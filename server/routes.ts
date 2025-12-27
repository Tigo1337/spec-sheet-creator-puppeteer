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
import os from "os";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// --- DEBUG LOGGER ---
const logSystemStats = (id: string, stage: string) => {
  const used = process.memoryUsage();
  const rss = Math.round(used.rss / 1024 / 1024); 
  console.log(`[${id}] ${stage} | Node RSS: ${rss}MB`);
};

// --- BROWSER ROTATION SYSTEM ---
// AGGRESSIVE rotation to prevent memory crashes during bulk exports.
// Chrome accumulates memory even after page.close(), so we restart frequently.
let sharedBrowser: puppeteer.Browser | null = null;
let browserUsageCount = 0;
const MAX_USES_BEFORE_RESTART = 2; // Restart every 2 PDFs - aggressive to prevent OOM

// Kill any orphaned Chrome processes from previous crashes
async function killOrphanedChrome() {
  try {
    await execAsync("pkill -f 'chrome.*--headless' || true");
  } catch {
    // Ignore errors - process may not exist
  }
}

// Force garbage collection if available (Node --expose-gc flag)
function forceGC() {
  if (global.gc) {
    console.log("[GC] Forcing garbage collection...");
    global.gc();
  }
}

async function getBrowser() {
  // 1. Check if we need to rotate the browser
  if (sharedBrowser && browserUsageCount >= MAX_USES_BEFORE_RESTART) {
    console.log(`[Puppeteer] Maintenance: Rotating browser after ${browserUsageCount} uses...`);
    try {
      // Close all pages first to release resources
      const pages = await sharedBrowser.pages();
      for (const page of pages) {
        await page.close().catch(() => {});
      }
      await sharedBrowser.close();
    } catch (e) {
      console.error("Error closing browser for rotation:", e);
    }
    sharedBrowser = null;
    browserUsageCount = 0;
    
    // Force garbage collection and give system time to release memory
    forceGC();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Kill any orphaned processes
    await killOrphanedChrome();
  }

  // 2. Launch new instance if needed
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    console.log("[Puppeteer] Launching New Browser Instance...");
    sharedBrowser = await puppeteer.launch({
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
        '--single-process', // Run all Chrome in single process to prevent memory fragmentation
        '--js-flags=--max-old-space-size=256', // Limit JS heap to 256MB
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    });
    browserUsageCount = 0;
  }

  browserUsageCount++;
  return sharedBrowser;
}

// Ensure browser closes when server stops
process.on('exit', async () => {
  if (sharedBrowser) await sharedBrowser.close();
});

