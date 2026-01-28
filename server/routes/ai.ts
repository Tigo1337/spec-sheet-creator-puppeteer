/**
 * AI-related API routes
 * Handles data enrichment, standardization, field mapping, product knowledge, and LAYOUT ANALYSIS.
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

// Use the specific model requested for Vision tasks
const visionModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: { responseMimeType: "application/json" }
});

const textModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: { responseMimeType: "application/json" }
});

/**
 * NEW: POST /api/ai/analyze-layout
 * Analyzes a PDF page image to detect separate images and tables.
 */
router.post("/analyze-layout", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  const { image } = req.body; // Expecting Base64 Data URL

  if (!image) return res.status(400).json({ error: "No image provided" });

  try {
    // 1. Prepare the image part for Gemini
    const base64Data = image.split(",")[1]; // Remove "data:image/png;base64," prefix

    const prompt = `
      Analyze this document page layout. I need to extract distinct visual elements to reconstruct it digitally.
      1. Identify all **Visual Images** (logos, product photos, icons).
      2. Identify all **Data Tables** (grids).
      3. Identify all **Text Regions** (paragraphs, headings, bulleted lists). Group multi-line paragraphs and lists into a SINGLE bounding box. Do not split lines.

      Return JSON:
      {
        "images": [{ "box_2d": [y1, x1, y2, x2], "label": "string" }],
        "tables": [{ "box_2d": [y1, x1, y2, x2], "rows": number, "cols": number }],
        "text_regions": [{ "box_2d": [y1, x1, y2, x2], "type": "paragraph" | "heading" | "list" }]
      }

      Important:
      - "box_2d" coordinates must be normalized to 0-1000 scale.
      - Do not hallucinate elements. If no elements of a type exist, return an empty array.
    `;

    // 2. Generate Content
    const result = await visionModel.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: "image/png",
        },
      },
    ]);

    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    const layoutData = JSON.parse(cleanJson);

    res.json(layoutData);

  } catch (error) {
    console.error("Layout Analysis Error:", error);
    res.status(500).json({ error: "AI Layout Analysis failed", details: String(error) });
  }
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
        result = await textModel.generateContent(prompt);
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
        result = await textModel.generateContent(prompt);
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

    // Save to knowledge base logic...
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
    const result = await textModel.generateContent(prompt);
    res.json(JSON.parse(result.response.text().replace(/```json|```/g, "").trim()));
  } catch {
    res.status(500).json({ error: "AI Mapping failed" });
  }
});

export default router;
