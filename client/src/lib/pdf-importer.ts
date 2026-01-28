/**
 * AI-Assisted PDF Layout Template Generator
 *
 * Workflow:
 * 1. Render PDF page to a high-quality "Master Image" (for AI analysis only).
 * 2. Send "Master Image" to Gemini AI to identify discrete elements:
 *    - Visual Images (logos, product photos, icons)
 *    - Data Tables (grids)
 *    - Text Regions (paragraphs, headings, lists) - grouped as unified bounding boxes
 * 3. Create placeholder "Image Elements" where the AI detected images (no actual image data).
 * 4. Create empty "Table Elements" with generic column headers where the AI detected tables.
 * 5. Create "Text Elements" from AI-detected text regions with type-based placeholders.
 *
 * NOTE: The backgroundDataUrl is NEVER added as a canvas element. It is only used
 * for AI analysis and then discarded. No background layer is created.
 *
 * NOTE: Raw PDF.js text extraction has been disabled in favor of AI-based text region
 * detection, which solves the text fragmentation issue by identifying unified text blocks.
 */

import * as pdfjsLib from "pdfjs-dist";
// NOTE: TextItem and TextMarkedContent imports removed - raw text extraction disabled in favor of AI text regions
import { nanoid } from "nanoid";
import type { CanvasElement } from "@shared/schema";

// --- CONFIGURATION ---
const PDFJS_VERSION = pdfjsLib.version || "5.4.449";
// Use unpkg for reliable worker loading
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

const PDF_DPI = 72;
const CANVAS_DPI = 96;
const DPI_SCALE = CANVAS_DPI / PDF_DPI; // ~1.333
const RENDER_SCALE = 2; // Render at 2x for high quality AI analysis

// NOTE: Text merging configuration removed - AI now handles text region detection
// See processAITextRegions() for placeholder content generation

export interface PdfImportResult {
  elements: CanvasElement[];
  canvasWidth: number;
  canvasHeight: number;
  backgroundDataUrl: string; // Provided for reference only, NOT added to canvas
  totalPages: number;
  importedPage: number;
}

export interface PdfImportOptions {
  pageNumber?: number;
  imageQuality?: number;
}

// --- HELPER FUNCTIONS ---

// NOTE: The following raw text extraction code has been removed in favor of AI-based text region detection:
// - RawTextItem interface
// - isTextItem() - type guard for PDF.js text items
// - extractFontWeight() - font weight detection from PDF font names
// - mapToWebFont() - PDF to web font mapping
// - convertPdfToCanvasCoords() - PDF coordinate conversion
// - estimateTextWidth() - text width estimation
// - mergeFragmentedText() - text fragment merging algorithm
// - isTextCenterInsideTable() - table overlap detection
// - extractTextElements() - raw PDF.js text extraction
//
// The AI now handles text region detection directly, grouping text into unified bounding boxes
// for paragraphs, headings, and lists. See processAITextRegions() for the new implementation.

