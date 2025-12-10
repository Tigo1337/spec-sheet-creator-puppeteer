import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CanvasElement, TextStyle, ShapeStyle } from "@shared/schema";
import { nanoid } from "nanoid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const GRID_SIZE = 10;
export const SNAP_THRESHOLD = 8;

export function snapToGrid(value: number, gridSize: number = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

export function createTextElement(
  x: number,
  y: number,
  content: string = "New Text"
): CanvasElement {
  return {
    id: nanoid(),
    type: "text",
    position: { x: snapToGrid(x), y: snapToGrid(y) },
    dimension: { width: 200, height: 40 },
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: Date.now(),
    content,
    textStyle: {
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: 400,
      color: "#000000",
      textAlign: "left",
      verticalAlign: "middle",
      lineHeight: 1.5,
      letterSpacing: 0,
    },
  };
}

// NEW: TOC Element Creator (Updated)
export function createTOCElement(
  x: number,
  y: number
): CanvasElement {
  return {
    id: nanoid(),
    type: "toc-list",
    position: { x: snapToGrid(x), y: snapToGrid(y) },
    dimension: { width: 500, height: 600 },
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: Date.now(),

    // Default Styling for the Item Rows (Product Names)
    textStyle: {
      fontFamily: "Inter",
      fontSize: 14,
      fontWeight: 400,
      color: "#000000",
      textAlign: "left",
      verticalAlign: "top",
      lineHeight: 1.8,
      letterSpacing: 0,
    },

    // Detailed Settings
    tocSettings: {
      title: "Table of Contents",
      showTitle: true,
      titleStyle: {
        fontFamily: "Inter",
        fontSize: 24,
        fontWeight: 700,
        color: "#000000",
        textAlign: "center",
        verticalAlign: "middle",
        lineHeight: 1.2,
        letterSpacing: 0
      },
      chapterStyle: {
        fontFamily: "Inter",
        fontSize: 16,
        fontWeight: 600,
        color: "#333333",
        textAlign: "left",
        verticalAlign: "middle",
        lineHeight: 2.5, // Extra spacing for chapter headers
        letterSpacing: 0
      },
      showPageNumbers: true,
      leaderStyle: "dotted",
      columnCount: 1
    }
  };
}

export function createShapeElement(
  x: number,
  y: number,
  shapeType: "rectangle" | "circle" | "line" = "rectangle"
): CanvasElement {
  return {
    id: nanoid(),
    type: "shape",
    position: { x: snapToGrid(x), y: snapToGrid(y) },
    dimension: { width: 100, height: 100 },
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: Date.now(),
    shapeType,
    shapeStyle: {
      fill: "#e5e7eb",
      stroke: "#9ca3af",
      strokeWidth: 1,
      borderRadius: shapeType === "circle" ? 50 : 4,
      opacity: 1,
    },
  };
}

export function createQRCodeElement(
  x: number,
  y: number,
  content: string = "https://doculoom.io"
): CanvasElement {
  return {
    id: nanoid(),
    type: "qrcode",
    position: { x: snapToGrid(x), y: snapToGrid(y) },
    dimension: { width: 100, height: 100 },
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: Date.now(),
    content,
    textStyle: {
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: 400,
      color: "#000000",
      textAlign: "left",
      verticalAlign: "middle",
      lineHeight: 1.5,
      letterSpacing: 0,
    },
  };
}

export function createDataFieldElement(
  x: number,
  y: number,
  columnName: string
): CanvasElement {
  return {
    id: nanoid(),
    type: "dataField",
    position: { x: snapToGrid(x), y: snapToGrid(y) },
    dimension: { width: 150, height: 32 },
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: Date.now(),
    content: `{{${columnName}}}`,
    dataBinding: columnName,
    textStyle: {
      fontFamily: "JetBrains Mono",
      fontSize: 14,
      fontWeight: 500,
      color: "#000000",
      textAlign: "left",
      verticalAlign: "middle",
      lineHeight: 1.4,
      letterSpacing: 0,
    },
  };
}

export function createImageFieldElement(
  x: number,
  y: number,
  columnName: string
): CanvasElement {
  return {
    id: nanoid(),
    type: "image",
    position: { x: snapToGrid(x), y: snapToGrid(y) },
    dimension: { width: 200, height: 150 },
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: Date.now(),
    dataBinding: columnName,
    aspectRatioLocked: true,
  };
}

export function createImageElement(
  x: number,
  y: number,
  imageSrc?: string,
  dataBinding?: string
): CanvasElement {
  return {
    id: nanoid(),
    type: "image",
    position: { x: snapToGrid(x), y: snapToGrid(y) },
    dimension: { width: 200, height: 150 },
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: Date.now(),
    imageSrc,
    dataBinding,
  };
}

export async function getImageDimensions(imageUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      resolve(null);
    };
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
  });
}

