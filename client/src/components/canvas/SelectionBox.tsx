import { useState, useCallback, useEffect } from "react";
import { useCanvasStore } from "@/stores/canvas-store";

interface SelectionBoxProps {
  elementId: string;
  zoom: number;
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export function SelectionBox({ elementId, zoom }: SelectionBoxProps) {
  const { elements, resizeElement, moveElement, snapToGrid: shouldSnap } = useCanvasStore();
  const element = elements.find((el) => el.id === elementId);
  
  const [isResizing, setIsResizing] = useState(false);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [startDimension, setStartDimension] = useState({ width: 0, height: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });

  if (!element) return null;

  const handleStyle: React.CSSProperties = {
    position: "absolute",
    width: 8,
    height: 8,
    backgroundColor: "white",
    border: "1px solid hsl(var(--primary))",
    borderRadius: 2,
    zIndex: 1000,
  };

  const handleMouseDown = useCallback(
    (handle: ResizeHandle) => (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsResizing(true);
      setActiveHandle(handle);
      setStartPos({ x: e.clientX, y: e.clientY });
      setStartDimension({
        width: element.dimension.width,
        height: element.dimension.height,
      });
      setStartPosition({
        x: element.position.x,
        y: element.position.y,
      });
    },
    [element]
  );

  useEffect(() => {
    if (!isResizing || !activeHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - startPos.x) / zoom;
      const deltaY = (e.clientY - startPos.y) / zoom;

      let newWidth = startDimension.width;
      let newHeight = startDimension.height;
      let newX = startPosition.x;
      let newY = startPosition.y;

      // Handle resizing from different corners/edges
      if (activeHandle.includes("e")) {
        newWidth = Math.max(20, startDimension.width + deltaX);
      }
      if (activeHandle.includes("w")) {
        const widthChange = Math.min(deltaX, startDimension.width - 20);
        newWidth = startDimension.width - widthChange;
        newX = startPosition.x + widthChange;
      }
      if (activeHandle.includes("s")) {
        newHeight = Math.max(20, startDimension.height + deltaY);
      }
      if (activeHandle.includes("n")) {
        const heightChange = Math.min(deltaY, startDimension.height - 20);
        newHeight = startDimension.height - heightChange;
        newY = startPosition.y + heightChange;
      }

      // Keep aspect ratio for corner handles when shift is pressed
      if (e.shiftKey && (activeHandle === "nw" || activeHandle === "ne" || activeHandle === "se" || activeHandle === "sw")) {
        const ratio = startDimension.width / startDimension.height;
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          newHeight = newWidth / ratio;
        } else {
          newWidth = newHeight * ratio;
        }
      }

      // Apply grid snapping if enabled
      if (shouldSnap) {
        newWidth = Math.round(newWidth / 10) * 10;
        newHeight = Math.round(newHeight / 10) * 10;
      }

      resizeElement(elementId, newWidth, newHeight);
      if (newX !== startPosition.x || newY !== startPosition.y) {
        moveElement(elementId, newX, newY);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setActiveHandle(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, activeHandle, startPos, startDimension, startPosition, zoom, elementId, resizeElement, moveElement, shouldSnap]);

  const { position, dimension } = element;
  const left = position.x * zoom;
  const top = position.y * zoom;
  const width = dimension.width * zoom;
  const height = dimension.height * zoom;

  return (
    <>
      {/* Corner handles */}
      <div
        style={{ ...handleStyle, left: left - 4, top: top - 4, cursor: "nw-resize" }}
        onMouseDown={handleMouseDown("nw")}
      />
      <div
        style={{ ...handleStyle, left: left + width - 4, top: top - 4, cursor: "ne-resize" }}
        onMouseDown={handleMouseDown("ne")}
      />
      <div
        style={{ ...handleStyle, left: left + width - 4, top: top + height - 4, cursor: "se-resize" }}
        onMouseDown={handleMouseDown("se")}
      />
      <div
        style={{ ...handleStyle, left: left - 4, top: top + height - 4, cursor: "sw-resize" }}
        onMouseDown={handleMouseDown("sw")}
      />

      {/* Edge handles */}
      <div
        style={{ ...handleStyle, left: left + width / 2 - 4, top: top - 4, cursor: "n-resize" }}
        onMouseDown={handleMouseDown("n")}
      />
      <div
        style={{ ...handleStyle, left: left + width - 4, top: top + height / 2 - 4, cursor: "e-resize" }}
        onMouseDown={handleMouseDown("e")}
      />
      <div
        style={{ ...handleStyle, left: left + width / 2 - 4, top: top + height - 4, cursor: "s-resize" }}
        onMouseDown={handleMouseDown("s")}
      />
      <div
        style={{ ...handleStyle, left: left - 4, top: top + height / 2 - 4, cursor: "w-resize" }}
        onMouseDown={handleMouseDown("w")}
      />
    </>
  );
}
