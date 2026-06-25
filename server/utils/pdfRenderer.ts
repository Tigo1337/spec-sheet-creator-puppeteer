/**
 * Inline PDF renderer using system Chromium + puppeteer-core.
 * No external worker, no GCS — runs directly inside the Replit server process.
 */

import puppeteer from "puppeteer-core";
import { execSync } from "child_process";
import { createRequire } from "module";
import { PassThrough } from "stream";
const require = createRequire(import.meta.url);
const archiver = require("archiver") as typeof import("archiver");
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
  return puppeteer.launch({
    executablePath: getChromiumPath(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    headless: true,
  });
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
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: scale });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
    const pdf = await page.pdf({
      width: `${width}px`,
      height: `${height}px`,
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
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
  const browser = await launchBrowser();

  return new Promise(async (resolve, reject) => {
    const passthrough = new PassThrough();
    const chunks: Buffer[] = [];
    passthrough.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    passthrough.on("end", () => resolve(Buffer.concat(chunks)));
    passthrough.on("error", reject);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", reject);
    archive.pipe(passthrough);

    try {
      for (let i = 0; i < htmlItems.length; i++) {
        const { html, filename } = resolveItem(htmlItems[i], i);
        const page = await browser.newPage();
        try {
          await page.setViewport({ width, height, deviceScaleFactor: scale });
          await page.setContent(html, { waitUntil: "networkidle0", timeout: 30000 });
          const pdf = await page.pdf({
            width: `${width}px`,
            height: `${height}px`,
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
          });
          archive.append(Buffer.from(pdf), { name: filename });
        } finally {
          await page.close();
        }
      }
      await archive.finalize();
    } catch (err) {
      await browser.close();
      reject(err);
      return;
    }

    await browser.close();
  });
}
