/**
 * BullMQ worker for PDF rendering.
 *
 * concurrency: 1 — only ONE Chromium instance runs at a time, preventing OOM.
 * Extra jobs queue in Redis and are picked up as each render finishes.
 */

import { Worker, type Job } from "bullmq";
import { renderHtmlToPdf, renderHtmlsToBulkZip, type HtmlItem } from "../utils/pdfRenderer";
import { saveExportFile } from "../utils/exportStorage";
import { storage } from "../storage";
import { logger } from "../utils/logger";
import * as Sentry from "@sentry/node";
import { PDF_QUEUE_NAME, redisConnection, type PdfJobData } from "./pdfQueue";

async function processPdfJob(job: Job<PdfJobData>): Promise<void> {
  const { jobId, type, html, items, width, height, scale, finalFileName } = job.data;
  logger.info({ jobId, type, queueJobId: job.id }, "PDF worker picked up job");

  const renderOptions = { width, height, scale };

  try {
    if ((type === "pdf_bulk" || type === "pdf_catalog") && Array.isArray(items) && items.length > 0) {
      const zipBuffer = await renderHtmlsToBulkZip(items as HtmlItem[], renderOptions);
      const displayName = finalFileName.replace(/\.pdf$/i, ".zip");
      saveExportFile(jobId, "zip", zipBuffer);
      await storage.updateExportJob(jobId, {
        status: "completed",
        progress: 100,
        displayFilename: displayName,
      });
      logger.info({ jobId, pages: items.length, bytes: zipBuffer.length }, "Bulk/catalog export completed");
    } else if (html) {
      const pdfBuffer = await renderHtmlToPdf(html, renderOptions);
      saveExportFile(jobId, "pdf", pdfBuffer);
      await storage.updateExportJob(jobId, {
        status: "completed",
        progress: 100,
        displayFilename: finalFileName,
      });
      logger.info({ jobId, bytes: pdfBuffer.length }, "Single PDF export completed");
    } else {
      throw new Error("Job has no renderable content (no html and no items)");
    }
  } catch (err) {
    logger.error({ err, jobId }, "PDF render failed in worker");
    Sentry.captureException(err);
    await storage.updateExportJob(jobId, {
      status: "failed",
      error: err instanceof Error ? err.message : "Rendering failed",
    });
    // Re-throw so BullMQ records the failure and triggers the retry/backoff
    throw err;
  }
}

let worker: Worker<PdfJobData> | null = null;

export function startPdfWorker(): Worker<PdfJobData> {
  if (worker) return worker;

  if (!process.env.REDIS_URL) {
    logger.warn("REDIS_URL not set — PDF worker not started. Exports will fail.");
    return null as any;
  }

  worker = new Worker<PdfJobData>(PDF_QUEUE_NAME, processPdfJob, {
    connection: redisConnection,
    concurrency: 1,  // Only 1 Chromium at a time — OOM protection
  });

  worker.on("completed", (job) => {
    logger.info({ queueJobId: job.id, jobId: job.data.jobId }, "Worker: job completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ queueJobId: job?.id, jobId: job?.data?.jobId, err }, "Worker: job failed");
  });

  worker.on("error", (err) => {
    logger.error({ err }, "Worker: connection error");
    Sentry.captureException(err);
  });

  logger.info({ concurrency: 1 }, "PDF worker started");
  return worker;
}

export async function stopPdfWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("PDF worker stopped");
  }
}
