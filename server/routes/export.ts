/**
 * Export-related API routes
 * PDF rendering runs inline using system Chromium + puppeteer-core.
 * Files are stored in Replit Object Storage — no GCS, no external worker.
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
} from "../utils/exportValidation";
import { renderHtmlToPdf, renderHtmlsToBulkZip } from "../utils/pdfRenderer";

const router = Router();

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
 * Renders inline using system Chromium — no external worker needed.
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

    // Respond immediately so the client can start polling
    res.json({ jobId: job.id, status: "pending" });

    // Render in the background
    (async () => {
      try {
        const renderOptions = {
          width: Number(width) || 816,
          height: Number(height) || 1056,
          scale: Number(scale) || 1,
        };

        let pdfBuffer: Buffer;

        if (jobType === "pdf_catalog" && Array.isArray(items) && items.length > 0) {
          // Catalog: merge multiple pages into one PDF by rendering each and concatenating
          // For simplicity we render each as a separate PDF and zip them (same as bulk)
          pdfBuffer = await renderHtmlsToBulkZip(items, renderOptions);
          const ext = "zip";
          await saveExportFile(job.id, ext, pdfBuffer);
          await storage.updateExportJob(job.id, {
            status: "completed",
            progress: 100,
            displayFilename: finalFileName.replace(/\.pdf$/i, ".zip"),
          });
        } else if (html) {
          pdfBuffer = await renderHtmlToPdf(html, renderOptions);
          await saveExportFile(job.id, "pdf", pdfBuffer);
          await storage.updateExportJob(job.id, {
            status: "completed",
            progress: 100,
            displayFilename: finalFileName,
          });
        } else {
          throw new Error("No renderable content provided");
        }

        logger.info({ jobId: job.id, bytes: pdfBuffer.length }, "Inline PDF export completed");
      } catch (err) {
        logger.error({ err, jobId: job.id }, "Inline PDF rendering failed");
        Sentry.captureException(err);
        await storage.updateExportJob(job.id, {
          status: "failed",
          error: err instanceof Error ? err.message : "Rendering failed",
        });
      }
    })();
  } catch (error) {
    logger.error({ err: error, userId: auth.userId }, "Failed to start PDF export job");
    Sentry.captureException(error);
    if (!res.headersSent) res.status(500).json({ error: "Failed to start export job" });
  }
});

/**
 * POST /api/export/async/bulk
 * Start an async bulk PDF export job (ZIP of multiple PDFs).
 */
router.post("/async/bulk", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

  const { items, width, height, scale, projectName, fileName } = req.body;
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

    res.json({ jobId: job.id, status: "pending" });

    (async () => {
      try {
        const zipBuffer = await renderHtmlsToBulkZip(items, {
          width: Number(width) || 816,
          height: Number(height) || 1056,
          scale: Number(scale) || 1,
        });
        await saveExportFile(job.id, "zip", zipBuffer);
        await storage.updateExportJob(job.id, {
          status: "completed",
          progress: 100,
          displayFilename: finalFileName,
        });
        logger.info({ jobId: job.id, pages: items.length, bytes: zipBuffer.length }, "Inline bulk export completed");
      } catch (err) {
        logger.error({ err, jobId: job.id }, "Inline bulk PDF rendering failed");
        Sentry.captureException(err);
        await storage.updateExportJob(job.id, {
          status: "failed",
          error: err instanceof Error ? err.message : "Rendering failed",
        });
      }
    })();
  } catch (error) {
    logger.error({ err: error, userId: auth.userId }, "Failed to start bulk export job");
    Sentry.captureException(error);
    if (!res.headersSent) res.status(500).json({ error: "Failed to start bulk export" });
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

export default router;
