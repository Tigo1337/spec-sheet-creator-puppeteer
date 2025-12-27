import { getUncachableStripeClient } from './stripeClient';
import { storage } from './storage';
import Stripe from 'stripe';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error('STRIPE WEBHOOK ERROR: Payload must be a Buffer.');
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

  // --- HELPER TO DETERMINE CREDITS BASED ON PLAN ---
  // Returns credit limit in CENTS (x100)
  static getCreditLimitForPlan(plan: string): number {
    // Check for "scale" keyword in the plan ID (e.g. 'prod_scale_monthly')
    if (plan.includes('scale') || plan.includes('business')) {
        return 10000 * 100; // 10k credits (1,000,000 cents)
    } 
    // Check for "pro" keyword
    if (plan.includes('pro')) {
        return 1000 * 100; // 1k credits
    }
    // Default Free
    return 50 * 100; 
  }

  static async handleCheckoutCompleted(session: Stripe.Checkout.Session, stripe: Stripe): Promise<void> {
    console.log('Checkout session completed:', session.id);
    if (session.mode !== 'subscription') return;

    const userId = session.metadata?.clerk_user_id;
    if (!userId) {
      console.error('No clerk_user_id in checkout session metadata');
      return;
    }

    const subscriptionId = session.subscription as string;
    const customerId = session.customer as string;

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const productId = subscription.items.data[0]?.price.product as string;
      const product = await stripe.products.retrieve(productId);

      // UPDATED: Use the exact planId from metadata without renaming
      let planName = product.metadata?.planId || 'free';

      // DETERMINE CREDITS
      const creditLimit = WebhookHandlers.getCreditLimitForPlan(planName);

      await storage.updateUserStripeInfo(userId, {
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        plan: planName, // Stores exact ID like 'prod_scale_monthly'
        planStatus: subscription.status,
      });

      // Reset Credits on Upgrade/Checkout
      await storage.updateUser(userId, {
          aiCredits: creditLimit,
          aiCreditsLimit: creditLimit,
          aiCreditsResetDate: new Date()
      });

      console.log(`Updated user ${userId}: Plan ${planName}, Credits ${creditLimit}`);
    } catch (error) {
      console.error('Error handling checkout completed:', error);
    }
  }

  static async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    console.log('Subscription updated:', subscription.id);
    const customerId = subscription.customer as string;

    try {
      const user = await WebhookHandlers.findUserByCustomerId(customerId);
      if (!user) return;

      const stripe = await getUncachableStripeClient();
      const productId = subscription.items.data[0]?.price.product as string;
      const product = await stripe.products.retrieve(productId);

      // UPDATED: Use exact planId
      let planName = product.metadata?.planId || 'free';

      const status = subscription.status;
      const planStatus = ['active', 'trialing'].includes(status) ? 'active' : status;

      const creditLimit = WebhookHandlers.getCreditLimitForPlan(planName);

      await storage.updateUserStripeInfo(user.id, {
        stripeSubscriptionId: subscription.id,
        planStatus: planStatus,
        plan: planName 
      });

      // Update Limit immediately
      await storage.updateUser(user.id, {
          aiCreditsLimit: creditLimit
      });

      console.log(`Updated subscription for ${user.id}: ${planName} (${planStatus})`);
    } catch (error) {
      console.error('Error handling subscription update:', error);
    }
  }

  static async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    console.log('Invoice payment succeeded:', invoice.id);
    const customerId = invoice.customer as string;

    // REFILL CREDITS ON PAYMENT
    try {
        const user = await storage.getUserByStripeCustomerId(customerId);
        if (!user) return;

        // If it is a subscription invoice
        if (invoice.subscription) {
            const limit = WebhookHandlers.getCreditLimitForPlan(user.plan);

            await storage.updateUser(user.id, {
                aiCredits: limit, // Full reset to max
                aiCreditsResetDate: new Date(),
                planStatus: 'active'
            });
            console.log(`Refilled credits for user ${user.id} to ${limit}`);
        }
    } catch (error) {
        console.error("Error processing invoice payment:", error);
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

      // Reset to Free limits
      await storage.updateUser(user.id, {
          aiCredits: 50 * 100,
          aiCreditsLimit: 50 * 100
      });
    } catch (error) { console.error(error); }
  }

  static async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
     const customerId = invoice.customer as string;
     try {
         const user = await WebhookHandlers.findUserByCustomerId(customerId);
         if(user) await storage.updateUserStripeInfo(user.id, { planStatus: 'past_due' });
     } catch(e) { console.error(e); }
  }

  static async findUserByCustomerId(customerId: string): Promise<{ id: string; plan: string } | null> {
    const user = await storage.getUserByStripeCustomerId(customerId);
    return user ? { id: user.id, plan: user.plan } : null;
  }
}