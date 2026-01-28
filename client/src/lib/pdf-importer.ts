/**
 * Pixel-Perfect PDF Layout Template Generator (Hybrid Intersection Engine v2)
 *
 * This module achieves PIXEL-PERFECT PDF import through a hybrid approach:
 *
 * STRATEGY:
 * - IMAGES: Native extraction from PDF operator list (bypasses AI completely)
 * - TEXT: Hybrid - AI detects regions, raw PDF.js items provide exact coordinates
 * - TABLES: AI detection (complex structures benefit from vision)
 *
 * Workflow:
 * 1. PHASE A: Extract raw metadata from PDF.js:
 *    - Text items with exact positions, font sizes, and font weights
 *    - Images via operator list with CTM (Current Transformation Matrix) tracking
 *    This ensures 3 images in PDF = 3 separate elements (no AI merging)
 *
 * 2. PHASE B: Send rendered page image to AI for semantic region detection.
 *    AI detects text regions and tables. AI's image detection is IGNORED.
 *
 * 3. PHASE C: INTERSECTION ENGINE with VARIANCE SPLITTING:
 *    For each AI text region:
 *    - Find all raw items with 50%+ overlap
 *    - CHECK VARIANCE: If font sizes differ by >20%, SPLIT into sub-groups
 *    - Use MODE font size (most frequent), not average, to prevent artifact skew
 *    - Use refined bounds from raw items EXCLUSIVELY (never AI padding)
 *    - Fallback to AI coordinates ONLY if zero raw items found
 *
 * 4. PHASE D: Cleanup.
 *
 * RESULT:
 * - 3 distinct images in PDF → 3 separate image elements
 * - Header + body in same region → Split into 2 text elements with correct sizes
 * - Font sizes match source exactly (no averaging artifacts)
 * - Bounding boxes are pixel-perfect (no AI whitespace padding)
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
// NATIVE IMAGE EXTRACTION (Pixel-Perfect Images)
// ============================================================================

/**
 * Represents a native image extracted from PDF operators with exact positioning.
 */
interface NativeImage {
  x: number;        // Canvas pixel X position (left edge)
  y: number;        // Canvas pixel Y position (top edge)
  width: number;    // Width in canvas pixels
  height: number;   // Height in canvas pixels
  objectId: string; // PDF object identifier for the image
}

/**
 * Multiply two 3x3 transformation matrices represented as [a, b, c, d, e, f]
 * where the matrix is:
 * | a  b  0 |
 * | c  d  0 |
 * | e  f  1 |
 */
function multiplyMatrices(
  m1: [number, number, number, number, number, number],
  m2: [number, number, number, number, number, number]
): [number, number, number, number, number, number] {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + b1 * c2,
    a1 * b2 + b1 * d2,
    c1 * a2 + d1 * c2,
    c1 * b2 + d1 * d2,
    e1 * a2 + f1 * c2 + e2,
    e1 * b2 + f1 * d2 + f2,
  ];
}

/**
 * Extract images natively from the PDF using operator list.
 * This bypasses AI vision entirely for image detection, providing pixel-perfect coordinates.
 *
 * Tracks the Current Transformation Matrix (CTM) through save/restore operations
 * to calculate exact image positions on the canvas.
 */