async function renderPageToImage(
  page: pdfjsLib.PDFPageProxy,
  options: PdfImportOptions
): Promise<string> {
  // Render at high resolution for AI analysis
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

/**
 * Process AI-detected images and create placeholder image elements.
 * Uses undefined imageSrc so the UI shows an empty image placeholder block.
 * NO actual image cropping is performed - this is a layout template.
 */
function processAIImages(
  images: Array<{ box_2d: [number, number, number, number]; label?: string }>,
  canvasWidth: number,
  canvasHeight: number
): CanvasElement[] {
  const elements: CanvasElement[] = [];
  let zIndex = 10;

  for (const imgData of images) {
    const [ymin, xmin, ymax, xmax] = imgData.box_2d;

    // Calculate canvas position from normalized coordinates
    const x = (xmin / 1000) * canvasWidth;
    const y = (ymin / 1000) * canvasHeight;
    const w = ((xmax - xmin) / 1000) * canvasWidth;
    const h = ((ymax - ymin) / 1000) * canvasHeight;

    elements.push({
      id: nanoid(),
      type: "image",
      imageSrc: undefined, // Placeholder - shows empty image block in UI
      position: { x: Math.round(x), y: Math.round(y) },
      dimension: { width: Math.round(w), height: Math.round(h) },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: zIndex++,
      pageIndex: 0,
      aspectRatioLocked: true,
      aspectRatio: w / h,
    });
  }

  return elements;
}

/**
 * Process AI-detected tables and create table elements with generic headers.
 * Also returns bounding boxes for filtering out overlapping text.
 */
function processAITables(
  tables: Array<{ box_2d: [number, number, number, number]; cols?: number; rows?: number }>,
  canvasWidth: number,
  canvasHeight: number
): { elements: CanvasElement[]; boundingBoxes: Array<{ x: number; y: number; width: number; height: number }> } {
  const elements: CanvasElement[] = [];
  const boundingBoxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  let zIndex = 10;

  for (const tableData of tables) {
    const [ymin, xmin, ymax, xmax] = tableData.box_2d;

    const x = (xmin / 1000) * canvasWidth;
    const y = (ymin / 1000) * canvasHeight;
    const w = ((xmax - xmin) / 1000) * canvasWidth;
    const h = ((ymax - ymin) / 1000) * canvasHeight;

    // Store bounding box for text overlap filtering
    boundingBoxes.push({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
    });

    const numCols = tableData.cols || 3;

    elements.push({
      id: nanoid(),
      type: "table",
      position: { x: Math.round(x), y: Math.round(y) },
      dimension: { width: Math.round(w), height: Math.round(h) },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: zIndex++,
      pageIndex: 0,
      aspectRatioLocked: false,
      tableSettings: {
        columns: Array.from({ length: numCols }).map((_, i) => ({
          id: `col-${i}`,
          header: `Column ${i + 1}`, // Generic placeholder headers
          width: Math.round(w / numCols),
          headerAlign: "left",
          rowAlign: "left"
        })),
        headerStyle: {
          fontFamily: "Inter",
          fontSize: 12,
          fontWeight: 700,
          color: "#000",
          textAlign: "left",
          verticalAlign: "middle",
          lineHeight: 1.2,
          letterSpacing: 0
        },
        rowStyle: {
          fontFamily: "Inter",
          fontSize: 12,
          fontWeight: 400,
          color: "#000",
          textAlign: "left",
          verticalAlign: "middle",
          lineHeight: 1.2,
          letterSpacing: 0
        },
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

  return { elements, boundingBoxes };
}

/**
 * Process AI-detected text regions and create text elements with placeholders.
 * This replaces the raw PDF.js text extraction with AI-identified text regions.
 */
function processAITextRegions(
  textRegions: Array<{ box_2d: [number, number, number, number]; type: "paragraph" | "heading" | "list" }>,
  canvasWidth: number,
  canvasHeight: number
): CanvasElement[] {
  const elements: CanvasElement[] = [];
  let zIndex = 50; // Text elements go on top of images/tables

  for (const region of textRegions) {
    const [ymin, xmin, ymax, xmax] = region.box_2d;

    // Convert normalized coordinates (0-1000) to canvas pixels
    const x = (xmin / 1000) * canvasWidth;
    const y = (ymin / 1000) * canvasHeight;
    const w = ((xmax - xmin) / 1000) * canvasWidth;
    const h = ((ymax - ymin) / 1000) * canvasHeight;

    // Determine placeholder content and font size based on region type
    let content: string;
    let fontSize: number;
    let fontWeight: number;

    switch (region.type) {
      case "heading":
        content = "Heading";
        fontSize = 24;
        fontWeight = 700;
        break;
      case "list":
        content = "• List Item";
        fontSize = 14;
        fontWeight = 400;
        break;
      case "paragraph":
      default:
        content = "Paragraph Text...";
        fontSize = 14;
        fontWeight = 400;
        break;
    }

    elements.push({
      id: nanoid(),
      type: "text",
      content,
      position: { x: Math.round(x), y: Math.round(y) },
      dimension: { width: Math.round(w), height: Math.round(h) },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: zIndex++,
      pageIndex: 0,
      aspectRatioLocked: false,
      textStyle: {
        fontFamily: "Inter",
        fontSize,
        fontWeight,
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

    // 1. Render Full Page Image for AI Analysis ONLY
    //    This image is sent to AI and then DISCARDED - NOT added as a background layer
    const backgroundDataUrl = await renderPageToImage(page, options);

    // 2. AI Analysis (STRICT - No Fallback)
    console.log("PDF Importer: Sending image to AI for layout analysis...");
    const aiResponse = await fetch("/api/ai/analyze-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: backgroundDataUrl }),
    });

    if (!aiResponse.ok) {
      const errorBody = await aiResponse.text();
      throw new Error(`AI Analysis Failed (${aiResponse.status}): ${errorBody}`);
    }

    const layout = await aiResponse.json();
    console.log(`PDF Importer: AI detected ${layout.images?.length || 0} images, ${layout.tables?.length || 0} tables, ${layout.text_regions?.length || 0} text regions`);

    // 3. Process AI-detected Tables
    const { elements: tableElements } = processAITables(
      layout.tables || [],
      canvasWidth,
      canvasHeight
    );

    // 4. Process AI-detected Images (placeholder images, no actual cropped data)
    const imageElements = processAIImages(
      layout.images || [],
      canvasWidth,
      canvasHeight
    );

    // 5. Process AI-detected Text Regions (replaces raw PDF.js text extraction)
    //    The AI identifies unified text regions (paragraphs, headings, lists) as single bounding boxes,
    //    eliminating the text fragmentation issue from raw PDF text extraction.
    const textElements = processAITextRegions(
      layout.text_regions || [],
      canvasWidth,
      canvasHeight
    );

    await pdfDoc.destroy();

    // 6. Combine all elements - NO BACKGROUND ELEMENT
    //    The backgroundDataUrl is NOT added to the canvas elements.
    //    zIndex ordering: Tables & Images at 10+, Text at 50+
    const allElements: CanvasElement[] = [
      ...tableElements,
      ...imageElements,
      ...textElements,
    ];

    console.log(`PDF Importer: Created layout template with ${allElements.length} elements (${tableElements.length} tables, ${imageElements.length} images, ${textElements.length} text regions)`);

    return {
      elements: allElements,
      canvasWidth,
      canvasHeight,
      backgroundDataUrl, // Provided for reference/debugging only - NOT in elements
      totalPages,
      importedPage: pageNumber,
    };

  } catch (error) {
    console.error("Critical PDF Import Failure:", error);
    throw error;
  }
}
