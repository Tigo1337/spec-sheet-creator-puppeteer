/**
 * Export-related API routes.
 * PDF rendering runs inline using system Chromium + puppeteer-core.
 * Finished files are held in an in-memory cache (1-hour TTL) and streamed
 * directly to the browser — no GCS, no Object Storage, no sidecar auth.
 */

import { Router } from "express";
import { getAuth } from "@clerk/express";
import * as Sentry from "@sentry/node";
import { storage } from "../storage";
import { logger } from "../utils/logger";
import { checkAdmin } from "../middleware/auth";
import { saveExportFile, getExportFile, deleteExportFile } from "../utils/exportStorage";
import { validatePdfExportBody, validateHtmlItems } from "../utils/exportValidation";
import { renderHtmlToPdf, renderHtmlsToBulkZip, HtmlItem } from "../utils/pdfRenderer";

const router = Router();

/**
 * GET /api/export/download/:id
 * Stream the export file directly from the in-memory cache.
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

    const cached = getExportFile(job.id);
    if (!cached) {
      // Cache expired (server restarted or >1 hour since render). Ask client to re-export.
      return res.status(410).send("Export file has expired. Please export again.");
    }

    const displayName = job.displayFilename || job.fileName || cached.fileName;
    res.setHeader("Content-Type", cached.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${displayName.replace(/"/g, '\\"')}"`);
    res.setHeader("Content-Length", cached.buffer.length);
    res.send(cached.buffer);

    // Clean up immediately after serving — no need to keep it in memory
    deleteExportFile(job.id);
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
 * Start an async single-page PDF export job.
 */
router.post("/async/pdf", async (req, res) => {
  const auth = getAuth(req);
  if (!auth.userId) return res.status(401).json({ error: "Authentication required" });

  const { html, items, width, height, scale, colorModel, type, projectName, fileName } = req.body;
  const validation = validatePdfExportBody({ html, items });
  if (!validation.ok) return res.status(400).json({ error: validation.error });

  try {
    const jobType = type === "pdf_catalog" ? "pdf_catalog" : "pdf_single";
    const finalFileName = fileName || (jobType === "pdf_catalog" ? "catalog.zip" : "export.pdf");

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

        if (jobType === "pdf_catalog" && Array.isArray(items) && items.length > 0) {
          const zipBuffer = await renderHtmlsToBulkZip(items as HtmlItem[], renderOptions);
          const displayName = finalFileName.replace(/\.pdf$/i, ".zip");
          saveExportFile(job.id, "zip", zipBuffer);
          await storage.updateExportJob(job.id, {
            status: "completed",
            progress: 100,
            displayFilename: displayName,
          });
          logger.info({ jobId: job.id, pages: items.length, bytes: zipBuffer.length }, "Catalog export completed");
        } else if (html) {
          const pdfBuffer = await renderHtmlToPdf(html, renderOptions);
          saveExportFile(job.id, "pdf", pdfBuffer);
          await storage.updateExportJob(job.id, {
            status: "completed",
            progress: 100,
            displayFilename: finalFileName,
          });
          logger.info({ jobId: job.id, bytes: pdfBuffer.length }, "Single PDF export completed");
        } else {
          throw new Error("No renderable content provided");
        }
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
        const zipBuffer = await renderHtmlsToBulkZip(items as HtmlItem[], {
          width: Number(width) || 816,
          height: Number(height) || 1056,
          scale: Number(scale) || 1,
        });
        saveExportFile(job.id, "zip", zipBuffer);
        await storage.updateExportJob(job.id, {
          status: "completed",
          progress: 100,
          displayFilename: finalFileName,
        });
        logger.info({ jobId: job.id, pages: items.length, bytes: zipBuffer.length }, "Bulk export completed");
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

export default router;
