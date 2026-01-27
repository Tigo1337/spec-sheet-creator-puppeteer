/**
 * AI-Assisted PDF Importer
 *
 * Workflow:
 * 1. Render PDF page to a high-quality "Master Image".
 * 2. Send "Master Image" to Gemini AI to identify discrete elements (Logos, Photos, Tables).
 * 3. Crop separate "Image Elements" from the Master Image based on AI coordinates.
 * 4. Create empty "Table Elements" where the AI detected tables.
 * 5. Extract "Text Elements" using PDF.js standard parsing.
 */

import * as pdfjsLib from "pdfjs-dist";
import type { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";
import { nanoid } from "nanoid";
import type { CanvasElement, TextStyle } from "@shared/schema";

// --- CONFIGURATION ---
const PDFJS_VERSION = pdfjsLib.version || "5.4.449";
// Use unpkg for reliable worker loading
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

const PDF_DPI = 72;
const CANVAS_DPI = 96;
const DPI_SCALE = CANVAS_DPI / PDF_DPI; // ~1.333
const RENDER_SCALE = 2; // Render at 2x for high quality crops

export interface PdfImportResult {
  elements: CanvasElement[];
  canvasWidth: number;
  canvasHeight: number;
  backgroundDataUrl: string;
  totalPages: number;
  importedPage: number;
}

export interface PdfImportOptions {
  pageNumber?: number;
  imageQuality?: number;
}

// --- HELPER FUNCTIONS ---

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return "str" in item && typeof item.str === "string";
}

/**
 * Crop a specific region from the base64 source image.
 * @param sourceImageBase64 The full page image
 * @param box [ymin, xmin, ymax, xmax] in 0-1000 scale
 * @param canvasWidth Width of the target canvas
 * @param canvasHeight Height of the target canvas
 */
async function cropImage(
  sourceImageBase64: string,
  box: [number, number, number, number],
  canvasWidth: number,
  canvasHeight: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const [ymin, xmin, ymax, xmax] = box;

      // Convert normalized 0-1000 coordinates to actual pixel coordinates
      // Note: We use the *image's* natural dimensions for cropping source
      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;

      const sx = (xmin / 1000) * imgW;
      const sy = (ymin / 1000) * imgH;
      const sw = ((xmax - xmin) / 1000) * imgW;
      const sh = ((ymax - ymin) / 1000) * imgH;

      // Create a canvas for the cropped piece
      const canvas = document.createElement("canvas");
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Failed to get 2D context"));
        return;
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = sourceImageBase64;
  });
}

function extractFontWeight(fontName: string): number {
  const name = fontName.toLowerCase();
  if (name.includes("black") || name.includes("heavy")) return 900;
  if (name.includes("bold")) return 700;
  if (name.includes("semibold") || name.includes("demibold")) return 600;
  if (name.includes("medium")) return 500;
  if (name.includes("light")) return 300;
  return 400;
}

function mapToWebFont(fontName: string): string {
  const name = fontName.toLowerCase();
  if (name.includes("arial")) return "Arial";
  if (name.includes("times")) return "Times New Roman";
  if (name.includes("courier")) return "Courier New";
  if (name.includes("roboto")) return "Roboto";
  if (name.includes("open sans")) return "Open Sans";
  return "Inter";
}

function convertPdfToCanvasCoords(
  pdfX: number,
  pdfY: number,
  pageHeightPt: number,
  fontSize: number
): { x: number; y: number } {
  const canvasY = (pageHeightPt - pdfY) * DPI_SCALE;
  const canvasX = pdfX * DPI_SCALE;
  return { x: canvasX, y: canvasY - fontSize };
}

function estimateTextDimensions(
  content: string,
  fontSize: number
): { width: number; height: number } {
  const avgCharWidth = fontSize * 0.55;
  const width = Math.max(content.length * avgCharWidth, 20);
  const height = Math.max(fontSize * 1.4, 20);
  return { width, height };
}

