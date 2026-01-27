/**
 * AI-related API routes
 * Handles data enrichment, standardization, field mapping, and product knowledge management
 */

import { Router } from "express";
import { getAuth } from "@clerk/express";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from "../storage";
import { checkAndDeductAiCredits } from "../middleware/auth";
import { buildDynamicPrompt, EnrichmentConfig } from "../utils/helpers";

const router = Router();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const aiModel = genAI.getGenerativeModel({
  model: "gemini-2.5-flash-lite",
  generationConfig: { responseMimeType: "application/json" }
});

/**
 * POST /api/ai/enrich-data
 * Enrich product data using AI based on configuration
 */
router.post("/enrich-data", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  const { rows, config, anchorColumn, customFieldName } = req.body;

  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: "No data rows provided" });
  }

  const cost = rows.length * 100;
  const allowed = await checkAndDeductAiCredits(auth.userId, cost);
  if (!allowed) {
    return res.status(403).json({ error: "Insufficient AI Credits", message: "Upgrade to Scale for more." });
  }

  const enrichmentConfig: EnrichmentConfig = config || { type: 'marketing', tone: 'Professional' };
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
      try {
        result = await aiModel.generateContent(prompt);
        break;
      } catch (e: unknown) {
        const error = e as { status?: number };
        if (error.status === 429 || error.status === 503) {
          attempts++;
          await new Promise(r => setTimeout(r, 1000 * attempts));
        } else {
          throw e;
        }
      }
    }
    if (!result) throw new Error("AI Generation failed");

    const generatedContent = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
    const usage = result.response.usageMetadata;

    // Log AI request with token counts
    storage.logAiRequest({
      userId: auth.userId,
      requestType: "enrich",
      promptContent: prompt,
      generatedResponse: JSON.stringify(generatedContent),
      tokenCost: cost,
      promptTokens: usage?.promptTokenCount || 0,
      completionTokens: usage?.candidatesTokenCount || 0
    }).catch(err => console.error("Failed to log AI request:", err));

    // Save to knowledge base for scale/business users
    if (anchorColumn && auth.userId) {
      const user = await storage.getUser(auth.userId);
      if (user?.plan && (user.plan.includes("scale") || user.plan.includes("business"))) {
        try {
          const knowledgeItems = limitedRows.map((row: Record<string, unknown>, i: number) => {
            const keyVal = row[anchorColumn];
            const content = generatedContent[i];
            if (!keyVal || !content) return null;
            return {
              keyName: anchorColumn,
              productKey: String(keyVal).trim(),
              fieldType: customFieldName || enrichmentConfig.type,
              content: String(content)
            };
          }).filter((item: unknown) => item !== null);

          if (knowledgeItems.length > 0) {
            await storage.batchSaveProductKnowledge(auth.userId, knowledgeItems as Array<{
              keyName: string;
              productKey: string;
              fieldType: string;
              content: string;
            }>);
          }
        } catch (e) {
          console.error("Memory save failed", e);
        }
      }
    }

    res.json({ generatedContent });
  } catch (error) {
    console.error("Enrichment Error:", error);
    res.status(500).json({ error: "Failed to generate content" });
  }
});

/**
 * POST /api/ai/standardize
 * Standardize column values using AI
 */
