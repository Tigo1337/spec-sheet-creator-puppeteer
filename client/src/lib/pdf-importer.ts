/**
 * AI-Assisted PDF Layout Template Generator
 *
 * Workflow:
 * 1. Render PDF page to a high-quality "Master Image".
 * 2. Send "Master Image" to Gemini AI to identify discrete elements (Logos, Photos, Tables).
 * 3. Create placeholder "Image Elements" where the AI detected images (no actual image data).
 * 4. Create empty "Table Elements" with generic column headers where the AI detected tables.
 * 5. Extract "Text Elements" using PDF.js, merge fragmented text, and replace with placeholders.
 * 6. Filter out text elements that overlap with detected tables.
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

// Text merging configuration
const TEXT_MERGE_Y_TOLERANCE = 5; // Max vertical distance (px) to consider same line
const TEXT_MERGE_X_GAP = 20; // Max horizontal gap (px) to merge text items

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

// Internal interface for raw text items before merging
interface RawTextItem {
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
}

// --- HELPER FUNCTIONS ---

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return "str" in item && typeof item.str === "string";
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

function estimateTextWidth(charCount: number, fontSize: number): number {
  const avgCharWidth = fontSize * 0.55;
  return Math.max(charCount * avgCharWidth, 20);
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

/**
 * Merge fragmented text items that are on the same line and close together.
 * Returns merged text items with adjusted positions and widths.
 */
function mergeFragmentedText(items: RawTextItem[]): RawTextItem[] {
  if (items.length === 0) return [];

  // Sort by Y position first, then by X position
  const sorted = [...items].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > TEXT_MERGE_Y_TOLERANCE) return yDiff;
    return a.x - b.x;
  });

  const merged: RawTextItem[] = [];
  let current: RawTextItem | null = null;

  for (const item of sorted) {
    if (!current) {
      current = { ...item };
      continue;
    }

    // Check if this item is on the same line (similar Y coordinate)
    const sameY = Math.abs(item.y - current.y) <= TEXT_MERGE_Y_TOLERANCE;

    // Check if this item is close enough horizontally to merge
    const currentRight = current.x + current.width;
    const horizontalGap = item.x - currentRight;
    const closeEnough = horizontalGap >= 0 && horizontalGap <= TEXT_MERGE_X_GAP;

    // Check if font properties match (same style text)
    const sameFont = item.fontSize === current.fontSize &&
                     item.fontFamily === current.fontFamily &&
                     item.fontWeight === current.fontWeight;

    if (sameY && closeEnough && sameFont) {
      // Merge: extend the current item's width to cover both
      const newRight = item.x + item.width;
      current.width = newRight - current.x;
      // Keep the smaller y and larger height if they differ slightly
      current.y = Math.min(current.y, item.y);
      current.height = Math.max(current.height, item.height);
    } else {
      // Start a new merged item
      merged.push(current);
      current = { ...item };
    }
  }

  // Don't forget the last item
  if (current) {
    merged.push(current);
  }

  return merged;
}

/**
 * Check if a point/rect overlaps with any table bounding box.
 */
function isOverlappingTable(
  textX: number,
  textY: number,
  textWidth: number,
  textHeight: number,
  tables: Array<{ x: number; y: number; width: number; height: number }>
): boolean {
  for (const table of tables) {
    // Check if text bounding box overlaps with table bounding box
    const textRight = textX + textWidth;
    const textBottom = textY + textHeight;
    const tableRight = table.x + table.width;
    const tableBottom = table.y + table.height;

    // Overlap check: NOT (completely left, right, above, or below)
    const overlaps = !(
      textRight < table.x ||  // text is completely left of table
      textX > tableRight ||   // text is completely right of table
      textBottom < table.y || // text is completely above table
      textY > tableBottom     // text is completely below table
    );

    if (overlaps) return true;
  }
  return false;
}

