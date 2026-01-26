/**
 * Commerce/Payment API routes
 * Handles Stripe checkout, subscription management, and pricing plans
 */

import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { storage } from "../storage";
import { stripeService } from "../stripeService";
import { getStripePublishableKey } from "../stripeClient";
import { normalizeEmail } from "../utils/helpers";

const router = Router();

/**
 * GET /api/plans
 * Get available pricing plans from Stripe
 */
router.get("/plans", async (req, res) => {
  res.json(await stripeService.getActivePrices());
});

/**
 * GET /api/stripe/config
 * Get Stripe publishable key for client-side initialization
 */
router.get("/stripe/config", async (req, res) => {
  res.json({ publishableKey: await getStripePublishableKey() });
});

/**
 * GET /api/subscription
 * Get current user's subscription details
 */
router.get("/subscription", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  const user = await storage.getUser(auth.userId);
  res.json(user ? {
    plan: user.plan,
    planStatus: user.planStatus,
    stripeCustomerId: user.stripeCustomerId,
    stripeSubscriptionId: user.stripeSubscriptionId,
    aiCredits: user.aiCredits || 0,
    aiCreditsLimit: user.aiCreditsLimit || 0,
    aiCreditsResetDate: user.aiCreditsResetDate,
    pdfUsageCount: user.pdfUsageCount || 0,
    pdfUsageResetDate: user.pdfUsageResetDate
  } : { subscription: null, plan: "free" });
});

/**
 * POST /api/checkout
 * Create a Stripe checkout session for subscription
 */
router.post("/checkout", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  let user = await storage.getUser(auth.userId);
  if (!user) {
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    user = await storage.createUser({
      id: auth.userId,
      email: clerkUser.emailAddresses[0].emailAddress,
      plan: "free",
      planStatus: "active"
    });
  }

  if (!user.stripeCustomerId) {
    const customer = await stripeService.createCustomer(user.email, user.id);
    await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
    user.stripeCustomerId = customer.id;
  }

  const baseUrl = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['x-forwarded-host'] || req.get('host')}`;
  const session = await stripeService.createCheckoutSession(
    user.stripeCustomerId,
    req.body.priceId,
    `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    `${baseUrl}/pricing`,
    auth.userId
  );

  res.json({ url: session.url });
});

/**
 * POST /api/customer-portal
 * Create a Stripe customer portal session for subscription management
 */
router.post("/customer-portal", async (req, res) => {
  const auth = getAuth(req);
  const user = await storage.getUser(auth.userId || "");
  if (!user?.stripeCustomerId) return res.status(400).json({ error: "No sub" });

  const baseUrl = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['x-forwarded-host'] || req.get('host')}`;
  const session = await stripeService.createCustomerPortalSession(user.stripeCustomerId, `${baseUrl}/editor`);
  res.json({ url: session.url });
});

/**
 * POST /api/users/sync
 * Sync user from Clerk with anti-abuse checks
 */
router.post("/users/sync", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  const { fingerprint } = req.body;
  let user = await storage.getUser(auth.userId);

  if (!user) {
    const clerkUser = await clerkClient.users.getUser(auth.userId);
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) return res.status(400).json({ error: "No email" });

    const normalized = normalizeEmail(email);

    // WHITELIST: Allow specific accounts to bypass trial abuse checks
    const isWhitelisted = email.includes("tigolivier1337");
    let initialCredits = 5000;

    if (!isWhitelisted) {
      // 1. Check if normalized email already exists
      const existingNormalized = await storage.getUserByNormalizedEmail(normalized);
      // 2. Check if device fingerprint already exists
      const existingFingerprint = fingerprint ? await storage.getUserByFingerprint(fingerprint) : null;
      // 3. Check Stripe for existing customer with same email
      const stripeCustomer = await stripeService.findCustomerByEmail(email);

      if (existingNormalized || existingFingerprint || stripeCustomer) {
        console.warn(`Potential trial abuse detected for ${email}. Setting 0 initial credits.`);
        initialCredits = 0;
      }
    }

    user = await storage.createUser({
      id: auth.userId,
      email,
      normalizedEmail: normalized,
      deviceFingerprint: fingerprint || null,
      plan: "free",
      planStatus: "active",
      aiCredits: initialCredits
    });
  }

  res.json(user);
});

export default router;
