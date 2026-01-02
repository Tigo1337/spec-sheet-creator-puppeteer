import { useState, useRef, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { LeftPanel } from "@/components/panels/LeftPanel";
import { RightPanel } from "@/components/panels/RightPanel";
import { DesignCanvas } from "@/components/canvas/DesignCanvas";
import { CatalogNavigator } from "@/components/canvas/CatalogNavigator";
import { useCanvasStore } from "@/stores/canvas-store";
import { 
  DndContext, 
  DragOverlay, 
  useSensor, 
  useSensors, 
  PointerSensor, 
  DragStartEvent, 
  DragMoveEvent, 
  DragEndEvent 
} from "@dnd-kit/core";
import { createDataFieldElement, createImageFieldElement, snapToGrid } from "@/lib/canvas-utils";
import { detectAlignmentGuides, type ActiveGuides } from "@/lib/alignment-guides";
import { Database, Sparkles, GripVertical } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

export default function Editor() {
  const { 
    isCatalogMode, 
    addElement, 
    moveElement, 
    elements, 
    zoom, 
    snapToGrid: shouldSnap, 
    canvasWidth, 
    canvasHeight,
    selectElement,
    updateElement,
    setActivePage,
    imageFieldNames,
    aiFieldNames,
    // Auto-Save Dependencies
    currentDesignId,
    hasUnsavedChanges,
    backgroundColor,
    pageCount,
    catalogSections,
    chapterDesigns,
    activeSectionType,
    activeChapterGroup,
    setSaveStatus
  } = useCanvasStore();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<"sidebar" | "canvas" | null>(null);
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

  // --- AUTO SAVE LOGIC ---
  const updateDesignMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/designs/${currentDesignId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Auto-save failed");
      return res.json();
    },
    onSuccess: () => {
      setSaveStatus("saved");
    },
    onError: () => {
      setSaveStatus("error");
    }
  });

  useEffect(() => {
    if (!currentDesignId || !hasUnsavedChanges) return;

    setSaveStatus("saving");

    const timer = setTimeout(() => {
        let payload: any = {
            canvasWidth,
            canvasHeight,
            pageCount,
            backgroundColor,
        };

        if (isCatalogMode) {
            // Reconstruct catalog structure
            const finalSections = { ...catalogSections };
            const finalChapterDesigns = { ...chapterDesigns };

            if (activeSectionType === 'chapter' && activeChapterGroup) {
                finalChapterDesigns[activeChapterGroup] = { elements, backgroundColor };
            } else {
                finalSections[activeSectionType] = {
                    ...finalSections[activeSectionType],
                    elements,
                    backgroundColor
                };
            }

            payload.type = "catalog";
            payload.catalogData = {
                sections: finalSections,
                chapterDesigns: finalChapterDesigns,
                excelData: useCanvasStore.getState().excelData // Include data for reload
            };
            payload.elements = []; // Catalog stores elements inside sections
        } else {
            payload.type = "single";
            payload.elements = elements;
            // Also save excel data for single docs to allow reload
            payload.catalogData = { excelData: useCanvasStore.getState().excelData };
        }

        updateDesignMutation.mutate(payload);

    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [
    elements, 
    canvasWidth, 
    canvasHeight, 
    backgroundColor, 
    pageCount, 
    currentDesignId, 
    hasUnsavedChanges,
    // Add catalog dependencies to ensure latest state is captured
    isCatalogMode,
    activeSectionType,
    activeChapterGroup,
    catalogSections,
    chapterDesigns
  ]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const id = active.id as string;
    setActiveId(id);

    // Case 1: Dragging from Sidebar (New Field)
    if (active.data.current?.header) {
      setDragType("sidebar");
      return;
    }

    // Case 2: Dragging existing Canvas Element
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

    // Only handle snapping/guides for existing elements
    if (dragType === "canvas") {
      const element = elements.find((el) => el.id === active.id);
      if (!element) return;

      let newX = startPosRef.current.x + delta.x / zoom;
      let newY = startPosRef.current.y + delta.y / zoom;

      if (shouldSnap) {
        newX = snapToGrid(newX);
        newY = snapToGrid(newY);
      }

      // Constrain to canvas
      newX = Math.max(0, Math.min(newX, canvasWidth - element.dimension.width));
      newY = Math.max(0, Math.min(newY, canvasHeight - element.dimension.height));

      // Guides
      const pageElements = elements.filter((el) => el.id !== active.id && el.pageIndex === element.pageIndex);
      const tempElement = { ...element, position: { x: newX, y: newY } };
      const guides = detectAlignmentGuides(tempElement, pageElements, zoom);
      setActiveGuides(guides);

      moveElement(active.id as string, newX, newY);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Handle Drop from Sidebar
    if (dragType === "sidebar" && over && over.id.toString().startsWith("page-")) {
      const header = active.data.current?.header;
      if (header) {
        // Calculate Drop Coordinates
        const pageIndex = parseInt(over.id.toString().split("-")[1], 10);
        const pageElement = document.getElementById(over.id as string);

        if (pageElement) {
          const rect = pageElement.getBoundingClientRect();
          // Use the drag event's absolute coordinates to map to canvas space
          // @ts-ignore - dnd-kit types can be strict, but current.translated exists on dragEnd
          const dropRect = active.rect.current.translated; 

          if (dropRect) {
            const x = (dropRect.left - rect.left) / zoom;
            const y = (dropRect.top - rect.top) / zoom;

            // Determine Field Type logic (Image vs Data)
            const isManuallyMarked = imageFieldNames.has(header);
            const isAutoDetected = /image|photo|picture|url|thumbnail|img|avatar|logo/i.test(header);
            const isImageColumn = isManuallyMarked || isAutoDetected;

            const newElement = isImageColumn 
              ? createImageFieldElement(x, y, header)
              : createDataFieldElement(x, y, header);

            addElement({ ...newElement, pageIndex });
            toast({ title: "Field Added", description: `Added "${header}" to Page ${pageIndex + 1}` });
          }
        }
      }
    } 
    // Handle Drop for Moving Elements (Page Switching)
    else if (dragType === "canvas" && over && over.id.toString().startsWith("page-")) {
      const targetPageIndex = parseInt(over.id.toString().split("-")[1], 10);
      const element = elements.find(el => el.id === active.id);
      if (element && element.pageIndex !== targetPageIndex) {
        updateElement(active.id as string, { pageIndex: targetPageIndex });
      }
    }

    // Reset State
    setActiveId(null);
    setDragType(null);
    setActiveGuides({ vertical: null, horizontal: null, alignments: [] });
  };

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <DndContext 
        sensors={sensors} 
        onDragStart={handleDragStart} 
        onDragMove={handleDragMove} 
        onDragEnd={handleDragEnd}
      >
        <Header />
        {isCatalogMode && <CatalogNavigator />}
        <div className="flex-1 flex overflow-hidden">
          <LeftPanel />

          {/* Pass guides down to visualizer */}
          <DesignCanvas 
            activeId={activeId} 
            activeGuides={activeGuides} 
          />

          <RightPanel />
        </div>

        {/* Global Drag Overlay for smooth visuals */}
        <DragOverlay dropAnimation={null} zIndex={1000}>
          {activeId && dragType === "sidebar" ? (
             <div className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm shadow-xl cursor-grabbing border-2 ${
                 aiFieldNames.has(activeId.replace("header-", "")) 
                   ? "bg-purple-100 text-purple-900 border-purple-500" 
                   : "bg-white text-primary border-primary"
             }`}>
                <GripVertical className="h-4 w-4 opacity-50" />
                {aiFieldNames.has(activeId.replace("header-", "")) ? <Sparkles className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                <span className="font-semibold">{activeId.replace("header-", "")}</span>
             </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}