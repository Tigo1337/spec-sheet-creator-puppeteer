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
    position: { x, y }, // Removed internal snap to avoid overriding caller
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

export function createTableElement(x: number, y: number): CanvasElement {
  return {
    id: nanoid(),
    type: "table",
    position: { x, y }, // Removed internal snap to avoid overriding caller
    dimension: { width: 400, height: 200 },
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: Date.now(),
    tableSettings: {
      variant: "standard",
      columns: [
        { id: nanoid(), header: "Item", width: 150, dataField: "Name" },
        { id: nanoid(), header: "Description", width: 200, dataField: "Description" },
        { id: nanoid(), header: "Price", width: 80, dataField: "Price" },
      ],
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
      borderColor: "#e5e7eb",
      borderWidth: 1,
      cellPadding: 8,
    },
  };
}

/**
 * Creates a Properties Table element - a locked 2-column key/value table
 * for displaying specifications like "Weight: 50lbs"
 */
export function createPropertiesTableElement(x: number, y: number): CanvasElement {
  return {
    id: nanoid(),
    type: "table",
    position: { x, y },
    dimension: { width: 300, height: 150 },
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: Date.now(),
    tableSettings: {
      variant: "properties",
      columns: [
        { id: nanoid(), header: "Feature", width: 120, headerAlign: "left", rowAlign: "left" },
        { id: nanoid(), header: "Value", width: 180, headerAlign: "left", rowAlign: "left" },
      ],
      // Static data for properties tables (no data binding)
      staticData: [
        { Feature: "Material", Value: "Aluminium" },
        { Feature: "Finish", Value: "Matte" },
        { Feature: "Weight", Value: "2.5 lbs" },
      ],
      headerStyle: {
        fontFamily: "Inter",
        fontSize: 12,
        fontWeight: 700,
        color: "#374151",
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
      headerBackgroundColor: "#f9fafb",
      rowBackgroundColor: "#ffffff",
      borderColor: "#e5e7eb",
      borderWidth: 1,
      cellPadding: 8,
    },
  };
}

export function createTOCElement(
  x: number,
  y: number
): CanvasElement {
  return {
    id: nanoid(),
    type: "toc-list",
    position: { x, y }, // Removed internal snap
    dimension: { width: 500, height: 600 },
    rotation: 0,
    locked: false,
    visible: true,
    zIndex: Date.now(),

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
        lineHeight: 2.5,
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
    position: { x, y }, // Removed internal snap
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
    position: { x, y }, // Removed internal snap
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
    position: { x, y }, // Removed internal snap
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
    position: { x, y }, // Removed internal snap
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
    position: { x, y }, // Removed internal snap
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

export const paginateTOC = (tocElement: CanvasElement, pageMap: any[], elementHeight: number) => {
  const settings = tocElement.tocSettings || { title: "Table of Contents", showTitle: true, columnCount: 1 };
  const columnCount = settings.columnCount || 1;
  const padding = 32; 
  const availableHeight = elementHeight - padding;
  const pages: any[][] = [];
  let currentPage: any[] = [];
  const titleHeight = settings.showTitle 
    ? ((settings.titleStyle?.fontSize || 24) * (settings.titleStyle?.lineHeight || 1.2)) + 10 
    : 0; 
  const headerFontSize = settings.chapterStyle?.fontSize || 18;
  const headerLineHeight = settings.chapterStyle?.lineHeight || 1.5;
  const headerHeight = (headerFontSize * headerLineHeight); 
  const itemFontSize = tocElement.textStyle?.fontSize || 14;
  const itemLineHeight = tocElement.textStyle?.lineHeight || 1.5;
  const itemHeight = (itemFontSize * itemLineHeight) + 2; 
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
          if (currentUsedHeight + headerHeight > currentCapacity) { flushPage(); }
          currentPage.push({ type: "header", text: groupTitle });
          currentUsedHeight += headerHeight;
          groups[groupTitle].forEach((item) => {
              if (currentUsedHeight + itemHeight > currentCapacity) { flushPage(); }
              currentPage.push({ type: "item", ...item });
              currentUsedHeight += itemHeight;
          });
      });
  } else {
      pageMap.forEach(item => {
          if (currentUsedHeight + itemHeight > currentCapacity) { flushPage(); }
          currentPage.push({ type: "item", ...item });
          currentUsedHeight += itemHeight;
      });
  }
  if (currentPage.length > 0) { pages.push(currentPage); }
  if (pages.length === 0) return [[]];
  return pages;
};

/**
 * Calculates the required height for a table based on its settings and data.
 * USES SAFETY=6 LOGIC (Matching user preference)
 */
export function calculateTableHeight(
  element: CanvasElement, 
  rows: any[], 
  groupByValue?: any
): number {
  if (element.type !== 'table' || !element.tableSettings) return element.dimension.height;

  const settings = element.tableSettings;

  let rowCount = 0;
  if (settings.groupByField && groupByValue) {
      rowCount = rows.filter(r => r[settings.groupByField!] === groupByValue).length;
  } else {
      rowCount = Math.min(rows.length, 5); 
  }

  rowCount = Math.max(rowCount, 1);

  const hFS = settings.headerStyle?.fontSize || 14;
  const hLH = settings.headerStyle?.lineHeight || 1.2;
  const rFS = settings.rowStyle?.fontSize || 12;
  const rLH = settings.rowStyle?.lineHeight || 1.2;
  const bWidth = settings.borderWidth || 1;
  const safety = 6; // Matching your preferred safety buffer

  const headerHeight = (hFS * hLH + safety);
  const bodyHeight = rowCount * (rFS * rLH + safety);
  const totalBorderHeight = (rowCount + 2) * bWidth;

  return headerHeight + bodyHeight + totalBorderHeight;
}