import { useRef, useCallback, useEffect, useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { CanvasElement } from "./CanvasElement";
import { SelectionBox } from "./SelectionBox";
import { AlignmentGuides } from "./AlignmentGuides";
import { createTextElement, createShapeElement, snapToGrid } from "@/lib/canvas-utils";
import { detectAlignmentGuides, type ActiveGuides } from "@/lib/alignment-guides";
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
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

export function DesignCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const [activeGuides, setActiveGuides] = useState<ActiveGuides>({
    vertical: null,
    horizontal: null,
    alignments: [],
  });

  const {
    canvasWidth,
    canvasHeight,
    gridSize,
    backgroundColor,
    zoom,
    showGrid,
    snapToGrid: shouldSnap,
    elements,
    selectedElementIds,
    activeTool,
    pageCount,
    activePageIndex,
    selectElement,
    clearSelection,
    addElement,
    moveElement,
    updateElement,
    setActiveTool,
    addPage,
    removePage,
    setActivePage,
  } = useCanvasStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent, pageIndex: number) => {
      // Set active page when clicked
      if (activePageIndex !== pageIndex) {
        setActivePage(pageIndex);
      }

      // If clicking directly on the canvas background (not an element)
      if (e.target === e.currentTarget) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;

        if (activeTool === "text") {
          const el = createTextElement(x, y);
          // Explicitly set page index for new elements
          addElement({ ...el, pageIndex });
          setActiveTool("select");
        } else if (activeTool === "shape") {
          const el = createShapeElement(x, y, "rectangle");
          addElement({ ...el, pageIndex });
          setActiveTool("select");
        } else {
          clearSelection();
        }
      }
    },
    [activeTool, zoom, addElement, clearSelection, setActiveTool, activePageIndex, setActivePage]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    selectElement(active.id as string);

    const element = useCanvasStore.getState().elements.find((el) => el.id === active.id);
    if (element) {
      startPosRef.current = { x: element.position.x, y: element.position.y };
      // Ensure we are on the right page if we start dragging an unselected element
      setActivePage(element.pageIndex || 0);
    }
  }, [selectElement, setActivePage]);

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (!activeId) return;

      const { delta } = event;
      const allElements = useCanvasStore.getState().elements;
      const element = allElements.find((el) => el.id === activeId);
      if (!element) return;

      // Calculate position
      let newX = startPosRef.current.x + delta.x / zoom;
      let newY = startPosRef.current.y + delta.y / zoom;

      if (shouldSnap) {
        newX = snapToGrid(newX);
        newY = snapToGrid(newY);
      }

      // Simple clamping
      newX = Math.max(0, Math.min(newX, canvasWidth - element.dimension.width));
      newY = Math.max(0, Math.min(newY, canvasHeight - element.dimension.height));

      // Calculate guides (only against elements on the SAME page)
      const pageElements = allElements.filter((el) => el.id !== activeId && el.pageIndex === element.pageIndex);
      const tempElement = { ...element, position: { x: newX, y: newY } };
      const guides = detectAlignmentGuides(tempElement, pageElements, zoom);
      setActiveGuides(guides);

      moveElement(activeId, newX, newY);
    },
    [activeId, zoom, shouldSnap, canvasWidth, canvasHeight, moveElement]
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const id = active.id as string;

    // Check if we dropped onto a specific page
    if (over && over.id.toString().startsWith("page-")) {
      const targetPageIndex = parseInt(over.id.toString().split("-")[1], 10);

      // Update element's page index if changed
      const element = useCanvasStore.getState().elements.find(el => el.id === id);
      if (element && element.pageIndex !== targetPageIndex) {
        updateElement(id, { pageIndex: targetPageIndex });
      }
    }

    setActiveId(null);
    setActiveGuides({ vertical: null, horizontal: null, alignments: [] });
  }, [updateElement]);

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
      className="flex-1 overflow-auto bg-muted/30 flex flex-col items-center p-8 gap-8"
      style={{ minHeight: 0 }}
    >
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
      >
        {Array.from({ length: pageCount }).map((_, pageIndex) => (
          <div key={pageIndex} className="relative group">
            {/* Page Label */}
            <div className="absolute -top-6 left-0 text-xs text-muted-foreground font-medium flex justify-between w-full">
              <span>Page {pageIndex + 1}</span>
              {pageCount > 1 && (
                <button 
                  onClick={() => removePage(pageIndex)}
                  className="hover:text-destructive transition-colors"
                  title="Remove Page"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* The Canvas Page */}
            <div
              id={`page-${pageIndex}`} // ID for droppable target
              data-testid={`design-canvas-page-${pageIndex}`}
              className={`relative shadow-lg transition-shadow duration-200 ${activePageIndex === pageIndex ? 'ring-2 ring-primary ring-offset-2' : ''}`}
              style={{
                width: canvasWidth * zoom,
                height: canvasHeight * zoom,
                backgroundColor,
                backgroundImage: showGrid
                  ? `linear-gradient(to right, hsl(var(--border) / 0.15) 1px, transparent 1px),
                     linear-gradient(to bottom, hsl(var(--border) / 0.15) 1px, transparent 1px)`
                  : undefined,
                backgroundSize: showGrid ? `${gridSize * zoom}px ${gridSize * zoom}px` : undefined,
                cursor: activeTool === "text" ? "text" : activeTool === "shape" ? "crosshair" : "default",
              }}
              onClick={(e) => handleCanvasClick(e, pageIndex)}
            >
              {/* Only render elements belonging to this page */}
              {sortedElements
                .filter(el => (el.pageIndex ?? 0) === pageIndex)
                .map((element) => (
                  <CanvasElement
                    key={element.id}
                    element={element}
                    isSelected={selectedElementIds.includes(element.id)}
                    zoom={zoom}
                    onSelect={selectElement}
                  />
              ))}

              {/* Show alignment guides only on active page */}
              {activeId && activePageIndex === pageIndex && (
                <AlignmentGuides activeId={activeId} activeGuides={activeGuides} zoom={zoom} />
              )}

              {/* Selection box logic */}
              {selectedElementIds.length === 1 && 
               elements.find(el => el.id === selectedElementIds[0])?.pageIndex === pageIndex && (
                <SelectionBox
                  elementId={selectedElementIds[0]}
                  zoom={zoom}
                />
              )}
            </div>
          </div>
        ))}

        {/* Add Page Button at bottom */}
        <Button 
          variant="outline" 
          className="w-[200px] border-dashed gap-2"
          onClick={addPage}
        >
          <Plus className="h-4 w-4" /> Add Page
        </Button>

        <DragOverlay dropAnimation={null} />
      </DndContext>
    </div>
  );
}