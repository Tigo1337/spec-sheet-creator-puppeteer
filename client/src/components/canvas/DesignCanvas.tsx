import { useRef, useCallback, useEffect, useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { CanvasElement } from "./CanvasElement";
import { SelectionBox } from "./SelectionBox";
import { createTextElement, createShapeElement, snapToGrid } from "@/lib/canvas-utils";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  DragMoveEvent,
} from "@dnd-kit/core";

export function DesignCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const {
    canvasWidth,
    canvasHeight,
    backgroundColor,
    zoom,
    showGrid,
    snapToGrid: shouldSnap,
    elements,
    selectedElementIds,
    activeTool,
    selectElement,
    clearSelection,
    addElement,
    moveElement,
    setActiveTool,
  } = useCanvasStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target !== canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      if (activeTool === "text") {
        addElement(createTextElement(x, y));
        setActiveTool("select");
      } else if (activeTool === "shape") {
        addElement(createShapeElement(x, y, "rectangle"));
        setActiveTool("select");
      } else {
        clearSelection();
      }
    },
    [activeTool, zoom, addElement, clearSelection, setActiveTool]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    
    const element = elements.find((el) => el.id === active.id);
    if (element && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const pointerX = (event.activatorEvent as PointerEvent).clientX;
      const pointerY = (event.activatorEvent as PointerEvent).clientY;
      
      setDragOffset({
        x: (pointerX - rect.left) / zoom - element.position.x,
        y: (pointerY - rect.top) / zoom - element.position.y,
      });
    }
  }, [elements, zoom]);

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (!activeId || !canvasRef.current) return;

      const { delta } = event;
      const element = elements.find((el) => el.id === activeId);
      if (!element) return;

      let newX = element.position.x + delta.x / zoom;
      let newY = element.position.y + delta.y / zoom;

      if (shouldSnap) {
        newX = snapToGrid(newX);
        newY = snapToGrid(newY);
      }

      // Clamp to canvas bounds
      newX = Math.max(0, Math.min(newX, canvasWidth - element.dimension.width));
      newY = Math.max(0, Math.min(newY, canvasHeight - element.dimension.height));

      moveElement(activeId, newX, newY);
    },
    [activeId, elements, zoom, shouldSnap, canvasWidth, canvasHeight, moveElement]
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event;
    const id = active.id as string;
    
    const element = elements.find((el) => el.id === id);
    if (!element) {
      setActiveId(null);
      return;
    }

    let newX = element.position.x + delta.x / zoom;
    let newY = element.position.y + delta.y / zoom;

    if (shouldSnap) {
      newX = snapToGrid(newX);
      newY = snapToGrid(newY);
    }

    // Clamp to canvas bounds
    newX = Math.max(0, Math.min(newX, canvasWidth - element.dimension.width));
    newY = Math.max(0, Math.min(newY, canvasHeight - element.dimension.height));

    moveElement(id, newX, newY);
    setActiveId(null);
  }, [elements, zoom, shouldSnap, canvasWidth, canvasHeight, moveElement]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const { deleteSelectedElements } = useCanvasStore.getState();
        deleteSelectedElements();
      }

      if (e.key === "Escape") {
        clearSelection();
        setActiveTool("select");
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        e.preventDefault();
        const { selectAll } = useCanvasStore.getState();
        selectAll();
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          const { redo } = useCanvasStore.getState();
          redo();
        } else {
          const { undo } = useCanvasStore.getState();
          undo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection, setActiveTool]);

  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center p-8"
      style={{ minHeight: 0 }}
    >
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        <div
          ref={canvasRef}
          data-testid="design-canvas"
          className="relative shadow-lg transition-shadow duration-200"
          style={{
            width: canvasWidth * zoom,
            height: canvasHeight * zoom,
            backgroundColor,
            backgroundImage: showGrid
              ? `linear-gradient(to right, hsl(var(--border) / 0.3) 1px, transparent 1px),
                 linear-gradient(to bottom, hsl(var(--border) / 0.3) 1px, transparent 1px)`
              : undefined,
            backgroundSize: showGrid ? `${10 * zoom}px ${10 * zoom}px` : undefined,
            cursor: activeTool === "text" ? "text" : activeTool === "shape" ? "crosshair" : "default",
          }}
          onClick={handleCanvasClick}
        >
          {sortedElements.map((element) => (
            <CanvasElement
              key={element.id}
              element={element}
              isSelected={selectedElementIds.includes(element.id)}
              zoom={zoom}
              onSelect={selectElement}
            />
          ))}

          {selectedElementIds.length === 1 && (
            <SelectionBox
              elementId={selectedElementIds[0]}
              zoom={zoom}
            />
          )}
        </div>

        <DragOverlay dropAnimation={null} />
      </DndContext>
    </div>
  );
}