router.post("/standardize", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  const { values, config, instruction, keys, keyName, fieldName } = req.body;

  if (!values?.length) return res.status(400).json({ error: "Invalid data" });

  const allowed = await checkAndDeductAiCredits(auth.userId, values.length * 25);
  if (!allowed) return res.status(403).json({ error: "Insufficient AI Credits" });

  try {
    const prompt = `Task: ${config ? buildDynamicPrompt(config) : (instruction || "Standardize")}\nInput: ${JSON.stringify(values.slice(0, 1000))}\nOutput: JSON Array of strings.`;

    let result, attempts = 0;
    while (attempts < 3) {
      try {
        result = await aiModel.generateContent(prompt);
        break;
      } catch (e: unknown) {
        const error = e as { status?: number };
        if (error.status === 429 || error.status === 503) {
          attempts++;
          await new Promise(r => setTimeout(r, 1000 * attempts));
        } else {
          throw e;
        }
      }
    }

    if (!result) throw new Error("AI Generation failed");

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

    // Save to knowledge base for scale/business users
    if (keys && keys.length > 0 && keyName && fieldName) {
      const user = await storage.getUser(auth.userId);
      if (user?.plan && (user.plan.includes("scale") || user.plan.includes("business"))) {
        try {
          const knowledgeItems = keys.map((key: string, i: number) => {
            const content = standardized[i];
            if (!key || !content) return null;
            return {
              keyName: keyName,
              productKey: String(key).trim(),
              fieldType: fieldName,
              content: String(content)
            };
          }).filter((item: unknown) => item !== null);

          if (knowledgeItems.length > 0) {
            await storage.batchSaveProductKnowledge(auth.userId, knowledgeItems as Array<{
              keyName: string;
              productKey: string;
              fieldType: string;
              content: string;
            }>);
          }
        } catch (e) {
          console.error("Memory save failed for standardize", e);
        }
      }
    }

    res.json({ standardized });
  } catch (error) {
    console.error("Standardize Error:", error);
    res.status(500).json({ error: "Processing failed" });
  }
});

/**
 * POST /api/ai/knowledge/check
 * Check for existing knowledge matches
 */
router.post("/knowledge/check", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

  const user = await storage.getUser(auth.userId);
  if (!(user?.plan && (user.plan.includes("scale") || user.plan.includes("business")))) {
    return res.status(403).json({ error: "Feature locked", matches: {} });
  }

  const { keys, keyName } = req.body;
  if (!keys?.length) return res.json({ matches: {} });

  try {
    const results = await storage.batchGetProductKnowledge(auth.userId, keys.slice(0, 100), keyName);
    const map: Record<string, Record<string, string>> = {};
    results.forEach(item => {
      if (!map[item.productKey]) map[item.productKey] = {};
      map[item.productKey][item.fieldType] = item.content;
    });
    res.json({ matches: map });
  } catch (e) {
    res.status(500).json({ error: "Error" });
  }
});

/**
 * GET /api/ai/knowledge
 * Get all product knowledge for the user
 */
router.get("/knowledge", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  try {
    res.json(await storage.getAllProductKnowledge(auth.userId));
  } catch {
    res.status(500).json({ error: "Error" });
  }
});

/**
 * DELETE /api/ai/knowledge/:id
 * Delete a specific knowledge entry
 */
router.delete("/knowledge/:id", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  try {
    const success = await storage.deleteProductKnowledge(req.params.id, auth.userId);
    res.sendStatus(success ? 204 : 404);
  } catch {
    res.status(500).json({ error: "Error" });
  }
});

/**
 * PUT /api/ai/knowledge/:id
 * Update a specific knowledge entry
 */
router.put("/knowledge/:id", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  try {
    const updated = await storage.updateProductKnowledge(req.params.id, auth.userId, req.body.content);
    res.json(updated || { error: "Not found" });
  } catch {
    res.status(500).json({ error: "Error" });
  }
});

/**
 * POST /api/ai/map-fields
 * Map source headers to target variables using AI
 */
router.post("/map-fields", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  try {
    const prompt = `Match columns ${JSON.stringify(req.body.sourceHeaders)} to ${JSON.stringify(req.body.targetVariables)}. Return JSON array [{source, target, confidence}].`;
    const result = await aiModel.generateContent(prompt);
    res.json(JSON.parse(result.response.text().replace(/```json|```/g, "").trim()));
  } catch {
    res.status(500).json({ error: "AI Mapping failed" });
  }
});

/**
 * POST /api/ai/analyze-layout
 * Analyze a PDF page image using Computer Vision to detect images and tables
 * Input: { image: string } - Base64 Data URL of the PDF page
 * Output: { images: [...], tables: [...] }
 */