export function getDefaultTextStyle(): TextStyle {
  return {
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: 400,
    color: "#000000",
    textAlign: "left",
    lineHeight: 1.5,
    letterSpacing: 0,
  };
}

export function getDefaultShapeStyle(): ShapeStyle {
  return {
    fill: "#e5e7eb",
    stroke: "#9ca3af",
    strokeWidth: 1,
    borderRadius: 4,
    opacity: 1,
  };
}

export function clampPosition(
  x: number,
  y: number,
  width: number,
  height: number,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, canvasWidth - width)),
    y: Math.max(0, Math.min(y, canvasHeight - height)),
  };
}

export function isPointInElement(
  px: number,
  py: number,
  element: CanvasElement
): boolean {
  const { x, y } = element.position;
  const { width, height } = element.dimension;
  return px >= x && px <= x + width && py >= y && py <= y + height;
}

export function duplicateElement(element: CanvasElement): CanvasElement {
  return {
    ...element,
    id: nanoid(),
    position: {
      x: element.position.x + 20,
      y: element.position.y + 20,
    },
    zIndex: Date.now(),
  };
}

export function applyDataToTemplate(
  elements: CanvasElement[],
  rowData: Record<string, string>
): CanvasElement[] {
  return elements.map((element) => {
    if (element.dataBinding && rowData[element.dataBinding]) {
      return {
        ...element,
        content: rowData[element.dataBinding],
      };
    }
    return element;
  });
}

export function isHtmlContent(content: string): boolean {
  if (!content || typeof content !== "string") return false;
  return /<[a-z][\s\S]*>/i.test(content);
}

// --- NEW: Shared ToC Pagination Logic (Updated for precision) ---
export const paginateTOC = (tocElement: CanvasElement, pageMap: any[], elementHeight: number) => {
  const settings = tocElement.tocSettings || { title: "Table of Contents", showTitle: true, columnCount: 1 };
  const columnCount = settings.columnCount || 1;

  // Padding must match the renderer (16px top + 16px bottom = 32px)
  const padding = 32; 
  const availableHeight = elementHeight - padding;

  const pages: any[][] = [];
  let currentPage: any[] = [];

  // Heights based on styles
  const titleHeight = settings.showTitle 
    ? ((settings.titleStyle?.fontSize || 24) * (settings.titleStyle?.lineHeight || 1.2)) + 10 
    : 0; 

  // Use actual configured line height for headers, default to 1.5
  const headerFontSize = settings.chapterStyle?.fontSize || 18;
  const headerLineHeight = settings.chapterStyle?.lineHeight || 1.5;
  const headerHeight = (headerFontSize * headerLineHeight) + 12; // 8px top + 4px bottom margin

  // Use actual configured line height for items, default to 1.5
  const itemFontSize = tocElement.textStyle?.fontSize || 14;
  const itemLineHeight = tocElement.textStyle?.lineHeight || 1.5;
  const itemHeight = (itemFontSize * itemLineHeight) + 2; // +2 for safety/padding

  // --- Capacity Logic ---
  const page1ColumnHeight = availableHeight - titleHeight;
  const page1TotalCapacity = page1ColumnHeight * columnCount;
  const pageNextTotalCapacity = availableHeight * columnCount;

  let currentCapacity = page1TotalCapacity;
  let currentUsedHeight = 0;

  const groupBy = settings.groupByField;

  const flushPage = () => {
    if (currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      currentUsedHeight = 0;
      currentCapacity = pageNextTotalCapacity; 
    }
  };

  if (groupBy) {
      const groups: Record<string, any[]> = {};
      pageMap.forEach(item => {
          const key = item.group || "Uncategorized";
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
      });

      Object.keys(groups).forEach(groupTitle => {
          if (currentUsedHeight + headerHeight > currentCapacity) {
              flushPage();
          }
          currentPage.push({ type: "header", text: groupTitle });
          currentUsedHeight += headerHeight;

          groups[groupTitle].forEach((item) => {
              if (currentUsedHeight + itemHeight > currentCapacity) {
                  flushPage();
              }
              currentPage.push({ type: "item", ...item });
              currentUsedHeight += itemHeight;
          });
      });
  } else {
      pageMap.forEach(item => {
          if (currentUsedHeight + itemHeight > currentCapacity) {
              flushPage();
          }
          currentPage.push({ type: "item", ...item });
          currentUsedHeight += itemHeight;
      });
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  if (pages.length === 0) return [[]];

  return pages;
};