async function extractNativeImages(
  page: pdfjsLib.PDFPageProxy,
  pageHeightPt: number
): Promise<NativeImage[]> {
  const operatorList = await page.getOperatorList();
  const { OPS } = pdfjsLib;
  const images: NativeImage[] = [];

  // Identity matrix: [scaleX, skewX, skewY, scaleY, translateX, translateY]
  const identityMatrix: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];

  // CTM stack for save/restore operations
  let ctm: [number, number, number, number, number, number] = [...identityMatrix];
  const ctmStack: [number, number, number, number, number, number][] = [];

  // Iterate through all PDF operators
  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const op = operatorList.fnArray[i];
    const args = operatorList.argsArray[i];

    switch (op) {
      case OPS.save:
        // Push current CTM onto stack
        ctmStack.push([...ctm]);
        break;

      case OPS.restore:
        // Pop CTM from stack
        if (ctmStack.length > 0) {
          ctm = ctmStack.pop()!;
        }
        break;

      case OPS.transform:
        // Apply transformation to current CTM
        if (args && args.length >= 6) {
          const transformMatrix: [number, number, number, number, number, number] = [
            args[0], args[1], args[2], args[3], args[4], args[5]
          ];
          ctm = multiplyMatrices(ctm, transformMatrix);
        }
        break;

      case OPS.paintImageXObject:
      case OPS.paintJpegXObject:
      case OPS.paintImageXObjectRepeat:
        // Image painting operation - extract coordinates from CTM
        if (args && args.length >= 1) {
          const objectId = args[0] as string;

          // The CTM contains the image transformation:
          // - ctm[0] = scaleX (width in PDF points)
          // - ctm[3] = scaleY (height in PDF points, may be negative for flipped images)
          // - ctm[4] = translateX (X position in PDF points)
          // - ctm[5] = translateY (Y position in PDF points, from bottom)

          // Extract image dimensions from CTM
          const pdfWidth = Math.abs(ctm[0]);
          const pdfHeight = Math.abs(ctm[3]);
          const pdfX = ctm[4];
          // PDF Y is from bottom; if image is flipped (negative scaleY), adjust origin
          const pdfY = ctm[3] < 0 ? ctm[5] - pdfHeight : ctm[5];

          // Convert PDF coordinates to canvas coordinates
          const canvasX = pdfX * DPI_SCALE;
          const canvasY = (pageHeightPt - pdfY - pdfHeight) * DPI_SCALE;
          const canvasWidth = pdfWidth * DPI_SCALE;
          const canvasHeight = pdfHeight * DPI_SCALE;

          // Only add images with reasonable dimensions (filter out tiny artifacts)
          if (canvasWidth > 5 && canvasHeight > 5) {
            images.push({
              x: canvasX,
              y: canvasY,
              width: canvasWidth,
              height: canvasHeight,
              objectId,
            });
          }
        }
        break;
    }
  }

  console.log(`PDF Importer: Extracted ${images.length} native images from operator list`);
  return images;
}

/**
 * Create CanvasElement objects from natively extracted images.
 * Uses exact PDF coordinates instead of AI vision, ensuring each distinct
 * image in the PDF becomes a separate element.
 */
