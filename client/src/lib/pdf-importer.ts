/**
 * PDF Importer Utility - Hybrid AI Strategy
 *
 * Uses pdfjs-dist + AI Vision to parse PDFs and extract:
 * 1. A high-quality background image (DataURL) for visual reference (zIndex 0, hidden by default)
 * 2. AI-detected cropped images and tables (zIndex 1)
 * 3. Editable text elements mapped to CanvasElement schema (zIndex 2)
 */

import * as pdfjsLib from "pdfjs-dist";
import type { TextItem, TextMarkedContent } from "pdfjs-dist/types/src/display/api";
import { nanoid } from "nanoid";
import type { CanvasElement, TextStyle, TableSettings, TableColumn } from "@shared/schema";

// --- WORKER CONFIGURATION ---
const PDFJS_VERSION = pdfjsLib.version || "5.4.449";
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

// DPI conversion constants
const PDF_DPI = 72;
const CANVAS_DPI = 96;
const DPI_SCALE = CANVAS_DPI / PDF_DPI; // 1.333...

// Rendering scale for high-quality background images
const RENDER_SCALE = 2;

// --- Types ---
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
  enableAiAnalysis?: boolean;
}

interface AILayoutResponse {
  images: Array<{
    box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] in 0-1000 scale
    label: string;
  }>;
  tables: Array<{
    box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax] in 0-1000 scale
    rows: number;
    cols: number;
  }>;
}

// --- Helper Functions ---

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
  _fontWeight: number
): { width: number; height: number } {
  const avgCharWidth = fontSize * 0.55;
  const width = Math.max(content.length * avgCharWidth, 50);
  const height = Math.max(fontSize * 1.4, 20);
  return { width, height };
}

/**
 * Crop a region from a base64 image using normalized coordinates (0-1000 scale)
 * @param base64Image - Full page image as Base64 Data URL
 * @param box - Bounding box [ymin, xmin, ymax, xmax] in 0-1000 scale
 * @param canvasWidth - Full canvas width in pixels
 * @param canvasHeight - Full canvas height in pixels
 * @returns Cropped image as Base64 Data URL
 */
async function cropImage(
  base64Image: string,
  box: [number, number, number, number],
  canvasWidth: number,
  canvasHeight: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Convert normalized coordinates (0-1000) to pixels
      const [ymin, xmin, ymax, xmax] = box;
      const x = (xmin / 1000) * canvasWidth;
      const y = (ymin / 1000) * canvasHeight;
      const width = ((xmax - xmin) / 1000) * canvasWidth;
      const height = ((ymax - ymin) / 1000) * canvasHeight;

      // Create offscreen canvas for cropping
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = Math.max(1, Math.round(width));
      cropCanvas.height = Math.max(1, Math.round(height));
      const ctx = cropCanvas.getContext("2d");

      if (!ctx) {
        reject(new Error("Failed to get 2D context for crop canvas"));
        return;
      }

      // Draw the cropped region
      ctx.drawImage(
        img,
        Math.round(x),
        Math.round(y),
        Math.round(width),
        Math.round(height),
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );

      resolve(cropCanvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Failed to load image for cropping"));
    img.src = base64Image;
  });
}

/**
 * Call the AI layout analysis endpoint
 */
async function analyzeLayoutWithAI(imageDataUrl: string): Promise<AILayoutResponse> {
  try {
    const response = await fetch("/api/ai/analyze-layout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ image: imageDataUrl }),
    });

    if (!response.ok) {
      console.warn("AI layout analysis failed:", response.status);
      return { images: [], tables: [] };
    }

    const result = await response.json();
    return {
      images: result.images || [],
      tables: result.tables || [],
    };
  } catch (error) {
    console.warn("AI layout analysis error:", error);
    return { images: [], tables: [] };
  }
}

/**
 * Create default table settings for AI-detected tables
 */
function createDefaultTableSettings(rows: number, cols: number): TableSettings {
  // Generate placeholder columns
  const columns: TableColumn[] = Array.from({ length: cols }, (_, i) => ({
    id: nanoid(),
    header: `Column ${i + 1}`,
    dataField: undefined,
    width: 100,
    headerAlign: "left" as const,
    rowAlign: "left" as const,
  }));

  return {
    columns,
    groupByField: undefined,
    autoFitColumns: false,
    autoHeightAdaptation: false,
    minColumnWidth: 50,
    equalRowHeights: true,
    minRowHeight: 24,
    headerStyle: {
      fontFamily: "Inter",
      fontSize: 14,
      fontWeight: 700,
      color: "#000000",
      textAlign: "left",
      verticalAlign: "middle",
      lineHeight: 1.2,
      letterSpacing: 0,
    },
    rowStyle: {
      fontFamily: "Inter",
      fontSize: 12,
      fontWeight: 400,
      color: "#000000",
      textAlign: "left",
      verticalAlign: "middle",
      lineHeight: 1.2,
      letterSpacing: 0,
    },
    headerBackgroundColor: "#f3f4f6",
    rowBackgroundColor: "#ffffff",
    alternateRowColors: false,
    alternateRowColor: "#f9fafb",
    borderColor: "#e5e7eb",
    borderWidth: 1,
    cellPadding: 8,
  };
}

/**
 * Render PDF page to high-quality image
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
  if (!context) throw new Error("Failed to get 2D canvas context");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvas: canvas,
    canvasContext: context,
    viewport,
  }).promise;

  const format = options.imageFormat || "image/png";
  const quality = options.imageQuality || 0.92;
  return canvas.toDataURL(format, quality);
}

/**
 * Extract text elements from PDF page
 */
