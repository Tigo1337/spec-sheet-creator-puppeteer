import Stripe from 'stripe';

// 1. Validate Keys exist
if (!process.env.STRIPE_SECRET_KEY) {
  // If this error triggers, check your Replit Secrets!
  throw new Error("Missing STRIPE_SECRET_KEY in environment variables");
}

// 2. Export the Stripe instance directly
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-08-27.basil', 
  typescript: true,
});

// 3. Helper to get the client (matches your old signature to prevent breaking other files)
export async function getUncachableStripeClient() {
  return stripe;
}

// 4. Helper to get keys
export async function getStripePublishableKey() {
  const key = process.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!key) throw new Error("Missing VITE_STRIPE_PUBLISHABLE_KEY");
  return key;
}

export async function getStripeSecretKey() {
  return process.env.STRIPE_SECRET_KEY!;
}

// 5. Stripe Sync Helper (keeps your DB in sync)
// Removed stripe-replit-sync for manual Stripe integration
export async function getStripeSync() {
  return null;
}