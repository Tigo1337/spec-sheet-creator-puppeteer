import type { Express } from "express";
import { createServer, type Server } from "http";
import { getAuth, clerkClient } from "@clerk/express";
import { storage } from "./storage";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { insertTemplateSchema, insertSavedDesignSchema } from "@shared/schema";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // Template CRUD routes
  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await storage.getTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:id", async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching template:", error);
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  app.post("/api/templates", async (req, res) => {
    try {
      const parseResult = insertTemplateSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.message });
      }
      const template = await storage.createTemplate(parseResult.data);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating template:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.put("/api/templates/:id", async (req, res) => {
    try {
      const template = await storage.updateTemplate(req.params.id, req.body);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error updating template:", error);
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/templates/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting template:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Saved Designs CRUD routes (user-specific with Clerk authentication)
  app.get("/api/designs", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const designs = await storage.getDesignsByUser(auth.userId);
      res.json(designs);
    } catch (error) {
      console.error("Error fetching designs:", error);
      res.status(500).json({ error: "Failed to fetch designs" });
    }
  });

  app.get("/api/designs/:id", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const design = await storage.getDesign(req.params.id, auth.userId);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      res.json(design);
    } catch (error) {
      console.error("Error fetching design:", error);
      res.status(500).json({ error: "Failed to fetch design" });
    }
  });

  app.post("/api/designs", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const parseResult = insertSavedDesignSchema.safeParse({
        ...req.body,
        userId: auth.userId,
      });
      if (!parseResult.success) {
        return res.status(400).json({ error: parseResult.error.message });
      }
      const design = await storage.createDesign(parseResult.data);
      res.status(201).json(design);
    } catch (error) {
      console.error("Error creating design:", error);
      res.status(500).json({ error: "Failed to create design" });
    }
  });

  app.put("/api/designs/:id", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const design = await storage.updateDesign(req.params.id, auth.userId, req.body);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      res.json(design);
    } catch (error) {
      console.error("Error updating design:", error);
      res.status(500).json({ error: "Failed to update design" });
    }
  });

  app.delete("/api/designs/:id", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      const deleted = await storage.deleteDesign(req.params.id, auth.userId);
      if (!deleted) {
        return res.status(404).json({ error: "Design not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting design:", error);
      res.status(500).json({ error: "Failed to delete design" });
    }
  });

  // Object Storage routes - Public file serving
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Object Storage routes - Private object serving (public access for this MVP)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Object Storage routes - Upload URL generation
  app.post("/api/objects/upload", async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  // Object Storage routes - Update object after upload
  app.put("/api/objects/uploaded", async (req, res) => {
    if (!req.body.objectURL) {
      return res.status(400).json({ error: "objectURL is required" });
    }

    try {
      const objectPath = objectStorageService.normalizeObjectEntityPath(
        req.body.objectURL
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error processing uploaded object:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ============================================
  // Stripe Checkout Routes
  // ============================================

  // Get Stripe publishable key for frontend
  app.get("/api/stripe/config", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting Stripe config:", error);
      res.status(500).json({ error: "Failed to get Stripe configuration" });
    }
  });

  // Get or create user in database (called after Clerk authentication)
  app.post("/api/users/sync", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      // Get user from Clerk to get email
      const clerkUser = await clerkClient.users.getUser(auth.userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;

      if (!email) {
        return res.status(400).json({ error: "User email not found" });
      }

      // Check if user exists in our database
      let user = await storage.getUser(auth.userId);

      if (!user) {
        // Create new user
        user = await storage.createUser({
          id: auth.userId,
          email,
          plan: "free",
          planStatus: "active",
        });
      }

      res.json(user);
    } catch (error) {
      console.error("Error syncing user:", error);
      res.status(500).json({ error: "Failed to sync user" });
    }
  });

  // Get current user's subscription status
  app.get("/api/subscription", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(auth.userId);
      if (!user) {
        return res.json({ subscription: null, plan: "free" });
      }

      res.json({
        plan: user.plan,
        planStatus: user.planStatus,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ error: "Failed to fetch subscription" });
    }
  });

  // Create Stripe checkout session
  app.post("/api/checkout", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { priceId } = req.body;
      if (!priceId) {
        return res.status(400).json({ error: "Price ID is required" });
      }

      // Get or create user
      let user = await storage.getUser(auth.userId);
      
      if (!user) {
        // Get email from Clerk
        const clerkUser = await clerkClient.users.getUser(auth.userId);
        const email = clerkUser.emailAddresses[0]?.emailAddress;
        
        if (!email) {
          return res.status(400).json({ error: "User email not found" });
        }

        user = await storage.createUser({
          id: auth.userId,
          email,
          plan: "free",
          planStatus: "active",
        });
      }

      // Create or get Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(user.email, user.id);
        await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }

      // Get base URL for redirects
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const baseUrl = `${protocol}://${host}`;

      // Create checkout session
      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        `${baseUrl}/pricing`,
        auth.userId
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  // Create customer portal session for managing subscription
  app.post("/api/customer-portal", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await storage.getUser(auth.userId);
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ error: "No subscription found" });
      }

      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const baseUrl = `${protocol}://${host}`;

      const session = await stripeService.createCustomerPortalSession(
        user.stripeCustomerId,
        `${baseUrl}/editor`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ error: "Failed to create portal session" });
    }
  });

  return httpServer;
}
