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
import { GoogleGenerativeAI } from "@google/generative-ai";

const execAsync = promisify(exec);

// --- STRICT QUEUE SYSTEM ---
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

// Helper to check admin status via Env Var OR Clerk Role
async function checkAdmin(userId: string): Promise<boolean> {
  // 1. Check Environment Variable (Fastest)
  if (process.env.ADMIN_USER_ID && userId === process.env.ADMIN_USER_ID) {
    return true;
  }

  // 2. Check Clerk Role (Database/Metadata source)
  try {
    const user = await clerkClient.users.getUser(userId);
    return user.publicMetadata?.role === "admin";
  } catch (error) {
    console.error("Failed to verify admin role:", error);
    return false;
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const objectStorageService = new ObjectStorageService();

  // --- INITIALIZE GEMINI 2.5 FLASH-LITE ---
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  const aiModel = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash-lite", 
    generationConfig: {
      responseMimeType: "application/json",
    }
  });

  // ============================================
  // HEALTH CHECK ENDPOINT
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

    try {
      await storage.getUser("health-check-probe");
      health.checks.database = "connected";
    } catch (e) {
      health.checks.database = "disconnected";
      health.status = "DEGRADED";
      console.error("Health check failed: Database", e);
    }

    if (process.env.STRIPE_SECRET_KEY) {
        health.checks.stripe = "configured";
    } else {
        health.checks.stripe = "missing_key";
    }

    const httpCode = health.status === "OK" ? 200 : 503;
    res.status(httpCode).json(health);
  });

  // ============================================
  // AI DATA ENRICHMENT ROUTE (UPDATED)
  // ============================================
  app.post("/api/ai/enrich-data", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

    // anchorColumn = The name of the column user picked (e.g. "SKU")
    const { rows, type, tone, anchorColumn, customFieldName } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No data rows provided" });
    }

    // Define preset prompts for friction-less UX
    const promptTemplates: Record<string, string> = {
      "marketing": "Write a compelling marketing description highlighting key features.",
      "seo": "Write a short, punchy, SEO-optimized product title (under 60 chars).",
      "features": "Extract the technical specs and return them as a bulleted list (use • character).",
      "email": "Write a short, persuasive sales email blurb introducing this product.",
      "social": "Write an engaging social media caption with relevant hashtags."
    };

    const selectedPrompt = promptTemplates[type] || promptTemplates["marketing"];

    // Cap at 50 rows for safety/performance
    const limitedRows = rows.slice(0, 50); 

    try {
      const prompt = `
        You are an expert content generator for product catalogs.

        TASK: ${selectedPrompt}
        TONE: ${tone || "Professional"}

        INSTRUCTIONS:
        1. I will provide a JSON array of data rows.
        2. For EACH row, look at ALL available fields (like Name, Dimensions, Material, etc) to understand the product.
        3. Generate the requested text for that specific product.
        4. OUTPUT FORMAT: A raw JSON array of strings. ["Text for Item 1", "Text for Item 2", ...].
        5. Do not include markdown formatting or keys, just the array of strings.

        DATA ROWS:
        ${JSON.stringify(limitedRows)}
      `;

      let result;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          result = await aiModel.generateContent(prompt);
          break;
        } catch (e: any) {
          if (e.status === 429 || e.status === 503 || e.message?.includes("429") || e.message?.includes("Overloaded")) {
            attempts++;
            if (attempts >= maxAttempts) throw e;
            const delay = Math.pow(2, attempts) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw e;
          }
        }
      }

      if (!result) throw new Error("AI Generation failed");

      const responseText = result.response.text();
      const cleanText = responseText.replace(/```json|```/g, "").trim();

      let generatedContent;
      try {
        generatedContent = JSON.parse(cleanText);
      } catch (e) {
        console.error("AI JSON Parse Error", e);
        return res.status(500).json({ error: "AI returned invalid format" });
      }

      if (!Array.isArray(generatedContent)) {
         return res.status(500).json({ error: "AI did not return an array" });
      }

      // --- MEMORY SAVE STEP (FIXED) ---
      // If user provided an Anchor Column (e.g. SKU), save this generation to DB
      if (anchorColumn && auth.userId) {
         try {
             const knowledgeItems = limitedRows.map((row: any, i: number) => {
                 const keyVal = row[anchorColumn]; // Get Value of SKU column (e.g. "123")
                 const content = generatedContent[i];

                 if (!keyVal || !content) return null;

                 return {
                     keyName: anchorColumn, // SAVE THE COLUMN NAME (e.g. "SKU")
                     productKey: String(keyVal).trim(),
                     fieldType: customFieldName || type, 
                     content: String(content)
                 };
             }).filter((item: any) => item !== null);

             if (knowledgeItems.length > 0) {
                 await storage.batchSaveProductKnowledge(auth.userId, knowledgeItems);
                 console.log(`[AI Memory] Saved ${knowledgeItems.length} items for user ${auth.userId}`);
             }
         } catch (saveError) {
             console.error("[AI Memory] Failed to save knowledge:", saveError);
             // Don't fail the request, just log it.
         }
      }

      res.json({ generatedContent });

    } catch (error) {
      console.error("Enrichment Error:", error);
      res.status(500).json({ error: "Failed to generate content" });
    }
  });

  // ============================================
  // AI KNOWLEDGE RETRIEVAL (UPDATED)
  // ============================================
  app.post("/api/ai/knowledge/check", async (req, res) => {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

      const { keys, keyName } = req.body;
      if (!keys || !Array.isArray(keys) || keys.length === 0 || !keyName) {
          return res.json({ matches: {} });
      }

      try {
          // Limit keys to prevent massive queries
          const lookupKeys = keys.slice(0, 100);

          // Pass keyName to storage
          const results = await storage.batchGetProductKnowledge(auth.userId, lookupKeys, keyName);

          // Group by Product Key
          // Output: { "SKU-123": { "Marketing Copy": "Desc...", "SEO Title": "Title..." } }
          const map: Record<string, Record<string, string>> = {};

          results.forEach(item => {
              if (!map[item.productKey]) map[item.productKey] = {};
              // If multiple entries exist, the query order (desc date) ensures we see the latest first.
              if (!map[item.productKey][item.fieldType]) {
                  map[item.productKey][item.fieldType] = item.content;
              }
          });

          res.json({ matches: map });
      } catch (error) {
          console.error("Knowledge Check Error:", error);
          res.status(500).json({ error: "Failed to check knowledge base" });
      }
  });

  // ============================================
  // AI AUTO-MAPPING ROUTE (STRICT & ROBUST)
  // ============================================
  app.post("/api/ai/map-fields", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

    const { sourceHeaders, targetVariables } = req.body;

    if (!sourceHeaders || !targetVariables) {
      return res.status(400).json({ error: "Missing headers or targets" });
    }

    try {
      // --- PROMPT ---
      const prompt = `
        You are a strict data mapping engine.

        INPUT DATA:
        1. **Source Headers** (Columns in User's CSV): ${JSON.stringify(sourceHeaders)}
        2. **Allowed Targets** (Variables in User's Template): ${JSON.stringify(targetVariables)}

        **YOUR GOAL:**
        For each "Source Header", determine if it semantically matches EXACTLY ONE of the "Allowed Targets".

        **CRITICAL CONSTRAINTS (DO NOT IGNORE):**
        1. **NO NEW TARGETS:** The 'target' field in your JSON **MUST** be an exact string from the "Allowed Targets" list above. 
           - If a Source Header matches a concept that is NOT in "Allowed Targets", **IGNORE IT**. Do not map it.
           - Example: If Source is "SKU" but "SKU" is NOT in Allowed Targets, return nothing for it.
        2. **SEMANTIC MATCHING ONLY:** - Match synonyms (e.g., Source "Dimensions" -> Target "Measurements").
           - Match abbreviations (e.g., Source "Qty" -> Target "Quantity").
           - DO NOT match unrelated types (e.g., NEVER map "Price" to "Measurements").
        3. **CONFIDENCE:**
           - 1.0 = Perfect synonym or exact match.
           - 0.0 = No valid target found in the list.
        4. **OUTPUT:** Return a clean JSON array of objects: { "source": string, "target": string, "confidence": number }.
        5. **FILTER:** Only return mappings with confidence > 0.8.
      `;

      // --- ROBUST RETRY LOGIC (429 & 503) ---
      let result;
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          result = await aiModel.generateContent(prompt);
          break; // Success!
        } catch (e: any) {
          // Check for Rate Limit (429) OR Service Overload (503)
          if (
            e.status === 429 || 
            e.status === 503 || 
            e.message?.includes("429") || 
            e.message?.includes("503") ||
            e.message?.includes("Overloaded")
          ) {
            attempts++;
            if (attempts >= maxAttempts) throw e; // Give up after max attempts

            // Exponential backoff: 1s, 2s, 4s
            const delay = Math.pow(2, attempts) * 1000;
            console.warn(`Gemini API Error (${e.status}). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw e; // Throw other errors immediately
          }
        }
      }

      if (!result) throw new Error("AI request failed after retries");

      const responseText = result.response.text();

      // Clean up potential markdown formatting (```json ... ```)
      const cleanText = responseText.replace(/```json|```/g, "").trim();

      const mapping = JSON.parse(cleanText);
      const rawMapping = Array.isArray(mapping) ? mapping : (mapping.mapping || mapping.matches || []);

      // --- FINAL SAFETY FILTER ---
      const validTargets = new Set(targetVariables);
      const finalMapping = rawMapping.filter((m: any) => validTargets.has(m.target));

      res.json(finalMapping);

    } catch (error) {
      console.error("Gemini Mapping Error:", error);
      res.status(500).json({ error: "AI Mapping failed" });
    }
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
  // 1. PDF Export Route (ENFORCED LIMITS + WATERMARK)
  // ============================================
  app.post("/api/export/pdf", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    let { html, width, height, scale = 2, colorModel = 'rgb' } = req.body;

    if (!html || !width || !height) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
      // 1. GET USER & CHECK PLAN
      const user = await storage.getUser(auth.userId);
      const isPro = user?.plan === "pro"; 

      // 2. ENFORCE USAGE LIMITS (Free Tier)
      if (!isPro) {
        // Enforce Export Settings
        if (colorModel === 'cmyk') {
          console.warn(`User ${auth.userId} requested CMYK but is Free. Forcing RGB.`);
          colorModel = 'rgb';
        }

        // Check Monthly Quota
        const usage = await storage.checkAndIncrementUsage(auth.userId);
        if (!usage.allowed) {
          return res.status(403).json({ 
            error: "Monthly PDF limit reached (50/50). Upgrade to Pro for unlimited exports." 
          });
        }

        // 3. SERVER-SIDE WATERMARK INJECTION
        if (!html.includes("Created with <b>Doculoom</b>")) {
           const watermarkStyle = `
             position: fixed; 
             bottom: 16px; 
             right: 16px; 
             opacity: 0.5; 
             z-index: 9999; 
             font-family: sans-serif; 
             font-size: 12px; 
             color: #000000; 
             background-color: rgba(255,255,255,0.7); 
             padding: 4px 8px; 
             border-radius: 4px;
             pointer-events: none;
           `;
           const watermarkDiv = `<div style="${watermarkStyle}">Created with <b>Doculoom</b></div>`;
           // Insert before closing body tag
           html = html.replace("</body>", `${watermarkDiv}</body>`);
        }
      }

      // 4. PROCESS PDF (QUEUE)
      const pdfBuffer = await pdfQueue.add(async () => {
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
          await browser.close().catch(e => console.error("Error closing browser:", e));
        }
      });

      // 5. CMYK POST-PROCESSING (Pro Only)
      let finalBuffer = pdfBuffer;
      let usedColorModel = 'rgb'; 

      if (isPro && colorModel === 'cmyk') {
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
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

    const { html, width, height } = req.body;
    if (!html || !width || !height) return res.status(400).json({ error: "Missing required parameters" });

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

          await page.setContent(html, { waitUntil: ["load", "networkidle0"], timeout: 30000 });
          await page.evaluate(async () => { await document.fonts.ready; });

          return await page.screenshot({ type: "jpeg", quality: 70, fullPage: true, encoding: "base64" });
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

  app.post("/api/qrcodes", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

      // ENFORCE: Free users cannot create Dynamic QR Codes
      const user = await storage.getUser(auth.userId);
      if (user?.plan !== "pro") {
        return res.status(403).json({ error: "Dynamic QR Codes are a Pro feature." });
      }

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

      // ENFORCE: Free users cannot update Dynamic QR Codes
      const user = await storage.getUser(auth.userId);
      if (user?.plan !== "pro") {
        return res.status(403).json({ error: "Managing QR Codes is a Pro feature." });
      }

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
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

      const isAdmin = await checkAdmin(auth.userId);
      if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });

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
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

      const isAdmin = await checkAdmin(auth.userId);
      if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });

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
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

      const isAdmin = await checkAdmin(auth.userId);
      if (!isAdmin) return res.status(403).json({ error: "Unauthorized" });

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

  // --- NEW PLANS ROUTE ---
  app.get("/api/plans", async (req, res) => {
    try {
      const prices = await stripeService.getActivePrices();
      res.json(prices);
    } catch (error) {
      console.error("Failed to fetch plans:", error);
      res.status(500).json({ error: "Failed to fetch plans" });
    }
  });
  // ---------------------

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

      let user = await storage.getUser(auth.userId);
      if (!user) {
        let email: string | undefined;
        try {
          const clerkUser = await clerkClient.users.getUser(auth.userId);
          email = clerkUser.emailAddresses[0]?.emailAddress;
        } catch (clerkError: any) {
          console.error(`Clerk user fetch failed during sync for user ${auth.userId}:`, clerkError);
        }

        if (!email) {
          return res.status(400).json({ 
            error: "User email not found", 
            details: "Could not retrieve email from Clerk. Please ensure you are logged in correctly." 
          });
        }
        user = await storage.createUser({ id: auth.userId, email, plan: "free", planStatus: "active" });
      }
      res.json(user);
    } catch (error: any) {
      console.error("Failed to sync user:", error);
      res.status(500).json({ error: "Failed to sync user", details: error.message });
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
        let email: string | undefined;
        try {
          const clerkUser = await clerkClient.users.getUser(auth.userId);
          email = clerkUser.emailAddresses[0]?.emailAddress;
        } catch (clerkError) {
          console.error("Clerk user fetch failed, attempting fallback:", clerkError);
          // Fallback: If Clerk fetch fails (e.g. race condition), try to use email from token/metadata if possible
          // For now, if we can't get email, we can't create the user record reliably for Stripe
        }

        if (!email) return res.status(400).json({ error: "User email not found. Please ensure your Clerk profile is complete." });
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
    } catch (error: any) {
      console.error("Failed to create checkout session:", error);
      res.status(500).json({ error: "Failed to create checkout session", details: error.message });
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