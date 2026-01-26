/**
 * Main Editor page component
 * Provides the canvas editing interface with panels and drag-and-drop support
 */

import { useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { LeftPanel } from "@/components/panels/LeftPanel";
import { RightPanel } from "@/components/panels/RightPanel";
import { DesignCanvas } from "@/components/canvas/DesignCanvas";
import { CatalogNavigator } from "@/components/canvas/CatalogNavigator";
import { useCanvasStore } from "@/stores/canvas-store";
import { DndContext, DragOverlay } from "@dnd-kit/core";
import { useCanvasDragDrop } from "@/hooks/useCanvasDragDrop";
import { Database, Sparkles, GripVertical } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function Editor() {
  const queryClient = useQueryClient();

  // Canvas store state for auto-save
  const {
    isCatalogMode,
    elements,
    canvasWidth,
    canvasHeight,
    backgroundColor,
    pageCount,
    catalogSections,
    chapterDesigns,
    activeSectionType,
    activeChapterGroup,
    currentDesignId,
    hasUnsavedChanges,
    aiFieldNames,
    setSaveStatus
  } = useCanvasStore();

  // Drag and drop hook
  const {
    activeId,
    dragType,
    activeGuides,
    sensors,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  } = useCanvasDragDrop();

  // Auto-save mutation
  const updateDesignMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/designs"] });
    },
    onError: () => {
      setSaveStatus("error");
    }
  });

  // Auto-save effect
  useEffect(() => {
    if (!currentDesignId || !hasUnsavedChanges) return;

    setSaveStatus("saving");

    const timer = setTimeout(() => {
      const payload: Record<string, unknown> = {
        canvasWidth,
        canvasHeight,
        pageCount,
        backgroundColor,
      };

      if (isCatalogMode) {
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
        };
        payload.elements = [];
      } else {
        payload.type = "single";
        payload.elements = elements;
        payload.catalogData = {};
      }

      updateDesignMutation.mutate(payload);
    }, 2000);

    return () => clearTimeout(timer);
  }, [
    elements, canvasWidth, canvasHeight, backgroundColor, pageCount,
    currentDesignId, hasUnsavedChanges, isCatalogMode, activeSectionType,
    activeChapterGroup, catalogSections, chapterDesigns
  ]);

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
          <DesignCanvas activeId={activeId} activeGuides={activeGuides} />
          <RightPanel />
        </div>
        <DragOverlay dropAnimation={null} zIndex={1000}>
          {activeId && dragType === "sidebar" ? (
            <div className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm shadow-xl cursor-grabbing border-2 ${
              aiFieldNames.has(activeId.replace("header-", ""))
                ? "bg-purple-100 text-purple-900 border-purple-500"
                : "bg-white text-primary border-primary"
            }`}>
              <GripVertical className="h-4 w-4 opacity-50" />
              {aiFieldNames.has(activeId.replace("header-", ""))
                ? <Sparkles className="h-4 w-4" />
                : <Database className="h-4 w-4" />
              }
              <span className="font-semibold">{activeId.replace("header-", "")}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
