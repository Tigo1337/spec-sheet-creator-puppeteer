import { getUncachableStripeClient, getStripeWebhookSecret } from './stripeClient';
import { storage } from './storage';
import { logger } from './utils/logger';
import Stripe from 'stripe';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error('STRIPE WEBHOOK ERROR: Payload must be a Buffer.');
    }

    const stripe = await getUncachableStripeClient();
    const webhookSecret = getStripeWebhookSecret();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      logger.error({ err }, 'Webhook signature verification failed');
      throw err;
    }

    await WebhookHandlers.handleEvent(event, stripe);
  }

  static async handleEvent(event: Stripe.Event, stripe: Stripe): Promise<void> {
    logger.info({ eventType: event.type }, 'Processing Stripe event');

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
        logger.info({ eventType: event.type }, 'Unhandled Stripe event type');
    }
  }

  static getCreditLimitForPlan(plan: string): number {
    if (plan.includes('scale') || plan.includes('business')) {
        return 10000 * 100;
    } 
    if (plan.includes('pro')) {
        return 1000 * 100;
    }
    return 50 * 100; 
  }

  static async handleCheckoutCompleted(session: Stripe.Checkout.Session, stripe: Stripe): Promise<void> {
    logger.info({ sessionId: session.id }, 'Checkout session completed');
    if (session.mode !== 'subscription') return;

    const userId = session.metadata?.clerk_user_id;
    if (!userId) {
      logger.error('No clerk_user_id in checkout session metadata');
      return;
    }

    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const productId = subscription.items.data[0]?.price.product as string;
      const product = await stripe.products.retrieve(productId);

      let planName = product.metadata?.planId || 'free';
      const creditLimit = WebhookHandlers.getCreditLimitForPlan(planName);

      await storage.updateUserStripeInfo(userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan: planName,
        planStatus: subscription.status,
      });

      await storage.updateUser(userId, {
          aiCredits: creditLimit,
          aiCreditsLimit: creditLimit,
          aiCreditsResetDate: new Date()
      });

      logger.info({ userId, plan: planName, credits: creditLimit }, 'User plan updated after checkout');
    } catch (error) {
      logger.error({ err: error }, 'Error handling checkout completed');
    }
  }

  static async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    logger.info({ subscriptionId: subscription.id }, 'Subscription updated');
    const customerId = subscription.customer as string;

    try {
      const user = await WebhookHandlers.findUserByCustomerId(customerId);
      if (!user) return;

      const stripe = await getUncachableStripeClient();
      const productId = subscription.items.data[0]?.price.product as string;
      const product = await stripe.products.retrieve(productId);

      let planName = product.metadata?.planId || 'free';

      const status = subscription.status;
      const planStatus = ['active', 'trialing'].includes(status) ? 'active' : status;

      const creditLimit = WebhookHandlers.getCreditLimitForPlan(planName);

      await storage.updateUserStripeInfo(user.id, {
        stripeSubscriptionId: subscription.id,
        planStatus: planStatus,
        plan: planName 
      });

      await storage.updateUser(user.id, {
          aiCreditsLimit: creditLimit
      });

      logger.info({ userId: user.id, plan: planName, status: planStatus }, 'Subscription updated for user');
    } catch (error) {
      logger.error({ err: error }, 'Error handling subscription update');
    }
  }

  static async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    logger.info({ invoiceId: invoice.id }, 'Invoice payment succeeded');
    const customerId = invoice.customer as string;

    try {
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (!user) return;

        if ((invoice as any).subscription) {
            const limit = WebhookHandlers.getCreditLimitForPlan(user.plan);

            await storage.updateUser(user.id, {
                aiCredits: limit,
                aiCreditsResetDate: new Date(),
                planStatus: 'active'
            });
            logger.info({ userId: user.id, credits: limit }, 'Credits refilled for user');
        }
    } catch (error) {
        logger.error({ err: error }, 'Error processing invoice payment');
    }
  }

  static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const customerId = subscription.customer as string;
    try {
      const user = await WebhookHandlers.findUserByCustomerId(customerId);
      if (!user) return;

      await storage.updateUserStripeInfo(user.id, {
        stripeSubscriptionId: null,
        plan: 'free',
        planStatus: 'canceled',
      });

      await storage.updateUser(user.id, {
          aiCredits: 50 * 100,
          aiCreditsLimit: 50 * 100
      });

      logger.info({ userId: user.id }, 'Subscription deleted, reverted to free plan');
    } catch (error) {
      logger.error({ err: error }, 'Error handling subscription deletion');
    }
  }

  static async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
     const customerId = invoice.customer as string;
     try {
         const user = await WebhookHandlers.findUserByCustomerId(customerId);
         if(user) {
           await storage.updateUserStripeInfo(user.id, { planStatus: 'past_due' });
           logger.warn({ userId: user.id }, 'Invoice payment failed, marked as past_due');
         }
     } catch(error) {
       logger.error({ err: error }, 'Error handling invoice payment failure');
     }
  }

  static async findUserByCustomerId(customerId: string): Promise<{ id: string; plan: string } | null> {
    const user = await storage.getUserByStripeCustomerId(customerId);
    return user ? { id: user.id, plan: user.plan } : null;
  }
}
