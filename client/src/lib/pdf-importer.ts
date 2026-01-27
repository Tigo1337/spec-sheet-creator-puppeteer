/**
 * PDF Importer Utility
 *
 * Uses pdfjs-dist to parse PDFs and extract:
 * 1. A high-quality background image (DataURL) for visual reference
 * 2. Editable text elements mapped to CanvasElement schema
 */

import * as pdfjsLib from "pdfjs-dist";
import type { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";
import { nanoid } from "nanoid";
import type { CanvasElement, TextStyle } from "@shared/schema";

// --- WORKER CONFIGURATION ---
// We use a fallback version string just in case, but pdfjsLib.version should be defined.
// Unpkg is more reliable for specific NPM versions than cdnjs.
const PDFJS_VERSION = pdfjsLib.version || "5.4.449";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

// DPI conversion constants
const PDF_DPI = 72;
const CANVAS_DPI = 96;
const DPI_SCALE = CANVAS_DPI / PDF_DPI; // 1.333...

// Rendering scale for high-quality background images
const RENDER_SCALE = 2;

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
  imageFormat?: "image/png" | "image/jpeg";
}

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return "str" in item && typeof item.str === "string";
}

function extractFontWeight(fontName: string): number {
  const name = fontName.toLowerCase();
  if (name.includes("black") || name.includes("heavy")) return 900;
  if (name.includes("extrabold") || name.includes("ultrabold")) return 800;
  if (name.includes("bold")) return 700;
  if (name.includes("semibold") || name.includes("demibold")) return 600;
  if (name.includes("medium")) return 500;
  if (name.includes("light")) return 300;
  if (name.includes("extralight") || name.includes("ultralight")) return 200;
  if (name.includes("thin")) return 100;
  return 400;
}

function mapToWebFont(fontName: string): string {
  const name = fontName.toLowerCase();
  if (name.includes("arial") || name.includes("helvetica")) return "Inter";
  if (name.includes("times")) return "Georgia";
  if (name.includes("courier")) return "Inconsolata";
  if (name.includes("georgia")) return "Georgia";
  if (name.includes("verdana")) return "Inter";
  if (name.includes("trebuchet")) return "Inter";
  if (name.includes("palatino")) return "Libre Baskerville";
  if (name.includes("bookman")) return "Libre Baskerville";
  if (name.includes("garamond")) return "Crimson Text";
  if (name.includes("century")) return "Libre Baskerville";
  if (name.includes("futura")) return "Montserrat";
  if (name.includes("avant")) return "Raleway";
  if (name.includes("calibri")) return "Inter";
  if (name.includes("cambria")) return "Georgia";
  if (name.includes("roboto")) return "Roboto";
  if (name.includes("open sans") || name.includes("opensans")) return "Open Sans";
  if (name.includes("lato")) return "Lato";
  if (name.includes("montserrat")) return "Montserrat";
  if (name.includes("poppins")) return "Poppins";
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
  fontSize: number,
  fontWeight: number
): { width: number; height: number } {
  const avgCharWidth = fontSize * 0.55;
  const width = Math.max(content.length * avgCharWidth, 50);
  const height = Math.max(fontSize * 1.4, 20);
  return { width, height };
}

async function renderPageToImage(
  page: pdfjsLib.PDFPageProxy,
  options: PdfImportOptions
): Promise<string> {
  const viewport = page.getViewport({ scale: RENDER_SCALE * DPI_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Failed to get 2D canvas context");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  const format = options.imageFormat || "image/png";
  const quality = options.imageQuality || 0.92;
  return canvas.toDataURL(format, quality);
}

async function extractTextElements(
  page: pdfjsLib.PDFPageProxy,
  pageHeightPt: number
): Promise<CanvasElement[]> {
  const textContent = await page.getTextContent();
  const elements: CanvasElement[] = [];
  let zIndex = 1;

  for (const item of textContent.items) {
    if (!isTextItem(item)) continue;
    const text = item.str.trim();
    if (!text) continue;

    const transform = item.transform;
    const pdfX = transform[4];
    const pdfY = transform[5];
    const fontSizeFromTransform = Math.abs(transform[3]);
    const fontSize = Math.round(fontSizeFromTransform * DPI_SCALE);

    const { x, y } = convertPdfToCanvasCoords(pdfX, pdfY, pageHeightPt, fontSize);
    if (x < 0 || y < 0) continue;

    const fontName = item.fontName || "";
    const fontWeight = extractFontWeight(fontName);
    const fontFamily = mapToWebFont(fontName);
    const { width, height } = estimateTextDimensions(text, fontSize, fontWeight);

    const textStyle: TextStyle = {
      fontFamily,
      fontSize,
      fontWeight,
      color: "#000000",
      textAlign: "left",
      verticalAlign: "top",
      lineHeight: 1.2,
      letterSpacing: 0,
    };

    const element: CanvasElement = {
      id: nanoid(),
      type: "text",
      position: { x: Math.round(x), y: Math.round(y) },
      dimension: { width: Math.round(width), height: Math.round(height) },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: zIndex++,
      content: text,
      pageIndex: 0,
      textStyle,
      aspectRatioLocked: false,
    };
    elements.push(element);
  }
  return elements;
}

export async function importPdf(
  file: File,
  options: PdfImportOptions = {}
): Promise<PdfImportResult> {
  const { pageNumber = 1 } = options;

  try {
    const arrayBuffer = await file.arrayBuffer();

    // Standard Font Data (cMaps) is required for robust text extraction
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
      cMapPacked: true,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    if (pageNumber < 1 || pageNumber > totalPages) {
      throw new Error(`Invalid page number: ${pageNumber}. PDF has ${totalPages} pages.`);
    }

    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });

    const pageWidthPt = viewport.width;
    const pageHeightPt = viewport.height;
    const canvasWidth = Math.round(pageWidthPt * DPI_SCALE);
    const canvasHeight = Math.round(pageHeightPt * DPI_SCALE);

    const [backgroundDataUrl, textElements] = await Promise.all([
      renderPageToImage(page, options),
      extractTextElements(page, pageHeightPt),
    ]);

    await pdfDoc.destroy();

    return {
      elements: textElements,
      canvasWidth,
      canvasHeight,
      backgroundDataUrl,
      totalPages,
      importedPage: pageNumber,
    };
  } catch (error) {
    console.error("PDF Import Failed:", error);
    throw error;
  }
}
