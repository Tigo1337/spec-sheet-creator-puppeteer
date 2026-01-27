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

// Configure the PDF.js worker for pdfjs-dist v5
// Use CDN for reliable cross-environment compatibility with Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// DPI conversion constants
const PDF_DPI = 72;
const CANVAS_DPI = 96;
const DPI_SCALE = CANVAS_DPI / PDF_DPI; // 1.333...

// Rendering scale for high-quality background images
const RENDER_SCALE = 2;

/**
 * Result type for PDF import operation
 */
export interface PdfImportResult {
  /** Extracted text elements mapped to CanvasElement schema */
  elements: CanvasElement[];
  /** Canvas width in pixels (96 DPI) */
  canvasWidth: number;
  /** Canvas height in pixels (96 DPI) */
  canvasHeight: number;
  /** High-quality background image as DataURL */
  backgroundDataUrl: string;
  /** Total number of pages in the PDF */
  totalPages: number;
  /** Currently imported page number (1-indexed) */
  importedPage: number;
}

/**
 * Options for PDF import
 */
export interface PdfImportOptions {
  /** Page number to import (1-indexed, default: 1) */
  pageNumber?: number;
  /** Image quality for background (0-1, default: 0.92) */
  imageQuality?: number;
  /** Image format for background ('image/png' | 'image/jpeg', default: 'image/png') */
  imageFormat?: "image/png" | "image/jpeg";
}

/**
 * Checks if a TextContent item is a TextItem (has str property)
 */
function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return "str" in item && typeof item.str === "string";
}

/**
 * Extracts font weight from font name string
 * Common patterns: "Bold", "Heavy", "Black", "Medium", "Light", "Thin"
 */
function extractFontWeight(fontName: string): number {
  const name = fontName.toLowerCase();

  if (name.includes("black") || name.includes("heavy")) return 900;
  if (name.includes("extrabold") || name.includes("ultrabold")) return 800;
  if (name.includes("bold")) return 700;
  if (name.includes("semibold") || name.includes("demibold")) return 600;
  if (name.includes("medium")) return 500;
  if (name.includes("regular") || name.includes("normal")) return 400;
  if (name.includes("light")) return 300;
  if (name.includes("extralight") || name.includes("ultralight")) return 200;
  if (name.includes("thin")) return 100;

  return 400; // Default to normal weight
}

/**
 * Maps a PDF font name to a commonly available web font
 */
function mapToWebFont(fontName: string): string {
  const name = fontName.toLowerCase();

  // Common PDF font mappings
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

  // Default to Inter for sans-serif or unrecognized fonts
  return "Inter";
}

/**
 * Converts PDF coordinates to Canvas coordinates
 *
 * PDF uses: Bottom-left origin, 72 DPI
 * Canvas uses: Top-left origin, 96 DPI
 *
 * @param pdfY - Y coordinate in PDF space
 * @param pdfX - X coordinate in PDF space
 * @param pageHeightPt - Page height in PDF points
 * @param fontSize - Font size to account for baseline offset
 */
function convertPdfToCanvasCoords(
  pdfX: number,
  pdfY: number,
  pageHeightPt: number,
  fontSize: number
): { x: number; y: number } {
  // Convert from bottom-left to top-left origin
  // The text baseline in PDF is at the bottom of the text, so we subtract fontSize
  const canvasY = (pageHeightPt - pdfY) * DPI_SCALE;
  const canvasX = pdfX * DPI_SCALE;

  return { x: canvasX, y: canvasY - fontSize };
}

/**
 * Estimates text dimensions based on content and font size
 */
function estimateTextDimensions(
  content: string,
  fontSize: number,
  fontWeight: number
): { width: number; height: number } {
  // Approximate character width based on font size
  // Average character width is roughly 0.5-0.6 of font size for most fonts
  const avgCharWidth = fontSize * 0.55;
  const width = Math.max(content.length * avgCharWidth, 50);
  const height = Math.max(fontSize * 1.4, 20); // Line height factor

  return { width, height };
}

/**
 * Renders a PDF page to a high-quality DataURL image
 */
async function renderPageToImage(
  page: pdfjsLib.PDFPageProxy,
  options: PdfImportOptions
): Promise<string> {
  const viewport = page.getViewport({ scale: RENDER_SCALE * DPI_SCALE });

  // Create offscreen canvas
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Failed to get 2D canvas context");
  }

  // Fill with white background
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  // Render PDF page to canvas
  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  // Convert to DataURL
  const format = options.imageFormat || "image/png";
  const quality = options.imageQuality || 0.92;

  return canvas.toDataURL(format, quality);
}

