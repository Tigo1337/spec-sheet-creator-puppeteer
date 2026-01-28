/**
 * AI-Assisted PDF Layout Template Generator (Hybrid Intersection Engine)
 *
 * Workflow:
 * 1. PHASE A: Extract raw metadata from PDF.js with perfect coordinates.
 * 2. PHASE B: Send rendered page image to AI for semantic region detection.
 * 3. PHASE C: INTERSECTION ENGINE - For each AI region, intersect with raw items to:
 *    - Refine bounds using min/max of matched raw items (pixel-perfect sizing)
 *    - Calculate average font size from matched items
 *    - Detect text alignment from line start positions
 * 4. PHASE D: Cleanup - Fallback to AI coordinates if no intersecting items found.
 *
 * The AI gives us good "regions" but bad "coordinates."
 * The PDF gives us bad "regions" (fragmented lines) but perfect "coordinates."
 * This hybrid approach combines the best of both.
 *
 * NOTE: No backgroundElement is ever created. The rendered image is only used
 * for AI analysis and then discarded.
 */

import * as pdfjsLib from "pdfjs-dist";
import type { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";
import { nanoid } from "nanoid";
import type { CanvasElement } from "@shared/schema";

// --- CONFIGURATION ---
const PDFJS_VERSION = pdfjsLib.version || "5.4.449";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

const PDF_DPI = 72;
const CANVAS_DPI = 96;
const DPI_SCALE = CANVAS_DPI / PDF_DPI; // ~1.333

const RENDER_SCALE = 2; // Render at 2x for high quality AI analysis

// Default values for text elements
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_FONT_WEIGHT = 400;
const DEFAULT_LINE_HEIGHT = 1.4;
const CHAR_WIDTH_RATIO = 0.55;

// Intersection matching threshold (50% overlap required)
const INTERSECTION_THRESHOLD = 0.5;

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

// --- RAW ITEM INTERFACE (Phase A Output) ---

/**
 * Represents a single text snippet extracted from PDF.js with accurate positioning.
 * This is the "truth" for coordinates and font info.
 */
interface RawItem {
  x: number;       // Canvas pixel X position (left edge)
  y: number;       // Canvas pixel Y position (top edge)
  width: number;   // Width in canvas pixels
  height: number;  // Height in canvas pixels
  text: string;    // The actual text content
  fontSize: number; // Font size in canvas pixels
  fontFamily: string; // Original PDF font name
}

// --- HELPER FUNCTIONS ---

/**
 * Type guard to check if a text content item is a TextItem.
 */
function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return "str" in item && typeof item.str === "string";
}

/**
 * Extract font weight from PDF font name.
 */
function extractFontWeight(fontName: string): number {
  const lowerFont = fontName.toLowerCase();
  if (
    lowerFont.includes("bold") ||
    lowerFont.includes("heavy") ||
    lowerFont.includes("black") ||
    lowerFont.includes("-b") ||
    lowerFont.endsWith("bd")
  ) {
    return 700;
  }
  if (lowerFont.includes("semibold") || lowerFont.includes("demibold")) {
    return 600;
  }
  if (lowerFont.includes("medium")) {
    return 500;
  }
  if (lowerFont.includes("light") || lowerFont.includes("thin")) {
    return 300;
  }
  return 400;
}

/**
 * Convert PDF coordinates to canvas pixel coordinates.
 * PDF uses bottom-left origin, canvas uses top-left origin.
 */
function convertPdfToCanvasCoords(
  pdfX: number,
  pdfY: number,
  pageHeightPt: number
): { x: number; y: number } {
  const canvasX = pdfX * DPI_SCALE;
  const canvasY = (pageHeightPt - pdfY) * DPI_SCALE;
  return { x: canvasX, y: canvasY };
}

/**
 * Estimate text width based on character count and font size.
 */
function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_WIDTH_RATIO;
}

// ============================================================================
// PHASE A: EXTRACT RAW METADATA
// ============================================================================

/**
 * Extract raw layout data from a PDF page.
 * Returns an array of RawItem with exact bounding boxes.
 * These items are kept in memory for intersection matching.
 */
