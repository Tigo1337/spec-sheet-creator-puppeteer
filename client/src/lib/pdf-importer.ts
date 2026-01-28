/**
 * Pixel-Perfect PDF Layout Template Generator (Hybrid Intersection Engine v3)
 *
 * This module achieves PIXEL-PERFECT PDF import through a hybrid approach:
 *
 * STRATEGY:
 * - IMAGES: AI vision with strict separation prompting (each distinct image = separate element)
 * - TEXT: Hybrid - AI detects regions, raw PDF.js items provide exact coordinates
 * - TABLES: AI detection (complex structures benefit from vision)
 *
 * Workflow:
 * 1. PHASE A: Extract raw text metadata from PDF.js:
 *    - Text items with exact positions, font sizes, and font weights
 *
 * 2. PHASE B: Send rendered page image to AI for semantic region detection.
 *    - AI detects images with STRICT SEPARATION (whitespace = separate boxes)
 *    - AI detects text regions and tables
 *
 * 3. PHASE C: INTERSECTION ENGINE with VARIANCE SPLITTING:
 *    For each AI text region:
 *    - Find all raw items with 50%+ overlap
 *    - CHECK VARIANCE: If font sizes differ by >20%, SPLIT into sub-groups
 *    - Group items by Y-position (lines) and create separate elements for each font-size group
 *    - Use MODE font size (most frequent), not average, to prevent artifact skew
 *    - Use refined bounds from raw items with HEIGHT BUFFER to prevent clipping
 *    - Fallback to AI coordinates ONLY if zero raw items found
 *    - ALL text elements use type "text" (no heading distinction)
 *
 * 4. PHASE D: Cleanup.
 *
 * RESULT:
 * - AI detects images with strict whitespace separation
 * - Header + body in same region → Split into 2 text elements with correct sizes
 * - Font sizes match source exactly (using MODE, no averaging artifacts)
 * - Bounding boxes include height buffer to prevent text clipping
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

const RENDER_SCALE = 3; // Render at 3x for high quality AI analysis (better gap detection)

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
  backgroundDataUrl: string; // Provided for reference only, NOT added to canvas (first page preview)
  totalPages: number;
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
 * Calculate the MODE (most frequent) font size from matched raw items.
 * Falls back to MAX font size if no clear mode exists.
 * This prevents small artifacts from shrinking the main text.
 */
function calculateModeFontSize(matchingItems: RawItem[]): number {
  if (matchingItems.length === 0) return DEFAULT_FONT_SIZE;

  // Round font sizes to nearest integer for grouping
  const fontSizeCounts = new Map<number, number>();
  let maxFontSize = 0;

  for (const item of matchingItems) {
    const roundedSize = Math.round(item.fontSize);
    fontSizeCounts.set(roundedSize, (fontSizeCounts.get(roundedSize) || 0) + 1);
    maxFontSize = Math.max(maxFontSize, item.fontSize);
  }

  // Find the mode (most frequent font size)
  let modeSize = DEFAULT_FONT_SIZE;
  let maxCount = 0;

  for (const [size, count] of fontSizeCounts) {
    if (count > maxCount) {
      maxCount = count;
      modeSize = size;
    }
  }

  // If mode doesn't cover at least 30% of items, use max font size instead
  // This handles cases where font sizes are evenly distributed
  if (maxCount < matchingItems.length * 0.3) {
    return Math.round(maxFontSize);
  }

  return modeSize;
}

/**
 * Check if there's high font size variance within matched items.
 * Returns true if distinct font size groups exist (e.g., headers + body text).
 *
 * Uses a >20% difference threshold: if any font size differs from another
 * by more than 20%, we should split the region into separate elements.
 */
function hasHighFontVariance(matchingItems: RawItem[]): boolean {
  if (matchingItems.length < 2) return false;

  // Round font sizes and collect unique sizes
  const uniqueSizes = new Set<number>();
  for (const item of matchingItems) {
    uniqueSizes.add(Math.round(item.fontSize));
  }

  if (uniqueSizes.size < 2) return false;

  const sizeArray = Array.from(uniqueSizes).sort((a, b) => a - b);
  const minSize = sizeArray[0];
  const maxSize = sizeArray[sizeArray.length - 1];

  // Check if max font size is more than 20% larger than min font size
  // This catches cases like Header (24px) + Body (12px) → 100% difference
  // or Header (18px) + Body (14px) → 28% difference
  const percentDifference = (maxSize - minSize) / minSize;

  return percentDifference > 0.2;
}

