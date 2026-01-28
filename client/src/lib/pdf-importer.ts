/**
 * AI-Assisted PDF Layout Template Generator (Hybrid Mode)
 *
 * Workflow:
 * 1. Render PDF page to a high-quality "Master Image" (for AI analysis only).
 * 2. Extract RAW text items from PDF.js with accurate font sizes and positions.
 * 3. Send "Master Image" to Gemini AI to identify discrete elements:
 *    - Visual Images (logos, product photos, icons)
 *    - Data Tables (grids)
 *    - Text Regions (paragraphs, headings, lists) - grouped as unified bounding boxes
 * 4. HYBRID: For each AI text region, intersect with raw text items to derive:
 *    - Accurate font size (average/mode of matching items)
 *    - Font weight detection from PDF font names
 *    - Text alignment inference
 * 5. Calculate element height dynamically based on placeholder text length.
 *
 * NOTE: The backgroundDataUrl is NEVER added as a canvas element. It is only used
 * for AI analysis and then discarded. No background layer is created.
 */

import * as pdfjsLib from "pdfjs-dist";
import type { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";
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

// Default values for text elements
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_FONT_WEIGHT = 400;
const DEFAULT_LINE_HEIGHT = 1.4;
const CHAR_WIDTH_RATIO = 0.55; // Average character width ratio for Inter font

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

// --- RAW TEXT ITEM INTERFACE ---

/**
 * Represents a single text chunk extracted from PDF.js with accurate font info.
 * These are kept in memory and NOT added to the canvas directly.
 */
interface RawTextItem {
  text: string;
  x: number; // Canvas pixel X position
  y: number; // Canvas pixel Y position
  width: number; // Estimated width in canvas pixels
  height: number; // Font height in canvas pixels
  fontSize: number; // Font size in canvas pixels
  fontWeight: number; // 400 (normal) or 700 (bold)
  fontFamily: string; // Original PDF font name
}

// --- HELPER FUNCTIONS ---

/**
 * Type guard to check if a text content item is a TextItem (has 'str' property).
 */
function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return "str" in item && typeof item.str === "string";
}

/**
 * Extract font weight from PDF font name.
 * PDF fonts often include weight indicators in their names.
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
  // Flip Y axis and scale to canvas DPI
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

// --- RAW TEXT SCANNER ---

/**
 * Extract all text items from a PDF page with accurate font sizes and positions.
 * Returns RawTextItem[] which is kept in memory for intersection matching.
 * Does NOT add elements to the canvas.
 */
async function extractRawTextItems(
  page: pdfjsLib.PDFPageProxy,
  pageHeightPt: number
): Promise<RawTextItem[]> {
  const textContent = await page.getTextContent();
  const rawItems: RawTextItem[] = [];

  for (const item of textContent.items) {
    if (!isTextItem(item)) continue;
    if (!item.str || item.str.trim() === "") continue;

    // Get transform matrix: [scaleX, skewX, skewY, scaleY, translateX, translateY]
    const transform = item.transform;
    const pdfX = transform[4];
    const pdfY = transform[5];

    // Font size is typically in the scaleY component (index 3) or scaleX (index 0)
    // Use absolute value as it can be negative for certain text orientations
    const pdfFontSize = Math.abs(transform[3]) || Math.abs(transform[0]) || 12;
    const canvasFontSize = pdfFontSize * DPI_SCALE;

    // Convert coordinates
    const { x, y } = convertPdfToCanvasCoords(pdfX, pdfY, pageHeightPt);

    // Get font info
    const fontName = item.fontName || "";
    const fontWeight = extractFontWeight(fontName);

    // Calculate dimensions
    const width = item.width ? item.width * DPI_SCALE : estimateTextWidth(item.str, canvasFontSize);
    const height = item.height ? item.height * DPI_SCALE : canvasFontSize;

    rawItems.push({
      text: item.str,
      x,
      y: y - height, // Adjust Y to top of text box
      width,
      height,
      fontSize: canvasFontSize,
      fontWeight,
      fontFamily: fontName,
    });
  }

  return rawItems;
}

// --- REGION INTERSECTION LOGIC ---

/**
 * Find all raw text items that fall inside an AI-detected bounding box.
 * Uses center-point intersection for more accurate matching.
 */
