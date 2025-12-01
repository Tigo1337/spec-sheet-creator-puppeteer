import { useMemo } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import type { ActiveGuides } from "@/lib/alignment-guides";

interface AlignmentGuidesProps {
  activeId: string | null;
  activeGuides: ActiveGuides;
  zoom: number;
}

export function AlignmentGuides({ activeId, activeGuides, zoom }: AlignmentGuidesProps) {
  const { elements, canvasHeight, canvasWidth, gridSize } = useCanvasStore();

  const guides = useMemo(() => {
    const guideElements = [];

    // Render center crosshairs when element is being dragged
    if (activeId) {
      const activeElement = elements.find((el) => el.id === activeId);
      if (activeElement) {
        const elementCenterX = activeElement.position.x + activeElement.dimension.width / 2;
        const elementCenterY = activeElement.position.y + activeElement.dimension.height / 2;
        const canvasCenterX = canvasWidth / 2;
        const canvasCenterY = canvasHeight / 2;

        const centerX = elementCenterX * zoom;
        const centerY = elementCenterY * zoom;
        const canvasCenterXZoomed = canvasCenterX * zoom;
        const canvasCenterYZoomed = canvasCenterY * zoom;

        // Vertical center line (pink - element's vertical center)
        guideElements.push(
          <line
            key="center-v"
            x1={centerX}
            y1={0}
            x2={centerX}
            y2={canvasHeight * zoom}
            stroke="#ff006e"
            strokeWidth="2"
            strokeDasharray="6,4"
            pointerEvents="none"
            opacity="0.9"
          />
        );

        // Horizontal center line (pink - element's horizontal center)
        guideElements.push(
          <line
            key="center-h"
            x1={0}
            y1={centerY}
            x2={canvasWidth * zoom}
            y2={centerY}
            stroke="#ff006e"
            strokeWidth="2"
            strokeDasharray="6,4"
            pointerEvents="none"
            opacity="0.9"
          />
        );

        // Blue vertical center line - shows when element is horizontally centered in canvas
        guideElements.push(
          <line
            key="grid-center-v"
            x1={canvasCenterXZoomed}
            y1={0}
            x2={canvasCenterXZoomed}
            y2={canvasHeight * zoom}
            stroke="#0099ff"
            strokeWidth="2"
            strokeDasharray="4,6"
            pointerEvents="none"
            opacity="0.7"
          />
        );

        // Blue horizontal center line - shows when element is vertically centered in canvas
        guideElements.push(
          <line
            key="grid-center-h"
            x1={0}
            y1={canvasCenterYZoomed}
            x2={canvasWidth * zoom}
            y2={canvasCenterYZoomed}
            stroke="#0099ff"
            strokeWidth="2"
            strokeDasharray="4,6"
            pointerEvents="none"
            opacity="0.7"
          />
        );
      }
    }

    // Render alignment guides
    activeGuides.alignments.forEach((guide, idx) => {
      if (guide.type === "vertical") {
        const x = guide.position * zoom;
        guideElements.push(
          <line
            key={`align-v-${idx}`}
            x1={x}
            y1={0}
            x2={x}
            y2={canvasHeight * zoom}
            stroke="#00d9ff"
            strokeWidth="1.5"
            pointerEvents="none"
            opacity="0.8"
          />
        );
      } else {
        const y = guide.position * zoom;
        guideElements.push(
          <line
            key={`align-h-${idx}`}
            x1={0}
            y1={y}
            x2={canvasWidth * zoom}
            y2={y}
            stroke="#00d9ff"
            strokeWidth="1.5"
            pointerEvents="none"
            opacity="0.8"
          />
        );
      }
    });

    return guideElements;
  }, [activeId, activeGuides, elements, zoom, canvasHeight, canvasWidth]);

  return (
    <svg
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1000,
      }}
    >
      {guides}
    </svg>
  );
}
