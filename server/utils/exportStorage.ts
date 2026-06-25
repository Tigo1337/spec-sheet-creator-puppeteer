/**
 * In-memory cache for completed export files (PDF / ZIP).
 *
 * The buffer is already in memory after Chromium renders it — this just holds
 * a reference until the user downloads it. Entries expire after 1 hour and are
 * cleaned up automatically.
 *
 * No GCS, no Replit Object Storage, no sidecar auth required.
 */

import { logger } from "./logger";

const TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedExport {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  expiresAt: number;
}

const exportCache = new Map<string, CachedExport>();

// Purge expired entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  let purged = 0;
  for (const [id, entry] of exportCache.entries()) {
    if (entry.expiresAt < now) {
      exportCache.delete(id);
      purged++;
    }
  }
  if (purged > 0) logger.info({ purged }, "Purged expired export cache entries");
}, 15 * 60 * 1000).unref();

/**
 * Store a rendered PDF or ZIP buffer in the in-memory cache.
 */
export function saveExportFile(jobId: string, ext: string, data: Buffer): void {
  const contentType = ext === "zip" ? "application/zip" : "application/pdf";
  exportCache.set(jobId, {
    buffer: data,
    contentType,
    fileName: `${jobId}.${ext}`,
    expiresAt: Date.now() + TTL_MS,
  });
  logger.info({ jobId, ext, bytes: data.length }, "Export file cached in memory");
}

/**
 * Retrieve a cached export buffer. Returns null if not found or expired.
 */
export function getExportFile(jobId: string): CachedExport | null {
  const entry = exportCache.get(jobId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    exportCache.delete(jobId);
    return null;
  }
  return entry;
}

/**
 * Remove an entry from the cache (e.g. after download).
 */
export function deleteExportFile(jobId: string): void {
  exportCache.delete(jobId);
}
