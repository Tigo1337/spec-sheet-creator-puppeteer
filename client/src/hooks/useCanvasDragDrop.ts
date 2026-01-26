/**
 * Custom hook for managing drag-and-drop interactions on the canvas
 * Handles both sidebar-to-canvas drops (adding new elements) and
 * canvas element repositioning with snapping and alignment guides
 */

import { useState, useRef } from "react";
import {
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragMoveEvent,
  DragEndEvent
} from "@dnd-kit/core";
import { useCanvasStore } from "@/stores/canvas-store";
import { createDataFieldElement, createImageFieldElement, snapToGrid } from "@/lib/canvas-utils";
import { detectAlignmentGuides, type ActiveGuides } from "@/lib/alignment-guides";
import { toast } from "@/hooks/use-toast";

export type DragType = "sidebar" | "canvas" | null;

export interface UseCanvasDragDropReturn {
  activeId: string | null;
  dragType: DragType;
  activeGuides: ActiveGuides;
  sensors: ReturnType<typeof useSensors>;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragMove: (event: DragMoveEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
}

export function useCanvasDragDrop(): UseCanvasDragDropReturn {
  const {
    elements,
    zoom,
    snapToGrid: shouldSnap,
    gridSize,
    canvasWidth,
    canvasHeight,
    addElement,
    moveElement,
    selectElement,
    updateElement,
    setActivePage,
    imageFieldNames,
  } = useCanvasStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<DragType>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const [activeGuides, setActiveGuides] = useState<ActiveGuides>({
    vertical: null,
    horizontal: null,
    alignments: [],
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const id = active.id as string;
    setActiveId(id);

    // Check if dragging from sidebar (header field)
    if (active.data.current?.header) {
      setDragType("sidebar");
      return;
    }

    // Dragging existing canvas element
    const element = elements.find((el) => el.id === id);
    if (element) {
      setDragType("canvas");
      selectElement(id);
      startPosRef.current = { x: element.position.x, y: element.position.y };
      setActivePage(element.pageIndex || 0);
    }
  };

  const handleDragMove = (event: DragMoveEvent) => {
    const { active, delta } = event;

    if (dragType === "canvas") {
      const element = elements.find((el) => el.id === active.id);
      if (!element) return;

      let newX = startPosRef.current.x + delta.x / zoom;
      let newY = startPosRef.current.y + delta.y / zoom;

      // Apply grid snapping if enabled
      if (shouldSnap) {
        newX = snapToGrid(newX, gridSize);
        newY = snapToGrid(newY, gridSize);
      }

      // Constrain to canvas bounds
      newX = Math.max(0, Math.min(newX, canvasWidth - element.dimension.width));
      newY = Math.max(0, Math.min(newY, canvasHeight - element.dimension.height));

      // Calculate alignment guides with other elements on the same page
      const pageElements = elements.filter(
        (el) => el.id !== active.id && el.pageIndex === element.pageIndex
      );
      const tempElement = { ...element, position: { x: newX, y: newY } };
      const guides = detectAlignmentGuides(tempElement, pageElements, zoom);
      setActiveGuides(guides);

      moveElement(active.id as string, newX, newY);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Handle sidebar drop onto canvas page
    if (dragType === "sidebar" && over && over.id.toString().startsWith("page-")) {
      const header = active.data.current?.header;
      if (header) {
        const pageIndex = parseInt(over.id.toString().split("-")[1], 10);
        const pageElement = document.getElementById(over.id as string);

        if (pageElement) {
          const rect = pageElement.getBoundingClientRect();
          // @ts-ignore - DnD Kit internal property
          const dropRect = active.rect.current.translated;

          if (dropRect) {
            const rawX = (dropRect.left - rect.left) / zoom;
            const rawY = (dropRect.top - rect.top) / zoom;

            // Apply grid snapping to dropped position
            const x = shouldSnap ? snapToGrid(rawX, gridSize) : rawX;
            const y = shouldSnap ? snapToGrid(rawY, gridSize) : rawY;

            // Determine if this is an image field
            const isManuallyMarked = imageFieldNames.has(header);
            const isAutoDetected = /image|photo|picture|url|thumbnail|img|avatar|logo/i.test(header);
            const isImageColumn = isManuallyMarked || isAutoDetected;

            const newElement = isImageColumn
              ? createImageFieldElement(x, y, header)
              : createDataFieldElement(x, y, header);

            addElement({ ...newElement, pageIndex });
            toast({ title: "Field Added", description: `Added "${header}"` });
          }
        }
      }
    }
    // Handle moving canvas element to different page
    else if (dragType === "canvas" && over && over.id.toString().startsWith("page-")) {
      const targetPageIndex = parseInt(over.id.toString().split("-")[1], 10);
      const element = elements.find((el) => el.id === active.id);

      if (element && element.pageIndex !== targetPageIndex) {
        updateElement(active.id as string, { pageIndex: targetPageIndex });
      }
    }

    // Reset drag state
    setActiveId(null);
    setDragType(null);
    setActiveGuides({ vertical: null, horizontal: null, alignments: [] });
  };

  return {
    activeId,
    dragType,
    activeGuides,
    sensors,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
