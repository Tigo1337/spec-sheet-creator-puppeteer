/**
 * Replit Object Storage helpers for PDF export files.
 * Replaces the @google-cloud/storage (user GCS) dependency for export I/O.
 */

import { objectStorageClient } from "../objectStorage";
import { logger } from "./logger";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

/**
 * Parse PRIVATE_OBJECT_DIR into { bucketName, prefix }.
 * PRIVATE_OBJECT_DIR looks like: /repl-default-bucket-xxx/.private
 */
function parsePrivateDir(): { bucketName: string; prefix: string } {
  const raw = process.env.PRIVATE_OBJECT_DIR || "";
  const normalized = raw.startsWith("/") ? raw.slice(1) : raw;
  const parts = normalized.split("/");
  const bucketName = parts[0];
  const prefix = parts.slice(1).join("/");
  if (!bucketName) throw new Error("PRIVATE_OBJECT_DIR is not set or invalid");
  return { bucketName, prefix };
}

/**
 * Full GCS object name for a given export job output file.
 * e.g. .private/exports/abc123.pdf
 */
function exportObjectName(jobId: string, ext: string): { bucketName: string; objectName: string } {
  const { bucketName, prefix } = parsePrivateDir();
  const objectName = [prefix, "exports", `${jobId}.${ext}`]
    .filter(Boolean)
    .join("/");
  return { bucketName, objectName };
}

/**
 * Save a PDF/ZIP buffer to Replit Object Storage.
 */
export async function saveExportFile(jobId: string, ext: string, data: Buffer): Promise<void> {
  const { bucketName, objectName } = exportObjectName(jobId, ext);
  const contentType = ext === "zip" ? "application/zip" : "application/pdf";
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(data, { contentType, resumable: false });
  logger.info({ jobId, objectName }, "Export file saved to Replit Object Storage");
}

/**
 * Check whether an export file exists in Replit Object Storage.
 */
export async function exportFileExists(jobId: string, ext: string): Promise<boolean> {
  try {
    const { bucketName, objectName } = exportObjectName(jobId, ext);
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    const [exists] = await file.exists();
    return exists;
  } catch {
    return false;
  }
}

/**
 * Stream an export file from Replit Object Storage into an HTTP response.
 */
export async function streamExportFile(
  jobId: string,
  ext: string,
  res: import("express").Response
): Promise<void> {
  const { bucketName, objectName } = exportObjectName(jobId, ext);
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  const [exists] = await file.exists();
  if (!exists) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  const contentType = ext === "zip" ? "application/zip" : "application/pdf";
  res.setHeader("Content-Type", contentType);
  file.createReadStream().pipe(res);
}

/**
 * Generate a time-limited signed download URL from Replit Object Storage.
 * Returns null if configuration is missing or signing fails.
 */
export async function generateExportSignedUrl(
  jobId: string,
  fileName: string,
  type: string
): Promise<string | null> {
  try {
    const ext = type === "pdf_bulk" ? "zip" : "pdf";
    const { bucketName, objectName } = exportObjectName(jobId, ext);

    const response = await fetch(
      `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket_name: bucketName,
          object_name: objectName,
          method: "GET",
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          response_disposition: `attachment; filename="${fileName.replace(/"/g, '\\"')}"`,
        }),
      }
    );

    if (!response.ok) {
      logger.warn(
        { status: response.status, jobId },
        "Replit sidecar signed URL request failed"
      );
      return null;
    }

    const { signed_url } = await response.json();
    return signed_url as string;
  } catch (e) {
    logger.error({ err: e, jobId }, "Failed to generate Replit Object Storage signed URL");
    return null;
  }
}
