import { useMemo } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import type { ActiveGuides } from "@/lib/alignment-guides";

interface AlignmentGuidesProps {
  activeId: string | null;
  activeGuides: ActiveGuides;
  zoom: number;
}

export function AlignmentGuides({ activeId, activeGuides, zoom }: AlignmentGuidesProps) {
  const { elements, canvasHeight, canvasWidth } = useCanvasStore();

  const guides = useMemo(() => {
    const guideElements = [];

    // Render center crosshairs when element is being dragged
    if (activeId) {
      const activeElement = elements.find((el) => el.id === activeId);
      if (activeElement) {
        const centerX = (activeElement.position.x + activeElement.dimension.width / 2) * zoom;
        const centerY = (activeElement.position.y + activeElement.dimension.height / 2) * zoom;

        // Vertical center line
        guideElements.push(
          <line
            key="center-v"
            x1={centerX}
            y1={0}
            x2={centerX}
            y2={canvasHeight * zoom}
            stroke="#ff006e"
            strokeWidth="1"
            strokeDasharray="4,4"
            pointerEvents="none"
            opacity="0.6"
          />
        );

        // Horizontal center line
        guideElements.push(
          <line
            key="center-h"
            x1={0}
            y1={centerY}
            x2={canvasWidth * zoom}
            y2={centerY}
            stroke="#ff006e"
            strokeWidth="1"
            strokeDasharray="4,4"
            pointerEvents="none"
            opacity="0.6"
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
