/**
 * Assets API routes
 * Handles designs, templates, QR codes, and object storage operations
 */

import { Router } from "express";
import { getAuth } from "@clerk/express";
import { storage } from "../storage";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../objectStorage";
import { insertTemplateSchema, insertSavedDesignSchema, insertQrCodeSchema } from "@shared/schema";
import { checkAdmin } from "../middleware/auth";

const router = Router();
const objectStorageService = new ObjectStorageService();

// ============================================
// QR CODE ROUTES
// ============================================

/**
 * POST /api/qrcodes
 * Create a new QR code (Pro feature)
 */
router.post("/qrcodes", async (req, res) => {
  try {
    const auth = getAuth(req);
    if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

    const user = await storage.getUser(auth.userId);
    const isPaid = user?.plan && (user.plan.includes("pro") || user.plan.includes("scale") || user.plan.includes("business"));
    if (!isPaid) return res.status(403).json({ error: "Pro feature required" });

    const data = insertQrCodeSchema.parse(req.body);
    res.status(201).json(await storage.createQRCode(auth.userId, data.destinationUrl, data.designId));
  } catch (e: unknown) {
    const error = e as { message?: string };
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/qrcodes
 * Get all QR codes for the current user
 */
router.get("/qrcodes", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  res.json(await storage.getQRCodesByUser(auth.userId));
});

/**
 * PUT /api/qrcodes/:id
 * Update a QR code destination URL
 */
router.put("/qrcodes/:id", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  const updated = await storage.updateQRCode(req.params.id, auth.userId, req.body.destinationUrl);
  res.json(updated || { error: "Not found" });
});

// ============================================
// TEMPLATE ROUTES
// ============================================

/**
 * GET /api/templates
 * Get all templates
 */
router.get("/templates", async (req, res) => {
  res.json(await storage.getTemplates());
});

/**
 * GET /api/templates/:id
 * Get a specific template by ID
 */
router.get("/templates/:id", async (req, res) => {
  res.json(await storage.getTemplate(req.params.id) || { error: "Not found" });
});

/**
 * POST /api/templates
 * Create a new template (admin only)
 */
router.post("/templates", async (req, res) => {
  const auth = getAuth(req);
  if (!await checkAdmin(auth.userId || "")) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  res.status(201).json(await storage.createTemplate(insertTemplateSchema.parse(req.body)));
});

/**
 * PUT /api/templates/:id
 * Update a template (admin only)
 */
router.put("/templates/:id", async (req, res) => {
  const auth = getAuth(req);
  if (!await checkAdmin(auth.userId || "")) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  res.json(await storage.updateTemplate(req.params.id, req.body));
});

/**
 * DELETE /api/templates/:id
 * Delete a template (admin only)
 */
router.delete("/templates/:id", async (req, res) => {
  const auth = getAuth(req);
  if (!await checkAdmin(auth.userId || "")) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  await storage.deleteTemplate(req.params.id);
  res.sendStatus(204);
});

// ============================================
// DESIGN ROUTES
// ============================================

/**
 * POST /api/designs
 * Create a new saved design
 */
router.post("/designs", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  res.status(201).json(
    await storage.createDesign(insertSavedDesignSchema.parse({ ...req.body, userId: auth.userId }))
  );
});

/**
 * GET /api/designs
 * Get all designs for the current user
 */
router.get("/designs", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  res.json(await storage.getDesignsByUser(auth.userId));
});

/**
 * GET /api/designs/:id
 * Get a specific design by ID
 */
router.get("/designs/:id", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  res.json(await storage.getDesign(req.params.id, auth.userId) || { error: "Not found" });
});

/**
 * PUT /api/designs/:id
 * Update a design
 */
router.put("/designs/:id", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  res.json(await storage.updateDesign(req.params.id, auth.userId, req.body));
});

/**
 * DELETE /api/designs/:id
 * Delete a design
 */
router.delete("/designs/:id", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Auth required" });

  await storage.deleteDesign(req.params.id, auth.userId);
  res.sendStatus(204);
});

// ============================================
// OBJECT STORAGE ROUTES
// ============================================

/**
 * POST /api/objects/upload
 * Get a signed URL for uploading an object
 */
router.post("/objects/upload", async (req, res) => {
  res.json({ uploadURL: await objectStorageService.getObjectEntityUploadURL() });
});

/**
 * PUT /api/objects/uploaded
 * Normalize an object path after upload
 */
router.put("/objects/uploaded", async (req, res) => {
  res.json({ objectPath: objectStorageService.normalizeObjectEntityPath(req.body.objectURL) });
});

export default router;

// Export functions for routes that need to be mounted at different paths
export { objectStorageService };
