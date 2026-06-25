/**
 * Validation helpers for export payloads.
 *
 * The global body-parser already caps the total request at 50MB
 * (see server/index.ts largePayloadRoutes), but that single ceiling does not
 * protect against pathological shapes within the limit — e.g. tens of thousands
 * of tiny HTML chunks, or a single oversized document. These helpers add
 * per-item and per-count bounds so a request that is technically under 50MB
 * still can't exhaust the PDF worker.
 */

// A single rendered page of HTML is realistically well under this. 8MB leaves
// generous headroom for inlined images/fonts while still rejecting abuse.
export const MAX_HTML_BYTES = 8 * 1024 * 1024;

// Upper bound on chunks in a single catalog / bulk export request.
export const MAX_ITEMS = 1000;

export interface ExportValidationResult {
  ok: boolean;
  /** Present when ok === false. Safe to return to the client. */
  error?: string;
}

const byteLength = (value: string): number => Buffer.byteLength(value, "utf8");

/**
 * Validate a single HTML document string.
 */
export function validateHtmlContent(html: unknown): ExportValidationResult {
  if (typeof html !== "string" || html.length === 0) {
    return { ok: false, error: "Missing HTML content" };
  }
  if (byteLength(html) > MAX_HTML_BYTES) {
    return { ok: false, error: "HTML content exceeds the maximum allowed size" };
  }
  return { ok: true };
}

/**
 * Validate an array of HTML chunks (catalog / bulk export).
 * Each item may be a plain HTML string OR an object { html: string; filename?: string }.
 */
export function validateHtmlItems(items: unknown): ExportValidationResult {
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Invalid or empty items" };
  }
  if (items.length > MAX_ITEMS) {
    return { ok: false, error: `Too many items (max ${MAX_ITEMS})` };
  }
  for (const item of items) {
    const html = typeof item === "string" ? item : (item as any)?.html;
    if (typeof html !== "string" || html.length === 0) {
      return { ok: false, error: "Each item must be a non-empty HTML string" };
    }
    if (byteLength(html) > MAX_HTML_BYTES) {
      return { ok: false, error: "An item exceeds the maximum allowed size" };
    }
  }
  return { ok: true };
}

/**
 * Validate the body of an /async/pdf request, which may carry either a single
 * `html` document or an array of `items`.
 */
export function validatePdfExportBody(body: {
  html?: unknown;
  items?: unknown;
}): ExportValidationResult {
  const hasHtml = typeof body.html === "string" && body.html.length > 0;
  const hasItems = Array.isArray(body.items) && body.items.length > 0;

  if (!hasHtml && !hasItems) {
    return { ok: false, error: "Missing content" };
  }
  if (hasHtml) {
    const htmlResult = validateHtmlContent(body.html);
    if (!htmlResult.ok) return htmlResult;
  }
  if (hasItems) {
    const itemsResult = validateHtmlItems(body.items);
    if (!itemsResult.ok) return itemsResult;
  }
  return { ok: true };
}