function findIntersectingTextItems(
  rawItems: RawTextItem[],
  box: { x: number; y: number; width: number; height: number }
): RawTextItem[] {
  return rawItems.filter((item) => {
    // Calculate center point of the text item
    const itemCenterX = item.x + item.width / 2;
    const itemCenterY = item.y + item.height / 2;

    // Check if center is inside the box
    return (
      itemCenterX >= box.x &&
      itemCenterX <= box.x + box.width &&
      itemCenterY >= box.y &&
      itemCenterY <= box.y + box.height
    );
  });
}

/**
 * Calculate the mode (most common value) from an array of numbers.
 * Used for detecting the dominant font size in a region.
 */
function calculateMode(values: number[]): number | null {
  if (values.length === 0) return null;

  // Round to nearest integer for grouping similar sizes
  const counts = new Map<number, number>();
  for (const val of values) {
    const rounded = Math.round(val);
    counts.set(rounded, (counts.get(rounded) || 0) + 1);
  }

  let mode = values[0];
  let maxCount = 0;
  for (const [value, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      mode = value;
    }
  }

  return mode;
}

/**
 * Calculate average value from an array of numbers.
 */
function calculateAverage(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Derive font metrics from intersecting raw text items.
 * Returns the detected font size (mode or average) and dominant font weight.
 */
function deriveFontMetrics(
  matchingItems: RawTextItem[]
): { fontSize: number; fontWeight: number } {
  if (matchingItems.length === 0) {
    return { fontSize: DEFAULT_FONT_SIZE, fontWeight: DEFAULT_FONT_WEIGHT };
  }

  const fontSizes = matchingItems.map((item) => item.fontSize);
  const fontWeights = matchingItems.map((item) => item.fontWeight);

  // Use mode for font size (most common size in the region)
  const modeFontSize = calculateMode(fontSizes);
  // Fall back to average if mode fails
  const avgFontSize = calculateAverage(fontSizes);
  const detectedFontSize = modeFontSize || avgFontSize || DEFAULT_FONT_SIZE;

  // Use mode for font weight (most common weight)
  const modeWeight = calculateMode(fontWeights);
  const detectedFontWeight = modeWeight || DEFAULT_FONT_WEIGHT;

  return {
    fontSize: Math.round(detectedFontSize),
    fontWeight: detectedFontWeight,
  };
}

/**
 * Detect text alignment based on the horizontal distribution of text items within the box.
 */
function detectTextAlignment(
  matchingItems: RawTextItem[],
  boxX: number,
  boxWidth: number
): "left" | "center" | "right" {
  if (matchingItems.length === 0) return "left";

  // Calculate the average horizontal center of all text items
  const itemCenters = matchingItems.map((item) => item.x + item.width / 2);
  const avgCenter = itemCenters.reduce((sum, c) => sum + c, 0) / itemCenters.length;

  const boxCenter = boxX + boxWidth / 2;
  const tolerance = boxWidth * 0.15; // 15% tolerance

  if (Math.abs(avgCenter - boxCenter) < tolerance) {
    return "center";
  } else if (avgCenter > boxCenter + tolerance) {
    return "right";
  }
  return "left";
}

// --- DYNAMIC HEIGHT CALCULATION ---

/**
 * Calculate the element height based on placeholder text and detected font size.
 * Ignores the AI's bounding box height and calculates a "tight fit" height.
 */
function calculateDynamicHeight(
  placeholderText: string,
  elementWidth: number,
  fontSize: number
): number {
  // Heuristic for height calculation
  const characterWidth = fontSize * CHAR_WIDTH_RATIO;
  const charsPerLine = Math.max(1, Math.floor(elementWidth / characterWidth));
  const numberOfLines = Math.ceil(placeholderText.length / charsPerLine);
  const lineHeightPx = fontSize * DEFAULT_LINE_HEIGHT;

  const calculatedHeight = Math.max(lineHeightPx, numberOfLines * lineHeightPx);

  // Add small buffer for visual padding
  return Math.round(calculatedHeight + 8);
}

// --- ELEMENT PROCESSORS ---

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
 * Process AI-detected text regions using HYBRID logic:
 * 1. Get AI bounding box (x, y, width) - ignore height
 * 2. Find intersecting raw text items from PDF.js
 * 3. Derive font size and weight from matching items
 * 4. Calculate height dynamically based on placeholder text
 */
function processAITextRegionsHybrid(
  textRegions: Array<{ box_2d: [number, number, number, number]; type: "paragraph" | "heading" | "list"; content?: string }>,
  rawTextItems: RawTextItem[],
  canvasWidth: number,
  canvasHeight: number
): CanvasElement[] {
  const elements: CanvasElement[] = [];
  const zIndex = 50; // Text elements go on top of images/tables

  for (const textData of textRegions) {
    const [ymin, xmin, ymax, xmax] = textData.box_2d;

    // Convert 0-1000 coordinates to Pixels
    const x = (xmin / 1000) * canvasWidth;
    const y = (ymin / 1000) * canvasHeight;
    const w = ((xmax - xmin) / 1000) * canvasWidth;
    // Note: We IGNORE the AI height (ymax - ymin) and calculate our own

    // --- STEP 1: Find Intersecting Raw Text Items ---
    const aiBox = { x, y, width: w, height: ((ymax - ymin) / 1000) * canvasHeight };
    const matchingItems = findIntersectingTextItems(rawTextItems, aiBox);

    // --- STEP 2: Derive Font Metrics from Matching Items ---
    let { fontSize, fontWeight } = deriveFontMetrics(matchingItems);

    // --- STEP 3: Apply Type-Based Defaults (if no matches or for enhancement) ---
    let placeholder = "Lorem ipsum text block...";

    if (textData.type === "heading") {
      // Headings should be at least 18px and bold
      fontSize = Math.max(fontSize, 18);
      fontWeight = Math.max(fontWeight, 700);
      placeholder = "Heading Text";
    } else if (textData.type === "list") {
      placeholder = "• List item 1\n• List item 2\n• List item 3";
    }

    // Use AI content for placeholder if available (for more accurate height calculation)
    const contentForHeight = textData.content || placeholder;

    // --- STEP 4: Detect Text Alignment ---
    const textAlign = detectTextAlignment(matchingItems, x, w);

    // --- STEP 5: Calculate Dynamic Height ---
    // Keep AI width, calculate height based on placeholder text
    const calculatedHeight = calculateDynamicHeight(contentForHeight, w, fontSize);

    // Create the Text Element
    elements.push({
      id: nanoid(),
      type: "text",
      content: placeholder, // Use placeholder to focus on layout
      position: { x: Math.round(x), y: Math.round(y) },
      dimension: { width: Math.round(w), height: calculatedHeight },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: zIndex,
      pageIndex: 0,
      aspectRatioLocked: false,
      textStyle: {
        fontFamily: "Inter",
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: "#000000",
        textAlign: textAlign,
        verticalAlign: "top",
        lineHeight: DEFAULT_LINE_HEIGHT,
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

    // --- STEP 1: Extract Raw Text Items from PDF.js ---
    // These are kept in memory for intersection matching, NOT added to canvas
    console.log("PDF Importer: Extracting raw text items from PDF...");
    const rawTextItems = await extractRawTextItems(page, pageHeightPt);
    console.log(`PDF Importer: Extracted ${rawTextItems.length} raw text items`);

    // --- STEP 2: Render Full Page Image for AI Analysis ---
    // This image is sent to AI and then DISCARDED - NOT added as a background layer
    const backgroundDataUrl = await renderPageToImage(page, options);

    // --- STEP 3: AI Layout Analysis ---
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

    // --- STEP 4: Process AI-detected Tables ---
    const { elements: tableElements } = processAITables(
      layout.tables || [],
      canvasWidth,
      canvasHeight
    );

    // --- STEP 5: Process AI-detected Images ---
    // Placeholder images, no actual cropped data
    const imageElements = processAIImages(
      layout.images || [],
      canvasWidth,
      canvasHeight
    );

    // --- STEP 6: Process AI-detected Text Regions with HYBRID Logic ---
    // For each AI text region:
    //   1. Find intersecting raw text items
    //   2. Derive fontSize and fontWeight from them
    //   3. Generate element using AI's x, y, width and calculated height
    const textElements = processAITextRegionsHybrid(
      layout.text_regions || [],
      rawTextItems,
      canvasWidth,
      canvasHeight
    );

    await pdfDoc.destroy();

    // --- STEP 7: Combine All Elements ---
    // NO BACKGROUND ELEMENT - backgroundDataUrl is NOT added to canvas elements
    // zIndex ordering: Tables & Images at 10+, Text at 50+
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
