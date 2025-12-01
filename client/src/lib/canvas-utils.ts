import type { CanvasElement, TextStyle, ShapeStyle } from "@shared/schema";
import { nanoid } from "nanoid";

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
