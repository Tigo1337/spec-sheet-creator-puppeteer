/**
 * AI-Assisted PDF Layout Template Generator
 *
 * Workflow:
 * 1. Render PDF page to a high-quality "Master Image" (for AI analysis only).
 * 2. Send "Master Image" to Gemini AI to identify discrete elements (Logos, Photos, Tables).
 * 3. Create placeholder "Image Elements" where the AI detected images (no actual image data).
 * 4. Create empty "Table Elements" with generic column headers where the AI detected tables.
 * 5. Extract "Text Elements" using PDF.js, merge fragmented text into lines, use placeholders.
 * 6. Filter out text elements whose center point falls inside detected tables.
 *
 * NOTE: The backgroundDataUrl is NEVER added as a canvas element. It is only used
 * for AI analysis and then discarded. No background layer is created.
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
const RENDER_SCALE = 2; // Render at 2x for high quality AI analysis

// Text merging configuration
const TEXT_MERGE_Y_TOLERANCE = 5; // Max vertical distance (px) to consider same line
const TEXT_MERGE_X_GAP = 20; // Max horizontal gap (px) to merge text items

// Placeholder text for layout templates
const PLACEHOLDER_TEXT = "Lorem ipsum dolor sit amet...";

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

// Internal interface for raw text items before merging
interface RawTextItem {
  content: string; // The actual text content
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

function estimateTextWidth(text: string, fontSize: number): number {
  // Average character width is roughly 0.55 of font size for most fonts
  const avgCharWidth = fontSize * 0.55;
  return Math.max(text.length * avgCharWidth, 20);
}

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
 * Merge fragmented text items that are on the same line and close together.
 *
 * Algorithm:
 * 1. Sort all items by Y position (top to bottom), then X position (left to right)
 * 2. Iterate through sorted items and merge if:
 *    - Same vertical line (Y difference < TEXT_MERGE_Y_TOLERANCE)
 *    - Close horizontally (gap between items < TEXT_MERGE_X_GAP)
 *    - Same font properties (size, family, weight)
 * 3. Combined content includes space between merged items
 * 4. Width spans from start of first item to end of last item
 */
