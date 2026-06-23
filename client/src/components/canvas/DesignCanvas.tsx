import { useCallback, useEffect, useState, useRef } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { CanvasElement } from "./CanvasElement";
import { SelectionBox } from "./SelectionBox";
import { AlignmentGuides } from "./AlignmentGuides";
import { Ruler } from "./Ruler";
import { FloatingToolbar } from "./FloatingToolbar";
import { CanvasRowNavigator } from "./CanvasRowNavigator";
import { ZoomControls } from "./ZoomControls";
import { createTextElement, createShapeElement } from "@/lib/canvas-utils";
import { type ActiveGuides } from "@/lib/alignment-guides";
import { useDroppable } from "@dnd-kit/core";
import { Trash2, Grid3X3, ChevronLeft, ChevronRight, FilePlus, LayoutGrid } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PagePreviewPanel } from "./PagePreviewPanel";

function DroppablePage({ pageIndex, children, style, onClick, activePageIndex }: any) {
  const { setNodeRef, isOver } = useDroppable({
    id: `page-${pageIndex}`,
  });

  return (
    <div
      ref={setNodeRef}
      id={`page-${pageIndex}`}
      className={`relative shadow-lg transition-all duration-200 ${
         activePageIndex === pageIndex ? 'ring-2 ring-primary ring-offset-2 z-10' : 'z-0'
      } ${isOver ? 'ring-2 ring-green-500 ring-offset-2 scale-[1.005]' : ''}`} 
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface DesignCanvasProps {
  activeId?: string | null;
  activeGuides?: ActiveGuides;
}

export function DesignCanvas({
  activeId = null,
  activeGuides = { vertical: null, horizontal: null, alignments: [] }
}: DesignCanvasProps) {
  const [isPanning, setIsPanning] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showPagePreview, setShowPagePreview] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    canvasWidth,
    canvasHeight,
    gridSize,
    backgroundColor,
    zoom,
    showGrid,
    snapToGrid,
    elements,
    selectedElementIds,
    activeTool,
    pageCount,
    activePageIndex,
    selectElement,
    clearSelection,
    addElement,
    setActiveTool,
    addPage,
    removePage,
    setActivePage,
    toggleGrid,
    setRightPanelTab
  } = useCanvasStore();

  useEffect(() => {
    if (selectedElementIds.length > 0) {
      setRightPanelTab("properties");
    }
  }, [selectedElementIds, setRightPanelTab]);

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

  // Global keyboard shortcuts listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // Debug logging to help diagnose focus issues
      console.log('Key pressed:', e.key, 'Target:', target.tagName, target.id || '(no id)');

      // Ignore if user is typing in an input, textarea, or editable element
      // BUT allow if the target is body or the canvas container
      const isCanvasContainer = target.id === 'canvas-main-container';
      const isBody = target.tagName === 'BODY';

      if (
        !isCanvasContainer &&
        !isBody &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      // Get latest state directly from the store to avoid stale closures
      const state = useCanvasStore.getState();
      const selectedIds = state.selectedElementIds;

      // Handle Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          state.deleteSelectedElements();
        }
      }

      // Handle Escape
      if (e.key === 'Escape') {
        state.clearSelection();
        state.setActiveTool('select');
      }

      // Handle Select All (Ctrl/Cmd + A)
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault();
        state.selectAll();
      }

      // Handle Undo/Redo (Ctrl/Cmd + Z)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          state.redo();
        } else {
          state.undo();
        }
      }

      // Handle Duplicate (Ctrl/Cmd + D)
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        if (selectedIds.length === 1) {
          state.duplicateElement(selectedIds[0]);
        }
      }

      // Handle Arrow Movement
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectedIds.length > 0) {
          e.preventDefault();

          const step = e.shiftKey ? 10 : 1; // 10px if Shift held, otherwise 1px

          selectedIds.forEach((id) => {
            const element = state.elements.find((el) => el.id === id);
            if (element && !element.locked) {
              let newX = element.position.x;
              let newY = element.position.y;

              switch (e.key) {
                case 'ArrowUp':
                  newY -= step;
                  break;
                case 'ArrowDown':
                  newY += step;
                  break;
                case 'ArrowLeft':
                  newX -= step;
                  break;
                case 'ArrowRight':
                  newX += step;
                  break;
              }

              state.updateElement(id, { position: { x: newX, y: newY } });
            }
          });
        }
      }

      // Handle Zoom In (Ctrl/Cmd + = or +)
      if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        const newZoom = Math.min(2, state.zoom + 0.25);
        state.setZoom(newZoom);
      }

      // Handle Zoom Out (Ctrl/Cmd + -)
      if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        const newZoom = Math.max(0.25, state.zoom - 0.25);
        state.setZoom(newZoom);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pageElement = document.getElementById('page-0');
    if (pageElement) {
        const rect = pageElement.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;
        setMousePos({ x, y });
    }
  }, [zoom]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent, pageIndex: number) => {
      if (isPanning) return;

      // Focus the canvas container to enable keyboard shortcuts
      containerRef.current?.focus();

      if (activePageIndex !== pageIndex) {
        setActivePage(pageIndex);
      }

      if (e.target === e.currentTarget) {
        const rect = e.currentTarget.getBoundingClientRect();
        const rawX = (e.clientX - rect.left) / zoom;
        const rawY = (e.clientY - rect.top) / zoom;

        // FIXED: Ensure placement respects 5px or 10px increments if snap is ON
        const x = snapToGrid ? Math.round(rawX / gridSize) * gridSize : rawX;
        const y = snapToGrid ? Math.round(rawY / gridSize) * gridSize : rawY;

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
    [activeTool, zoom, addElement, clearSelection, setActiveTool, activePageIndex, setActivePage, isPanning, gridSize, snapToGrid]
  );

  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  const isFirstPage = activePageIndex === 0;
  const isLastPage = activePageIndex === pageCount - 1;

  return (
    <div
        ref={containerRef}
        id="canvas-main-container"
        tabIndex={-1}
        className="flex-1 flex flex-col h-full relative outline-none"
        onMouseMove={handleMouseMove}
    >
        {/* 1. Canvas Area (Takes all remaining space) */}
        <div id="canvas-viewport" className="flex-1 relative overflow-hidden bg-brand-primary">
            {/* Rulers */}
            <div className="absolute top-0 left-6 right-0 h-6 bg-muted border-b z-20 overflow-hidden">
                <Ruler type="horizontal" zoom={zoom} length={canvasWidth} mousePos={mousePos.x} />
            </div>

            <div className="absolute top-6 bottom-0 left-0 w-6 bg-muted border-r z-20 overflow-hidden">
                <Ruler type="vertical" zoom={zoom} length={canvasHeight} mousePos={mousePos.y} />
            </div>

            <div className="absolute top-0 left-0 w-6 h-6 bg-muted z-30 border-r border-b flex items-center justify-center">
                <button
                    onClick={toggleGrid}
                    className={`w-full h-full flex items-center justify-center hover:bg-accent ${showGrid ? 'text-primary' : 'text-muted-foreground'}`}
                    title="Toggle Grid"
                >
                   <Grid3X3 className="h-3 w-3" />
                </button>
            </div>

            {/* Scrollable Canvas Content - Single Page View */}
            <ScrollArea className={`flex-1 h-full ${isPanning ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                <div className="flex flex-col items-center p-8 pt-12 pl-12 min-h-full justify-center">
                    <div className="relative group">
                        <div className="absolute -top-6 left-0 text-xs text-muted-foreground font-medium flex justify-between w-full">
                            <span>Page {activePageIndex + 1} of {pageCount}</span>
                            {pageCount > 1 && (
                            <button
                                onClick={() => removePage(activePageIndex)}
                                className="hover:text-destructive transition-colors"
                                title="Remove Page"
                            >
                                <Trash2 className="h-3 w-3" />
                            </button>
                            )}
                        </div>

                        <DroppablePage
                            pageIndex={activePageIndex}
                            activePageIndex={activePageIndex}
                            onClick={(e: React.MouseEvent) => handleCanvasClick(e, activePageIndex)}
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
                        >
                            {sortedElements
                            .filter(el => (el.pageIndex ?? 0) === activePageIndex)
                            .map((element) => (
                                <CanvasElement
                                    key={element.id}
                                    element={element}
                                    isSelected={selectedElementIds.includes(element.id)}
                                    zoom={zoom}
                                    onSelect={selectElement}
                                />
                            ))}

                            {activeId && (
                               <AlignmentGuides activeId={activeId} activeGuides={activeGuides} zoom={zoom} />
                            )}

                            {selectedElementIds.length === 1 &&
                            elements.find(el => el.id === selectedElementIds[0])?.pageIndex === activePageIndex && (
                                <>
                                    <SelectionBox elementId={selectedElementIds[0]} zoom={zoom} />
                                    <FloatingToolbar zoom={zoom} />
                                </>
                            )}
                        </DroppablePage>
                    </div>
                </div>
                <ScrollBar orientation="horizontal" />
                <ScrollBar orientation="vertical" />
            </ScrollArea>

            {/* Page Navigation - Centered at bottom of canvas area */}
            {pageCount > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white/95 backdrop-blur-sm shadow-lg rounded-full border border-gray-200 px-2 py-1.5">
                    {/* Previous Page Button */}
                    <button
                        onClick={() => setActivePage(activePageIndex - 1)}
                        disabled={isFirstPage}
                        className={`p-1.5 rounded-full transition-all ${
                            isFirstPage
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                        }`}
                        title="Previous Page"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>

                    {/* Page Indicator */}
                    <span className="px-2 text-sm font-medium text-gray-700 min-w-[60px] text-center">
                        {activePageIndex + 1} / {pageCount}
                    </span>

                    {/* Next Page Button */}
                    <button
                        onClick={() => setActivePage(activePageIndex + 1)}
                        disabled={isLastPage}
                        className={`p-1.5 rounded-full transition-all ${
                            isLastPage
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                        }`}
                        title="Next Page"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>

                    {/* Divider */}
                    <div className="w-px h-5 bg-gray-200" />

                    {/* Page Preview Button */}
                    <button
                        onClick={() => setShowPagePreview(true)}
                        className="p-1.5 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-all"
                        title="View All Pages"
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </button>

                    {/* Add Page Button */}
                    <button
                        onClick={addPage}
                        className="p-1.5 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-all"
                        title="Add New Page"
                    >
                        <FilePlus className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Single page - just show Add Page button */}
            {pageCount === 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-white/95 backdrop-blur-sm shadow-lg rounded-full border border-gray-200 px-2 py-1.5">
                    <span className="px-2 text-sm font-medium text-gray-700">Page 1</span>
                    <div className="w-px h-5 bg-gray-200" />
                    <button
                        onClick={addPage}
                        className="p-1.5 rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-800 transition-all flex items-center gap-1"
                        title="Add New Page"
                    >
                        <FilePlus className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Zoom Controls - Stay in Canvas Area */}
            <ZoomControls />
        </div>

        {/* 2. Footer Area (Static height, distinct block) */}
        <div className="h-14 border-t border-white/10 bg-brand-primary-light text-brand-white flex items-center justify-center z-10 flex-shrink-0">
            <CanvasRowNavigator />
        </div>

        {/* Page Preview Panel (Modal overlay) */}
        <PagePreviewPanel
            isOpen={showPagePreview}
            onClose={() => setShowPagePreview(false)}
        />
    </div>
  );
}