/**
 * Group raw items by Y-position and font size to create sub-groups.
 * Used when a region has high font variance to split headers from body text.
 *
 * Uses >20% font size difference as the threshold for splitting groups.
 * This ensures headers (24px) and body text (12px) become separate elements.
 */
function groupItemsByStyleAndPosition(
  matchingItems: RawItem[]
): RawItem[][] {
  if (matchingItems.length === 0) return [];

  // First, group by similar Y position (within 5px = same line)
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

  // Now group consecutive lines that have similar font sizes
  // Use >20% difference threshold for splitting (same as hasHighFontVariance)
  const styleGroups: RawItem[][] = [];
  let currentGroup: RawItem[] = [];
  let currentGroupFontSize = 0;

  for (const line of lineGroups) {
    // Calculate the dominant font size for this line (use mode/most common)
    const fontSizeCounts = new Map<number, number>();
    for (const item of line) {
      const roundedSize = Math.round(item.fontSize);
      fontSizeCounts.set(roundedSize, (fontSizeCounts.get(roundedSize) || 0) + 1);
    }
    let lineFontSize = Math.round(line[0].fontSize);
    let maxCount = 0;
    for (const [size, count] of fontSizeCounts) {
      if (count > maxCount) {
        maxCount = count;
        lineFontSize = size;
      }
    }

    if (currentGroup.length === 0) {
      // Start a new group
      currentGroup = [...line];
      currentGroupFontSize = lineFontSize;
    } else {
      // Check if font sizes differ by more than 20%
      const smallerSize = Math.min(lineFontSize, currentGroupFontSize);
      const largerSize = Math.max(lineFontSize, currentGroupFontSize);
      const percentDifference = (largerSize - smallerSize) / smallerSize;

      if (percentDifference <= 0.2) {
        // Same font size group (within 20% tolerance)
        currentGroup.push(...line);
      } else {
        // Different font size (>20% difference) - start a new group
        styleGroups.push(currentGroup);
        currentGroup = [...line];
        currentGroupFontSize = lineFontSize;
      }
    }
  }

  if (currentGroup.length > 0) {
    styleGroups.push(currentGroup);
  }

  return styleGroups;
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
  canvasHeight: number,
  pageIndex: number
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
      pageIndex,
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
  canvasHeight: number,
  pageIndex: number
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
      pageIndex,
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
 * Create a single text element from a group of raw items.
 * Uses pixel-perfect bounds from the raw items with a height buffer to prevent clipping.
 *
 * All elements are created with type "text" (no heading distinction).
 * Font size is the MODE (most frequent) from the group, not averaged.
 */
function createTextElementFromGroup(
  items: RawItem[],
  pageIndex: number,
  zIndex: number
): CanvasElement {
  const bounds = refineBounds(items)!;

  const finalX = bounds.minX;
  const finalY = bounds.minY;
  const finalWidth = bounds.maxX - bounds.minX;

  // Use MODE font size (most frequent) to prevent artifacts from skewing the size
  const fontSize = calculateModeFontSize(items);
  const fontWeight = detectFontWeight(items);
  const alignment = detectAlignment(items, finalWidth);

  // Add dynamic height buffer to prevent text clipping
  // Buffer is 50% of average font size to accommodate descenders and line spacing
  const avgFontSize = items.reduce((sum, item) => sum + item.fontSize, 0) / items.length;
  const heightBuffer = avgFontSize * 0.5;
  const finalHeight = (bounds.maxY - bounds.minY) + heightBuffer;

  // Generic placeholder for all text elements
  const placeholder = "Lorem ipsum text block...";

  return {
    id: nanoid(),
    type: "text",
    content: placeholder,
    position: { x: Math.round(finalX), y: Math.round(finalY) },
    dimension: { width: Math.round(finalWidth), height: Math.round(finalHeight) },
    rotation: 0,
    locked: false,
    visible: true,
    zIndex,
    pageIndex,
    aspectRatioLocked: false,
    textStyle: {
      fontFamily: "Inter",
      fontSize,
      fontWeight,
      color: "#000000",
      textAlign: alignment,
      verticalAlign: "top",
      lineHeight: DEFAULT_LINE_HEIGHT,
      letterSpacing: 0,
    },
  };
}

/**
 * Process AI-detected text regions using the HYBRID INTERSECTION ENGINE
 * with FONT SIZE VARIANCE SPLITTING.
 *
 * For each AI region:
 * 1. Query: Find all RawItems that intersect with the AI's box_2d (50% overlap)
 * 2. Variance Check: If font sizes vary significantly (>20%), SPLIT into sub-groups
 * 3. For each group:
 *    - Group items by Y-position (lines) to create separate elements for each font-size group
 *    - Refine Bounds: Use min/max of raw items with HEIGHT BUFFER to prevent clipping
 *    - Detect Style: Use MODE font size (most frequent), not average
 *    - Create Element: All elements use type "text" (no heading distinction)
 * 4. Fallback: Only use AI coordinates if zero intersecting items found
 */
function processTextRegionsWithIntersection(
  textRegions: Array<{ box_2d: [number, number, number, number]; type: "heading" | "paragraph" | "list"; content?: string }>,
  rawItems: RawItem[],
  canvasWidth: number,
  canvasHeight: number,
  pageIndex: number
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

    // --- STEP 2: Handle No Matches (Fallback to AI coordinates) ---
    if (matchingItems.length === 0) {
      // FALLBACK: No raw items found, use AI coordinates
      // This happens for text that PDF.js couldn't extract (e.g., rasterized text)
      // Add height buffer to AI box to prevent clipping
      const fallbackHeight = aiBox.height + (DEFAULT_FONT_SIZE * 0.5);

      elements.push({
        id: nanoid(),
        type: "text",
        content: "Lorem ipsum text block...",
        position: { x: Math.round(aiBox.x), y: Math.round(aiBox.y) },
        dimension: { width: Math.round(aiBox.width), height: Math.round(fallbackHeight) },
        rotation: 0,
        locked: false,
        visible: true,
        zIndex: zIndex++,
        pageIndex,
        aspectRatioLocked: false,
        textStyle: {
          fontFamily: "Inter",
          fontSize: DEFAULT_FONT_SIZE,
          fontWeight: DEFAULT_FONT_WEIGHT,
          color: "#000000",
          textAlign: "left",
          verticalAlign: "top",
          lineHeight: DEFAULT_LINE_HEIGHT,
          letterSpacing: 0,
        },
      });
      continue;
    }

    // --- STEP 3: Check for Font Size Variance ---
    if (hasHighFontVariance(matchingItems)) {
      // SPLIT: Group items by Y-position and font size to create separate elements
      // This handles cases like headers and body text grouped together by AI
      const styleGroups = groupItemsByStyleAndPosition(matchingItems);

      console.log(`PDF Importer: Splitting region into ${styleGroups.length} sub-groups due to font variance`);

      for (const group of styleGroups) {
        if (group.length === 0) continue;

        // Create text element for this font-size group (no heading distinction)
        elements.push(createTextElementFromGroup(group, pageIndex, zIndex++));
      }
    } else {
      // NO SPLIT: All items have consistent font size, create single element
      elements.push(createTextElementFromGroup(matchingItems, pageIndex, zIndex++));
    }
  }

  return elements;
}

