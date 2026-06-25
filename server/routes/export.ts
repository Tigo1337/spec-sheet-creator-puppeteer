/**
 * Export-related API routes
 * Handles PDF generation, bulk exports, download URLs, and export job management.
 * All file I/O uses Replit Object Storage — no GCS credentials required.
 */

import { Router } from "express";
import { getAuth } from "@clerk/express";
import * as Sentry from "@sentry/node";
import { storage } from "../storage";
import { logger } from "../utils/logger";
import { checkAdmin } from "../middleware/auth";
import {
  saveExportFile,
  streamExportFile,
  generateExportSignedUrl,
} from "../utils/exportStorage";
import {
  validatePdfExportBody,
  validateHtmlItems,
  validateHtmlContent,
} from "../utils/exportValidation";

const router = Router();

/** Shared secret the worker must send in X-Worker-Secret for callbacks. */
function getWorkerSecret(): string {
  return process.env.WORKER_SECRET || "";
}

/**
 * GET /api/export/download/:id
 * Generate a signed Replit Object Storage URL and redirect the browser.
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

    const fileName = job.displayFilename || job.fileName || "Export";
    const signedUrl = await generateExportSignedUrl(job.id, fileName, job.type);
    if (!signedUrl) return res.status(500).send("Could not generate download link");

    res.redirect(302, signedUrl);
  } catch (e) {
    logger.error({ err: e, jobId: req.params.id }, "Export download failed");
    Sentry.captureException(e);
    res.status(500).send("Server Error");
  }
});

/**
 * GET /api/export/history
 * Get export history for the current user.
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
      downloadUrl: job.status === "completed" ? `/api/export/download/${job.id}` : null,
    }));
    res.json(history);
  } catch (error) {
    logger.error({ err: error, userId: auth.userId }, "Failed to fetch export history");
    Sentry.captureException(error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

/**
 * POST /api/export/async/pdf
 * Start an async PDF export job (single page or catalog).
 * HTML is sent inline to the worker — no GCS upload required.
 */