async function extractTextElements(
  page: pdfjsLib.PDFPageProxy,
  pageHeightPt: number
): Promise<{ elements: CanvasElement[]; rawItems: RawTextItem[] }> {
  const textContent = await page.getTextContent();
  const rawItems: RawTextItem[] = [];

  // First pass: collect all raw text items
  for (const item of textContent.items) {
    if (!isTextItem(item)) continue;
    const text = item.str.trim();
    if (!text) continue;

    const transform = item.transform;
    const fontSize = Math.round(Math.abs(transform[3]) * DPI_SCALE);
    const { x, y } = convertPdfToCanvasCoords(transform[4], transform[5], pageHeightPt, fontSize);

    if (x < 0 || y < 0) continue;

    const width = estimateTextWidth(text.length, fontSize);
    const height = Math.max(fontSize * 1.4, 20);

    rawItems.push({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      fontSize,
      fontFamily: mapToWebFont(item.fontName),
      fontWeight: extractFontWeight(item.fontName),
    });
  }

  // Merge fragmented text items
  const mergedItems = mergeFragmentedText(rawItems);

  // Convert to CanvasElements with placeholder text
  const elements: CanvasElement[] = [];
  let zIndex = 50; // Text goes on top of images/tables (which are at ~10)

  for (const item of mergedItems) {
    elements.push({
      id: nanoid(),
      type: "text",
      content: "[Text Field]", // Placeholder text instead of actual content
      position: { x: item.x, y: item.y },
      dimension: { width: item.width, height: item.height },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: zIndex++,
      pageIndex: 0,
      aspectRatioLocked: false,
      textStyle: {
        fontFamily: item.fontFamily,
        fontSize: item.fontSize,
        fontWeight: item.fontWeight,
        color: "#000000",
        textAlign: "left",
        verticalAlign: "top",
        lineHeight: 1.2,
        letterSpacing: 0,
      },
    });
  }

  return { elements, rawItems: mergedItems };
}

/**
 * Process AI-detected images and create placeholder image elements.
 * Uses undefined imageSrc so the UI shows an empty image block.
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

    // Calculate canvas position
    const x = (xmin / 1000) * canvasWidth;
    const y = (ymin / 1000) * canvasHeight;
    const w = ((xmax - xmin) / 1000) * canvasWidth;
    const h = ((ymax - ymin) / 1000) * canvasHeight;

    elements.push({
      id: nanoid(),
      type: "image",
      imageSrc: undefined, // Placeholder - no actual image, shows empty image block
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

    // 1. Render Full Page Image for AI Analysis (NOT added to canvas)
    const backgroundDataUrl = await renderPageToImage(page, options);

    // 2. AI Analysis (STRICT - No Fallback)
    console.log("PDF Importer: Sending image to AI (" + backgroundDataUrl.length + " chars)");
    const aiResponse = await fetch("/api/ai/analyze-layout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: backgroundDataUrl }),
    });

    if (!aiResponse.ok) {
      const errorBody = await aiResponse.text();
      throw new Error("AI Analysis Failed (" + aiResponse.status + "): " + errorBody);
    }

    const layout = await aiResponse.json();
    console.log("PDF Importer: AI Analysis successful. Detected " + layout.images.length + " images and " + layout.tables.length + " tables.");

    // 3. Process AI-detected Tables (with bounding boxes for text filtering)
    const { elements: tableElements, boundingBoxes: tableBoundingBoxes } = processAITables(
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

    // 5. Extract and Merge Text Elements
    const { elements: textElements } = await extractTextElements(page, pageHeightPt);

    // 6. Filter out text elements that overlap with table bounding boxes
    const filteredTextElements = textElements.filter((textEl) => {
      const overlaps = isOverlappingTable(
        textEl.position.x,
        textEl.position.y,
        textEl.dimension.width,
        textEl.dimension.height,
        tableBoundingBoxes
      );
      return !overlaps;
    });

    console.log(`PDF Importer: Filtered ${textElements.length - filteredTextElements.length} text elements overlapping tables.`);

    await pdfDoc.destroy();

    // 7. Combine all elements (NO background element)
    // zIndex ordering: Tables & Images at 10+, Text at 50+
    const allElements: CanvasElement[] = [
      ...tableElements,
      ...imageElements,
      ...filteredTextElements,
    ];

    return {
      elements: allElements,
      canvasWidth,
      canvasHeight,
      backgroundDataUrl, // Still provided for reference, but NOT in elements
      totalPages,
      importedPage: pageNumber,
    };

  } catch (error) {
    console.error("Critical PDF Import Failure:", error);
    throw error;
  }
}