async function extractRawLayout(
  page: pdfjsLib.PDFPageProxy,
  pageHeightPt: number
): Promise<RawItem[]> {
  const textContent = await page.getTextContent();
  const rawItems: RawItem[] = [];

  for (const item of textContent.items) {
    if (!isTextItem(item)) continue;
    if (!item.str || item.str.trim() === "") continue;

    // Get transform matrix: [scaleX, skewX, skewY, scaleY, translateX, translateY]
    const transform = item.transform;
    const pdfX = transform[4];
    const pdfY = transform[5];

    // Font size from transform matrix
    const pdfFontSize = Math.abs(transform[3]) || Math.abs(transform[0]) || 12;
    const canvasFontSize = pdfFontSize * DPI_SCALE;

    // Convert PDF coords to canvas coords
    const { x, y } = convertPdfToCanvasCoords(pdfX, pdfY, pageHeightPt);

    // Calculate dimensions
    const width = item.width ? item.width * DPI_SCALE : estimateTextWidth(item.str, canvasFontSize);
    const height = item.height ? item.height * DPI_SCALE : canvasFontSize;

    rawItems.push({
      x,
      y: y - height, // Adjust Y to top of text box (PDF Y is baseline)
      width,
      height,
      text: item.str,
      fontSize: canvasFontSize,
      fontFamily: item.fontName || "",
    });
  }

  return rawItems;
}

// ============================================================================
// PHASE B: AI ANALYSIS (Render + Send to AI)
// ============================================================================

/**
 * Render a PDF page to a high-quality image for AI analysis.
 */
