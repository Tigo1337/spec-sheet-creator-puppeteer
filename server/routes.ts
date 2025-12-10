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
import puppeteer from "puppeteer";
import path from "path";
import { nanoid } from "nanoid"; 

import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // ============================================
  // 0. Dynamic QR Code Redirection (Public)
  // ============================================
  app.get("/q/:id", async (req, res) => {
    const shortId = req.params.id;

    try {
      // NOTE: For MVP, we mock the DB lookup. 
      // To fully implement, you must add `getQRCode(id)` to your `server/storage.ts`
      // const qrRecord = await storage.getQRCode(shortId);

      const qrRecord = { destinationUrl: "https://doculoom.io" }; // Default fallback for testing

      if (qrRecord) {
         // 301 Redirect: Browser will cache this redirect. 
         // Use 302 if you want to track analytics on every scan.
         return res.redirect(302, qrRecord.destinationUrl);
      }

      res.status(404).send("QR Code link not found");
    } catch (error) {
      console.error("QR Redirect Error:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // ============================================
  // 1. PDF Export Route (High Quality + CMYK)
  // ============================================
  app.post("/api/export/pdf", async (req, res) => {
    // Destructure colorModel (default to rgb)
    const { html, width, height, pageCount = 1, scale = 2, colorModel = 'rgb' } = req.body;

    if (!html || !width || !height) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
      console.log(`-> Generating PDF (Scale: ${scale}x, Mode: ${colorModel.toUpperCase()})...`);

      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.NIX_CHROMIUM_WRAPPER,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--font-render-hinting=none',
        ],
      });

      const page = await browser.newPage();

      await page.setViewport({
        width: Math.ceil(width),
        height: Math.ceil(height),
        deviceScaleFactor: Number(scale),
      });

      await page.setContent(html, {
        waitUntil: ["load", "networkidle0"],
        timeout: 60000,
      });

      const pdfData = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
      });

      await browser.close();

      let finalPdfBuffer = Buffer.from(pdfData);

      // --- CMYK POST-PROCESSING ---
      if (colorModel === 'cmyk') {
        console.log("-> Converting to CMYK via Ghostscript...");

        const timestamp = Date.now();
        // Use a safe temp directory path
        const inputPath = path.resolve(`/tmp/input_${timestamp}.pdf`);
        const outputPath = path.resolve(`/tmp/output_${timestamp}.pdf`);

        try {
            // 1. Write the RGB PDF to disk
            await fs.promises.writeFile(inputPath, finalPdfBuffer);

            // 2. Run Ghostscript command
            // -dPDFSETTINGS=/prepress ensures high quality
            // -sColorConversionStrategy=CMYK forces conversion
            await execAsync(
                `gs -o "${outputPath}" -sDEVICE=pdfwrite -sColorConversionStrategy=CMYK -dProcessColorModel=/DeviceCMYK -dPDFSETTINGS=/prepress -dSAFER -dBATCH -dNOPAUSE "${inputPath}"`
            );

            // 3. Read back the converted file
            finalPdfBuffer = await fs.promises.readFile(outputPath);

            // 4. Cleanup temp files
            await fs.promises.unlink(inputPath);
            await fs.promises.unlink(outputPath);

            console.log("-> CMYK Conversion Successful.");
        } catch (gsError) {
            console.error("Ghostscript conversion failed, falling back to RGB:", gsError);
            // Attempt cleanup even if it fails
            try {
                if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath);
                if (fs.existsSync(outputPath)) await fs.promises.unlink(outputPath);
            } catch (e) { /* ignore cleanup errors */ }
        }
      }

      console.log(`-> Sending Final PDF (${finalPdfBuffer.length} bytes)`);

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=export.pdf",
        "Content-Length": String(finalPdfBuffer.length),
      });

      res.send(finalPdfBuffer);

    } catch (error) {
      console.error("PDF Generation Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate PDF" });
      }
    }
  });

  // ============================================
  // 2. Preview Generation Route (Thumbnail)
  // ============================================
  app.post("/api/export/preview", async (req, res) => {
    const { html, width, height } = req.body;

    if (!html || !width || !height) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
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

      // Lower scale for thumbnails (faster/smaller)
      await page.setViewport({
        width: Math.ceil(width),
        height: Math.ceil(height),
        deviceScaleFactor: 0.5, 
      });

      await page.setContent(html, {
        waitUntil: ["load", "networkidle0"],
        timeout: 30000,
      });

      // Take Screenshot as Base64 String
      const base64String = await page.screenshot({
        type: "jpeg",
        quality: 70,
        fullPage: true,
        encoding: "base64"
      });

      await browser.close();

      // Return JSON so frontend can safely parse it
      res.json({ 
        image: `data:image/jpeg;base64,${base64String}` 
      });

    } catch (error) {
      console.error("Preview Generation Error:", error);
      res.status(500).json({ error: "Failed to generate preview" });
    }
  });

  // ============================================
  // QR Code CRUD API
  // ============================================
  app.post("/api/qrcodes", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

      const { destinationUrl } = req.body;
      if (!destinationUrl) return res.status(400).json({ error: "Destination URL is required" });

      const shortId = nanoid(8); // Generate short ID like "x8k29a"

      // TODO: Call storage.createQRCode(...) here to persist to DB
      // const newQR = await storage.createQRCode({ id: shortId, ... });

      // Mock response for now
      const newQR = { id: shortId, destinationUrl };

      res.status(201).json(newQR);
    } catch (error) {
      res.status(500).json({ error: "Failed to create QR code" });
    }
  });

  // ============================================
  // Standard CRUD Routes
  // ============================================

  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await storage.getTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:id", async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  app.post("/api/templates", async (req, res) => {
    try {
      const parseResult = insertTemplateSchema.safeParse(req.body);
      if (!parseResult.success) return res.status(400).json({ error: parseResult.error.message });
      const template = await storage.createTemplate(parseResult.data);
      res.status(201).json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.put("/api/templates/:id", async (req, res) => {
    try {
      const template = await storage.updateTemplate(req.params.id, req.body);
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/templates/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTemplate(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Template not found" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  app.post("/api/designs", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

      const parseResult = insertSavedDesignSchema.safeParse({
        ...req.body,
        userId: auth.userId,
      });

      if (!parseResult.success) {
          console.error("Design Validation Failed:", parseResult.error.message);
          return res.status(400).json({ error: parseResult.error.message });
      }

      const design = await storage.createDesign(parseResult.data);
      res.status(201).json(design);
    } catch (error: any) {
      console.error("Database Insert Error:", error); // UPDATED LOGGING
      // Check for specific column missing error
      if (error.message?.includes("column") && error.message?.includes("does not exist")) {
         return res.status(500).json({ error: "Database schema mismatch. Please run migrations." });
      }
      res.status(500).json({ error: "Failed to create design" });
    }
  });

  app.get("/api/designs", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const designs = await storage.getDesignsByUser(auth.userId);
      res.json(designs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch designs" });
    }
  });

  app.get("/api/designs/:id", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const design = await storage.getDesign(req.params.id, auth.userId);
      if (!design) return res.status(404).json({ error: "Design not found" });
      res.json(design);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch design" });
    }
  });

  app.post("/api/designs", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const parseResult = insertSavedDesignSchema.safeParse({
        ...req.body,
        userId: auth.userId,
      });
      if (!parseResult.success) return res.status(400).json({ error: parseResult.error.message });
      const design = await storage.createDesign(parseResult.data);
      res.status(201).json(design);
    } catch (error) {
      res.status(500).json({ error: "Failed to create design" });
    }
  });

  app.put("/api/designs/:id", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const design = await storage.updateDesign(req.params.id, auth.userId, req.body);
      if (!design) return res.status(404).json({ error: "Design not found" });
      res.json(design);
    } catch (error) {
      res.status(500).json({ error: "Failed to update design" });
    }
  });

  app.delete("/api/designs/:id", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const deleted = await storage.deleteDesign(req.params.id, auth.userId);
      if (!deleted) return res.status(404).json({ error: "Design not found" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete design" });
    }
  });

  // Object Storage routes
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) return res.status(404).json({ error: "File not found" });
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) return res.sendStatus(404);
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  app.put("/api/objects/uploaded", async (req, res) => {
    if (!req.body.objectURL) return res.status(400).json({ error: "objectURL is required" });
    try {
      const objectPath = objectStorageService.normalizeObjectEntityPath(req.body.objectURL);
      res.status(200).json({ objectPath });
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Stripe
  app.get("/api/stripe/config", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
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
        user = await storage.createUser({ id: auth.userId, email, plan: "free", planStatus: "active" });
      }
      res.json(user);
    } catch (error) {
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
      res.status(500).json({ error: "Failed to create portal session" });
    }
  });

  return httpServer;
}