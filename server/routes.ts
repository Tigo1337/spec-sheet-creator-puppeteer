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
import { exec, execFile } from "child_process";
import { promisify } from "util";
import { GoogleGenerativeAI } from "@google/generative-ai";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// --- STRICT QUEUE SYSTEM WITH COOLDOWN ---
// CRITICAL FIX: Limit 1 + Artificial Delay.
// This processes PDFs sequentially and waits between them to let Replit GC clean up RAM.
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
        // WAIT 2500ms before processing the next item.
        // This prevents "OOM Killer" in low-memory environments like Replit.
        setTimeout(() => {
            const next = this.queue.shift();
            next?.();
        }, 2500);
      }
    }
  }
};

// Helper to check admin status via Env Var OR Clerk Role
async function checkAdmin(userId: string): Promise<boolean> {
  if (process.env.ADMIN_USER_ID && process.env.ADMIN_USER_ID.trim().length > 0 && userId === process.env.ADMIN_USER_ID) {
    return true;
  }
  try {
    const user = await clerkClient.users.getUser(userId);
    return user.publicMetadata?.role === "admin";
  } catch (error) {
    console.error("Failed to verify admin role:", error);
    return false;
  }
}

// --- PROMPT BUILDER LOGIC ---
interface EnrichmentConfig {
  type: string;
  tone?: string;
  currencySymbol?: string;
  currencyPlacement?: 'before' | 'after';
  currencySpacing?: boolean;
  currencyDecimals?: 'default' | 'whole' | 'two';
  currencyThousandSeparator?: boolean;
  measurementUnit?: string;
  measurementFormat?: 'abbr' | 'full';
  measurementSpacing?: boolean;
  customInstructions?: string;
}

