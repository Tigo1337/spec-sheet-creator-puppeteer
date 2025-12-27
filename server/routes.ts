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

const pdfQueue = {
  active: 0,
  limit: 3, 
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

// --- AI CREDIT HELPER (UPDATED) ---
// Cost is in "Credit Cents". 100 Cents = 1 Credit.
async function checkAndDeductAiCredits(userId: string, costCents: number): Promise<boolean> {
  const user = await storage.getUser(userId);
  if (!user) return false;

  let currentCredits = user.aiCredits || 0;
  const lastReset = user.aiCreditsResetDate ? new Date(user.aiCreditsResetDate) : new Date(0);
  const now = new Date();

  // LOGIC FIX: Check for monthly reset for ALL plans (Annual plans need this)
  const oneDay = 1000 * 60 * 60 * 24;
  const daysSinceReset = (now.getTime() - lastReset.getTime()) / oneDay;

  // If > 30 days have passed, refill credits (Lazy Reset)
  if (daysSinceReset >= 30) {
      const limit = user.aiCreditsLimit || 0;
      console.log(`[AI Limit] Monthly reset triggered for ${userId}. Refilling to ${limit}`);

      // Update local variable for immediate check
      currentCredits = limit; 

      // If they still can't afford it after reset (unlikely unless cost > limit), fail
      if (currentCredits < costCents) return false;

      // Apply Reset & Deduction atomically
      await storage.updateUser(userId, { 
          aiCredits: currentCredits - costCents,
          aiCreditsResetDate: now
      });
      return true;
  }

  // Normal Deduction
  if (currentCredits < costCents) {
      return false;
  }

  await storage.updateUser(userId, { 
    aiCredits: currentCredits - costCents 
  });

  return true;
}

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
      if (currencyPlacement === 'after') { instructions += "Place the currency symbol AFTER the number. "; } else { instructions += "Place the currency symbol BEFORE the number. "; }
      if (currencySpacing) { instructions += "Insert a single space between the symbol and the number (e.g. '$ 10'). "; } else { instructions += "Do NOT place a space between the symbol and the number (e.g. '$10'). "; }
      if (currencyDecimals === 'whole') { instructions += "Round all values to the nearest whole number (no decimals). "; } else if (currencyDecimals === 'two') { instructions += "Ensure exactly two decimal places for all values (e.g. 10.00). "; }
      if (currencyThousandSeparator) { instructions += "Use a comma as a thousand separator (e.g. 1,000). "; } else { instructions += "Do NOT use thousand separators (e.g. 1000). "; }
      break;
    case "measurements":
      const unit = measurementUnit || 'cm';
      const format = measurementFormat || 'abbr';
      const spacing = measurementSpacing !== false; 
      const fullUnits: Record<string, string> = { 'in': 'inches', 'cm': 'centimeters', 'mm': 'millimeters', 'lb': 'pounds', 'kg': 'kilograms' };
      const targetUnit = format === 'full' ? (fullUnits[unit] || unit) : unit;
      const spaceChar = spacing ? " " : "";
      instructions = `Identify ALL numeric values in the text. Treat them as measurements. Format them to use the unit "${targetUnit}".
      Formatting Rules:
      1. Append "${targetUnit}" to every number found.${spacing ? ' Insert a space between number and unit.' : ' Do NOT put a space between number and unit.'}
      2. If a field contains multiple numbers or dimensions (e.g. "L x W x H" or "10, 20, 30"), apply the unit to EACH number.
      3. Keep original separators (x, by, -, etc) intact.`;
      break;
    case "title_case":
      instructions = "Convert the text to Title Case (Capitalize First Letter of Each Major Word).";
      break;
    case "uppercase":
      instructions = "Convert the text to UPPERCASE.";
      break;
    case "clean_text":
      instructions = "Remove all special characters, emojis, and HTML tags. Keep only plain text and punctuation.";
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
  1. Do NOT use actual newline characters (\\n) or the Enter key in your output.
  2. If you need to separate sentences or lines, you MUST use the HTML tag "<br>" instead.
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

    app.get("/health", async (req, res) => {
    const health = {
      uptime: process.uptime(),
      timestamp: Date.now(),
      status: "OK",
      checks: { database: "unknown", stripe: "unknown" }
    };
    try {
      await storage.getUser("health-check-probe");
      health.checks.database = "connected";
    } catch (e) {
      health.checks.database = "disconnected";
      health.status = "DEGRADED";
      console.error("Health check failed: Database", e);
    }
    if (process.env.STRIPE_SECRET_KEY) { health.checks.stripe = "configured"; } else { health.checks.stripe = "missing_key"; }
    const httpCode = health.status === "OK" ? 200 : 503;
    res.status(httpCode).json(health);
  });

  // ============================================
  // AI DATA ENRICHMENT ROUTE (Generation)
  // COST: 1.00 Credit per row (100 Cents)
  // ============================================
  app.post("/api/ai/enrich-data", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

    const { rows, config, anchorColumn, customFieldName } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: "No data rows provided" });
    }

    // 1. CREDIT CHECK
    // Cost = Rows * 100 cents (1 Credit)
    const cost = rows.length * 100; 
    const allowed = await checkAndDeductAiCredits(auth.userId, cost);
    if (!allowed) {
        return res.status(403).json({ 
            error: "Insufficient AI Credits",
            message: "You have run out of AI credits. Upgrade to Scale for more."
        });
    }

    // Default to marketing if no config provided
    const enrichmentConfig = config || { type: 'marketing', tone: 'Professional' };
    const selectedInstructions = buildDynamicPrompt(enrichmentConfig);
    const limitedRows = rows.slice(0, 50); 

    try {
      const prompt = `
        You are an expert content generator for product catalogs.
        TASK: ${selectedInstructions}
        INSTRUCTIONS:
        1. I will provide a JSON array of data rows.
        2. For EACH row, look at ALL available fields to understand the product.
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
          if (e.status === 429 || e.status === 503 || e.message?.includes("429")) {
            attempts++;
            if (attempts >= maxAttempts) throw e;
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
          } else { throw e; }
        }
      }

      if (!result) throw new Error("AI Generation failed");
      const cleanText = result.response.text().replace(/```json|```/g, "").trim();
      let generatedContent = JSON.parse(cleanText);

      // --- KNOWLEDGE BASE SAVE (Gate: Scale Plan Only) ---
      if (anchorColumn && auth.userId) {
         const user = await storage.getUser(auth.userId);
         // UPDATED: Check if plan includes 'scale'
         if (user?.plan && (user.plan.includes("scale") || user.plan.includes("business"))) {
             try {
                 const knowledgeItems = limitedRows.map((row: any, i: number) => {
                     const keyVal = row[anchorColumn];
                     const content = generatedContent[i];
                     if (!keyVal || !content) return null;
                     return {
                         keyName: anchorColumn,
                         productKey: String(keyVal).trim(),
                         fieldType: customFieldName || enrichmentConfig.type, 
                         content: String(content)
                     };
                 }).filter((item: any) => item !== null);

                 if (knowledgeItems.length > 0) {
                     await storage.batchSaveProductKnowledge(auth.userId, knowledgeItems);
                 }
             } catch (saveError) {
                 console.error("[AI Memory] Failed to save knowledge:", saveError);
             }
         }
      }

      res.json({ generatedContent });
    } catch (error) {
      console.error("Enrichment Error:", error);
      res.status(500).json({ error: "Failed to generate content" });
    }
  });

  // ============================================
  // AI STANDARDIZATION ROUTE
  // COST: 0.25 Credit per row (25 Cents)
  // ============================================
  app.post("/api/ai/standardize", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

    const { values, config, instruction } = req.body;
    if (!values || !Array.isArray(values)) return res.status(400).json({ error: "Invalid data" });

    // 1. CREDIT CHECK
    // Cost = Values * 25 cents (0.25 Credit)
    const cost = values.length * 25; 
    const allowed = await checkAndDeductAiCredits(auth.userId, cost);
    if (!allowed) {
        return res.status(403).json({ 
            error: "Insufficient AI Credits",
            message: "You have run out of AI credits. Upgrade to Scale for more."
        });
    }

    let finalInstruction = config ? buildDynamicPrompt(config) : (instruction || "Standardize the format.");
    const processValues = values.slice(0, 1000);

    try {
      const prompt = `
        You are a data standardization engine.
        TASK: "${finalInstruction}"
        INPUT DATA (JSON Array): ${JSON.stringify(processValues)}
        STRICT RULES:
        1. Return a JSON array of strings of the EXACT same length as the input.
        2. Apply the TASK to format each item.
        3. If a value is missing/null, keep it as empty string "".
        4. If a value is already correct, keep it as is.
        5. NO Markdown. NO Explanations. Just the JSON array.
        CRITICAL FORMATTING RULE:
        8. Do not use newlines in the JSON string output unless escaped. Use <br> if multi-line text is absolutely required inside a field.
      `;

      let result;
      let attempts = 0;
      while (attempts < 3) {
        try {
          result = await aiModel.generateContent(prompt);
          break;
        } catch (e: any) {
           if (e.status === 429 || e.status === 503) {
            attempts++;
            if (attempts >= 3) throw e;
            await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
           } else { throw e; }
        }
      }

      const text = result.response.text().replace(/```json|```/g, "").trim();
      const standardized = JSON.parse(text);
      res.json({ standardized });
    } catch (error) {
      console.error("Standardize Error:", error);
      res.status(500).json({ error: "Processing failed" });
    }
  });

  // ============================================
  // KNOWLEDGE BASE ROUTES (Gate: Scale Plan)
  // ============================================
  app.post("/api/ai/knowledge/check", async (req, res) => {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

      // Gate Check
      const user = await storage.getUser(auth.userId);
      const hasAccess = user?.plan && (user.plan.includes("scale") || user.plan.includes("business"));

      if (!hasAccess) {
          return res.status(403).json({ error: "Feature locked", matches: {} });
      }

      const { keys, keyName } = req.body;
      if (!keys || !Array.isArray(keys) || keys.length === 0 || !keyName) {
          return res.json({ matches: {} });
      }

      try {
          const lookupKeys = keys.slice(0, 100);
          const results = await storage.batchGetProductKnowledge(auth.userId, lookupKeys, keyName);
          const map: Record<string, Record<string, string>> = {};
          results.forEach(item => {
              if (!map[item.productKey]) map[item.productKey] = {};
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

  app.get("/api/ai/knowledge", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const items = await storage.getAllProductKnowledge(auth.userId);
      res.json(items);
    } catch (error) { res.status(500).json({ error: "Failed to fetch knowledge base" }); }
  });

  app.delete("/api/ai/knowledge/:id", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const success = await storage.deleteProductKnowledge(req.params.id, auth.userId);
      if (success) { res.sendStatus(204); } else { res.status(404).json({ error: "Item not found" }); }
    } catch (error) { res.status(500).json({ error: "Failed to delete item" }); }
  });

  app.put("/api/ai/knowledge/:id", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "Content is required" });
    try {
      const updated = await storage.updateProductKnowledge(req.params.id, auth.userId, content);
      if (updated) { res.json(updated); } else { res.status(404).json({ error: "Item not found" }); }
    } catch (error) { res.status(500).json({ error: "Failed to update item" }); }
  });

  app.post("/api/ai/map-fields", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

    const { sourceHeaders, targetVariables } = req.body;

    if (!sourceHeaders || !targetVariables) {
      return res.status(400).json({ error: "Missing headers or targets" });
    }

    try {
      const prompt = `
        You are a strict data mapping engine.
        INPUT DATA:
        1. **Source Headers** (Columns in User's CSV): ${JSON.stringify(sourceHeaders)}
        2. **Allowed Targets** (Variables in User's Template): ${JSON.stringify(targetVariables)}
        **YOUR GOAL:**
        For each "Source Header", determine if it semantically matches EXACTLY ONE of the "Allowed Targets".
        **CRITICAL CONSTRAINTS (DO NOT IGNORE):**
        1. **NO NEW TARGETS:** The 'target' field in your JSON **MUST** be an exact string from the "Allowed Targets" list above. 
        2. **SEMANTIC MATCHING ONLY:** - Match synonyms (e.g., Source "Dimensions" -> Target "Measurements").
        3. **CONFIDENCE:** 1.0 = Perfect synonym or exact match.
        4. **OUTPUT:** Return a clean JSON array of objects: { "source": string, "target": string, "confidence": number }.
        5. **FILTER:** Only return mappings with confidence > 0.8.
      `;

      let result;
      let attempts = 0;
      while (attempts < 3) {
        try {
          result = await aiModel.generateContent(prompt);
          break; 
        } catch (e: any) {
          if (e.status === 429 || e.status === 503 || e.message?.includes("Overloaded")) {
            attempts++;
            if (attempts >= 3) throw e; 
            const delay = Math.pow(2, attempts) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          } else { throw e; }
        }
      }

      if (!result) throw new Error("AI request failed after retries");

      const responseText = result.response.text();
      const cleanText = responseText.replace(/```json|```/g, "").trim();
      const mapping = JSON.parse(cleanText);
      const rawMapping = Array.isArray(mapping) ? mapping : (mapping.mapping || mapping.matches || []);
      const validTargets = new Set(targetVariables);
      const finalMapping = rawMapping.filter((m: any) => validTargets.has(m.target));

      res.json(finalMapping);

    } catch (error) {
      console.error("Gemini Mapping Error:", error);
      res.status(500).json({ error: "AI Mapping failed" });
    }
  });

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

  app.post("/api/export/pdf", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

    let { html, width, height, scale = 2, colorModel = 'rgb' } = req.body;
    if (!html || !width || !height) return res.status(400).json({ error: "Missing required parameters" });

    try {
      const user = await storage.getUser(auth.userId);
      const isPaid = user?.plan && (user.plan.includes("pro") || user.plan.includes("scale") || user.plan.includes("business")); 

      if (!isPaid) {
        if (colorModel === 'cmyk') colorModel = 'rgb';
        const usage = await storage.checkAndIncrementUsage(auth.userId);
        if (!usage.allowed) {
          return res.status(403).json({ 
            error: "Monthly PDF limit reached (50/50). Upgrade to Pro for unlimited exports." 
          });
        }
        if (!html.includes("Created with <b>Doculoom</b>")) {
           const watermarkStyle = `
             position: fixed; bottom: 16px; right: 16px; opacity: 0.5; z-index: 9999; 
             font-family: sans-serif; font-size: 12px; color: #000000; 
             background-color: rgba(255,255,255,0.7); padding: 4px 8px; border-radius: 4px;
             pointer-events: none;
           `;
           const watermarkDiv = `<div style="${watermarkStyle}">Created with <b>Doculoom</b></div>`;
           html = html.replace("</body>", `${watermarkDiv}</body>`);
        }
      }

      const pdfBuffer = await pdfQueue.add(async () => {
        const browser = await puppeteer.launch({
          headless: true,
          executablePath: process.env.NIX_CHROMIUM_WRAPPER || puppeteer.executablePath(),
          args: [
            '--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', 
            '--disable-dev-shm-usage', '--font-render-hinting=none', 
            '--disable-extensions', '--no-first-run', '--no-zygote'
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

      if (isPaid && colorModel === 'cmyk') {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const inputPath = path.resolve(`/tmp/input_${timestamp}_${randomId}.pdf`);
        const outputPath = path.resolve(`/tmp/output_${timestamp}_${randomId}.pdf`);

        try {
            await fs.promises.writeFile(inputPath, finalBuffer);
            await execFileAsync('gs', [
                '-o', outputPath, '-sDEVICE=pdfwrite', '-sColorConversionStrategy=CMYK',
                '-dProcessColorModel=/DeviceCMYK', '-dPDFSETTINGS=/prepress',
                '-dSAFER', '-dBATCH', '-dNOPAUSE', inputPath
            ]);
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
      if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

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

  app.post("/api/qrcodes", async (req, res) => {
    try {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
      const user = await storage.getUser(auth.userId);
      const isPaid = user?.plan && (user.plan.includes("pro") || user.plan.includes("scale") || user.plan.includes("business"));
      if (!isPaid) return res.status(403).json({ error: "Dynamic QR Codes are a Pro feature." });

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
      const user = await storage.getUser(auth.userId);
      const isPaid = user?.plan && (user.plan.includes("pro") || user.plan.includes("scale") || user.plan.includes("business"));
      if (!isPaid) return res.status(403).json({ error: "Managing QR Codes is a Pro feature." });

      const updated = await storage.updateQRCode(req.params.id, auth.userId, req.body.destinationUrl);
      if (!updated) return res.status(404).json({ error: "QR Code not found" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update QR code" });
    }
  });

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

  app.get("/api/plans", async (req, res) => {
    try {
      const prices = await stripeService.getActivePrices();
      res.json(prices);
    } catch (error) {
      console.error("Failed to fetch plans:", error);
      res.status(500).json({ error: "Failed to fetch plans" });
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
            details: "Could not retrieve email from Clerk." 
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
        // NEW: Usage Stats
        aiCredits: user.aiCredits || 0,
        aiCreditsLimit: user.aiCreditsLimit || 0,
        aiCreditsResetDate: user.aiCreditsResetDate,
        pdfUsageCount: user.pdfUsageCount || 0,
        pdfUsageResetDate: user.pdfUsageResetDate,
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
        }

        if (!email) return res.status(400).json({ error: "User email not found." });
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