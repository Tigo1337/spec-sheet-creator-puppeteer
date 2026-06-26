/**
 * BullMQ queue definition and Redis connection.
 * One shared connection for adding jobs; the worker uses its own connection.
 */

import { Queue } from "bullmq";
import { logger } from "../utils/logger";

if (!process.env.REDIS_URL) {
  logger.warn("REDIS_URL is not set — PDF export queue will not function.");
}

export const redisConnection = {
  url: process.env.REDIS_URL || "",
  // Upstash requires TLS (rediss://); ioredis picks it up from the URL scheme.
  // No additional tls config needed.
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,    // Required for Upstash
};

export interface PdfJobData {
  jobId: string;       // DB export job ID (also used as cache key)
  type: "pdf_single" | "pdf_bulk" | "pdf_catalog";
  html?: string;       // Single-page render
  items?: Array<string | { html: string; filename?: string }>; // Multi-page render
  width: number;
  height: number;
  scale: number;
  finalFileName: string;
}

export const PDF_QUEUE_NAME = "pdf-export";

// Shared queue instance (used by the route to add jobs)
export const pdfQueue = new Queue<PdfJobData>(PDF_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,                    // Retry once on failure (Chromium crash, OOM)
    backoff: { type: "fixed", delay: 3000 },
    removeOnComplete: { count: 50 }, // Keep last 50 completed job records in Redis
    removeOnFail: { count: 50 },
  },
});

logger.info("PDF export queue initialized");
