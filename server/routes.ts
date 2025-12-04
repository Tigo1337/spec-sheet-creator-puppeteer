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
import puppeteer from "puppeteer"; // Ensure this is installed

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // ============================================
  // PDF Export Route (Puppeteer)
  // ============================================
  app.post("/api/export/pdf", async (req, res) => {
    console.log("-> PDF Generation Request Received");

    // UPDATED: Destructure 'scale' from request body (default to 2)
    const { html, width, height, pageCount = 1, scale = 2 } = req.body;

    if (!html || !width || !height) {
      console.error("-> PDF Error: Missing parameters");
      return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
      console.log(`-> Launching Puppeteer (Width: ${width}, Height: ${height}, Pages: ${pageCount}, Scale: ${scale}x)...`);

      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--font-render-hinting=none',
        ],
      });

      const page = await browser.newPage();

      // UPDATED: Use the scale parameter for deviceScaleFactor
      await page.setViewport({
        width: Math.ceil(width),
        height: Math.ceil(height),
        deviceScaleFactor: Number(scale),
      });

      await page.setContent(html, {
        waitUntil: ["load", "networkidle0"],
        timeout: 60000, 
      });

      console.log("-> Content loaded, printing PDF...");

      const pdfData = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
      });

      await browser.close();

      // --- CRITICAL FIX: Convert to Buffer ---
      const pdfBuffer = Buffer.from(pdfData);

      console.log(`-> PDF Generated Successfully. Size: ${pdfBuffer.length} bytes`);

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=export.pdf",
        "Content-Length": String(pdfBuffer.length),
      });

      res.send(pdfBuffer);

    } catch (error) {
      console.error("-> PDF Generation Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate PDF" });
      }
    }
  });

  // ... (Keep the rest of your existing routes below) ...

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

  // Saved Designs CRUD routes
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

  // Object Storage routes
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

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.put("/api/objects/uploaded", async (req, res) => {
    if (!req.body.objectURL) {
      return res.status(400).json({ error: "objectURL is required" });
    }
    try {
      const objectPath = objectStorageService.normalizeObjectEntityPath(req.body.objectURL);
      res.status(200).json({ objectPath: objectPath });
    } catch (error) {
      console.error("Error processing uploaded object:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Stripe
  app.get("/api/stripe/config", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting Stripe config:", error);
      res.status(500).json({ error: "Failed to get Stripe configuration" });
    }
  });

  app.post("/api/users/sync", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const clerkUser = await clerkClient.users.getUser(auth.userId);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) return res.status(400).json({ error: "User email not found" });
      let user = await storage.getUser(auth.userId);
      if (!user) {
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

  app.get("/api/subscription", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const user = await storage.getUser(auth.userId);
      if (!user) return res.json({ subscription: null, plan: "free" });
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

  app.post("/api/checkout", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const { priceId } = req.body;
      if (!priceId) return res.status(400).json({ error: "Price ID is required" });
      let user = await storage.getUser(auth.userId);
      if (!user) {
        const clerkUser = await clerkClient.users.getUser(auth.userId);
        const email = clerkUser.emailAddresses[0]?.emailAddress;
        if (!email) return res.status(400).json({ error: "User email not found" });
        user = await storage.createUser({ id: auth.userId, email, plan: "free", planStatus: "active" });
      }
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(user.email, user.id);
        await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
        customerId = customer.id;
      }
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.get('host');
      const baseUrl = `${protocol}://${host}`;
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

  app.post("/api/customer-portal", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const user = await storage.getUser(auth.userId);
      if (!user?.stripeCustomerId) return res.status(400).json({ error: "No subscription found" });
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