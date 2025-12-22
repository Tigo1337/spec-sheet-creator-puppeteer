import { getUncachableStripeClient } from './stripeClient';

export class StripeService {
  async createCustomer(email: string, userId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      metadata: { userId },
    });
  }

  async createCheckoutSession(
    customerId: string, 
    priceId: string, 
    successUrl: string, 
    cancelUrl: string,
    userId: string
  ) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        clerk_user_id: userId,
      },
      subscription_data: {
        metadata: {
          clerk_user_id: userId,
        },
      },
    });
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  // --- NEW METHOD ---
  async getActivePrices() {
    const stripe = await getUncachableStripeClient();
    const prices = await stripe.prices.list({
      active: true,
      limit: 100,
      expand: ['data.product'] 
    });

    // Filter to only include prices that have our specific metadata from the seed script
    return prices.data.filter(p => p.metadata?.planId || (p.product as any)?.metadata?.planId);
  }
}

export const stripeService = new StripeService();