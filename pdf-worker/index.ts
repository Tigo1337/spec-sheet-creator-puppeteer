/**
 * Doculoom PDF Worker v2
 *
 * Renders HTML to PDF/PNG using Puppeteer.
 * All output is delivered via a callback URL — no Google Cloud Storage required.
 *
 * Endpoints:
 *   POST /process-job  — async PDF render, result POSTed to callbackUrl
 *   POST /preview      — synchronous PNG screenshot, returns binary
 *   GET  /health       — liveness probe
 */

import express, { Request, Response } from "express";
import puppeteer, { Browser, PDFOptions } from "puppeteer";
import archiver from "archiver";
import { PassThrough } from "stream";

const app = express();
app.use(express.json({ limit: "200mb" }));

const PORT = parseInt(process.env.PORT || "8080", 10);

// Puppeteer browser singleton — reused across requests
let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) return browser;
  browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
  });
  return browser;
}

/** Render a single HTML string to a PDF Buffer. */
async function renderPdf(
  html: string,
  widthPx: number,
  heightPx: number,
  scale: number = 1,
  colorModel: string = "rgb"
): Promise<Buffer> {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width: Math.round(widthPx), height: Math.round(heightPx) });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 60_000 });

    // Wait for fonts to finish rendering
    await page.evaluateHandle("document.fonts.ready");

    const pdfOptions: PDFOptions = {
      width: `${widthPx}px`,
      height: `${heightPx}px`,
      printBackground: true,
      scale,
    };

    if (colorModel === "cmyk") {
      // CMYK hint: currently Puppeteer outputs sRGB; downstream CMYK conversion
      // is expected to be handled by a post-processing step if required.
      pdfOptions.preferCSSPageSize = true;
    }

    const pdfBuffer = await page.pdf(pdfOptions);
    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

/** Render a single HTML string to a PNG Buffer (for previews). */
async function renderPng(
  html: string,
  widthPx: number,
  heightPx: number
): Promise<Buffer> {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width: Math.round(widthPx), height: Math.round(heightPx) });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });
    await page.evaluateHandle("document.fonts.ready");
    const screenshot = await page.screenshot({ type: "png", fullPage: false });
    return Buffer.from(screenshot);
  } finally {
    await page.close();
  }
}

/** POST the result binary to the app's callback endpoint. */
async function postCallback(
  callbackUrl: string,
  workerSecret: string,
  jobId: string,
  jobType: string,
  fileName: string,
  data: Buffer
): Promise<void> {
  const res = await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": jobType === "pdf_bulk" ? "application/zip" : "application/pdf",
      "X-Job-Id": jobId,
      "X-Job-Type": jobType,
      "X-File-Name": fileName,
      "X-Worker-Secret": workerSecret,
    },
    body: data,
  });
  if (!res.ok) {
    throw new Error(`Callback failed: ${res.status} ${await res.text()}`);
  }
}

