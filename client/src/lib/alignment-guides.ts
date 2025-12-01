import type { CanvasElement } from "@shared/schema";

export interface AlignmentGuide {
  type: "vertical" | "horizontal";
  position: number; // x or y coordinate
  elementIds: string[]; // which elements align at this position
}

export interface ActiveGuides {
  vertical: number | null; // x coordinate of center line
  horizontal: number | null; // y coordinate of center line
  alignments: AlignmentGuide[];
}

const SNAP_DISTANCE = 5; // pixels

export function detectAlignmentGuides(
  activeElement: CanvasElement,
  otherElements: CanvasElement[],
  zoom: number
): ActiveGuides {
  const guides: AlignmentGuide[] = [];

  const activeLeft = activeElement.position.x;
  const activeRight = activeElement.position.x + activeElement.dimension.width;
  const activeCenterX = activeElement.position.x + activeElement.dimension.width / 2;
  const activeTop = activeElement.position.y;
  const activeBottom = activeElement.position.y + activeElement.dimension.height;
  const activeCenterY = activeElement.position.y + activeElement.dimension.height / 2;

  // Check alignment with other elements
  otherElements.forEach((el) => {
    const elLeft = el.position.x;
    const elRight = el.position.x + el.dimension.width;
    const elCenterX = el.position.x + el.dimension.width / 2;
    const elTop = el.position.y;
    const elBottom = el.position.y + el.dimension.height;
    const elCenterY = el.position.y + el.dimension.height / 2;

    // Check vertical alignments (left, center, right)
    if (Math.abs(activeLeft - elLeft) < SNAP_DISTANCE) {
      const existing = guides.find((g) => g.type === "vertical" && g.position === elLeft);
      if (existing) {
        existing.elementIds.push(el.id);
      } else {
        guides.push({
          type: "vertical",
          position: elLeft,
          elementIds: [el.id],
        });
      }
    }

    if (Math.abs(activeCenterX - elCenterX) < SNAP_DISTANCE) {
      const existing = guides.find((g) => g.type === "vertical" && g.position === elCenterX);
      if (existing) {
        existing.elementIds.push(el.id);
      } else {
        guides.push({
          type: "vertical",
          position: elCenterX,
          elementIds: [el.id],
        });
      }
    }

    if (Math.abs(activeRight - elRight) < SNAP_DISTANCE) {
      const existing = guides.find((g) => g.type === "vertical" && g.position === elRight);
      if (existing) {
        existing.elementIds.push(el.id);
      } else {
        guides.push({
          type: "vertical",
          position: elRight,
          elementIds: [el.id],
        });
      }
    }

    // Check horizontal alignments (top, center, bottom)
    if (Math.abs(activeTop - elTop) < SNAP_DISTANCE) {
      const existing = guides.find((g) => g.type === "horizontal" && g.position === elTop);
      if (existing) {
        existing.elementIds.push(el.id);
      } else {
        guides.push({
          type: "horizontal",
          position: elTop,
          elementIds: [el.id],
        });
      }
    }

    if (Math.abs(activeCenterY - elCenterY) < SNAP_DISTANCE) {
      const existing = guides.find((g) => g.type === "horizontal" && g.position === elCenterY);
      if (existing) {
        existing.elementIds.push(el.id);
      } else {
        guides.push({
          type: "horizontal",
          position: elCenterY,
          elementIds: [el.id],
        });
      }
    }

    if (Math.abs(activeBottom - elBottom) < SNAP_DISTANCE) {
      const existing = guides.find((g) => g.type === "horizontal" && g.position === elBottom);
      if (existing) {
        existing.elementIds.push(el.id);
      } else {
        guides.push({
          type: "horizontal",
          position: elBottom,
          elementIds: [el.id],
        });
      }
    }
  });

  return {
    vertical: null,
    horizontal: null,
    alignments: guides,
  };
}