async function renderPageToImage(
  page: pdfjsLib.PDFPageProxy,
  options: PdfImportOptions
): Promise<string> {
  // Render at high resolution
  const viewport = page.getViewport({ scale: RENDER_SCALE * DPI_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas context failed");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: context, viewport }).promise;

  return canvas.toDataURL("image/png", options.imageQuality || 0.92);
}

async function extractTextElements(
  page: pdfjsLib.PDFPageProxy,
  pageHeightPt: number
): Promise<CanvasElement[]> {
  const textContent = await page.getTextContent();
  const elements: CanvasElement[] = [];
  let zIndex = 50; // Text goes on top of images (which will be ~10)

  for (const item of textContent.items) {
    if (!isTextItem(item)) continue;
    const text = item.str.trim();
    if (!text) continue;

    const transform = item.transform;
    const fontSize = Math.round(Math.abs(transform[3]) * DPI_SCALE);
    const { x, y } = convertPdfToCanvasCoords(transform[4], transform[5], pageHeightPt, fontSize);

    if (x < 0 || y < 0) continue;

    const { width, height } = estimateTextDimensions(text, fontSize);

    elements.push({
      id: nanoid(),
      type: "text",
      content: text,
      position: { x: Math.round(x), y: Math.round(y) },
      dimension: { width: Math.round(width), height: Math.round(height) },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: zIndex++,
      pageIndex: 0,
      aspectRatioLocked: false,
      textStyle: {
        fontFamily: mapToWebFont(item.fontName),
        fontSize,
        fontWeight: extractFontWeight(item.fontName),
        color: "#000000",
        textAlign: "left",
        verticalAlign: "top",
        lineHeight: 1.2,
        letterSpacing: 0,
      },
    });
  }
  return elements;
}

// --- MAIN IMPORT FUNCTION ---

export async function importPdf(
  file: File,
  options: PdfImportOptions = {}
): Promise<PdfImportResult> {
  const { pageNumber = 1 } = options;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
      cMapPacked: true,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });

    const pageWidthPt = viewport.width;
    const pageHeightPt = viewport.height;
    const canvasWidth = Math.round(pageWidthPt * DPI_SCALE);
    const canvasHeight = Math.round(pageHeightPt * DPI_SCALE);

    // 1. Render Full Page Background (High Quality)
    const backgroundDataUrl = await renderPageToImage(page, options);

    // 2. Extract Text (Traditional)
    const textElements = await extractTextElements(page, pageHeightPt);

    // 3. AI Analysis & Cropping
    let visionElements: CanvasElement[] = [];

    try {
      // Call Backend API to identify images and tables
      const aiResponse = await fetch("/api/ai/analyze-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: backgroundDataUrl }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        throw new Error(`AI Endpoint Error ${aiResponse.status}: ${errorText}`);
      }

      const layout = await aiResponse.json();

        // Process Images
        if (layout.images && Array.isArray(layout.images)) {
          for (const imgData of layout.images) {
            const [ymin, xmin, ymax, xmax] = imgData.box_2d;

            // Generate crop
            const croppedUrl = await cropImage(backgroundDataUrl, imgData.box_2d, canvasWidth, canvasHeight);

            // Calculate canvas position
            const x = (xmin / 1000) * canvasWidth;
            const y = (ymin / 1000) * canvasHeight;
            const w = ((xmax - xmin) / 1000) * canvasWidth;
            const h = ((ymax - ymin) / 1000) * canvasHeight;

            visionElements.push({
              id: nanoid(),
              type: "image",
              imageSrc: croppedUrl,
              position: { x: Math.round(x), y: Math.round(y) },
              dimension: { width: Math.round(w), height: Math.round(h) },
              rotation: 0,
              locked: false,
              visible: true,
              zIndex: 10, // Above background, below text
              pageIndex: 0,
              aspectRatioLocked: true,
              aspectRatio: w / h,
            });
          }
        }

        // Process Tables
        if (layout.tables && Array.isArray(layout.tables)) {
          for (const tableData of layout.tables) {
            const [ymin, xmin, ymax, xmax] = tableData.box_2d;

            const x = (xmin / 1000) * canvasWidth;
            const y = (ymin / 1000) * canvasHeight;
            const w = ((xmax - xmin) / 1000) * canvasWidth;
            const h = ((ymax - ymin) / 1000) * canvasHeight;

            // Basic table structure (empty for now, but formatted)
            visionElements.push({
              id: nanoid(),
              type: "table",
              position: { x: Math.round(x), y: Math.round(y) },
              dimension: { width: Math.round(w), height: Math.round(h) },
              rotation: 0,
              locked: false,
              visible: true,
              zIndex: 10,
              pageIndex: 0,
              aspectRatioLocked: false,
              tableSettings: {
                columns: Array.from({ length: tableData.cols || 3 }).map((_, i) => ({
                  id: `col-${i}`,
                  header: `Col ${i + 1}`,
                  width: Math.round(w / (tableData.cols || 3)),
                  headerAlign: "left",
                  rowAlign: "left"
                })),
                headerStyle: { fontFamily: "Inter", fontSize: 12, fontWeight: 700, color: "#000", textAlign: "left", verticalAlign: "middle", lineHeight: 1.2, letterSpacing: 0 },
                rowStyle: { fontFamily: "Inter", fontSize: 12, fontWeight: 400, color: "#000", textAlign: "left", verticalAlign: "middle", lineHeight: 1.2, letterSpacing: 0 },
                headerBackgroundColor: "#f3f4f6",
                rowBackgroundColor: "#ffffff",
                borderColor: "#e5e7eb",
                borderWidth: 1,
                cellPadding: 8,
                autoFitColumns: false,
                autoHeightAdaptation: false,
                minColumnWidth: 50,
                equalRowHeights: true,
                minRowHeight: 24,
                alternateRowColors: false
              }
            });
          }
        }
    } catch (e) {
      console.error("AI Layout Analysis failed, falling back to basic import:", e);
    }

    await pdfDoc.destroy();

    // 4. Combine Everything
    // If AI found images, we hide the main background so user can manipulate the pieces
    // If AI failed, we show the main background as a fallback
    const hideBackground = visionElements.some(el => el.type === "image");

    return {
      elements: [...visionElements, ...textElements],
      canvasWidth,
      canvasHeight,
      backgroundDataUrl, // Store keeps this as "Layer 0" (likely locked)
      totalPages,
      importedPage: pageNumber,
    };

  } catch (error) {
    console.error("PDF Import Failed:", error);
    throw error;
  }
}
