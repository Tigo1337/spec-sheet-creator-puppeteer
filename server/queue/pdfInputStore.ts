/**
 * In-process store for large PDF render payloads.
 *
 * BullMQ jobs are serialized into Redis — Upstash has a 1MB per-value limit.
 * Bulk/catalog exports contain many full HTML strings that easily exceed that.
 *
 * Solution: store the actual HTML payload here (same Node.js process as the
 * worker) and only pass the jobId reference through Redis. The worker reads
 * the payload from here and deletes it after picking it up.
 *
 * TTL: entries are cleaned up after 2 hours as a safety net in case the
 * worker crashes before it can delete the entry.
 */

export interface PdfInputPayload {
  html?: string;
  items?: Array<string | { html: string; filename?: string }>;
  expiresAt: number;
}

const store = new Map<string, PdfInputPayload>();

const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export function savePdfInput(jobId: string, payload: Omit<PdfInputPayload, "expiresAt">): void {
  store.set(jobId, { ...payload, expiresAt: Date.now() + TTL_MS });
}

export function getPdfInput(jobId: string): PdfInputPayload | undefined {
  return store.get(jobId);
}

export function deletePdfInput(jobId: string): void {
  store.delete(jobId);
}

// Background cleanup — runs every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of store.entries()) {
    if (entry.expiresAt < now) store.delete(id);
  }
}, 30 * 60 * 1000).unref();