router.post("/analyze-layout", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

  const { image } = req.body;

  if (!image || typeof image !== "string") {
    return res.status(400).json({ error: "Invalid input: 'image' must be a Base64 Data URL string" });
  }

  // Extract MIME type and base64 data from Data URL
  const dataUrlMatch = image.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!dataUrlMatch) {
    return res.status(400).json({ error: "Invalid image format: must be a valid Base64 Data URL" });
  }

  const mimeType = dataUrlMatch[1];
  const base64Data = dataUrlMatch[2];

  // Use vision-capable model for layout analysis
  const visionModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: { responseMimeType: "application/json" }
  });

  const prompt = `You are a document layout analysis AI. Analyze this PDF page image and detect:

1. **Distinct Visual Elements (Images)**: Logos, product photos, icons, diagrams, charts, or any non-text visual content.
2. **Data Tables**: Structured tabular data with rows and columns.

For each detected element, provide:
- **Images**: A bounding box (box_2d) as [ymin, xmin, ymax, xmax] in a normalized 0-1000 scale, and a descriptive label.
- **Tables**: A bounding box (box_2d) as [ymin, xmin, ymax, xmax] in 0-1000 scale, estimated row count (rows), and estimated column count (cols).

IMPORTANT:
- Coordinates use a 0-1000 normalized scale where (0,0) is top-left and (1000,1000) is bottom-right.
- box_2d format is [ymin, xmin, ymax, xmax] - note Y comes before X.
- Only detect clearly visible images and tables, not text blocks.
- For tables, count visible header row + data rows for rowCount.
- Be conservative: only include elements you are confident about.

Return a JSON object with this exact structure:
{
  "images": [
    { "box_2d": [ymin, xmin, ymax, xmax], "label": "description" }
  ],
  "tables": [
    { "box_2d": [ymin, xmin, ymax, xmax], "rows": number, "cols": number }
  ]
}

If no images or tables are detected, return empty arrays.`;

  try {
    let result;
    let attempts = 0;

    while (attempts < 3) {
      try {
        result = await visionModel.generateContent([
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]);
        break;
      } catch (e: unknown) {
        const error = e as { status?: number; message?: string };
        // Retry on rate limits or temporary errors
        if (error.status === 429 || error.status === 503) {
          attempts++;
          await new Promise(r => setTimeout(r, 1000 * attempts));
        } else {
          throw e;
        }
      }
    }

    if (!result) {
      throw new Error("AI layout analysis failed after retries");
    }

    const responseText = result.response.text().replace(/```json|```/g, "").trim();
    const analysisResult = JSON.parse(responseText);
    const usage = result.response.usageMetadata;

    // Validate and sanitize the response structure
    const sanitizedResult = {
      images: Array.isArray(analysisResult.images)
        ? analysisResult.images.filter((img: unknown) => {
            if (typeof img !== 'object' || img === null) return false;
            const i = img as { box_2d?: unknown; label?: unknown };
            return Array.isArray(i.box_2d) && i.box_2d.length === 4 && typeof i.label === 'string';
          }).map((img: { box_2d: number[]; label: string }) => ({
            box_2d: img.box_2d.map((v: number) => Math.max(0, Math.min(1000, Math.round(v)))),
            label: img.label
          }))
        : [],
      tables: Array.isArray(analysisResult.tables)
        ? analysisResult.tables.filter((tbl: unknown) => {
            if (typeof tbl !== 'object' || tbl === null) return false;
            const t = tbl as { box_2d?: unknown; rows?: unknown; cols?: unknown };
            return Array.isArray(t.box_2d) && t.box_2d.length === 4 &&
                   typeof t.rows === 'number' && typeof t.cols === 'number';
          }).map((tbl: { box_2d: number[]; rows: number; cols: number }) => ({
            box_2d: tbl.box_2d.map((v: number) => Math.max(0, Math.min(1000, Math.round(v)))),
            rows: Math.max(1, Math.round(tbl.rows)),
            cols: Math.max(1, Math.round(tbl.cols))
          }))
        : []
    };

    // Log AI request for analytics
    storage.logAiRequest({
      userId: auth.userId,
      requestType: "analyze-layout",
      promptContent: prompt,
      generatedResponse: JSON.stringify(sanitizedResult),
      tokenCost: 50, // Layout analysis cost
      promptTokens: usage?.promptTokenCount || 0,
      completionTokens: usage?.candidatesTokenCount || 0
    }).catch(err => console.error("Failed to log AI request:", err));

    res.json(sanitizedResult);
  } catch (error) {
    console.error("Layout Analysis Error:", error);
    res.status(500).json({
      error: "Failed to analyze layout",
      images: [],
      tables: []
    });
  }
});

export default router;