function mergeFragmentedText(items: RawTextItem[]): RawTextItem[] {
  if (items.length === 0) return [];

  // Step 1: Sort by Y position first (top to bottom), then by X position (left to right)
  const sorted = [...items].sort((a, b) => {
    const yDiff = a.y - b.y;
    // If Y positions are within tolerance, sort by X
    if (Math.abs(yDiff) <= TEXT_MERGE_Y_TOLERANCE) {
      return a.x - b.x;
    }
    return yDiff;
  });

  const merged: RawTextItem[] = [];
  let current: RawTextItem | null = null;

  // Step 2 & 3: Iterate and merge adjacent items on same line
  for (const item of sorted) {
    if (!current) {
      // First item becomes current
      current = { ...item };
      continue;
    }

    // Check if this item is on the same line (similar Y coordinate)
    const sameY = Math.abs(item.y - current.y) <= TEXT_MERGE_Y_TOLERANCE;

    // Check if this item is close enough horizontally to merge
    const currentRight = current.x + current.width;
    const horizontalGap = item.x - currentRight;
    const closeEnough = horizontalGap >= -5 && horizontalGap <= TEXT_MERGE_X_GAP;

    // Check if font properties match (same style text)
    const sameFont =
      item.fontSize === current.fontSize &&
      item.fontFamily === current.fontFamily &&
      item.fontWeight === current.fontWeight;

    if (sameY && closeEnough && sameFont) {
      // MERGE: Combine content with space, extend width
      current.content = current.content + " " + item.content;

      // Width spans from start of current to end of item
      const newRight = item.x + item.width;
      current.width = newRight - current.x;

      // Keep the smaller y and larger height if they differ slightly
      current.y = Math.min(current.y, item.y);
      current.height = Math.max(current.height, item.height);
    } else {
      // Start a new merged group
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
 * Check if a text element's CENTER POINT falls within any table bounding box.
 * This is used to remove text that would appear on top of tables.
 */
function isTextCenterInsideTable(
  textX: number,
  textY: number,
  textWidth: number,
  textHeight: number,
  tables: Array<{ x: number; y: number; width: number; height: number }>
): boolean {
  // Calculate center point of text element
  const centerX = textX + textWidth / 2;
  const centerY = textY + textHeight / 2;

  for (const table of tables) {
    const tableRight = table.x + table.width;
    const tableBottom = table.y + table.height;

    // Check if center point is inside table bounding box
    const insideX = centerX >= table.x && centerX <= tableRight;
    const insideY = centerY >= table.y && centerY <= tableBottom;

    if (insideX && insideY) {
      return true;
    }
  }

  return false;
}

async function extractTextElements(
  page: pdfjsLib.PDFPageProxy,
  pageHeightPt: number
): Promise<{ elements: CanvasElement[]; mergedItems: RawTextItem[] }> {
  const textContent = await page.getTextContent();
  const rawItems: RawTextItem[] = [];

  // First pass: collect all raw text items with their content
  for (const item of textContent.items) {
    if (!isTextItem(item)) continue;
    const text = item.str.trim();
    if (!text) continue;

    const transform = item.transform;
    const fontSize = Math.round(Math.abs(transform[3]) * DPI_SCALE);
    const { x, y } = convertPdfToCanvasCoords(transform[4], transform[5], pageHeightPt, fontSize);

    if (x < 0 || y < 0) continue;

    const width = estimateTextWidth(text, fontSize);
    const height = Math.max(fontSize * 1.4, 20);

    rawItems.push({
      content: text, // Preserve actual text content for merging
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      fontSize,
      fontFamily: mapToWebFont(item.fontName),
      fontWeight: extractFontWeight(item.fontName),
    });
  }

  // Second pass: merge fragmented text items into lines/paragraphs
  const mergedItems = mergeFragmentedText(rawItems);

  console.log(`PDF Importer: Merged ${rawItems.length} raw text items into ${mergedItems.length} text blocks`);

  // Convert to CanvasElements with PLACEHOLDER text (for layout template mode)
  const elements: CanvasElement[] = [];
  let zIndex = 50; // Text goes on top of images/tables (which are at ~10)

  for (const item of mergedItems) {
    // Recalculate width based on merged content length
    const calculatedWidth = estimateTextWidth(item.content, item.fontSize);
    const finalWidth = Math.max(item.width, calculatedWidth);

    elements.push({
      id: nanoid(),
      type: "text",
      content: PLACEHOLDER_TEXT, // Use placeholder instead of actual content
      position: { x: item.x, y: item.y },
      dimension: { width: finalWidth, height: item.height },
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

  return { elements, mergedItems };
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
    console.log(`PDF Importer: AI detected ${layout.images?.length || 0} images, ${layout.tables?.length || 0} tables`);

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

    // 5. Extract and Merge Text Elements (with text merging algorithm)
    const { elements: textElements } = await extractTextElements(page, pageHeightPt);

    // 6. Filter out text elements whose CENTER POINT falls inside table bounding boxes
    //    This prevents loose text from floating on top of table elements
    const filteredTextElements = textElements.filter((textEl) => {
      const centerInsideTable = isTextCenterInsideTable(
        textEl.position.x,
        textEl.position.y,
        textEl.dimension.width,
        textEl.dimension.height,
        tableBoundingBoxes
      );
      return !centerInsideTable;
    });

    const removedCount = textElements.length - filteredTextElements.length;
    if (removedCount > 0) {
      console.log(`PDF Importer: Filtered ${removedCount} text elements inside tables`);
    }

    await pdfDoc.destroy();

    // 7. Combine all elements - NO BACKGROUND ELEMENT
    //    The backgroundDataUrl is NOT added to the canvas elements.
    //    zIndex ordering: Tables & Images at 10+, Text at 50+
    const allElements: CanvasElement[] = [
      ...tableElements,
      ...imageElements,
      ...filteredTextElements,
    ];

    console.log(`PDF Importer: Created layout template with ${allElements.length} elements (${tableElements.length} tables, ${imageElements.length} images, ${filteredTextElements.length} text blocks)`);

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
