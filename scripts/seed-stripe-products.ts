import { getUncachableStripeClient } from '../server/stripeClient';
import Stripe from 'stripe';

let stripe: Stripe;

interface PlanConfig {
  name: string;
  productId: string;
  priceAmount: number;
  interval: 'month' | 'year';
  features: string[];
}

const plans: PlanConfig[] = [
  {
    name: 'Pro Monthly',
    productId: 'prod_pro_monthly',
    priceAmount: 3999, // Updated to $39.99
    interval: 'month',
    features: [
      'Unlimited spec sheets',
      'Unlimited data imports',
      'Custom branding',
      'Priority support',
      'Advanced export options'
    ]
  },
  {
    name: 'Pro Annual',
    productId: 'prod_pro_annual',
    priceAmount: 39999, // Updated to $399.99
    interval: 'year',
    features: [
      'Everything in Pro Monthly',
      '2 months free', // You might want to update this text if the math changes, but $399.99 vs $479.88 (39.99*12) is roughly ~2 months free (17% off).
      'Priority onboarding'
    ]
  }
];

async function findOrCreateProduct(plan: PlanConfig): Promise<Stripe.Product> {
  try {
    const products = await stripe.products.list({ limit: 100 });
    const existing = products.data.find(p => p.metadata?.planId === plan.productId);

    if (existing) {
      console.log(`Found existing product: ${existing.name} (${existing.id})`);
      return existing;
    }

    const product = await stripe.products.create({
      name: plan.name,
      description: `SpecSheet Builder ${plan.name} Plan`,
      metadata: {
        planId: plan.productId,
        features: JSON.stringify(plan.features)
      }
    });

    console.log(`Created product: ${product.name} (${product.id})`);
    return product;
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
}

async function findOrCreatePrice(product: Stripe.Product, plan: PlanConfig): Promise<Stripe.Price> {
  try {
    const prices = await stripe.prices.list({ 
      product: product.id,
      limit: 100 
    });

    const existing = prices.data.find(p => 
      p.unit_amount === plan.priceAmount && 
      p.recurring?.interval === plan.interval &&
      p.active
    );

    if (existing) {
      console.log(`Found existing price: ${existing.id} ($${plan.priceAmount / 100}/${plan.interval})`);
      return existing;
    }

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: plan.priceAmount,
      currency: 'usd',
      recurring: {
        interval: plan.interval
      },
      metadata: {
        planId: plan.productId
      }
    });

    console.log(`Created price: ${price.id} ($${plan.priceAmount / 100}/${plan.interval})`);
    return price;
  } catch (error) {
    console.error('Error creating price:', error);
    throw error;
  }
}

async function main() {
  console.log('Seeding Stripe products and prices...\n');

  stripe = await getUncachableStripeClient();

  for (const plan of plans) {
    console.log(`\nProcessing ${plan.name}...`);
    const product = await findOrCreateProduct(plan);
    await findOrCreatePrice(product, plan);
  }

  console.log('\n✓ Stripe products seeded successfully!');
  console.log('\nThe stripe-replit-sync package will automatically sync via webhook.');
}

main().catch(console.error);