async function renderPageToImage(
  page: pdfjsLib.PDFPageProxy,
  options: PdfImportOptions
): Promise<string> {
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

// ============================================================================
// PHASE C: THE INTERSECTION ENGINE (The Fix)
// ============================================================================

/**
 * Calculate the overlap ratio between a raw item and an AI box.
 * Returns a value between 0 and 1 representing how much of the raw item
 * is inside the AI box.
 */
function calculateOverlapRatio(
  item: RawItem,
  box: { x: number; y: number; width: number; height: number }
): number {
  // Calculate intersection rectangle
  const intersectLeft = Math.max(item.x, box.x);
  const intersectTop = Math.max(item.y, box.y);
  const intersectRight = Math.min(item.x + item.width, box.x + box.width);
  const intersectBottom = Math.min(item.y + item.height, box.y + box.height);

  // Check if there's any intersection
  if (intersectRight <= intersectLeft || intersectBottom <= intersectTop) {
    return 0;
  }

  // Calculate intersection area
  const intersectArea = (intersectRight - intersectLeft) * (intersectBottom - intersectTop);
  const itemArea = item.width * item.height;

  if (itemArea === 0) return 0;

  return intersectArea / itemArea;
}

/**
 * Find all RawItems that intersect with an AI bounding box.
 * Requires at least INTERSECTION_THRESHOLD (50%) overlap.
 */
function findIntersectingItems(
  rawItems: RawItem[],
  aiBox: { x: number; y: number; width: number; height: number }
): RawItem[] {
  return rawItems.filter((item) => {
    const overlap = calculateOverlapRatio(item, aiBox);
    return overlap >= INTERSECTION_THRESHOLD;
  });
}

/**
 * Refine the bounding box using the exact coordinates from matched raw items.
 * Returns pixel-perfect bounds based on actual text positions.
 */
function refineBounds(
  matchingItems: RawItem[]
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (matchingItems.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of matchingItems) {
    minX = Math.min(minX, item.x);
    minY = Math.min(minY, item.y);
    maxX = Math.max(maxX, item.x + item.width);
    maxY = Math.max(maxY, item.y + item.height);
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Calculate the average font size from matched raw items.
 */
function calculateAvgFontSize(matchingItems: RawItem[]): number {
  if (matchingItems.length === 0) return DEFAULT_FONT_SIZE;

  const total = matchingItems.reduce((sum, item) => sum + item.fontSize, 0);
  return Math.round(total / matchingItems.length);
}

/**
 * Detect the dominant font weight from matched raw items.
 */
function detectFontWeight(matchingItems: RawItem[]): number {
  if (matchingItems.length === 0) return DEFAULT_FONT_WEIGHT;

  // Count occurrences of each font weight
  const weightCounts = new Map<number, number>();
  for (const item of matchingItems) {
    const weight = extractFontWeight(item.fontFamily);
    weightCounts.set(weight, (weightCounts.get(weight) || 0) + 1);
  }

  // Find the most common weight
  let maxCount = 0;
  let dominantWeight = DEFAULT_FONT_WEIGHT;
  for (const [weight, count] of weightCounts) {
    if (count > maxCount) {
      maxCount = count;
      dominantWeight = weight;
    }
  }

  return dominantWeight;
}

/**
 * Detect text alignment by analyzing the horizontal positions of matched items.
 *
 * - Left aligned: minX values of lines are similar (within tolerance)
 * - Center aligned: center points of lines are similar
 * - Right aligned: maxX values of lines are similar
 */
function detectAlignment(
  matchingItems: RawItem[],
  regionWidth: number
): "left" | "center" | "right" {
  if (matchingItems.length < 2) return "left";

  // Group items into lines by Y position (items within 5px are same line)
  const lineGroups: RawItem[][] = [];
  const sortedByY = [...matchingItems].sort((a, b) => a.y - b.y);

  let currentLine: RawItem[] = [sortedByY[0]];
  for (let i = 1; i < sortedByY.length; i++) {
    const item = sortedByY[i];
    const prevItem = currentLine[currentLine.length - 1];

    if (Math.abs(item.y - prevItem.y) < 5) {
      currentLine.push(item);
    } else {
      lineGroups.push(currentLine);
      currentLine = [item];
    }
  }
  lineGroups.push(currentLine);

  if (lineGroups.length < 2) return "left";

  // Calculate line start positions (minX of each line)
  const lineStarts = lineGroups.map((line) => Math.min(...line.map((item) => item.x)));

  // Calculate line centers
  const lineCenters = lineGroups.map((line) => {
    const minX = Math.min(...line.map((item) => item.x));
    const maxX = Math.max(...line.map((item) => item.x + item.width));
    return (minX + maxX) / 2;
  });

  // Calculate line ends (maxX of each line)
  const lineEnds = lineGroups.map((line) => Math.max(...line.map((item) => item.x + item.width)));

  // Calculate variance for each alignment type
  const tolerance = regionWidth * 0.1; // 10% of region width

  const startVariance = Math.max(...lineStarts) - Math.min(...lineStarts);
  const centerVariance = Math.max(...lineCenters) - Math.min(...lineCenters);
  const endVariance = Math.max(...lineEnds) - Math.min(...lineEnds);

  // Determine alignment based on which has lowest variance
  if (startVariance <= tolerance && startVariance <= centerVariance && startVariance <= endVariance) {
    return "left";
  }
  if (centerVariance <= tolerance && centerVariance <= startVariance && centerVariance <= endVariance) {
    return "center";
  }
  if (endVariance <= tolerance) {
    return "right";
  }

  return "left"; // Default fallback
}

// ============================================================================
// ELEMENT PROCESSORS
// ============================================================================

/**
 * Process AI-detected images and create placeholder image elements.
 * Uses AI coordinates directly (no raw text intersection for images).
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
 * Process AI-detected tables and create table elements.
 */
function processAITables(
  tables: Array<{ box_2d: [number, number, number, number]; cols?: number; rows?: number }>,
  canvasWidth: number,
  canvasHeight: number
): CanvasElement[] {
  const elements: CanvasElement[] = [];
  let zIndex = 10;

  for (const tableData of tables) {
    const [ymin, xmin, ymax, xmax] = tableData.box_2d;

    const x = (xmin / 1000) * canvasWidth;
    const y = (ymin / 1000) * canvasHeight;
    const w = ((xmax - xmin) / 1000) * canvasWidth;
    const h = ((ymax - ymin) / 1000) * canvasHeight;

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
          header: `Column ${i + 1}`,
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

  return elements;
}

/**
 * Process AI-detected text regions using the HYBRID INTERSECTION ENGINE.
 *
 * For each AI region:
 * 1. Query: Find all RawItems that intersect with the AI's box_2d (50% overlap)
 * 2. Refine Bounds: Use min/max of matched raw items for pixel-perfect sizing
 * 3. Detect Style: Average font size, alignment from matched items
 * 4. Create Element: Use refined bounds for position/size
 * 5. Fallback: If no intersecting items, use AI coordinates
 */
function processTextRegionsWithIntersection(
  textRegions: Array<{ box_2d: [number, number, number, number]; type: "heading" | "paragraph" | "list"; content?: string }>,
  rawItems: RawItem[],
  canvasWidth: number,
  canvasHeight: number
): CanvasElement[] {
  const elements: CanvasElement[] = [];
  let zIndex = 50;

  for (const region of textRegions) {
    const [ymin, xmin, ymax, xmax] = region.box_2d;

    // Convert AI's 0-1000 coordinates to canvas pixels
    const aiBox = {
      x: (xmin / 1000) * canvasWidth,
      y: (ymin / 1000) * canvasHeight,
      width: ((xmax - xmin) / 1000) * canvasWidth,
      height: ((ymax - ymin) / 1000) * canvasHeight,
    };

    // --- STEP 1: Find Intersecting Raw Items (50% overlap required) ---
    const matchingItems = findIntersectingItems(rawItems, aiBox);

    // --- STEP 2: Determine Final Position and Size ---
    let finalX: number;
    let finalY: number;
    let finalWidth: number;
    let finalHeight: number;

    const refinedBounds = refineBounds(matchingItems);

    if (refinedBounds) {
      // Use refined bounds from raw items (pixel-perfect!)
      finalX = refinedBounds.minX;
      finalY = refinedBounds.minY;
      finalWidth = refinedBounds.maxX - refinedBounds.minX;
      finalHeight = refinedBounds.maxY - refinedBounds.minY;
    } else {
      // PHASE D: Fallback to AI coordinates if no intersecting items
      finalX = aiBox.x;
      finalY = aiBox.y;
      finalWidth = aiBox.width;
      finalHeight = aiBox.height;
    }

    // --- STEP 3: Detect Style from Matched Items ---
    let avgFontSize = calculateAvgFontSize(matchingItems);
    let fontWeight = detectFontWeight(matchingItems);
    const alignment = detectAlignment(matchingItems, finalWidth);

    // --- STEP 4: Apply Type-Based Adjustments ---
    let placeholder = "Lorem ipsum text block...";

    if (region.type === "heading") {
      // Headings should be at least 18px and bold
      avgFontSize = Math.max(avgFontSize, 18);
      fontWeight = Math.max(fontWeight, 700);
      placeholder = "Heading Text";
    } else if (region.type === "list") {
      placeholder = "• List item 1\n• List item 2\n• List item 3";
    }

    // --- STEP 5: Create the Element ---
    elements.push({
      id: nanoid(),
      type: "text",
      content: placeholder,
      position: { x: Math.round(finalX), y: Math.round(finalY) },
      dimension: { width: Math.round(finalWidth), height: Math.round(finalHeight) },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: zIndex++,
      pageIndex: 0,
      aspectRatioLocked: false,
      textStyle: {
        fontFamily: "Inter",
        fontSize: avgFontSize,
        fontWeight: fontWeight,
        color: "#000000",
        textAlign: alignment,
        verticalAlign: "top",
        lineHeight: DEFAULT_LINE_HEIGHT,
        letterSpacing: 0,
      },
    });
  }

  return elements;
}

// ============================================================================
// MAIN IMPORT FUNCTION
// ============================================================================

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

    // =========================================================================
    // PHASE A: Extract Raw Metadata (No elements created yet)
    // =========================================================================
    console.log("PDF Importer: PHASE A - Extracting raw layout from PDF...");
    const rawItems = await extractRawLayout(page, pageHeightPt);
    console.log(`PDF Importer: Extracted ${rawItems.length} raw text items with exact coordinates`);

    // =========================================================================
    // PHASE B: AI Analysis
    // =========================================================================
    console.log("PDF Importer: PHASE B - Rendering page for AI analysis...");
    const backgroundDataUrl = await renderPageToImage(page, options);

    console.log("PDF Importer: Sending image to AI for semantic region detection...");
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

    // =========================================================================
    // PHASE C: The Intersection Engine (The Fix)
    // =========================================================================
    console.log("PDF Importer: PHASE C - Running intersection engine...");

    // Process images (use AI coordinates directly)
    const imageElements = processAIImages(
      layout.images || [],
      canvasWidth,
      canvasHeight
    );

    // Process tables (use AI coordinates directly)
    const tableElements = processAITables(
      layout.tables || [],
      canvasWidth,
      canvasHeight
    );

    // Process text regions with HYBRID INTERSECTION ENGINE
    const textElements = processTextRegionsWithIntersection(
      layout.text_regions || [],
      rawItems,
      canvasWidth,
      canvasHeight
    );

    // =========================================================================
    // PHASE D: Cleanup
    // =========================================================================
    // - Fallback to AI coordinates is handled inside processTextRegionsWithIntersection
    // - No backgroundElement is created (backgroundDataUrl is for reference only)

    await pdfDoc.destroy();

    // Combine all elements (NO background element)
    const allElements: CanvasElement[] = [
      ...tableElements,
      ...imageElements,
      ...textElements,
    ];

    console.log(`PDF Importer: Created layout template with ${allElements.length} elements`);
    console.log(`  - ${tableElements.length} tables`);
    console.log(`  - ${imageElements.length} images`);
    console.log(`  - ${textElements.length} text regions (intersection-refined)`);

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
