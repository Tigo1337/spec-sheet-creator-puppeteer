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
import { logger } from "../utils/logger";

const router = Router();

/**
 * GET /api/plans
 * Get available pricing plans from Stripe
 */
router.get("/plans", async (req, res) => {
  try {
    const prices = await stripeService.getActivePrices();
    res.json(prices);
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Stripe /api/plans unavailable, returning empty list");
    res.json([]);
  }
});

/**
 * GET /api/stripe/config
 * Get Stripe publishable key for client-side initialization
 */
router.get("/stripe/config", async (req, res) => {
  try {
    res.json({ publishableKey: await getStripePublishableKey() });
  } catch (err: any) {
    logger.warn({ err: err?.message }, "Stripe publishable key unavailable");
    res.status(503).json({ error: "Stripe not configured" });
  }
});

/**
 * GET /api/subscription
 * Get current user's subscription details
 */
router.get("/subscription", async (req, res) => {
  try {
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
  } catch (err: any) {
    logger.error({ err: err?.message }, "Error fetching subscription");
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

/**
 * POST /api/checkout
 * Create a Stripe checkout session for subscription
 */
router.post("/checkout", async (req, res) => {
  try {
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
  } catch (err: any) {
    logger.error({ err: err?.message }, "Checkout session creation failed");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

/**
 * POST /api/customer-portal
 * Create a Stripe customer portal session for subscription management
 */
router.post("/customer-portal", async (req, res) => {
  try {
    const auth = getAuth(req);
    const user = await storage.getUser(auth.userId || "");
    if (!user?.stripeCustomerId) return res.status(400).json({ error: "No sub" });

    const baseUrl = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['x-forwarded-host'] || req.get('host')}`;
    const session = await stripeService.createCustomerPortalSession(user.stripeCustomerId, `${baseUrl}/editor`);
    res.json({ url: session.url });
  } catch (err: any) {
    logger.error({ err: err?.message }, "Customer portal session creation failed");
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

/**
 * POST /api/users/sync
 * Sync user from Clerk with anti-abuse checks
 */
router.post("/users/sync", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Auth required" });

    const { fingerprint } = req.body;
    let user = await storage.getUser(auth.userId);

    if (!user) {
      const clerkUser = await clerkClient.users.getUser(auth.userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) return res.status(400).json({ error: "No email" });

      const normalized = normalizeEmail(email);

      const isWhitelisted = email === process.env.ADMIN_EMAIL;
      let initialCredits = 5000;

      if (!isWhitelisted) {
        const existingNormalized = await storage.getUserByNormalizedEmail(normalized);
        const existingFingerprint = fingerprint ? await storage.getUserByFingerprint(fingerprint) : null;

        let stripeCustomer = null;
        try {
          stripeCustomer = await stripeService.findCustomerByEmail(email);
        } catch (stripeErr: any) {
          logger.warn({ err: stripeErr?.message }, "Stripe lookup skipped during user sync");
        }

        if (existingNormalized || existingFingerprint || stripeCustomer) {
          logger.warn({ email }, 'Potential trial abuse detected, setting 0 initial credits');
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
  } catch (err: any) {
    logger.error({ err: err?.message }, "User sync failed");
    res.status(500).json({ error: "User sync failed" });
  }
});

export default router;
