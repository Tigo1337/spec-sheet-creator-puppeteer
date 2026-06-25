/**
 * Inline PDF renderer using system Chromium + puppeteer-core.
 * No external worker, no GCS — runs directly inside the Replit server process.
 */

import puppeteer from "puppeteer-core";
import { execSync } from "child_process";
import { createRequire } from "module";
import { PassThrough } from "stream";
const require = createRequire(import.meta.url);
const _archiverMod = require("archiver");
const archiver = (_archiverMod.default ?? _archiverMod) as typeof import("archiver");
import { logger } from "./logger";

let chromiumPath: string | null = null;

function getChromiumPath(): string {
  if (chromiumPath) return chromiumPath;
  try {
    chromiumPath = execSync("which chromium", { encoding: "utf8" }).trim();
    logger.info({ path: chromiumPath }, "Chromium found");
    return chromiumPath;
  } catch {
    throw new Error(
      "Chromium not found. Make sure 'chromium' is listed in .replit [nix] packages."
    );
  }
}

async function launchBrowser() {
  const executablePath = getChromiumPath();

  // Kill any stale Chromium processes left over from crashed renders so they
  // don't block a new launch (ignore errors — nothing to clean up is fine).
  try { execSync("pkill -f chromium || true", { stdio: "ignore" }); } catch {}
  // Brief pause to let the OS reclaim resources before re-launching.
  await new Promise((r) => setTimeout(r, 500));

  logger.info({ executablePath }, "Launching Chromium browser");
  const browser = await puppeteer.launch({
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-extensions",
      "--no-zygote",           // safer than --single-process; avoids zygote crashes
      "--disable-web-security",
      "--font-render-hinting=none",
    ],
    headless: true,
    timeout: 30000,
  });
  logger.info("Chromium launched successfully");
  return browser;
}

export interface RenderOptions {
  width?: number;
  height?: number;
  scale?: number;
}

/**
 * Render a single HTML string to a PDF Buffer.
 */
export async function renderHtmlToPdf(
  html: string,
  options: RenderOptions = {}
): Promise<Buffer> {
  const { width = 816, height = 1056, scale = 1 } = options;
  logger.info({ width, height, scale }, "Starting single PDF render");
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: scale });
    // Use domcontentloaded — networkidle0 hangs if HTML references external resources
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Give fonts/images a moment to render
    await new Promise((r) => setTimeout(r, 500));
    const pdf = await page.pdf({
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    logger.info({ bytes: pdf.length }, "Single PDF render complete");
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export type HtmlItem = string | { html: string; filename?: string };

function resolveItem(item: HtmlItem, index: number): { html: string; filename: string } {
  if (typeof item === "string") {
    return { html: item, filename: `page_${String(index + 1).padStart(3, "0")}.pdf` };
  }
  const filename = item.filename
    ? item.filename.endsWith(".pdf") ? item.filename : `${item.filename}.pdf`
    : `page_${String(index + 1).padStart(3, "0")}.pdf`;
  return { html: item.html, filename };
}

/**
 * Render multiple HTML strings/objects to individual PDFs and return them as a ZIP Buffer.
 */
export async function renderHtmlsToBulkZip(
  htmlItems: HtmlItem[],
  options: RenderOptions = {}
): Promise<Buffer> {
  const { width = 816, height = 1056, scale = 1 } = options;
  logger.info({ count: htmlItems.length, width, height, scale }, "Starting bulk ZIP render");
  const browser = await launchBrowser();

  try {
    // Collect all PDF buffers first, then zip — avoids the async-Promise-executor
    // anti-pattern that silently swallows thrown errors.
    const pdfEntries: { name: string; buffer: Buffer }[] = [];

    for (let i = 0; i < htmlItems.length; i++) {
      const { html, filename } = resolveItem(htmlItems[i], i);
      logger.info({ index: i + 1, total: htmlItems.length, filename }, "Rendering page");
      const page = await browser.newPage();
      try {
        await page.setViewport({ width, height, deviceScaleFactor: scale });
        await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });
        await new Promise((r) => setTimeout(r, 300));
        const pdf = await page.pdf({
          width: `${width}px`,
          height: `${height}px`,
          printBackground: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        });
        pdfEntries.push({ name: filename, buffer: Buffer.from(pdf) });
        logger.info({ index: i + 1, filename, bytes: pdf.length }, "Page rendered");
      } finally {
        await page.close();
      }
    }

    logger.info({ pages: pdfEntries.length }, "All pages rendered, building ZIP");

    // Build the ZIP synchronously from collected buffers
    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const passthrough = new PassThrough();
      const chunks: Buffer[] = [];
      passthrough.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      passthrough.on("end", () => resolve(Buffer.concat(chunks)));
      passthrough.on("error", reject);

      const archive = archiver("zip", { zlib: { level: 6 } });
      archive.on("error", reject);
      archive.pipe(passthrough);

      for (const { name, buffer } of pdfEntries) {
        archive.append(buffer, { name });
      }
      archive.finalize();
    });

    logger.info({ bytes: zipBuffer.length }, "Bulk ZIP render complete");
    return zipBuffer;
  } finally {
    await browser.close().catch(() => {});
  }
}