router.post("/async/pdf", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

  const { html, items, width, height, scale, colorModel, type, projectName, fileName } = req.body;
  const validation = validatePdfExportBody({ html, items });
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  try {
    const jobType = type === "pdf_catalog" ? "pdf_catalog" : "pdf_single";
    const finalFileName = fileName || (jobType === "pdf_catalog" ? "catalog.pdf" : "export.pdf");

    const job = await storage.createExportJob({
      userId: auth.userId,
      type: jobType,
      projectName: projectName || "Untitled Project",
      fileName: finalFileName,
      displayFilename: finalFileName,
    });

    const baseUrl =
      `${req.headers["x-forwarded-proto"] || req.protocol}://` +
      `${req.headers["x-forwarded-host"] || req.get("host")}`;

    // Determine if the deployed worker supports inline HTML (new v2 worker)
    // or expects GCS paths (legacy v1 worker). Controlled by WORKER_VERSION env var.
    // Default: legacy (safe fallback so existing exports keep working).
    const isV2Worker = process.env.WORKER_VERSION === "2";

    let workerPayload: Record<string, unknown>;

    if (isV2Worker) {
      // New worker: receive HTML inline, POST result to callback
      workerPayload = {
        jobId: job.id,
        callbackUrl: `${baseUrl}/api/export/worker/complete`,
        workerSecret: getWorkerSecret(),
        data: {
          width, height, scale, colorModel, type: jobType, fileName: finalFileName,
          ...(html ? { html } : {}),
          ...(items ? { items } : {}),
        },
      };
    } else {
      // Legacy worker (v1): upload HTML to GCS first, pass storage path
      const { Storage } = await import("@google-cloud/storage");
      const externalStorage = new Storage({ credentials: JSON.parse(process.env.GCLOUD_KEY_JSON!) });
      const bucketName = "doculoom-exports";
      const workerData: Record<string, unknown> = { width, height, scale, colorModel, type: jobType };

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

      workerPayload = { jobId: job.id, data: workerData };
    }

    fetch(`${process.env.PDF_WORKER_URL}/process-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workerPayload),
    }).catch((err) => {
      logger.error({ err, jobId: job.id }, "PDF worker trigger failed");
      Sentry.captureException(err);
      storage.updateExportJob(job.id, { status: "failed", error: "Worker trigger failed" });
    });

    res.json({ jobId: job.id, status: "pending" });
  } catch (error) {
    logger.error({ err: error, userId: auth.userId }, "Failed to start PDF export job");
    Sentry.captureException(error);
    res.status(500).json({ error: "Failed to start export job" });
  }
});

/**
 * POST /api/export/async/bulk
 * Start an async bulk PDF export job (ZIP of multiple PDFs).
 */
router.post("/async/bulk", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

  const { items, width, height, scale, colorModel, projectName, fileName } = req.body;
  const validation = validateHtmlItems(items);
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  try {
    const finalFileName = fileName || `Bulk_Export_${new Date().toISOString().slice(0, 10)}.zip`;
    const job = await storage.createExportJob({
      userId: auth.userId,
      type: "pdf_bulk",
      fileName: finalFileName,
      displayFilename: finalFileName,
      projectName: projectName || "Bulk Export",
    });

    const baseUrl =
      `${req.headers["x-forwarded-proto"] || req.protocol}://` +
      `${req.headers["x-forwarded-host"] || req.get("host")}`;

    fetch(`${process.env.PDF_WORKER_URL}/process-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: job.id,
        callbackUrl: `${baseUrl}/api/export/worker/complete`,
        workerSecret: getWorkerSecret(),
        data: {
          htmlItems: items,
          width,
          height,
          scale,
          colorModel,
          type: "pdf_bulk",
          fileName: finalFileName,
        },
      }),
    }).catch((err) => {
      logger.error({ err, jobId: job.id }, "Bulk PDF worker trigger failed");
      Sentry.captureException(err);
      storage.updateExportJob(job.id, { status: "failed", error: "Worker trigger failed" });
    });

    res.json({ jobId: job.id, status: "pending" });
  } catch (error) {
    logger.error({ err: error, userId: auth.userId }, "Failed to start bulk export job");
    Sentry.captureException(error);
    res.status(500).json({ error: "Failed to start bulk export" });
  }
});

/**
 * POST /api/export/worker/complete
 * Callback endpoint for the PDF worker.
 * The worker POSTs the finished PDF/ZIP binary here so we can store it in
 * Replit Object Storage and mark the job complete — no GCS involved.
 *
 * Headers expected:
 *   X-Job-Id      — the export job UUID
 *   X-Job-Type    — pdf_single | pdf_catalog | pdf_bulk
 *   X-File-Name   — display filename (e.g. "catalog.pdf")
 *   X-Worker-Secret — shared secret for auth
 * Body: raw binary (PDF or ZIP)
 */
router.post("/worker/complete", async (req, res) => {
  const jobId = req.headers["x-job-id"] as string;
  const jobType = req.headers["x-job-type"] as string;
  const fileName = (req.headers["x-file-name"] as string) || "export.pdf";
  const secret = req.headers["x-worker-secret"] as string;
  const errorMsg = req.headers["x-job-error"] as string | undefined;

  if (!jobId) return res.status(400).json({ error: "Missing X-Job-Id header" });

  const workerSecret = getWorkerSecret();
  if (workerSecret && secret !== workerSecret) {
    logger.warn({ jobId }, "Worker callback rejected: invalid secret");
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Handle worker-reported failures
  if (errorMsg) {
    logger.error({ jobId, error: errorMsg }, "Worker reported job failure");
    await storage.updateExportJob(jobId, { status: "failed", error: errorMsg });
    return res.json({ received: true });
  }

  try {
    // express.raw() middleware (configured in index.ts) parses the body into a Buffer
    const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    if (fileBuffer.length === 0) {
      await storage.updateExportJob(jobId, { status: "failed", error: "Worker sent empty file" });
      return res.status(400).json({ error: "Empty file received" });
    }

    const ext = jobType === "pdf_bulk" ? "zip" : "pdf";
    await saveExportFile(jobId, ext, fileBuffer);
    await storage.updateExportJob(jobId, {
      status: "completed",
      progress: 100,
      displayFilename: fileName,
    });

    logger.info({ jobId, bytes: fileBuffer.length, ext }, "Export job completed via worker callback");
    res.json({ received: true });
  } catch (err) {
    logger.error({ err, jobId }, "Failed to process worker callback");
    Sentry.captureException(err);
    await storage.updateExportJob(jobId, { status: "failed", error: "Callback processing failed" });
    res.status(500).json({ error: "Failed to store export file" });
  }
});

/**
 * GET /api/export/proxy/:id
 * Stream an export file directly from Replit Object Storage.
 */
router.get("/proxy/:id", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const job = await storage.getExportJob(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    if (job.userId !== auth.userId) return res.status(403).json({ error: "Forbidden" });

    const ext = job.type === "pdf_bulk" ? "zip" : "pdf";
    await streamExportFile(job.id, ext, res);
  } catch (error) {
    logger.error({ err: error, jobId: req.params.id }, "Failed to proxy export file");
    Sentry.captureException(error);
    if (!res.headersSent) res.status(500).json({ error: "Failed to fetch file" });
  }
});

/**
 * POST /api/export/preview
 * Generate a preview image via the worker (synchronous, returns base64 PNG).
 */
router.post("/preview", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Unauthorized" });

  const { html, width, height } = req.body;
  const validation = validateHtmlContent(html);
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  const workerUrl = process.env.PDF_WORKER_URL;
  if (!workerUrl) return res.status(500).json({ error: "Configuration error" });

  try {
    const response = await fetch(`${workerUrl}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html,
        width: Number(width) || 1200,
        height: Number(height) || 800,
      }),
    });

    if (!response.ok) throw new Error(`Worker returned ${response.status}`);

    const imageBuffer = await response.arrayBuffer();
    res.json({
      image: `data:image/png;base64,${Buffer.from(imageBuffer).toString("base64")}`,
    });
  } catch (error) {
    logger.error({ err: error, userId: auth.userId }, "Failed to generate export preview");
    Sentry.captureException(error);
    res.status(500).json({ error: "Failed to generate preview" });
  }
});

export default router;
