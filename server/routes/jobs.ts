/**
 * Job status API routes
 * Handles export job status queries
 */

import { Router } from "express";
import { getAuth } from "@clerk/express";
import { storage } from "../storage";

const router = Router();

/**
 * GET /api/jobs/:id
 * Get status of an export job by ID
 */
router.get("/:id", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  const job = await storage.getExportJob(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.userId !== auth.userId) return res.status(403).json({ error: "Forbidden" });

  res.json({
    ...job,
    fileName: job.displayFilename || job.fileName || "Export",
    downloadUrl: job.status === "completed" ? `/api/export/download/${job.id}` : null
  });
});

export default router;
