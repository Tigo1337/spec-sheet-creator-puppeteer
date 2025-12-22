import { getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import Stripe from 'stripe';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer.'
      );
    }

    const stripe = await getUncachableStripeClient();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('Missing STRIPE_WEBHOOK_SECRET in environment variables');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      throw err;
    }

    await WebhookHandlers.handleEvent(event, stripe);
  }

  static async handleEvent(event: Stripe.Event, stripe: Stripe): Promise<void> {
    console.log(`Processing Stripe event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await WebhookHandlers.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, stripe);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await WebhookHandlers.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await WebhookHandlers.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_succeeded':
        await WebhookHandlers.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await WebhookHandlers.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  static async handleCheckoutCompleted(session: Stripe.Checkout.Session, stripe: Stripe): Promise<void> {
    console.log('Checkout session completed:', session.id);

    if (session.mode !== 'subscription') {
      console.log('Checkout is not a subscription, skipping');
      return;
    }

    const userId = session.metadata?.clerk_user_id;
    if (!userId) {
      console.error('No clerk_user_id in checkout session metadata');
      return;
    }

    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const priceId = subscription.items.data[0]?.price.id;
      const productId = subscription.items.data[0]?.price.product as string;
      const product = await stripe.products.retrieve(productId);

      // FIXED: Normalize plan name to 'pro' if it matches specific IDs
      let planName = product.metadata?.planId || 'pro';
      if (planName === 'prod_pro_monthly' || planName === 'prod_pro_annual') {
        planName = 'pro';
      }

      await storage.updateUserStripeInfo(userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan: planName,
        planStatus: subscription.status,
      });

      console.log(`Updated user ${userId} with subscription ${subscriptionId}, plan: ${planName}`);
    } catch (error) {
      console.error('Error handling checkout completed:', error);
    }
  }

  static async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    console.log('Subscription updated:', subscription.id);

    const customerId = subscription.customer as string;

    try {
      const user = await WebhookHandlers.findUserByCustomerId(customerId);
      if (!user) {
        console.log('No user found for customer:', customerId);
        return;
      }

      const status = subscription.status;
      const planStatus = ['active', 'trialing'].includes(status) ? 'active' : status;

      await storage.updateUserStripeInfo(user.id, {
        stripeSubscriptionId: subscription.id,
        planStatus: planStatus,
      });

      console.log(`Updated subscription status for user ${user.id}: ${planStatus}`);
    } catch (error) {
      console.error('Error handling subscription update:', error);
    }
  }

  static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    console.log('Subscription deleted:', subscription.id);

    const customerId = subscription.customer as string;

    try {
      const user = await WebhookHandlers.findUserByCustomerId(customerId);
      if (!user) {
        console.log('No user found for customer:', customerId);
        return;
      }

      await storage.updateUserStripeInfo(user.id, {
        stripeSubscriptionId: null,
        plan: 'free',
        planStatus: 'canceled',
      });

      console.log(`Canceled subscription for user ${user.id}`);
    } catch (error) {
      console.error('Error handling subscription deletion:', error);
    }
  }

  static async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    console.log('Invoice payment succeeded:', invoice.id);
  }

  static async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    console.log('Invoice payment failed:', invoice.id);

    const customerId = invoice.customer as string;

    try {
      const user = await WebhookHandlers.findUserByCustomerId(customerId);
      if (!user) {
        console.log('No user found for customer:', customerId);
        return;
      }

      await storage.updateUserStripeInfo(user.id, {
        planStatus: 'past_due',
      });

      console.log(`Marked user ${user.id} as past_due due to failed payment`);
    } catch (error) {
      console.error('Error handling failed payment:', error);
    }
  }

  static async findUserByCustomerId(customerId: string): Promise<{ id: string } | null> {
    const user = await storage.getUserByStripeCustomerId(customerId);
    return user ? { id: user.id } : null;
  }
}