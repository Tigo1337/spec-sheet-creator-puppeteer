import type { Express } from "express";
import { createServer, type Server } from "http";
import { getAuth, clerkClient } from "@clerk/express";
import { storage } from "./storage";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";
import { insertTemplateSchema, insertSavedDesignSchema, insertQrCodeSchema } from "@shared/schema";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// --- STRICT QUEUE SYSTEM ---
// This acts as a bottleneck. It allows only 1 PDF generation at a time.
// This is critical for Replit/VPS to prevent CPU/RAM spikes.
const pdfQueue = {
  active: 0,
  limit: 1, 
  queue: [] as (() => void)[],

  async add<T>(task: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      if (this.queue.length > 0) {
        const next = this.queue.shift();
        next?.();
      }
    }
  }
};

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // ============================================
  // HEALTH CHECK ENDPOINT
  // Monitoring services (e.g. UptimeRobot) should ping this
  // ============================================
  app.get("/health", async (req, res) => {
    const health = {
      uptime: process.uptime(),
      timestamp: Date.now(),
      status: "OK",
      checks: {
        database: "unknown",
        stripe: "unknown"
      }
    };

    // 1. Check Database Connectivity
    try {
      // Using a known-safe query (fetching a non-existent ID returns undefined, not error)
      await storage.getUser("health-check-probe");
      health.checks.database = "connected";
    } catch (e) {
      health.checks.database = "disconnected";
      health.status = "DEGRADED";
      console.error("Health check failed: Database", e);
    }

    // 2. Check Stripe Config
    if (process.env.STRIPE_SECRET_KEY) {
        health.checks.stripe = "configured";
    } else {
        health.checks.stripe = "missing_key";
    }

    const httpCode = health.status === "OK" ? 200 : 503;
    res.status(httpCode).json(health);
  });

  // ============================================
  // 0. Dynamic QR Code Redirection (Public)
  // ============================================
  app.get("/q/:id", async (req, res) => {
    const shortId = req.params.id;

    try {
      const qrRecord = await storage.getQRCode(shortId);

      if (qrRecord) {
         storage.incrementQRCodeScan(shortId).catch(console.error);
         return res.redirect(302, qrRecord.destinationUrl);
      }

      res.status(404).send("QR Code link not found");
    } catch (error) {
      console.error("QR Redirect Error:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // ============================================
  // 1. PDF Export Route (STRICT QUEUE + FRESH BROWSER)
  // ============================================
  app.post("/api/export/pdf", async (req, res) => {
    const { html, width, height, scale = 2, colorModel = 'rgb' } = req.body;

    if (!html || !width || !height) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
      // 1. Enter the Queue (Wait for turn)
      const pdfBuffer = await pdfQueue.add(async () => {
        console.log(`-> Processing PDF. Queue waiting: ${pdfQueue.queue.length}`);

        // 2. Launch a FRESH browser for this specific request
        const browser = await puppeteer.launch({
          headless: true,
          executablePath: process.env.NIX_CHROMIUM_WRAPPER || puppeteer.executablePath(),
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--font-render-hinting=none',
            '--disable-extensions',
            '--no-first-run',
            '--no-zygote',
            '--single-process', 
          ],
        });

        try {
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

          await page.evaluate(async () => {
            await document.fonts.ready;
          });

          const data = await page.pdf({
            printBackground: true,
            preferCSSPageSize: true,
          });

          return Buffer.from(data);

        } finally {
          // 3. KILL the browser immediately after use
          await browser.close().catch(e => console.error("Error closing browser:", e));
        }
      });

      // --- CMYK POST-PROCESSING ---
      let finalBuffer = pdfBuffer;
      let usedColorModel = 'rgb'; 

      if (colorModel === 'cmyk') {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const inputPath = path.resolve(`/tmp/input_${timestamp}_${randomId}.pdf`);
        const outputPath = path.resolve(`/tmp/output_${timestamp}_${randomId}.pdf`);

        try {
            await fs.promises.writeFile(inputPath, finalBuffer);
            await execAsync(
                `gs -o "${outputPath}" -sDEVICE=pdfwrite -sColorConversionStrategy=CMYK -dProcessColorModel=/DeviceCMYK -dPDFSETTINGS=/prepress -dSAFER -dBATCH -dNOPAUSE "${inputPath}"`
            );
            finalBuffer = await fs.promises.readFile(outputPath);
            usedColorModel = 'cmyk';

            await fs.promises.unlink(inputPath).catch(() => {});
            await fs.promises.unlink(outputPath).catch(() => {});
        } catch (gsError) {
            console.error("Ghostscript conversion failed (using RGB):", gsError);
            if (fs.existsSync(inputPath)) await fs.promises.unlink(inputPath).catch(() => {});
        }
      }

      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=export.pdf",
        "Content-Length": String(finalBuffer.length),
        "X-Color-Model": usedColorModel,
      });
      res.send(finalBuffer);

    } catch (error) {
      console.error("PDF Export Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate PDF" });
      }
    }
  });

  // ============================================
  // 2. Preview Generation Route
  // ============================================
  app.post("/api/export/preview", async (req, res) => {
    const { html, width, height } = req.body;

    if (!html || !width || !height) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
      const base64String = await pdfQueue.add(async () => {
        const browser = await puppeteer.launch({
          headless: true,
          executablePath: process.env.NIX_CHROMIUM_WRAPPER || puppeteer.executablePath(),
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
        });

        try {
          const page = await browser.newPage();
          await page.setViewport({
            width: Math.ceil(width),
            height: Math.ceil(height),
            deviceScaleFactor: 0.5, 
          });

          await page.setContent(html, {
            waitUntil: ["load", "networkidle0"],
            timeout: 30000,
          });

          await page.evaluate(async () => {
            await document.fonts.ready;
          });

          return await page.screenshot({
            type: "jpeg",
            quality: 70,
            fullPage: true,
            encoding: "base64"
          });
        } finally {
          await browser.close();
        }
      });

      res.json({ image: `data:image/jpeg;base64,${base64String}` });

    } catch (error) {
      console.error("Preview Generation Error:", error);
      res.status(500).json({ error: "Failed to generate preview" });
    }
  });

  // ============================================
  // QR Code & Admin Routes
  // ============================================

  const adminUserId = process.env.ADMIN_USER_ID;

  app.post("/api/qrcodes", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const parseResult = insertQrCodeSchema.safeParse(req.body);
      if (!parseResult.success) return res.status(400).json({ error: parseResult.error.message });
      const newQR = await storage.createQRCode(auth.userId, parseResult.data.destinationUrl, parseResult.data.designId);
      res.status(201).json(newQR);
    } catch (error) {
      res.status(500).json({ error: "Failed to create QR code" });
    }
  });

  app.get("/api/qrcodes", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const codes = await storage.getQRCodesByUser(auth.userId);
      res.json(codes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch QR codes" });
    }
  });

  app.put("/api/qrcodes/:id", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const updated = await storage.updateQRCode(req.params.id, auth.userId, req.body.destinationUrl);
      if (!updated) return res.status(404).json({ error: "QR Code not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update QR code" });
    }
  });

  // Template Routes (Admin Secured)
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
      const auth = getAuth(req);
      if (!auth.userId || auth.userId !== adminUserId) return res.status(403).json({ error: "Unauthorized" });
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
      const auth = getAuth(req);
      if (!auth.userId || auth.userId !== adminUserId) return res.status(403).json({ error: "Unauthorized" });
      const template = await storage.updateTemplate(req.params.id, req.body);
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/templates/:id", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId || auth.userId !== adminUserId) return res.status(403).json({ error: "Unauthorized" });
      const deleted = await storage.deleteTemplate(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Template not found" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // User Designs Routes
  app.post("/api/designs", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const parseResult = insertSavedDesignSchema.safeParse({ ...req.body, userId: auth.userId });
      if (!parseResult.success) return res.status(400).json({ error: parseResult.error.message });
      const design = await storage.createDesign(parseResult.data);
      res.status(201).json(design);
    } catch (error: any) {
      if (error.message?.includes("column")) return res.status(500).json({ error: "Database schema mismatch." });
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

  // Standard routes
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