/**
 * Extracts text items from a PDF page and converts them to CanvasElements
 */
async function extractTextElements(
  page: pdfjsLib.PDFPageProxy,
  pageHeightPt: number
): Promise<CanvasElement[]> {
  const textContent = await page.getTextContent();
  const elements: CanvasElement[] = [];

  let zIndex = 1; // Start at 1 since background image is at 0

  for (const item of textContent.items) {
    if (!isTextItem(item)) continue;

    const text = item.str.trim();
    if (!text) continue; // Skip empty strings

    // Extract transform data
    // transform array: [scaleX, skewX, skewY, scaleY, translateX, translateY]
    const transform = item.transform;
    const pdfX = transform[4];
    const pdfY = transform[5];

    // Extract font size from transform (scaleY gives the font size)
    const fontSizeFromTransform = Math.abs(transform[3]);
    const fontSize = Math.round(fontSizeFromTransform * DPI_SCALE);

    // Convert coordinates
    const { x, y } = convertPdfToCanvasCoords(pdfX, pdfY, pageHeightPt, fontSize);

    // Skip elements that would be off-canvas (negative coordinates)
    if (x < 0 || y < 0) continue;

    // Extract font info
    const fontName = item.fontName || "";
    const fontWeight = extractFontWeight(fontName);
    const fontFamily = mapToWebFont(fontName);

    // Estimate dimensions
    const { width, height } = estimateTextDimensions(text, fontSize, fontWeight);

    // Create text style
    const textStyle: TextStyle = {
      fontFamily,
      fontSize,
      fontWeight,
      color: "#000000", // PDF text color extraction is complex; default to black
      textAlign: "left",
      verticalAlign: "top",
      lineHeight: 1.2,
      letterSpacing: 0,
    };

    // Create CanvasElement
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

/**
 * Imports a PDF file and extracts its content for the canvas
 *
 * This implements a "hybrid" strategy:
 * 1. Renders the PDF page as a high-quality background image (preserves complex graphics)
 * 2. Extracts text items as editable CanvasElements positioned over the background
 *
 * @param file - PDF file to import
 * @param options - Import options (page number, image quality, etc.)
 * @returns Promise resolving to PdfImportResult
 */
export async function importPdf(
  file: File,
  options: PdfImportOptions = {}
): Promise<PdfImportResult> {
  const { pageNumber = 1 } = options;

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Load PDF document
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    // Enable font loading for better text extraction
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  // Validate page number
  if (pageNumber < 1 || pageNumber > totalPages) {
    throw new Error(`Invalid page number: ${pageNumber}. PDF has ${totalPages} pages.`);
  }

  // Get the requested page
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });

  // Calculate canvas dimensions (convert from 72 DPI to 96 DPI)
  const pageWidthPt = viewport.width;
  const pageHeightPt = viewport.height;
  const canvasWidth = Math.round(pageWidthPt * DPI_SCALE);
  const canvasHeight = Math.round(pageHeightPt * DPI_SCALE);

  // Run background rendering and text extraction in parallel
  const [backgroundDataUrl, textElements] = await Promise.all([
    renderPageToImage(page, options),
    extractTextElements(page, pageHeightPt),
  ]);

  // Clean up
  await pdfDoc.destroy();

  return {
    elements: textElements,
    canvasWidth,
    canvasHeight,
    backgroundDataUrl,
    totalPages,
    importedPage: pageNumber,
  };
}

/**
 * Gets basic information about a PDF without fully importing it
 * Useful for showing page count before import
 */
export async function getPdfInfo(file: File): Promise<{
  totalPages: number;
  pageWidth: number;
  pageHeight: number;
}> {
  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const totalPages = pdfDoc.numPages;
  const firstPage = await pdfDoc.getPage(1);
  const viewport = firstPage.getViewport({ scale: 1 });

  // Convert to canvas DPI
  const pageWidth = Math.round(viewport.width * DPI_SCALE);
  const pageHeight = Math.round(viewport.height * DPI_SCALE);

  await pdfDoc.destroy();

  return { totalPages, pageWidth, pageHeight };
}

/**
 * Validates that a file is a valid PDF
 */
export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
