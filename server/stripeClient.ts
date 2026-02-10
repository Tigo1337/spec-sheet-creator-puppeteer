import Stripe from 'stripe';
import { logger } from './utils/logger';

const isDevelopment = process.env.NODE_ENV !== 'production';

const stripeSecretKey = isDevelopment
  ? (process.env.STRIPE_SECRET_KEY_DEV || process.env.STRIPE_SECRET_KEY)
  : process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  const envType = isDevelopment ? 'development' : 'production';
  throw new Error(`Missing Stripe Secret Key for ${envType} environment. Please set ${isDevelopment ? 'STRIPE_SECRET_KEY_DEV' : 'STRIPE_SECRET_KEY'} in your environment.`);
}

logger.info(`Stripe configured for ${isDevelopment ? 'development (sandbox)' : 'production (live)'} mode`);

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-08-27.basil', 
  typescript: true,
});

export async function getUncachableStripeClient() {
  return stripe;
}

export async function getStripePublishableKey() {
  const key = isDevelopment
    ? (process.env.VITE_STRIPE_PUBLISHABLE_KEY_DEV || process.env.VITE_STRIPE_PUBLISHABLE_KEY)
    : process.env.VITE_STRIPE_PUBLISHABLE_KEY;

  if (!key) {
    const envType = isDevelopment ? 'development' : 'production';
    throw new Error(`Missing Stripe Publishable Key for ${envType} environment.`);
  }
  return key;
}

export async function getStripeSecretKey() {
  return stripeSecretKey;
}

export function getStripeWebhookSecret(): string {
  const secret = isDevelopment
    ? (process.env.STRIPE_WEBHOOK_SECRET_DEV || process.env.STRIPE_WEBHOOK_SECRET)
    : process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    const envType = isDevelopment ? 'development' : 'production';
    throw new Error(`Missing Stripe Webhook Secret for ${envType} environment.`);
  }
  return secret;
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: stripeSecretKey!,
    });
  }
  return stripeSync;
}
