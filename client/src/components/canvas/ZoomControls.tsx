import { useCanvasStore } from "@/stores/canvas-store";
import { Plus, Minus, Maximize } from "lucide-react";
import { useCallback, useRef, useEffect } from "react";

const ZOOM_STEP = 0.25;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;

export function ZoomControls() {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    zoom,
    setZoom,
    elements,
    canvasWidth,
    canvasHeight,
  } = useCanvasStore();

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(MAX_ZOOM, zoom + ZOOM_STEP);
    setZoom(newZoom);
  }, [zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(MIN_ZOOM, zoom - ZOOM_STEP);
    setZoom(newZoom);
  }, [zoom, setZoom]);

  const handleFitToScreen = useCallback(() => {
    // Get the canvas container dimensions
    const canvasContainer = document.querySelector('.flex-1.flex.flex-col.relative.bg-muted\\/30');
    if (!canvasContainer) return;

    const containerRect = canvasContainer.getBoundingClientRect();
    // Account for rulers (24px each) and padding (32px on each side)
    const availableWidth = containerRect.width - 24 - 64;
    const availableHeight = containerRect.height - 24 - 64;

    if (elements.length === 0) {
      // If no elements, fit the canvas itself
      const fitZoomX = availableWidth / canvasWidth;
      const fitZoomY = availableHeight / canvasHeight;
      const fitZoom = Math.min(fitZoomX, fitZoomY, MAX_ZOOM);
      setZoom(Math.max(MIN_ZOOM, fitZoom));
      return;
    }

    // Calculate bounding box of all elements
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    elements.forEach((element) => {
      const left = element.position.x;
      const top = element.position.y;
      const right = element.position.x + element.dimension.width;
      const bottom = element.position.y + element.dimension.height;

      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
    });

    // Include canvas boundaries in the bounding box calculation
    minX = Math.min(minX, 0);
    minY = Math.min(minY, 0);
    maxX = Math.max(maxX, canvasWidth);
    maxY = Math.max(maxY, canvasHeight);

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Calculate zoom to fit content
    const fitZoomX = availableWidth / contentWidth;
    const fitZoomY = availableHeight / contentHeight;
    const fitZoom = Math.min(fitZoomX, fitZoomY, MAX_ZOOM);

    setZoom(Math.max(MIN_ZOOM, fitZoom));
  }, [elements, canvasWidth, canvasHeight, setZoom]);

  // Prevent keyboard events from bubbling when interacting with buttons
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-6 right-6 z-50 flex flex-col gap-1 rounded-lg bg-black/50 backdrop-blur-sm p-1.5"
      onKeyDown={handleKeyDown}
    >
      <button
        onClick={handleZoomIn}
        disabled={zoom >= MAX_ZOOM}
        className="flex h-8 w-8 items-center justify-center rounded-md text-white hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Zoom In (Ctrl + =)"
      >
        <Plus className="h-4 w-4" />
      </button>

      <button
        onClick={handleZoomOut}
        disabled={zoom <= MIN_ZOOM}
        className="flex h-8 w-8 items-center justify-center rounded-md text-white hover:bg-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title="Zoom Out (Ctrl + -)"
      >
        <Minus className="h-4 w-4" />
      </button>

      <div className="h-px bg-white/20 mx-1" />

      <button
        onClick={handleFitToScreen}
        className="flex h-8 w-8 items-center justify-center rounded-md text-white hover:bg-white/20 transition-colors"
        title="Fit to Screen"
      >
        <Maximize className="h-4 w-4" />
      </button>
    </div>
  );
}