async function extractTextElements(
  page: pdfjsLib.PDFPageProxy,
  pageHeightPt: number,
  baseZIndex: number
): Promise<CanvasElement[]> {
  const textContent = await page.getTextContent();
  const elements: CanvasElement[] = [];
  let zIndex = baseZIndex;

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
      isImageField: false,
    };
    elements.push(element);
  }
  return elements;
}

/**
 * Process AI-detected images and create CanvasElements
 */
async function processAIImages(
  aiResponse: AILayoutResponse,
  backgroundDataUrl: string,
  canvasWidth: number,
  canvasHeight: number,
  baseZIndex: number
): Promise<CanvasElement[]> {
  const elements: CanvasElement[] = [];
  let zIndex = baseZIndex;

  for (const img of aiResponse.images) {
    try {
      const croppedImageUrl = await cropImage(
        backgroundDataUrl,
        img.box_2d,
        canvasWidth,
        canvasHeight
      );

      // Convert normalized coordinates to canvas pixels
      const [ymin, xmin, ymax, xmax] = img.box_2d;
      const x = (xmin / 1000) * canvasWidth;
      const y = (ymin / 1000) * canvasHeight;
      const width = ((xmax - xmin) / 1000) * canvasWidth;
      const height = ((ymax - ymin) / 1000) * canvasHeight;

      const element: CanvasElement = {
        id: nanoid(),
        type: "image",
        position: { x: Math.round(x), y: Math.round(y) },
        dimension: { width: Math.round(width), height: Math.round(height) },
        rotation: 0,
        locked: false,
        visible: true,
        zIndex: zIndex++,
        pageIndex: 0,
        imageSrc: croppedImageUrl,
        content: img.label,
        aspectRatioLocked: true,
        aspectRatio: width / height,
        isImageField: false,
      };
      elements.push(element);
    } catch (error) {
      console.warn("Failed to crop image:", error);
    }
  }

  return elements;
}

/**
 * Process AI-detected tables and create CanvasElements
 */
function processAITables(
  aiResponse: AILayoutResponse,
  canvasWidth: number,
  canvasHeight: number,
  baseZIndex: number
): CanvasElement[] {
  const elements: CanvasElement[] = [];
  let zIndex = baseZIndex;

  for (const table of aiResponse.tables) {
    // Convert normalized coordinates to canvas pixels
    const [ymin, xmin, ymax, xmax] = table.box_2d;
    const x = (xmin / 1000) * canvasWidth;
    const y = (ymin / 1000) * canvasHeight;
    const width = ((xmax - xmin) / 1000) * canvasWidth;
    const height = ((ymax - ymin) / 1000) * canvasHeight;

    const tableSettings = createDefaultTableSettings(table.rows, table.cols);

    const element: CanvasElement = {
      id: nanoid(),
      type: "table",
      position: { x: Math.round(x), y: Math.round(y) },
      dimension: { width: Math.round(width), height: Math.round(height) },
      rotation: 0,
      locked: false,
      visible: true,
      zIndex: zIndex++,
      pageIndex: 0,
      tableSettings,
      aspectRatioLocked: false,
      isImageField: false,
    };
    elements.push(element);
  }

  return elements;
}

/**
 * Main PDF import function with Hybrid AI strategy
 */
export async function importPdf(
  file: File,
  options: PdfImportOptions = {}
): Promise<PdfImportResult> {
  const { pageNumber = 1, enableAiAnalysis = true } = options;

  try {
    const arrayBuffer = await file.arrayBuffer();

    // Load PDF document
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

    // Step 1: Render full page to high-quality image
    const backgroundDataUrl = await renderPageToImage(page, options);

    // Step 2: Extract text elements (will be layered on top at zIndex 2+)
    const textElements = await extractTextElements(page, pageHeightPt, 200);

    // Step 3: AI Layout Analysis (if enabled)
    let aiImageElements: CanvasElement[] = [];
    let aiTableElements: CanvasElement[] = [];

    if (enableAiAnalysis) {
      console.log("Starting AI layout analysis...");
      const aiResponse = await analyzeLayoutWithAI(backgroundDataUrl);
      console.log("AI analysis complete:", {
        imagesFound: aiResponse.images.length,
        tablesFound: aiResponse.tables.length,
      });

      // Process AI-detected elements (zIndex 100-199 for images/tables)
      aiImageElements = await processAIImages(
        aiResponse,
        backgroundDataUrl,
        canvasWidth,
        canvasHeight,
        100
      );

      aiTableElements = processAITables(
        aiResponse,
        canvasWidth,
        canvasHeight,
        100 + aiImageElements.length
      );
    }

    // Step 4: Create background element (zIndex 0, hidden by default)
    const backgroundElement: CanvasElement = {
      id: nanoid(),
      type: "image",
      position: { x: 0, y: 0 },
      dimension: { width: canvasWidth, height: canvasHeight },
      rotation: 0,
      locked: true,
      visible: false, // Hidden by default so it doesn't obscure editable layers
      zIndex: 0,
      pageIndex: 0,
      imageSrc: backgroundDataUrl,
      content: "PDF Background",
      aspectRatioLocked: true,
      aspectRatio: canvasWidth / canvasHeight,
      isImageField: false,
    };

    // Combine all elements with proper layering:
    // - zIndex 0: Full page background (hidden)
    // - zIndex 100+: AI-detected images and tables
    // - zIndex 200+: Extracted text
    const allElements: CanvasElement[] = [
      backgroundElement,
      ...aiImageElements,
      ...aiTableElements,
      ...textElements,
    ];

    await pdfDoc.destroy();

    return {
      elements: allElements,
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

/**
 * Import PDF without AI analysis (faster, text-only extraction)
 */
export async function importPdfBasic(
  file: File,
  options: PdfImportOptions = {}
): Promise<PdfImportResult> {
  return importPdf(file, { ...options, enableAiAnalysis: false });
}