// ============================================================================
// AI LAYOUT ANALYSIS HELPER
// ============================================================================

interface AILayoutResult {
  images: Array<{ box_2d: [number, number, number, number]; label?: string }>;
  tables: Array<{ box_2d: [number, number, number, number]; cols?: number; rows?: number }>;
  text_regions: Array<{ box_2d: [number, number, number, number]; type: "heading" | "paragraph" | "list"; content?: string }>;
}

/**
 * Send a rendered page image to the AI for semantic region detection.
 * Returns the parsed layout data.
 */
async function analyzeLayoutWithAI(
  imageDataUrl: string,
  pageIndex: number
): Promise<AILayoutResult> {
  console.log(`PDF Importer: [Page ${pageIndex + 1}] Sending image to AI for semantic region detection...`);

  const aiResponse = await fetch("/api/ai/analyze-layout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: imageDataUrl }),
  });

  if (!aiResponse.ok) {
    const errorBody = await aiResponse.text();
    throw new Error(`AI Analysis Failed for page ${pageIndex + 1} (${aiResponse.status}): ${errorBody}`);
  }

  const layout = await aiResponse.json();
  console.log(`PDF Importer: [Page ${pageIndex + 1}] AI detected ${layout.images?.length || 0} images, ${layout.tables?.length || 0} tables, ${layout.text_regions?.length || 0} text regions`);

  return {
    images: layout.images || [],
    tables: layout.tables || [],
    text_regions: layout.text_regions || [],
  };
}

