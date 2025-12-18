import { useRef, useCallback, useEffect, useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { CanvasElement } from "./CanvasElement";
import { SelectionBox } from "./SelectionBox";
import { AlignmentGuides } from "./AlignmentGuides";
import { Ruler } from "./Ruler";
import { FloatingToolbar } from "./FloatingToolbar";
import { ShortcutsDialog } from "@/components/dialogs/ShortcutsDialog";
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
import { Plus, Trash2, Grid3X3 } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export function DesignCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const startPosRef = useRef({ x: 0, y: 0 });

  // Alignment Guides State
  const [activeGuides, setActiveGuides] = useState<ActiveGuides>({
    vertical: null,
    horizontal: null,
    alignments: [],
  });

  // Panning State
  const [isPanning, setIsPanning] = useState(false);

  // Mouse Tracking for Rulers
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

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
    toggleGrid,
    setRightPanelTab
  } = useCanvasStore();

  // 1. Context-Aware Panel Switching
  // Automatically switch to 'Properties' tab when an element is selected
  useEffect(() => {
    if (selectedElementIds.length > 0) {
      setRightPanelTab("properties");
    }
  }, [selectedElementIds, setRightPanelTab]);

  // 2. Spacebar to Pan Logic
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === "Space" && !e.repeat && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
            e.preventDefault();
            setIsPanning(true);
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === "Space") setIsPanning(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // 3. Mouse Tracking for Rulers
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // We calculate position relative to Page 0 to give consistent "Canvas Coordinates"
    // even if the user scrolls down to other pages.
    const pageElement = document.getElementById('page-0');
    if (pageElement) {
        const rect = pageElement.getBoundingClientRect();
        // Calculate X/Y relative to the canvas origin (0,0 of Page 1) accounting for zoom
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;
        setMousePos({ x, y });
    }
  }, [zoom]);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent, pageIndex: number) => {
      if (isPanning) return; // Don't allow clicking while panning

      if (activePageIndex !== pageIndex) {
        setActivePage(pageIndex);
      }

      if (e.target === e.currentTarget) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;

        if (activeTool === "text") {
          const el = createTextElement(x, y);
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
    [activeTool, zoom, addElement, clearSelection, setActiveTool, activePageIndex, setActivePage, isPanning]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (isPanning) return;
    const { active } = event;
    setActiveId(active.id as string);
    selectElement(active.id as string);

    const element = useCanvasStore.getState().elements.find((el) => el.id === active.id);
    if (element) {
      startPosRef.current = { x: element.position.x, y: element.position.y };
      setActivePage(element.pageIndex || 0);
    }
  }, [selectElement, setActivePage, isPanning]);

  const handleDragMove = useCallback(
    (event: DragMoveEvent) => {
      if (!activeId || isPanning) return;

      const { delta } = event;
      const allElements = useCanvasStore.getState().elements;
      const element = allElements.find((el) => el.id === activeId);
      if (!element) return;

      let newX = startPosRef.current.x + delta.x / zoom;
      let newY = startPosRef.current.y + delta.y / zoom;

      if (shouldSnap) {
        newX = snapToGrid(newX);
        newY = snapToGrid(newY);
      }

      // Constrain to canvas bounds (optional, can be removed if you want infinite-ish placement)
      newX = Math.max(0, Math.min(newX, canvasWidth - element.dimension.width));
      newY = Math.max(0, Math.min(newY, canvasHeight - element.dimension.height));

      const pageElements = allElements.filter((el) => el.id !== activeId && el.pageIndex === element.pageIndex);
      const tempElement = { ...element, position: { x: newX, y: newY } };

      // Calculate alignment guides
      const guides = detectAlignmentGuides(tempElement, pageElements, zoom);
      setActiveGuides(guides);

      moveElement(activeId, newX, newY);
    },
    [activeId, zoom, shouldSnap, canvasWidth, canvasHeight, moveElement, isPanning]
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    const id = active.id as string;

    // Handle moving elements between pages
    if (over && over.id.toString().startsWith("page-")) {
      const targetPageIndex = parseInt(over.id.toString().split("-")[1], 10);
      const element = useCanvasStore.getState().elements.find(el => el.id === id);
      if (element && element.pageIndex !== targetPageIndex) {
        updateElement(id, { pageIndex: targetPageIndex });
      }
    }

    setActiveId(null);
    setActiveGuides({ vertical: null, horizontal: null, alignments: [] });
  }, [updateElement]);

  // Global Keyboard Shortcuts
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
      // Duplicate Shortcut (Ctrl + D)
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
          e.preventDefault();
          const selected = useCanvasStore.getState().selectedElementIds;
          if (selected.length === 1) {
              useCanvasStore.getState().duplicateElement(selected[0]);
          }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearSelection, setActiveTool]);

  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div 
        className="flex-1 flex flex-col relative bg-muted/30 overflow-hidden" 
        onMouseMove={handleMouseMove}
    >
        {/* Top Ruler (Horizontal) */}
        <div className="absolute top-0 left-6 right-0 h-6 bg-muted border-b z-20 overflow-hidden">
            <Ruler type="horizontal" zoom={zoom} length={canvasWidth} mousePos={mousePos.x} />
        </div>

        {/* Left Ruler (Vertical) */}
        <div className="absolute top-6 bottom-0 left-0 w-6 bg-muted border-r z-20 overflow-hidden">
            <Ruler type="vertical" zoom={zoom} length={canvasHeight} mousePos={mousePos.y} />
        </div>

        {/* Toggle Grid Button (Top-Left Corner) */}
        <div className="absolute top-0 left-0 w-6 h-6 bg-muted z-30 border-r border-b flex items-center justify-center">
            <button 
                onClick={toggleGrid} 
                className={`w-full h-full flex items-center justify-center hover:bg-accent ${showGrid ? 'text-primary' : 'text-muted-foreground'}`}
                title="Toggle Grid"
            >
               <Grid3X3 className="h-3 w-3" />
            </button>
        </div>

        {/* Main Canvas Scroll Area */}
        <ScrollArea className={`flex-1 ${isPanning ? 'cursor-grab active:cursor-grabbing' : ''}`}>
        <div
            ref={containerRef}
            className="flex flex-col items-center p-8 pt-12 pl-12 gap-8 min-h-full"
        >
            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragEnd={handleDragEnd}
            >
            {Array.from({ length: pageCount }).map((_, pageIndex) => (
                <div key={pageIndex} className="relative group">
                {/* Page Number Label */}
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

                {/* Page Canvas Surface */}
                <div
                    id={`page-${pageIndex}`}
                    className={`relative shadow-lg transition-shadow duration-200 ${activePageIndex === pageIndex ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                    style={{
                    width: canvasWidth * zoom,
                    height: canvasHeight * zoom,
                    backgroundColor,
                    backgroundImage: showGrid
                        ? `linear-gradient(to right, rgba(0, 0, 0, 0.15) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(0, 0, 0, 0.15) 1px, transparent 1px)`
                        : undefined,
                    backgroundSize: showGrid ? `${gridSize * zoom}px ${gridSize * zoom}px` : undefined,
                    cursor: activeTool === "text" ? "text" : activeTool === "shape" ? "crosshair" : "default",
                    }}
                    onClick={(e) => handleCanvasClick(e, pageIndex)}
                >
                    {/* Render Elements */}
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

                    {/* Alignment Guides */}
                    {activeId && activePageIndex === pageIndex && (
                       <AlignmentGuides activeId={activeId} activeGuides={activeGuides} zoom={zoom} />
                    )}

                    {/* Selection Box & Floating Toolbar */}
                    {selectedElementIds.length === 1 && 
                    elements.find(el => el.id === selectedElementIds[0])?.pageIndex === pageIndex && (
                        <>
                            <SelectionBox elementId={selectedElementIds[0]} zoom={zoom} />
                            <FloatingToolbar zoom={zoom} />
                        </>
                    )}
                </div>
                </div>
            ))}

            {/* Add Page Button */}
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
        <ScrollBar orientation="horizontal" />
        <ScrollBar orientation="vertical" />
        </ScrollArea>

        {/* Shortcuts Helper */}
        <ShortcutsDialog />
    </div>
  );
}