function processNativeImages(
  nativeImages: NativeImage[],
  pageIndex: number
): CanvasElement[] {
  const elements: CanvasElement[] = [];
  let zIndex = 10;

  for (const img of nativeImages) {
    const aspectRatio = img.width / img.height;

    elements.push({
      id: nanoid(),
      type: "image",
      imageSrc: undefined, // Placeholder - shows empty image block in UI
      position: { x: Math.round(img.x), y: Math.round(img.y) },
      dimension: { width: Math.round(img.width), height: Math.round(img.height) },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: zIndex++,
      pageIndex,
      aspectRatioLocked: true,
      aspectRatio: aspectRatio,
    });
  }

  return elements;
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
 * Uses pixel-perfect bounds from the raw items exclusively.
 */
function createTextElementFromGroup(
  items: RawItem[],
  regionType: "heading" | "paragraph" | "list",
  pageIndex: number,
  zIndex: number
): CanvasElement {
  const bounds = refineBounds(items)!;

  const finalX = bounds.minX;
  const finalY = bounds.minY;
  const finalWidth = bounds.maxX - bounds.minX;
  const finalHeight = bounds.maxY - bounds.minY;

  // Use MODE font size (most frequent) to prevent artifacts from skewing the size
  let fontSize = calculateModeFontSize(items);
  let fontWeight = detectFontWeight(items);
  const alignment = detectAlignment(items, finalWidth);

  // Determine placeholder based on region type
  let placeholder = "Lorem ipsum text block...";

  if (regionType === "heading") {
    // Headings should be at least 18px and bold
    fontSize = Math.max(fontSize, 18);
    fontWeight = Math.max(fontWeight, 700);
    placeholder = "Heading Text";
  } else if (regionType === "list") {
    placeholder = "• List item 1\n• List item 2\n• List item 3";
  }

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
 * 2. Variance Check: If font sizes vary significantly, split into sub-groups
 * 3. For each group:
 *    - Refine Bounds: Use min/max of raw items for pixel-perfect sizing (NEVER fallback to AI box)
 *    - Detect Style: Use MODE font size (not average) to prevent artifact skew
 *    - Create Element: Use refined bounds exclusively
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
      elements.push({
        id: nanoid(),
        type: "text",
        content: region.type === "heading" ? "Heading Text" :
                 region.type === "list" ? "• List item 1\n• List item 2\n• List item 3" :
                 "Lorem ipsum text block...",
        position: { x: Math.round(aiBox.x), y: Math.round(aiBox.y) },
        dimension: { width: Math.round(aiBox.width), height: Math.round(aiBox.height) },
        rotation: 0,
        locked: false,
        visible: true,
        zIndex: zIndex++,
        pageIndex,
        aspectRatioLocked: false,
        textStyle: {
          fontFamily: "Inter",
          fontSize: region.type === "heading" ? 24 : DEFAULT_FONT_SIZE,
          fontWeight: region.type === "heading" ? 700 : DEFAULT_FONT_WEIGHT,
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
      // SPLIT: Group items by style and Y-position to create separate elements
      const styleGroups = groupItemsByStyleAndPosition(matchingItems);

      console.log(`PDF Importer: Splitting region into ${styleGroups.length} sub-groups due to font variance`);

      for (const group of styleGroups) {
        if (group.length === 0) continue;

        // Determine the appropriate type for this sub-group
        const groupFontSize = calculateModeFontSize(group);
        const isLikelyHeading = groupFontSize >= 18 || detectFontWeight(group) >= 600;
        const subType = isLikelyHeading ? "heading" : region.type;

        elements.push(createTextElementFromGroup(group, subType, pageIndex, zIndex++));
      }
    } else {
      // NO SPLIT: All items have consistent font size, create single element
      elements.push(createTextElementFromGroup(matchingItems, region.type, pageIndex, zIndex++));
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
    // PHASE A: Extract Raw Metadata (Text AND Images)
    // =========================================================================
    console.log(`PDF Importer: PHASE A - Extracting raw layout...`);

    // Extract raw text items with pixel-perfect coordinates
    const rawItems = await extractRawLayout(page, pageHeightPt);
    console.log(`PDF Importer: Extracted ${rawItems.length} raw text items`);

    // Extract native images with pixel-perfect coordinates from PDF operators
    // This replaces AI vision for images, ensuring each distinct image stays separate
    const nativeImages = await extractNativeImages(page, pageHeightPt);
    console.log(`PDF Importer: Extracted ${nativeImages.length} native images from PDF stream`);

    // =========================================================================
    // PHASE B: Render page and send to AI (for text regions and tables only)
    // =========================================================================
    console.log(`PDF Importer: PHASE B - Rendering page for AI analysis...`);
    const backgroundDataUrl = await renderPageToImage(page, options);

    // Send to AI for semantic analysis (text regions and tables)
    // NOTE: AI layout.images is now IGNORED - we use native extraction instead
    const layout = await analyzeLayoutWithAI(backgroundDataUrl, pageIndex);

    // =========================================================================
    // PHASE C: Run Intersection Engine
    // =========================================================================
    console.log(`PDF Importer: PHASE C - Running intersection engine...`);

    // Process images using NATIVE EXTRACTION (pixel-perfect, no AI merging)
    // This ensures 3 distinct images in PDF = 3 separate elements on canvas
    const imageElements = processNativeImages(nativeImages, pageIndex);

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

    console.log(`PDF Importer: Created ${tableElements.length} tables, ${imageElements.length} images (native), ${textElements.length} text regions`);

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