// ============================================================================
// MAIN IMPORT FUNCTION (Single Page Only)
// ============================================================================

export async function importPdf(
  file: File,
  options: PdfImportOptions = {}
): Promise<PdfImportResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
      cMapPacked: true,
    });

    const pdfDoc = await loadingTask.promise;

    // =========================================================================
    // ENFORCE SINGLE PAGE LIMIT
    // =========================================================================
    if (pdfDoc.numPages > 1) {
      await pdfDoc.destroy();
      throw new Error("Only single-page PDFs are supported at this time. Please upload a one-page document.");
    }

    console.log(`PDF Importer: Processing single-page PDF...`);

    // Get the first (and only) page
    const pageNumber = 1;
    const pageIndex = 0;
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const pageWidthPt = viewport.width;
    const pageHeightPt = viewport.height;
    const canvasWidth = Math.round(pageWidthPt * DPI_SCALE);
    const canvasHeight = Math.round(pageHeightPt * DPI_SCALE);

    // =========================================================================
    // PHASE A: Extract Raw Text Metadata
    // =========================================================================
    console.log(`PDF Importer: PHASE A - Extracting raw text layout...`);

    // Extract raw text items with pixel-perfect coordinates
    const rawItems = await extractRawLayout(page, pageHeightPt);
    console.log(`PDF Importer: Extracted ${rawItems.length} raw text items`);

    // =========================================================================
    // PHASE B: Render page and send to AI (for images, text regions, and tables)
    // =========================================================================
    console.log(`PDF Importer: PHASE B - Rendering page for AI analysis...`);
    const backgroundDataUrl = await renderPageToImage(page, options);

    // Send to AI for semantic analysis (images, text regions, and tables)
    // AI uses strict separation prompting to ensure distinct images are not merged
    const layout = await analyzeLayoutWithAI(backgroundDataUrl, pageIndex);

    // =========================================================================
    // PHASE C: Run Intersection Engine
    // =========================================================================
    console.log(`PDF Importer: PHASE C - Running intersection engine...`);

    // Process images using AI detection with strict separation
    // AI is prompted to return separate bounding boxes for images with whitespace between them
    const imageElements = processAIImages(
      layout.images,
      canvasWidth,
      canvasHeight,
      pageIndex
    );

    // Process tables (use AI coordinates - tables are complex and benefit from AI detection)
    const tableElements = processAITables(
      layout.tables,
      canvasWidth,
      canvasHeight,
      pageIndex
    );

    // Process text regions with HYBRID INTERSECTION ENGINE
    // Uses AI for region detection but raw items for pixel-perfect bounds and font sizes
    const textElements = processTextRegionsWithIntersection(
      layout.text_regions,
      rawItems,
      canvasWidth,
      canvasHeight,
      pageIndex
    );

    // Combine all elements from page 1
    const elements = [...tableElements, ...imageElements, ...textElements];

    console.log(`PDF Importer: Created ${tableElements.length} tables, ${imageElements.length} images (AI), ${textElements.length} text regions`);

    // =========================================================================
    // PHASE D: Cleanup
    // =========================================================================
    await pdfDoc.destroy();

    console.log(`PDF Importer: ===== IMPORT COMPLETE =====`);
    console.log(`PDF Importer: Created layout template with ${elements.length} total elements`);

    return {
      elements,
      canvasWidth,
      canvasHeight,
      backgroundDataUrl,
      totalPages: 1,
    };

  } catch (error) {
    console.error("Critical PDF Import Failure:", error);
    throw error;
  }
}