function buildDynamicPrompt(config: EnrichmentConfig): string {
  const { 
    type, 
    tone, 
    currencySymbol, 
    currencyPlacement, 
    currencySpacing, 
    currencyDecimals, 
    currencyThousandSeparator, 
    measurementUnit, 
    measurementFormat, 
    measurementSpacing 
  } = config;

  let instructions = "";

  switch (type) {
    case "marketing":
      instructions = "Write a compelling marketing description highlighting key features.";
      break;
    case "seo":
      instructions = "Write a short, punchy, SEO-optimized product title (under 60 chars).";
      break;
    case "features":
      instructions = "Extract the technical specs and return them as a bulleted list (use • character).";
      break;
    case "email":
      instructions = "Write a short, persuasive sales email blurb introducing this product.";
      break;
    case "social":
      instructions = "Write an engaging social media caption with relevant hashtags.";
      break;
    case "currency":
      instructions = `Identify all price/monetary values. Format them strictly as ${currencySymbol || '$'}. `;
      instructions += currencyPlacement === 'after' ? "Place the currency symbol AFTER the number. " : "Place the currency symbol BEFORE the number. ";
      instructions += currencySpacing ? "Insert a single space between the symbol and the number. " : "Do NOT place a space between the symbol and the number. ";
      if (currencyDecimals === 'whole') instructions += "Round all values to the nearest whole number. ";
      else if (currencyDecimals === 'two') instructions += "Ensure exactly two decimal places. ";
      instructions += currencyThousandSeparator ? "Use a comma as a thousand separator. " : "Do NOT use thousand separators. ";
      break;
    case "measurements":
      const unit = measurementUnit || 'cm';
      const targetUnit = measurementFormat === 'full' ? ({'in':'inches','cm':'centimeters','mm':'millimeters','lb':'pounds','kg':'kilograms'}[unit] || unit) : unit;
      const spaceChar = measurementSpacing !== false ? " " : "";
      instructions = `Identify ALL numeric values. Treat them as measurements. Format using unit "${targetUnit}". Append "${targetUnit}" to every number found.${spaceChar ? ' Insert space.' : ' No space.'}`;
      break;
    case "title_case":
      instructions = "Convert the text to Title Case.";
      break;
    case "uppercase":
      instructions = "Convert the text to UPPERCASE.";
      break;
    case "clean_text":
      instructions = "Remove all special characters, emojis, and HTML tags.";
      break;
    case "custom":
      instructions = config.customInstructions || "Follow the user's request.";
      break;
    default:
      instructions = "Analyze the product data.";
  }

  if (tone && !['currency', 'measurements', 'title_case', 'uppercase', 'clean_text'].includes(type)) {
    instructions += ` Tone: ${tone}.`;
  }

  instructions += `\n\nCRITICAL FORMATTING RULES:
  1. Do NOT use actual newline characters (\\n).
  2. If separating lines, use "<br>".
  3. Return ONLY the final formatted string.`;

  return instructions;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const objectStorageService = new ObjectStorageService();
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  const aiModel = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash-lite", 
    generationConfig: { responseMimeType: "application/json" }
  });

  // Health Check
  app.get("/health", async (req, res) => {
    const health = { uptime: process.uptime(), status: "OK", checks: { database: "unknown", stripe: "unknown" }};
    try { await storage.getUser("health-check-probe"); health.checks.database = "connected"; } 
    catch (e) { health.checks.database = "disconnected"; health.status = "DEGRADED"; }
    health.checks.stripe = process.env.STRIPE_SECRET_KEY ? "configured" : "missing_key";
    res.status(health.status === "OK" ? 200 : 503).json(health);
  });

  // AI Enrichment
  app.post("/api/ai/enrich-data", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
    const { rows, config, anchorColumn, customFieldName } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "No data rows" });

    const enrichmentConfig = config || { type: 'marketing', tone: 'Professional' };
    const selectedInstructions = buildDynamicPrompt(enrichmentConfig);
    const limitedRows = rows.slice(0, 50); 

    try {
      const prompt = `Task: ${selectedInstructions}\nData: ${JSON.stringify(limitedRows)}\nOutput: JSON Array of strings only.`;
      const result = await aiModel.generateContent(prompt);
      const generatedContent = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());

      if (anchorColumn && auth.userId) {
         try {
             const knowledgeItems = limitedRows.map((row: any, i: number) => {
                 const keyVal = row[anchorColumn];
                 if (!keyVal || !generatedContent[i]) return null;
                 return {
                     keyName: anchorColumn,
                     productKey: String(keyVal).trim(),
                     fieldType: customFieldName || enrichmentConfig.type, 
                     content: String(generatedContent[i])
                 };
             }).filter((item: any) => item !== null);
             if (knowledgeItems.length > 0) await storage.batchSaveProductKnowledge(auth.userId, knowledgeItems);
         } catch (e) { console.error("Memory save failed", e); }
      }
      res.json({ generatedContent });
    } catch (error) {
      console.error("Enrichment Error:", error);
      res.status(500).json({ error: "Failed to generate content" });
    }
  });

  app.post("/api/ai/standardize", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });
    const { values, config, instruction } = req.body;
    const finalInstruction = config ? buildDynamicPrompt(config) : (instruction || "Standardize format");

    try {
      const prompt = `Task: ${finalInstruction}\nInput: ${JSON.stringify(values.slice(0, 1000))}\nOutput: JSON Array of strings.`;
      const result = await aiModel.generateContent(prompt);
      const standardized = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
      res.json({ standardized });
    } catch (error) {
      console.error("Standardize Error:", error);
      res.status(500).json({ error: "Processing failed" });
    }
  });

  app.post("/api/ai/knowledge/check", async (req, res) => {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const { keys, keyName } = req.body;
      if (!keys?.length || !keyName) return res.json({ matches: {} });
      try {
          const results = await storage.batchGetProductKnowledge(auth.userId, keys.slice(0, 100), keyName);
          const map: Record<string, Record<string, string>> = {};
          results.forEach(item => {
              if (!map[item.productKey]) map[item.productKey] = {};
              if (!map[item.productKey][item.fieldType]) map[item.productKey][item.fieldType] = item.content;
          });
          res.json({ matches: map });
      } catch (error) { res.status(500).json({ error: "Failed to check knowledge base" }); }
  });

  app.get("/api/ai/knowledge", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
    try { const items = await storage.getAllProductKnowledge(auth.userId); res.json(items); } 
    catch (error) { res.status(500).json({ error: "Failed to fetch knowledge base" }); }
  });

  app.delete("/api/ai/knowledge/:id", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
    try { const success = await storage.deleteProductKnowledge(req.params.id, auth.userId); res.sendStatus(success ? 204 : 404); }
    catch (error) { res.status(500).json({ error: "Failed to delete item" }); }
  });

  app.put("/api/ai/knowledge/:id", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
    try { const updated = await storage.updateProductKnowledge(req.params.id, auth.userId, req.body.content); res.json(updated || {error: "Not found"}); }
    catch (error) { res.status(500).json({ error: "Failed to update item" }); }
  });

  app.post("/api/ai/map-fields", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const prompt = `Match columns ${JSON.stringify(req.body.sourceHeaders)} to variables ${JSON.stringify(req.body.targetVariables)}. Return JSON array [{source, target, confidence}].`;
      const result = await aiModel.generateContent(prompt);
      const mapping = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
      res.json(Array.isArray(mapping) ? mapping : []);
    } catch (error) { res.status(500).json({ error: "AI Mapping failed" }); }
  });

  // Dynamic QR
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
  // PDF EXPORT (STABLE: LIMIT 1 + FRESH BROWSER)
  // ============================================
  app.post("/api/export/pdf", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

    let { html, width, height, scale = 2, colorModel = 'rgb' } = req.body;
    if (!html || !width || !height) return res.status(400).json({ error: "Missing required parameters" });

    try {
      const user = await storage.getUser(auth.userId);
      const isPro = user?.plan === "pro"; 

      if (!isPro) {
        if (colorModel === 'cmyk') colorModel = 'rgb';
        const usage = await storage.checkAndIncrementUsage(auth.userId);
        if (!usage.allowed) return res.status(403).json({ error: "Monthly PDF limit reached. Upgrade to Pro." });
        if (!html.includes("Created with <b>Doculoom</b>")) {
           html = html.replace("</body>", `<div style="position:fixed;bottom:16px;right:16px;opacity:0.5;z-index:9999;font-family:sans-serif;font-size:12px;color:#000;background:rgba(255,255,255,0.7);padding:4px 8px;border-radius:4px;pointer-events:none;">Created with <b>Doculoom</b></div></body>`);
        }
      }

      // --- QUEUE EXECUTION ---
      const pdfBuffer = await pdfQueue.add(async () => {
        console.log(`-> Processing PDF. Queue waiting: ${pdfQueue.queue.length}`);

        const browser = await puppeteer.launch({
          headless: true,
          executablePath: process.env.NIX_CHROMIUM_WRAPPER || puppeteer.executablePath(),
          args: [
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', 
            '--disable-dev-shm-usage', '--font-render-hinting=none', 
            '--disable-extensions', '--no-first-run', '--no-zygote',
            '--single-process', // Necessary for Replit env stability
          ],
        });

        try {
          const page = await browser.newPage();
          await page.setRequestInterception(true);
          page.on('request', (request) => {
             const url = request.url().toLowerCase();
             if (url.startsWith('data:')) return request.continue();
             if (url.startsWith('file:') || url.includes('localhost') || url.includes('127.0.0.1')) return request.abort();
             request.continue();
          });

          await page.setViewport({ width: Math.ceil(width), height: Math.ceil(height), deviceScaleFactor: Number(scale) });
          await page.setContent(html, { waitUntil: ["load", "networkidle0"], timeout: 60000 });
          await page.evaluate(async () => { await document.fonts.ready; });
          return await page.pdf({ printBackground: true, preferCSSPageSize: true });
        } finally {
          await browser.close().catch(e => console.error("Error closing browser:", e));
        }
      });

      let finalBuffer = Buffer.from(pdfBuffer);
      let usedColorModel = 'rgb'; 

      if (isPro && colorModel === 'cmyk') {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const inputPath = path.resolve(`/tmp/input_${timestamp}_${randomId}.pdf`);
        const outputPath = path.resolve(`/tmp/output_${timestamp}_${randomId}.pdf`);
        try {
            await fs.promises.writeFile(inputPath, finalBuffer);
            await execFileAsync('gs', ['-o', outputPath, '-sDEVICE=pdfwrite', '-sColorConversionStrategy=CMYK', '-dProcessColorModel=/DeviceCMYK', '-dPDFSETTINGS=/prepress', '-dSAFER', '-dBATCH', '-dNOPAUSE', inputPath]);
            finalBuffer = await fs.promises.readFile(outputPath);
            usedColorModel = 'cmyk';
            await fs.promises.unlink(inputPath).catch(()=>{});
            await fs.promises.unlink(outputPath).catch(()=>{});
        } catch (e) { console.error("CMYK Error", e); if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); }
      }

      res.set({ "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=export.pdf", "Content-Length": String(finalBuffer.length), "X-Color-Model": usedColorModel });
      res.send(finalBuffer);

    } catch (error) {
      console.error("PDF Export Critical Fail:", error);
      if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  app.post("/api/export/preview", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Auth required" });
    const { html, width, height } = req.body;
    if (!html || !width || !height) return res.status(400).json({ error: "Missing params" });

    try {
      const base64String = await pdfQueue.add(async () => {
        const browser = await puppeteer.launch({
          headless: true,
          executablePath: process.env.NIX_CHROMIUM_WRAPPER || puppeteer.executablePath(),
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
        });
        try {
          const page = await browser.newPage();
          await page.setViewport({ width: Math.ceil(width), height: Math.ceil(height), deviceScaleFactor: 0.5 });
          await page.setContent(html, { waitUntil: ["load", "networkidle0"], timeout: 30000 });
          await page.evaluate(async () => { await document.fonts.ready; });
          return await page.screenshot({ type: "jpeg", quality: 70, fullPage: true, encoding: "base64" });
        } finally {
          await browser.close();
        }
      });
      res.json({ image: `data:image/jpeg;base64,${base64String}` });
    } catch (error) { res.status(500).json({ error: "Preview failed" }); }
  });

  // Standard Routes
  app.post("/api/qrcodes", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const user = await storage.getUser(auth.userId);
      if (user?.plan !== "pro") return res.status(403).json({ error: "Pro feature required" });
      const data = insertQrCodeSchema.parse(req.body);
      res.status(201).json(await storage.createQRCode(auth.userId, data.destinationUrl, data.designId));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/qrcodes", async (req, res) => {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Auth required" });
      res.json(await storage.getQRCodesByUser(auth.userId));
  });

  app.put("/api/qrcodes/:id", async (req, res) => {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Auth required" });
      const updated = await storage.updateQRCode(req.params.id, auth.userId, req.body.destinationUrl);
      res.json(updated || {error: "Not found"});
  });

  app.get("/api/templates", async (req, res) => res.json(await storage.getTemplates()));
  app.get("/api/templates/:id", async (req, res) => res.json(await storage.getTemplate(req.params.id) || {error: "Not found"}));

  app.post("/api/templates", async (req, res) => {
      const auth = getAuth(req);
      if (!await checkAdmin(auth.userId || "")) return res.status(403).json({error: "Unauthorized"});
      res.status(201).json(await storage.createTemplate(insertTemplateSchema.parse(req.body)));
  });

  app.put("/api/templates/:id", async (req, res) => {
      const auth = getAuth(req);
      if (!await checkAdmin(auth.userId || "")) return res.status(403).json({error: "Unauthorized"});
      res.json(await storage.updateTemplate(req.params.id, req.body));
  });

  app.delete("/api/templates/:id", async (req, res) => {
      const auth = getAuth(req);
      if (!await checkAdmin(auth.userId || "")) return res.status(403).json({error: "Unauthorized"});
      await storage.deleteTemplate(req.params.id);
      res.sendStatus(204);
  });

  app.post("/api/designs", async (req, res) => {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Auth required" });
      res.status(201).json(await storage.createDesign(insertSavedDesignSchema.parse({...req.body, userId: auth.userId})));
  });

  app.get("/api/designs", async (req, res) => {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Auth required" });
      res.json(await storage.getDesignsByUser(auth.userId));
  });

  app.get("/api/designs/:id", async (req, res) => {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Auth required" });
      res.json(await storage.getDesign(req.params.id, auth.userId) || {error: "Not found"});
  });

  app.put("/api/designs/:id", async (req, res) => {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Auth required" });
      res.json(await storage.updateDesign(req.params.id, auth.userId, req.body));
  });

  app.delete("/api/designs/:id", async (req, res) => {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Auth required" });
      await storage.deleteDesign(req.params.id, auth.userId);
      res.sendStatus(204);
  });

  app.get("/public-objects/:filePath(*)", async (req, res) => {
      try { const file = await objectStorageService.searchPublicObject(req.params.filePath); 
      if(!file) return res.status(404).json({error: "Not found"}); objectStorageService.downloadObject(file, res); }
      catch { res.status(500).json({error: "Server error"}); }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
      try { const f = await objectStorageService.getObjectEntityFile(req.path); objectStorageService.downloadObject(f, res); }
      catch (e) { res.sendStatus(e instanceof ObjectNotFoundError ? 404 : 500); }
  });

  app.post("/api/objects/upload", async (req, res) => res.json({ uploadURL: await objectStorageService.getObjectEntityUploadURL() }));
  app.put("/api/objects/uploaded", async (req, res) => res.json({ objectPath: objectStorageService.normalizeObjectEntityPath(req.body.objectURL) }));

  app.get("/api/plans", async (req, res) => res.json(await stripeService.getActivePrices()));
  app.get("/api/stripe/config", async (req, res) => res.json({ publishableKey: await getStripePublishableKey() }));

  app.post("/api/users/sync", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Auth required" });
    let user = await storage.getUser(auth.userId);
    if (!user) {
        const clerkUser = await clerkClient.users.getUser(auth.userId);
        const email = clerkUser.emailAddresses[0]?.emailAddress;
        if (!email) return res.status(400).json({ error: "No email" });
        user = await storage.createUser({ id: auth.userId, email, plan: "free", planStatus: "active" });
    }
    res.json(user);
  });

  app.get("/api/subscription", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Auth required" });
    const user = await storage.getUser(auth.userId);
    res.json(user ? { plan: user.plan, planStatus: user.planStatus, stripeCustomerId: user.stripeCustomerId, stripeSubscriptionId: user.stripeSubscriptionId } : { subscription: null, plan: "free" });
  });

  app.post("/api/checkout", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Auth required" });
    let user = await storage.getUser(auth.userId);
    if (!user) {
        const clerkUser = await clerkClient.users.getUser(auth.userId);
        user = await storage.createUser({ id: auth.userId, email: clerkUser.emailAddresses[0].emailAddress, plan: "free", planStatus: "active" });
    }
    if (!user.stripeCustomerId) {
        const c = await stripeService.createCustomer(user.email, user.id);
        await storage.updateUserStripeInfo(user.id, { stripeCustomerId: c.id });
        user.stripeCustomerId = c.id;
    }
    const baseUrl = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['x-forwarded-host'] || req.get('host')}`;
    const s = await stripeService.createCheckoutSession(user.stripeCustomerId, req.body.priceId, `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`, `${baseUrl}/pricing`, auth.userId);
    res.json({ url: s.url });
  });

  app.post("/api/customer-portal", async (req, res) => {
      const auth = getAuth(req);
      const user = await storage.getUser(auth.userId || "");
      if (!user?.stripeCustomerId) return res.status(400).json({ error: "No sub" });
      const baseUrl = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['x-forwarded-host'] || req.get('host')}`;
      const s = await stripeService.createCustomerPortalSession(user.stripeCustomerId, `${baseUrl}/editor`);
      res.json({ url: s.url });
  });

  return httpServer;
}