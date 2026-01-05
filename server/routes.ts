import type { Express } from "express";
import { createServer, type Server } from "http";
import { getAuth, clerkClient } from "@clerk/express";
import { storage } from "./storage";
import {
  ObjectStorageService,
  ObjectNotFoundError,
  objectStorageClient,
} from "./objectStorage";
import { insertTemplateSchema, insertSavedDesignSchema, insertQrCodeSchema, exportJobsTable } from "@shared/schema";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Storage } from "@google-cloud/storage";
import { desc, eq } from "drizzle-orm";

// --- ANTI-ABUSE HELPER ---
function normalizeEmail(email: string): string {
  const [localPart, domain] = email.toLowerCase().split('@');
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    // Gmail ignores '.' and everything after '+'
    const cleanLocal = localPart.split('+')[0].replace(/\./g, '');
    return `${cleanLocal}@${domain}`;
  }
  return email.toLowerCase();
}

// --- HELPER FUNCTIONS ---
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

async function generateSignedDownloadUrl(jobId: string, fileName: string, type: string) {
  const gcsKey = process.env.GCLOUD_KEY_JSON;
  if (!gcsKey) return null;
  try {
    const externalStorage = new Storage({ credentials: JSON.parse(gcsKey) });
    const bucketName = "doculoom-exports";
    const ext = type === "pdf_bulk" ? "zip" : "pdf";
    const gcsPath = `exports/${jobId}.${ext}`;
    const [url] = await externalStorage.bucket(bucketName).file(gcsPath).getSignedUrl({
        version: 'v4', action: 'read', expires: Date.now() + 60 * 60 * 1000, 
        responseDisposition: `attachment; filename="${fileName.replace(/"/g, '\\"')}"`
      });
    return url;
  } catch (e) {
    console.error(`Failed to sign URL for job ${jobId}`, e);
    return null;
  }
}

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
      currentCredits = limit; 
      if (currentCredits < costCents) return false;
      await storage.updateUser(userId, { aiCredits: currentCredits - costCents, aiCreditsResetDate: now });
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
  targetLanguage?: string; 
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
     type, tone, targetLanguage, currencySymbol, currencyPlacement, 
     currencySpacing, currencyDecimals, currencyThousandSeparator, 
     measurementUnit, measurementFormat, measurementSpacing 
   } = config;

  let instructions = "";

  switch (type) {
    case "marketing": instructions = "Write a compelling marketing description highlighting key features."; break;
    case "seo": instructions = "Write a short, punchy, SEO-optimized product title (under 60 chars)."; break;
    case "features": instructions = "Extract the technical specs and return them as a bulleted list (use • character)."; break;
    case "email": instructions = "Write a short, persuasive sales email blurb introducing this product."; break;
    case "social": instructions = "Write an engaging social media caption with relevant hashtags."; break;

    case "translation": 
      instructions = `Translate the provided text strictly into ${targetLanguage || 'English'}. Ensure regional nuances are respected. Keep any HTML like "<br>" exactly as is.`; 
      break;

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

  if (tone && !['currency', 'measurements', 'title_case', 'uppercase', 'clean_text'].includes(type)) { 
    instructions += ` Tone: ${tone}.`; 
  }

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
    if (!auth.userId) return res.status(401).json({ error: "Auth required" });
    const { rows, config, anchorColumn, customFieldName } = req.body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: "No data rows provided" });

    const cost = rows.length * 100; 
    const allowed = await checkAndDeductAiCredits(auth.userId, cost);
    if (!allowed) return res.status(403).json({ error: "Insufficient AI Credits", message: "Upgrade to Scale for more." });

    const enrichmentConfig = config || { type: 'marketing', tone: 'Professional' };
    const selectedInstructions = buildDynamicPrompt(enrichmentConfig);
    const limitedRows = rows.slice(0, 50); 

    try {
      const prompt = `
      CRITICAL SYSTEM INSTRUCTION: 
      You are processing a batch of totally independent data items.
      1. Treat each item in the "Data" array as a SEPARATE request. 
      2. Do NOT allow information, context, or descriptions from one row to influence another. 
      3. Do NOT use any outside knowledge (like real-world facts about a product) unless explicitly asked. Only use the data provided in the specific row object.

      Task: ${selectedInstructions}

      Data: ${JSON.stringify(limitedRows)}

      Output: JSON Array of strings (one string per row, in the exact same order).`;

      let result;
      let attempts = 0;
      while (attempts < 3) {
        try { result = await aiModel.generateContent(prompt); break; }
        catch (e: any) { if (e.status===429||e.status===503) { attempts++; await new Promise(r => setTimeout(r, 1000*attempts)); } else throw e; }
      }
      if (!result) throw new Error("AI Generation failed");

      const generatedContent = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
      const usage = result.response.usageMetadata;

      // --- LOGGING (Includes Token Counts) ---
      storage.logAiRequest({
          userId: auth.userId,
          requestType: "enrich",
          promptContent: prompt,
          generatedResponse: JSON.stringify(generatedContent),
          tokenCost: cost, // Credits
          promptTokens: usage?.promptTokenCount || 0,
          completionTokens: usage?.candidatesTokenCount || 0
      }).catch(err => console.error("Failed to log AI request:", err));

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
    const { values, config, instruction, keys, keyName, fieldName } = req.body;

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

      const standardized = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
      const usage = result.response.usageMetadata;

      storage.logAiRequest({
          userId: auth.userId,
          requestType: "standardize",
          promptContent: prompt,
          generatedResponse: JSON.stringify(standardized),
          tokenCost: values.length * 25, 
          promptTokens: usage?.promptTokenCount || 0,
          completionTokens: usage?.candidatesTokenCount || 0
      }).catch(err => console.error("Failed to log AI request:", err));

      if (keys && keys.length > 0 && keyName && fieldName) {
          const user = await storage.getUser(auth.userId);
          if (user?.plan && (user.plan.includes("scale") || user.plan.includes("business"))) {
              try {
                  const knowledgeItems = keys.map((key: string, i: number) => {
                      const content = standardized[i];
                      if (!key || !content) return null;
                      return { keyName: keyName, productKey: String(key).trim(), fieldType: fieldName, content: String(content) };
                  }).filter((item: any) => item !== null);

                  if (knowledgeItems.length > 0) await storage.batchSaveProductKnowledge(auth.userId, knowledgeItems);
              } catch (e) { console.error("Memory save failed for standardize", e); }
          }
      }

      res.json({ standardized });
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

  app.get("/api/export/download/:id", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).send("Authentication required");
    try {
        const job = await storage.getExportJob(req.params.id);
        if (!job) return res.status(404).send("Export not found");
        if (job.userId !== auth.userId && !(await checkAdmin(auth.userId))) return res.status(403).send("Forbidden");
        if (job.status !== "completed") return res.status(400).send("Export not ready");
        const signedUrl = await generateSignedDownloadUrl(job.id, job.displayFilename || job.fileName || "Export", job.type);
        if (!signedUrl) return res.status(500).send("Could not retrieve file");
        res.redirect(302, signedUrl);
    } catch (e) { res.status(500).send("Server Error"); }
  });

  app.get("/api/export/history", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
    try {
      const jobs = await storage.getExportHistory(auth.userId);
      const history = jobs.map((job) => ({
          id: job.id, status: job.status, type: job.type, createdAt: job.createdAt, projectName: job.projectName, fileName: job.displayFilename || job.fileName || "Export",
          downloadUrl: job.status === "completed" ? `/api/export/download/${job.id}` : null 
      }));
      res.json(history);
    } catch (error) { res.status(500).json({ error: "Failed to fetch history" }); }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });
    const job = await storage.getExportJob(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.userId !== auth.userId) return res.status(403).json({ error: "Forbidden" });
    res.json({ ...job, fileName: job.displayFilename || job.fileName || "Export", downloadUrl: job.status === "completed" ? `/api/export/download/${job.id}` : null });
  });

  app.post("/api/export/async/pdf", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
    const { html, items, width, height, scale, colorModel, type, projectName, fileName } = req.body;
    if (!html && (!items || items.length === 0)) return res.status(400).json({ error: "Missing content" });
    try {
      const jobType = type === "pdf_catalog" ? "pdf_catalog" : "pdf_single";
      const finalFileName = fileName || (jobType === "pdf_catalog" ? "catalog.pdf" : "export.pdf");
      const job = await storage.createExportJob({ userId: auth.userId, type: jobType, projectName: projectName || "Untitled Project", fileName: finalFileName, displayFilename: finalFileName });
      const externalStorage = new Storage({ credentials: JSON.parse(process.env.GCLOUD_KEY_JSON!) });
      const bucketName = "doculoom-exports";
      let workerData: any = { width, height, scale, colorModel, type: jobType };

      if (html) {
          const inputPath = `inputs/${job.id}.html`;
          await externalStorage.bucket(bucketName).file(inputPath).save(html, { contentType: "text/html", resumable: false });
          workerData.htmlStoragePath = inputPath;
      } else if (items) {
          const uploadedPaths: { htmlStoragePath: string }[] = [];
          await Promise.all(items.map(async (chunkHtml: string, index: number) => {
               const chunkPath = `inputs/${job.id}_part${index}.html`;
               await externalStorage.bucket(bucketName).file(chunkPath).save(chunkHtml, { contentType: "text/html", resumable: false });
               uploadedPaths[index] = { htmlStoragePath: chunkPath };
          }));
          workerData.items = uploadedPaths;
      }

      fetch(`${process.env.PDF_WORKER_URL}/process-job`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job.id, data: workerData }) })
          .catch(err => { storage.updateExportJob(job.id, { status: "failed", error: "Worker timed out" }); });
      res.json({ jobId: job.id, status: "pending" });
    } catch (error) { res.status(500).json({ error: "Failed to start export job" }); }
  });

  app.post("/api/export/async/bulk", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });
    const { items, width, height, scale, colorModel, projectName, fileName } = req.body;
    if (!items || !Array.isArray(items)) return res.status(400).json({ error: "Invalid bulk items" });
    try {
      const finalFileName = fileName || `Bulk_Export_${new Date().toISOString().slice(0,10)}.zip`;
      const job = await storage.createExportJob({ userId: auth.userId, type: "pdf_bulk", fileName: finalFileName, displayFilename: finalFileName, projectName: projectName || "Bulk Export" });
      fetch(`${process.env.PDF_WORKER_URL}/process-job`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job.id, data: { htmlItems: items, width, height, scale, colorModel, type: "pdf_bulk" } }) })
          .catch(err => console.error("Worker trigger failed:", err));
      res.json({ jobId: job.id, status: "pending" });
    } catch (error) { res.status(500).json({ error: "Failed to start bulk export" }); }
  });

  app.get("/api/export/proxy/:id", async (req, res) => {
      const auth = getAuth(req);
      if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });
      try {
        const job = await storage.getExportJob(req.params.id);
        if (!job) return res.status(404).json({ error: "Job not found" });
        if (job.userId !== auth.userId) return res.status(403).json({ error: "Forbidden" });
        const gcsKey = process.env.GCLOUD_KEY_JSON;
        if (!gcsKey) return res.status(500).json({ error: "Configuration error" });
        const storageClient = new Storage({ credentials: JSON.parse(gcsKey) });
        const bucketName = "doculoom-exports";
        const ext = job.type === "pdf_bulk" ? "zip" : "pdf";
        const gcsPath = `exports/${job.id}.${ext}`;
        const file = storageClient.bucket(bucketName).file(gcsPath);
        if (!(await file.exists())[0]) return res.status(404).json({ error: "File not found" });
        res.setHeader('Content-Type', 'application/pdf');
        file.createReadStream().pipe(res);
      } catch (error) { res.status(500).json({ error: "Failed to fetch file" }); }
  });

  app.post("/api/export/preview", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });
    const { html, width, height } = req.body;
    if (!html) return res.status(400).json({ error: "Missing HTML content" });
    const workerUrl = process.env.PDF_WORKER_URL;
    if (!workerUrl) return res.status(500).json({ error: "Configuration error" });
    try {
      const response = await fetch(`${workerUrl}/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html, width: Number(width) || 1200, height: Number(height) || 800 }) });
      if (!response.ok) throw new Error(`Worker returned ${response.status}`);
      const imageBuffer = await response.arrayBuffer();
      res.json({ image: `data:image/png;base64,${Buffer.from(imageBuffer).toString('base64')}` });
    } catch (error) { res.status(500).json({ error: "Failed to generate preview" }); }
  });

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

  // UPDATED: Sync User with Abuse Check
  app.post("/api/users/sync", async (req, res) => {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Auth required" });

    const { fingerprint } = req.body; 
    let user = await storage.getUser(auth.userId);

    if (!user) {
        const clerkUser = await clerkClient.users.getUser(auth.userId);
        const email = clerkUser.emailAddresses[0]?.emailAddress;
        if (!email) return res.status(400).json({ error: "No email" });

        const normalized = normalizeEmail(email);

        // WHITELIST: Allow your own accounts to bypass trial abuse checks
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