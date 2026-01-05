import { getUncachableStripeClient } from './stripeClient';

export class StripeService {
  async createCustomer(email: string, userId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      metadata: { userId },
    });
  }

  // NEW: Search for existing customers by email
  async findCustomerByEmail(email: string) {
    const stripe = await getUncachableStripeClient();
    const customers = await stripe.customers.list({
      email: email,
      limit: 1,
    });
    return customers.data[0];
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

  async getActivePrices() {
    const stripe = await getUncachableStripeClient();
    const prices = await stripe.prices.list({
      active: true,
      limit: 100,
      expand: ['data.product'] 
    });

    return prices.data.filter(p => p.metadata?.planId || (p.product as any)?.metadata?.planId);
  }
}

export const stripeService = new StripeService();