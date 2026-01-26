/**
 * Export-related API routes
 * Handles PDF generation, bulk exports, download URLs, and export job management
 */

import { Router } from "express";
import { getAuth } from "@clerk/express";
import { Storage } from "@google-cloud/storage";
import { storage } from "../storage";
import { checkAdmin } from "../middleware/auth";
import { generateSignedDownloadUrl } from "../utils/helpers";

const router = Router();

/**
 * GET /api/export/download/:id
 * Download a completed export by job ID
 */
router.get("/download/:id", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).send("Authentication required");

  try {
    const job = await storage.getExportJob(req.params.id);
    if (!job) return res.status(404).send("Export not found");
    if (job.userId !== auth.userId && !(await checkAdmin(auth.userId))) {
      return res.status(403).send("Forbidden");
    }
    if (job.status !== "completed") return res.status(400).send("Export not ready");

    const signedUrl = await generateSignedDownloadUrl(
      job.id,
      job.displayFilename || job.fileName || "Export",
      job.type
    );
    if (!signedUrl) return res.status(500).send("Could not retrieve file");

    res.redirect(302, signedUrl);
  } catch (e) {
    res.status(500).send("Server Error");
  }
});

/**
 * GET /api/export/history
 * Get export history for the current user
 */
router.get("/history", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

  try {
    const jobs = await storage.getExportHistory(auth.userId);
    const history = jobs.map((job) => ({
      id: job.id,
      status: job.status,
      type: job.type,
      createdAt: job.createdAt,
      projectName: job.projectName,
      fileName: job.displayFilename || job.fileName || "Export",
      downloadUrl: job.status === "completed" ? `/api/export/download/${job.id}` : null
    }));
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

/**
 * POST /api/export/async/pdf
 * Start an async PDF export job (single or catalog)
 */
router.post("/async/pdf", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

  const { html, items, width, height, scale, colorModel, type, projectName, fileName } = req.body;
  if (!html && (!items || items.length === 0)) {
    return res.status(400).json({ error: "Missing content" });
  }

  try {
    const jobType = type === "pdf_catalog" ? "pdf_catalog" : "pdf_single";
    const finalFileName = fileName || (jobType === "pdf_catalog" ? "catalog.pdf" : "export.pdf");

    const job = await storage.createExportJob({
      userId: auth.userId,
      type: jobType,
      projectName: projectName || "Untitled Project",
      fileName: finalFileName,
      displayFilename: finalFileName
    });

    const externalStorage = new Storage({ credentials: JSON.parse(process.env.GCLOUD_KEY_JSON!) });
    const bucketName = "doculoom-exports";
    const workerData: Record<string, unknown> = { width, height, scale, colorModel, type: jobType };

    if (html) {
      const inputPath = `inputs/${job.id}.html`;
      await externalStorage.bucket(bucketName).file(inputPath).save(html, {
        contentType: "text/html",
        resumable: false
      });
      workerData.htmlStoragePath = inputPath;
    } else if (items) {
      const uploadedPaths: { htmlStoragePath: string }[] = [];
      await Promise.all(items.map(async (chunkHtml: string, index: number) => {
        const chunkPath = `inputs/${job.id}_part${index}.html`;
        await externalStorage.bucket(bucketName).file(chunkPath).save(chunkHtml, {
          contentType: "text/html",
          resumable: false
        });
        uploadedPaths[index] = { htmlStoragePath: chunkPath };
      }));
      workerData.items = uploadedPaths;
    }

    fetch(`${process.env.PDF_WORKER_URL}/process-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: job.id, data: workerData })
    }).catch(err => {
      storage.updateExportJob(job.id, { status: "failed", error: "Worker timed out" });
    });

    res.json({ jobId: job.id, status: "pending" });
  } catch (error) {
    res.status(500).json({ error: "Failed to start export job" });
  }
});

/**
 * POST /api/export/async/bulk
 * Start an async bulk PDF export job (ZIP of multiple PDFs)
 */
router.post("/async/bulk", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

  const { items, width, height, scale, colorModel, projectName, fileName } = req.body;
  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: "Invalid bulk items" });
  }

  try {
    const finalFileName = fileName || `Bulk_Export_${new Date().toISOString().slice(0, 10)}.zip`;
    const job = await storage.createExportJob({
      userId: auth.userId,
      type: "pdf_bulk",
      fileName: finalFileName,
      displayFilename: finalFileName,
      projectName: projectName || "Bulk Export"
    });

    fetch(`${process.env.PDF_WORKER_URL}/process-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: job.id,
        data: { htmlItems: items, width, height, scale, colorModel, type: "pdf_bulk" }
      })
    }).catch(err => console.error("Worker trigger failed:", err));

    res.json({ jobId: job.id, status: "pending" });
  } catch (error) {
    res.status(500).json({ error: "Failed to start bulk export" });
  }
});

/**
 * GET /api/export/proxy/:id
 * Stream export file directly (for preview/inline viewing)
 */
router.get("/proxy/:id", async (req, res) => {
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

    if (!(await file.exists())[0]) {
      return res.status(404).json({ error: "File not found" });
    }

    res.setHeader('Content-Type', 'application/pdf');
    file.createReadStream().pipe(res);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch file" });
  }
});

/**
 * POST /api/export/preview
 * Generate a preview image of the export
 */
router.post("/preview", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  const { html, width, height } = req.body;
  if (!html) return res.status(400).json({ error: "Missing HTML content" });

  const workerUrl = process.env.PDF_WORKER_URL;
  if (!workerUrl) return res.status(500).json({ error: "Configuration error" });

  try {
    const response = await fetch(`${workerUrl}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html,
        width: Number(width) || 1200,
        height: Number(height) || 800
      })
    });

    if (!response.ok) throw new Error(`Worker returned ${response.status}`);

    const imageBuffer = await response.arrayBuffer();
    res.json({ image: `data:image/png;base64,${Buffer.from(imageBuffer).toString('base64')}` });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate preview" });
  }
});

export default router;
