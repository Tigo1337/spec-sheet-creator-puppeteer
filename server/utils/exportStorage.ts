/**
 * Replit Object Storage helpers for PDF export files.
 * Uses the Replit sidecar directly via signed URLs — does NOT use the
 * @google-cloud/storage SDK auth flow, which fails in background async contexts.
 */

import { logger } from "./logger";
import type { Response } from "express";

const SIDECAR = "http://127.0.0.1:1106";

function parsePrivateDir(): { bucketName: string; prefix: string } {
  const raw = process.env.PRIVATE_OBJECT_DIR || "";
  const normalized = raw.startsWith("/") ? raw.slice(1) : raw;
  const parts = normalized.split("/");
  const bucketName = parts[0];
  const prefix = parts.slice(1).join("/");
  if (!bucketName) throw new Error("PRIVATE_OBJECT_DIR is not set or invalid");
  return { bucketName, prefix };
}

function exportObjectName(jobId: string, ext: string): { bucketName: string; objectName: string } {
  const { bucketName, prefix } = parsePrivateDir();
  const objectName = [prefix, "exports", `${jobId}.${ext}`].filter(Boolean).join("/");
  return { bucketName, objectName };
}

async function getSidecarSignedUrl(
  bucketName: string,
  objectName: string,
  method: "GET" | "PUT",
  extraFields?: Record<string, string>
): Promise<string> {
  const body: Record<string, unknown> = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ...extraFields,
  };
  const res = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sidecar signed URL request failed (${res.status}): ${text}`);
  }
  const { signed_url } = await res.json();
  return signed_url as string;
}

/**
 * Save a PDF/ZIP buffer to Replit Object Storage via a signed PUT URL.
 */
export async function saveExportFile(jobId: string, ext: string, data: Buffer): Promise<void> {
  const { bucketName, objectName } = exportObjectName(jobId, ext);
  const contentType = ext === "zip" ? "application/zip" : "application/pdf";

  const signedUrl = await getSidecarSignedUrl(bucketName, objectName, "PUT");

  const uploadRes = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: data,
  });

  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`Upload to Object Storage failed (${uploadRes.status}): ${text}`);
  }

  logger.info({ jobId, objectName, bytes: data.length }, "Export file saved to Replit Object Storage");
}

/**
 * Stream an export file from Replit Object Storage into an HTTP response.
 * Uses a signed GET URL to fetch the file and pipes it to the response.
 */
export async function streamExportFile(jobId: string, ext: string, res: Response): Promise<void> {
  const { bucketName, objectName } = exportObjectName(jobId, ext);

  let signedUrl: string;
  try {
    signedUrl = await getSidecarSignedUrl(bucketName, objectName, "GET");
  } catch (e) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const fileRes = await fetch(signedUrl);
  if (!fileRes.ok) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const contentType = ext === "zip" ? "application/zip" : "application/pdf";
  res.setHeader("Content-Type", contentType);

  // Node.js fetch returns a Web ReadableStream — convert to Node stream
  const { Readable } = await import("stream");
  Readable.fromWeb(fileRes.body as any).pipe(res);
}

/**
 * Generate a time-limited signed download URL from Replit Object Storage.
 */
export async function generateExportSignedUrl(
  jobId: string,
  fileName: string,
  type: string
): Promise<string | null> {
  try {
    const ext = type === "pdf_bulk" ? "zip" : "pdf";
    const { bucketName, objectName } = exportObjectName(jobId, ext);

    const res = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: bucketName,
        object_name: objectName,
        method: "GET",
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        response_disposition: `attachment; filename="${fileName.replace(/"/g, '\\"')}"`,
      }),
    });

    if (!res.ok) {
      logger.warn({ status: res.status, jobId }, "Sidecar signed URL request failed");
      return null;
    }

    const { signed_url } = await res.json();
    return signed_url as string;
  } catch (e) {
    logger.error({ err: e, jobId }, "Failed to generate Replit Object Storage signed URL");
    return null;
  }
}