// --- STRICT QUEUE SYSTEM ---
const pdfQueue = {
  active: 0,
  limit: 1, // STRICTLY 1: Sequential processing is mandatory
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
        // 1s Delay between items to let system stabilize
        setTimeout(() => {
            const next = this.queue.shift();
            next?.();
        }, 1000); 
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

// --- AI CREDIT HELPER ---
async function checkAndDeductAiCredits(userId: string, costCents: number): Promise<boolean> {
  const user = await storage.getUser(userId);
  if (!user) return false;

  let currentCredits = user.aiCredits || 0;
  const lastReset = user.aiCreditsResetDate ? new Date(user.aiCreditsResetDate) : new Date(0);
  const now = new Date();
  const oneDay = 1000 * 60 * 60 * 24;
  const daysSinceReset = (now.getTime() - lastReset.getTime()) / oneDay;

  if (daysSinceReset >= 30) {
      const limit = user.aiCreditsLimit || 0;
      console.log(`[AI Limit] Monthly reset triggered for ${userId}. Refilling to ${limit}`);
      currentCredits = limit; 
      if (currentCredits < costCents) return false;
      await storage.updateUser(userId, { 
          aiCredits: currentCredits - costCents,
          aiCreditsResetDate: now
      });
      return true;
  }

  if (currentCredits < costCents) return false;
  await storage.updateUser(userId, { aiCredits: currentCredits - costCents });
  return true;
}

// --- PROMPT BUILDER ---
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
   const { type, tone, currencySymbol, currencyPlacement, currencySpacing, currencyDecimals, currencyThousandSeparator, measurementUnit, measurementFormat, measurementSpacing } = config;
  let instructions = "";

  switch (type) {
    case "marketing": instructions = "Write a compelling marketing description highlighting key features."; break;
    case "seo": instructions = "Write a short, punchy, SEO-optimized product title (under 60 chars)."; break;
    case "features": instructions = "Extract the technical specs and return them as a bulleted list (use • character)."; break;
    case "email": instructions = "Write a short, persuasive sales email blurb introducing this product."; break;
    case "social": instructions = "Write an engaging social media caption with relevant hashtags."; break;
    case "currency":
      instructions = `Identify all price/monetary values. Format them strictly as ${currencySymbol || '$'}. `;
      if (currencyPlacement === 'after') { instructions += "Place the currency symbol AFTER the number. "; } else { instructions += "Place the currency symbol BEFORE the number. "; }
      if (currencySpacing) { instructions += "Insert a single space between the symbol and the number (e.g. '$ 10'). "; } else { instructions += "Do NOT place a space between the symbol and the number (e.g. '$10'). "; }
      if (currencyDecimals === 'whole') { instructions += "Round all values to the nearest whole number (no decimals). "; } else if (currencyDecimals === 'two') { instructions += "Ensure exactly two decimal places for all values (e.g. 10.00). "; }
      if (currencyThousandSeparator) { instructions += "Use a comma as a thousand separator. "; } else { instructions += "Do NOT use thousand separators. "; }
      break;
    case "measurements":
      const unit = measurementUnit || 'cm';
      const targetUnit = measurementFormat === 'full' ? ({'in':'inches','cm':'centimeters','mm':'millimeters','lb':'pounds','kg':'kilograms'}[unit] || unit) : unit;
      const spaceChar = measurementSpacing !== false ? " " : "";
      instructions = `Identify ALL numeric values. Treat them as measurements. Format them to use the unit "${targetUnit}". Formatting Rules: 1. Append "${targetUnit}" to every number found.${spaceChar ? ' Insert a space between number and unit.' : ' Do NOT put a space between number and unit.'} 2. If a field contains multiple numbers, apply unit to EACH. 3. Keep original separators.`;
      break;
    case "title_case": instructions = "Convert the text to Title Case (Capitalize First Letter of Each Major Word)."; break;
    case "uppercase": instructions = "Convert the text to UPPERCASE."; break;
    case "clean_text": instructions = "Remove all special characters, emojis, and HTML tags."; break;
    case "custom": instructions = config.customInstructions || "Follow the user's request."; break;
    default: instructions = "Analyze the product data.";
  }
  if (tone && !['currency', 'measurements', 'title_case', 'uppercase', 'clean_text'].includes(type)) { instructions += ` Tone: ${tone}.`; }
  instructions += `\n\nCRITICAL FORMATTING RULES: 1. Do NOT use actual newline characters (\\n). 2. If separating lines, use "<br>". 3. Return ONLY the final formatted string.`;
  return instructions;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  const objectStorageService = new ObjectStorageService();
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  const aiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite", generationConfig: { responseMimeType: "application/json" } });

  app.get("/health", async (req, res) => {
    const health = { uptime: process.uptime(), timestamp: Date.now(), status: "OK", checks: { database: "unknown", stripe: "unknown" } };
    try { await storage.getUser("health-check-probe"); health.checks.database = "connected"; } 
    catch (e) { health.checks.database = "disconnected"; health.status = "DEGRADED"; console.error("Health check failed: Database", e); }
    health.checks.stripe = process.env.STRIPE_SECRET_KEY ? "configured" : "missing_key";
    res.status(health.status === "OK" ? 200 : 503).json(health);
  });

  // API Routes (AI)
  app.post("/api/ai/enrich-data", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
    const { rows, config, anchorColumn, customFieldName } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "No data rows provided" });

    const cost = rows.length * 100; 
    const allowed = await checkAndDeductAiCredits(auth.userId, cost);
    if (!allowed) return res.status(403).json({ error: "Insufficient AI Credits", message: "Upgrade to Scale for more." });

    const enrichmentConfig = config || { type: 'marketing', tone: 'Professional' };
    const selectedInstructions = buildDynamicPrompt(enrichmentConfig);
    const limitedRows = rows.slice(0, 50); 

    try {
      const prompt = `Task: ${selectedInstructions}\nData: ${JSON.stringify(limitedRows)}\nOutput: JSON Array of strings.`;
      let result;
      let attempts = 0;
      while (attempts < 3) {
        try { result = await aiModel.generateContent(prompt); break; }
        catch (e: any) { if (e.status===429||e.status===503) { attempts++; await new Promise(r => setTimeout(r, 1000*attempts)); } else throw e; }
      }
      if (!result) throw new Error("AI Generation failed");
      const generatedContent = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());

      if (anchorColumn && auth.userId) {
          const user = await storage.getUser(auth.userId);
          if (user?.plan && (user.plan.includes("scale") || user.plan.includes("business"))) {
              try {
                  const knowledgeItems = limitedRows.map((row: any, i: number) => {
                      const keyVal = row[anchorColumn]; const content = generatedContent[i];
                      if (!keyVal || !content) return null;
                      return { keyName: anchorColumn, productKey: String(keyVal).trim(), fieldType: customFieldName || enrichmentConfig.type, content: String(content) };
                  }).filter((item: any) => item !== null);
                  if (knowledgeItems.length > 0) await storage.batchSaveProductKnowledge(auth.userId, knowledgeItems);
              } catch (e) { console.error("Memory save failed", e); }
          }
      }
      res.json({ generatedContent });
    } catch (error) { console.error("Enrichment Error:", error); res.status(500).json({ error: "Failed to generate content" }); }
  });

  app.post("/api/ai/standardize", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });
    const { values, config, instruction } = req.body;
    if (!values?.length) return res.status(400).json({ error: "Invalid data" });

    const allowed = await checkAndDeductAiCredits(auth.userId, values.length * 25);
    if (!allowed) return res.status(403).json({ error: "Insufficient AI Credits" });

    try {
      const prompt = `Task: ${config ? buildDynamicPrompt(config) : (instruction || "Standardize")}\nInput: ${JSON.stringify(values.slice(0,1000))}\nOutput: JSON Array of strings.`;
      let result, attempts = 0;
      while (attempts < 3) {
        try { result = await aiModel.generateContent(prompt); break; }
        catch (e: any) { if (e.status===429||e.status===503) { attempts++; await new Promise(r => setTimeout(r, 1000*attempts)); } else throw e; }
      }
      res.json({ standardized: JSON.parse(result.response.text().replace(/```json|```/g, "").trim()) });
    } catch (error) { console.error("Standardize Error:", error); res.status(500).json({ error: "Processing failed" }); }
  });

  app.post("/api/ai/knowledge/check", async (req, res) => {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const user = await storage.getUser(auth.userId);
      if (!(user?.plan && (user.plan.includes("scale") || user.plan.includes("business")))) return res.status(403).json({ error: "Feature locked", matches: {} });
      const { keys, keyName } = req.body;
      if (!keys?.length) return res.json({ matches: {} });
      try {
          const results = await storage.batchGetProductKnowledge(auth.userId, keys.slice(0, 100), keyName);
          const map: Record<string, Record<string, string>> = {};
          results.forEach(item => { if (!map[item.productKey]) map[item.productKey]={}; map[item.productKey][item.fieldType] = item.content; });
          res.json({ matches: map });
      } catch (e) { res.status(500).json({ error: "Error" }); }
  });

  app.get("/api/ai/knowledge", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Auth required" });
    try { res.json(await storage.getAllProductKnowledge(auth.userId)); } catch { res.status(500).json({ error: "Error" }); }
  });

  app.delete("/api/ai/knowledge/:id", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Auth required" });
    try { const s = await storage.deleteProductKnowledge(req.params.id, auth.userId); res.sendStatus(s ? 204 : 404); } catch { res.status(500).json({ error: "Error" }); }
  });

  app.put("/api/ai/knowledge/:id", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Auth required" });
    try { const u = await storage.updateProductKnowledge(req.params.id, auth.userId, req.body.content); res.json(u || {error: "Not found"}); } catch { res.status(500).json({ error: "Error" }); }
  });

  app.post("/api/ai/map-fields", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Auth required" });
    try {
      const prompt = `Match columns ${JSON.stringify(req.body.sourceHeaders)} to ${JSON.stringify(req.body.targetVariables)}. Return JSON array [{source, target, confidence}].`;
      const result = await aiModel.generateContent(prompt);
      res.json(JSON.parse(result.response.text().replace(/```json|```/g, "").trim()));
    } catch { res.status(500).json({ error: "AI Mapping failed" }); }
  });

  app.get("/q/:id", async (req, res) => {
    try {
      const qr = await storage.getQRCode(req.params.id);
      if (qr) { storage.incrementQRCodeScan(req.params.id).catch(console.error); return res.redirect(302, qr.destinationUrl); }
      res.status(404).send("Not found");
    } catch { res.status(500).send("Error"); }
  });

  // ============================================
  // PDF EXPORT (WITH BROWSER ROTATION)
  // ============================================
  app.post("/api/export/pdf", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

    let { html, width, height, scale = 2, colorModel = 'rgb' } = req.body;
    if (!html || !width || !height) return res.status(400).json({ error: "Missing required parameters" });

    const reqId = Math.random().toString(36).substring(7);
    console.log(`[${reqId}] Received PDF Export Request`);

    try {
      const user = await storage.getUser(auth.userId);
      const isPaid = user?.plan && (user.plan.includes("pro") || user.plan.includes("scale") || user.plan.includes("business")); 

      if (!isPaid) {
        if (colorModel === 'cmyk') colorModel = 'rgb';
        const usage = await storage.checkAndIncrementUsage(auth.userId);
        if (!usage.allowed) return res.status(403).json({ error: "Limit reached." });
        if (!html.includes("Created with <b>Doculoom</b>")) {
           html = html.replace("</body>", `<div style="position:fixed;bottom:16px;right:16px;opacity:0.5;z-index:9999;font-family:sans-serif;font-size:12px;color:#000;background:rgba(255,255,255,0.7);padding:4px 8px;border-radius:4px;pointer-events:none;">Created with <b>Doculoom</b></div></body>`);
        }
      }

      const pdfBuffer = await pdfQueue.add(async () => {
        logSystemStats(reqId, "Start Queue Task");

        // Use Rotated Browser
        const browser = await getBrowser();
        if (!browser) throw new Error("Failed to initialize browser");

        let page;
        try {
          page = await browser.newPage();

          await page.setRequestInterception(true);
          page.on('request', (request) => {
             const url = request.url().toLowerCase();
             if (url.startsWith('data:')) return request.continue();
             if (url.startsWith('file:') || url.includes('localhost') || url.includes('127.0.0.1')) return request.abort();
             request.continue();
          });

          await page.setViewport({ width: Math.ceil(width), height: Math.ceil(height), deviceScaleFactor: Number(scale) });

          logSystemStats(reqId, "Setting Content");
          await page.setContent(html, { waitUntil: ["load", "networkidle0"], timeout: 60000 });

          await page.evaluate(async () => { await document.fonts.ready; });

          logSystemStats(reqId, "Generating PDF");
          const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });

          logSystemStats(reqId, "PDF Done");
          return pdf;

        } catch (err) {
            console.error(`[${reqId}] Render Error:`, err);
            // CRITICAL: If crash occurs, force next request to get a new browser
            if (sharedBrowser) {
                try { await sharedBrowser.close(); } catch {}
                sharedBrowser = null;
                browserUsageCount = 0;
            }
            await killOrphanedChrome();
            forceGC();
            throw err;
        } finally {
          if (page) await page.close().catch(() => {});
          logSystemStats(reqId, "Page Closed");
        }
      });

      let finalBuffer = Buffer.from(pdfBuffer);
      let usedColorModel = 'rgb'; 

      if (isPaid && colorModel === 'cmyk') {
        const id = Math.random().toString(36).substring(7);
        const inputPath = path.resolve(`/tmp/in_${id}.pdf`);
        const outputPath = path.resolve(`/tmp/out_${id}.pdf`);
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
      console.log(`[${reqId}] Success Response Sent`);
      
      // Trigger GC after each export to prevent memory buildup during bulk exports
      forceGC();

    } catch (error) {
      console.error(`[${reqId}] PDF Export Fail:`, error);
      forceGC(); // Also GC on failure to recover memory
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
        // Use rotated browser for preview too
        const browser = await getBrowser();
        let page;
        try {
          page = await browser.newPage();
          await page.setRequestInterception(true);
          page.on('request', (request) => {
             const url = request.url().toLowerCase();
             if (url.startsWith('file:') || url.includes('localhost') || url.includes('127.0.0.1')) return request.abort();
             request.continue();
          });
          await page.setViewport({ width: Math.ceil(width), height: Math.ceil(height), deviceScaleFactor: 0.5 });
          await page.setContent(html, { waitUntil: ["load", "networkidle0"], timeout: 30000 });
          await page.evaluate(async () => { await document.fonts.ready; });
          return await page.screenshot({ type: "jpeg", quality: 70, fullPage: true, encoding: "base64" });
        } catch (e) {
           // Reset browser on error and kill orphaned processes
           if (sharedBrowser) { 
             try { await sharedBrowser.close(); } catch {} 
             sharedBrowser = null; 
             browserUsageCount = 0; 
           }
           await killOrphanedChrome();
           forceGC();
           throw e;
        } finally {
           if (page) await page.close().catch(() => {});
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
      const isPaid = user?.plan && (user.plan.includes("pro") || user.plan.includes("scale") || user.plan.includes("business"));
      if (!isPaid) return res.status(403).json({ error: "Pro feature required" });
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
    res.json(user ? { plan: user.plan, planStatus: user.planStatus, stripeCustomerId: user.stripeCustomerId, stripeSubscriptionId: user.stripeSubscriptionId, aiCredits: user.aiCredits || 0, aiCreditsLimit: user.aiCreditsLimit || 0, aiCreditsResetDate: user.aiCreditsResetDate, pdfUsageCount: user.pdfUsageCount || 0, pdfUsageResetDate: user.pdfUsageResetDate } : { subscription: null, plan: "free" });
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