/** Report a failure back to the app via the callback. */
async function postError(
  callbackUrl: string,
  workerSecret: string,
  jobId: string,
  errorMsg: string
): Promise<void> {
  await fetch(callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Job-Id": jobId,
      "X-Job-Error": errorMsg,
      "X-Worker-Secret": workerSecret,
    },
    body: JSON.stringify({ error: errorMsg }),
  }).catch(() => {
    // Best-effort — don't throw if callback itself fails
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /process-job
// ─────────────────────────────────────────────────────────────────────────────
app.post("/process-job", async (req: Request, res: Response) => {
  const {
    jobId,
    callbackUrl,
    workerSecret = "",
    data,
  } = req.body as {
    jobId: string;
    callbackUrl: string;
    workerSecret?: string;
    data: {
      type: "pdf_single" | "pdf_catalog" | "pdf_bulk";
      html?: string;
      items?: string[];
      htmlItems?: string[];
      width?: number;
      height?: number;
      scale?: number;
      colorModel?: string;
      fileName?: string;
    };
  };

  if (!jobId || !callbackUrl || !data) {
    return res.status(400).json({ error: "Missing jobId, callbackUrl, or data" });
  }

  // Acknowledge immediately — rendering is async
  res.json({ jobId, status: "processing" });

  const {
    type = "pdf_single",
    html,
    items,
    htmlItems,
    width = 816,
    height = 1056,
    scale = 1,
    colorModel = "rgb",
    fileName = type === "pdf_bulk" ? "bulk_export.zip" : "export.pdf",
  } = data;

  try {
    if (type === "pdf_bulk") {
      // Render each HTML item to a separate PDF, then ZIP them all
      const htmlList = htmlItems || items || [];
      if (htmlList.length === 0) throw new Error("No HTML items provided for bulk export");

      const pdfBuffers = await Promise.all(
        htmlList.map((h, i) =>
          renderPdf(h, width, height, scale, colorModel).catch((err) => {
            throw new Error(`Failed to render item ${i}: ${err.message}`);
          })
        )
      );

      // Build ZIP in memory
      const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
        const passThrough = new PassThrough();
        const chunks: Buffer[] = [];
        passThrough.on("data", (c: Buffer) => chunks.push(c));
        passThrough.on("end", () => resolve(Buffer.concat(chunks)));
        passThrough.on("error", reject);

        const archive = archiver("zip", { zlib: { level: 6 } });
        archive.on("error", reject);
        archive.pipe(passThrough);

        pdfBuffers.forEach((pdf, i) => {
          archive.append(pdf, { name: `page_${String(i + 1).padStart(4, "0")}.pdf` });
        });

        archive.finalize();
      });

      await postCallback(callbackUrl, workerSecret, jobId, "pdf_bulk", fileName, zipBuffer);
    } else if (type === "pdf_catalog" && items && items.length > 0) {
      // Catalog: merge multiple HTML chunks into one PDF
      // Render each chunk individually and concatenate (simple approach)
      const pdfBuffers = await Promise.all(
        items.map((h, i) =>
          renderPdf(h, width, height, scale, colorModel).catch((err) => {
            throw new Error(`Failed to render catalog page ${i}: ${err.message}`);
          })
        )
      );

      // For a multi-page catalog we combine by using the first page's Puppeteer render
      // with all content on one page. A true PDF merge requires an external lib;
      // for now render everything into a single tall page if possible, or return as ZIP.
      // If there's only one chunk, return it directly.
      if (pdfBuffers.length === 1) {
        await postCallback(
          callbackUrl, workerSecret, jobId, type, fileName, pdfBuffers[0]
        );
      } else {
        // Multiple chunks: deliver as a ZIP of per-page PDFs
        const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
          const passThrough = new PassThrough();
          const chunks: Buffer[] = [];
          passThrough.on("data", (c: Buffer) => chunks.push(c));
          passThrough.on("end", () => resolve(Buffer.concat(chunks)));
          passThrough.on("error", reject);

          const archive = archiver("zip", { zlib: { level: 6 } });
          archive.on("error", reject);
          archive.pipe(passThrough);

          pdfBuffers.forEach((pdf, i) => {
            archive.append(pdf, { name: `page_${String(i + 1).padStart(4, "0")}.pdf` });
          });

          archive.finalize();
        });

        const zipFileName = fileName.replace(/\.pdf$/i, ".zip");
        await postCallback(
          callbackUrl, workerSecret, jobId, "pdf_bulk", zipFileName, zipBuffer
        );
      }
    } else {
      // Single page PDF (pdf_single or catalog with a single html string)
      const htmlContent = html || (items && items[0]) || "";
      if (!htmlContent) throw new Error("No HTML content provided");

      const pdfBuffer = await renderPdf(htmlContent, width, height, scale, colorModel);
      await postCallback(callbackUrl, workerSecret, jobId, type, fileName, pdfBuffer);
    }

    console.log(`[${jobId}] Job completed successfully`);
  } catch (err: any) {
    console.error(`[${jobId}] Job failed:`, err.message);
    await postError(callbackUrl, workerSecret, jobId, err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /preview  — synchronous PNG preview (unchanged API)
// ─────────────────────────────────────────────────────────────────────────────
app.post("/preview", async (req: Request, res: Response) => {
  const { html, width = 1200, height = 800 } = req.body as {
    html: string;
    width?: number;
    height?: number;
  };

  if (!html) return res.status(400).json({ error: "Missing html" });

  try {
    const png = await renderPng(html, width, height);
    res.set("Content-Type", "image/png");
    res.send(png);
  } catch (err: any) {
    console.error("Preview render failed:", err.message);
    res.status(500).json({ error: "Preview render failed" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", browserConnected: browser?.connected ?? false });
});

// Warm up the browser on startup
getBrowser()
  .then(() => console.log("Browser ready"))
  .catch((err) => console.error("Browser init failed:", err));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PDF Worker listening on port ${PORT}`);
});
