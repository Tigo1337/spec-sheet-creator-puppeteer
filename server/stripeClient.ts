import Stripe from 'stripe';
import { logger } from './utils/logger';

const isDevelopment = process.env.NODE_ENV !== 'production';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

let stripe: Stripe | null = null;

if (stripeSecretKey) {
  logger.info(`Stripe configured for ${isDevelopment ? 'development (sandbox)' : 'production (live)'} mode`);
  stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2025-08-27.basil',
    typescript: true,
  });
} else {
  logger.warn('Stripe secret key not found, Stripe features will be unavailable');
}

function getStripeClient(): Stripe {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment.');
  }
  return stripe;
}

export { stripe };

export async function getUncachableStripeClient() {
  return getStripeClient();
}

export async function getStripePublishableKey() {
  const key = process.env.VITE_STRIPE_PUBLISHABLE_KEY;

  if (!key) {
    throw new Error('Missing Stripe Publishable Key.');
  }
  return key;
}

export async function getStripeSecretKey() {
  if (!stripeSecretKey) {
    throw new Error('Missing Stripe Secret Key.');
  }
  return stripeSecretKey;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error('Missing Stripe Webhook Secret.');
  }
  return secret;
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    if (!stripeSecretKey) {
      throw new Error('Stripe is not configured.');
    }
    const { StripeSync } = await import('stripe-replit-sync');

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey,
    });
  }
  return stripeSync;
}
