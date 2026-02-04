import { useCallback } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus, Check } from "lucide-react";

interface PagePreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PageThumbnailProps {
  pageIndex: number;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

function PageThumbnail({ pageIndex, isActive, onSelect, onDelete, canDelete }: PageThumbnailProps) {
  const {
    canvasWidth,
    canvasHeight,
    backgroundColor,
    elements,
  } = useCanvasStore();

  // Calculate thumbnail dimensions (maintain aspect ratio, max 150px width)
  const maxWidth = 150;
  const scale = maxWidth / canvasWidth;
  const thumbnailWidth = canvasWidth * scale;
  const thumbnailHeight = canvasHeight * scale;

  // Filter elements for this page
  const pageElements = elements.filter(el => (el.pageIndex ?? 0) === pageIndex);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onSelect}
        className={`relative group transition-all duration-200 rounded-lg overflow-hidden ${
          isActive
            ? 'ring-2 ring-primary ring-offset-2 shadow-lg scale-105'
            : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-2 hover:shadow-md'
        }`}
      >
        {/* Thumbnail Canvas */}
        <div
          style={{
            width: thumbnailWidth,
            height: thumbnailHeight,
            backgroundColor,
            position: 'relative',
          }}
          className="shadow-sm border border-gray-200"
        >
          {/* Render simplified element representations */}
          {pageElements.map((element) => {
            const left = element.position.x * scale;
            const top = element.position.y * scale;
            const width = element.dimension.width * scale;
            const height = element.dimension.height * scale;

            // Render different element types
            if (element.type === 'image') {
              return (
                <div
                  key={element.id}
                  style={{
                    position: 'absolute',
                    left,
                    top,
                    width,
                    height,
                    backgroundColor: '#e5e7eb',
                    overflow: 'hidden',
                  }}
                >
                  {element.imageUrl && (
                    <img
                      src={element.imageUrl}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: element.imageFit || 'cover',
                      }}
                    />
                  )}
                </div>
              );
            }

            if (element.type === 'text') {
              return (
                <div
                  key={element.id}
                  style={{
                    position: 'absolute',
                    left,
                    top,
                    width,
                    height,
                    fontSize: Math.max(4, (element.textStyle?.fontSize || 12) * scale),
                    color: element.textStyle?.color || '#000',
                    overflow: 'hidden',
                    lineHeight: 1.2,
                  }}
                  className="truncate"
                >
                  {element.content?.substring(0, 20)}
                </div>
              );
            }

            if (element.type === 'shape') {
              return (
                <div
                  key={element.id}
                  style={{
                    position: 'absolute',
                    left,
                    top,
                    width,
                    height,
                    backgroundColor: element.shapeStyle?.fill || '#3b82f6',
                    borderRadius: element.shapeStyle?.shapeType === 'ellipse' ? '50%' :
                                  element.shapeStyle?.borderRadius ? element.shapeStyle.borderRadius * scale : 0,
                    opacity: element.shapeStyle?.opacity ?? 1,
                  }}
                />
              );
            }

            if (element.type === 'table') {
              return (
                <div
                  key={element.id}
                  style={{
                    position: 'absolute',
                    left,
                    top,
                    width,
                    height,
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #d1d5db',
                  }}
                />
              );
            }

            // Default placeholder for other types
            return (
              <div
                key={element.id}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  width,
                  height,
                  backgroundColor: '#e5e7eb',
                  border: '1px dashed #9ca3af',
                }}
              />
            );
          })}

          {/* Active indicator */}
          {isActive && (
            <div className="absolute top-1 right-1 bg-primary text-white rounded-full p-0.5">
              <Check className="h-3 w-3" />
            </div>
          )}
        </div>

        {/* Delete button (visible on hover) */}
        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute top-1 left-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
            title="Delete page"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </button>

      {/* Page number label */}
      <span className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
        Page {pageIndex + 1}
      </span>
    </div>
  );
}

export function PagePreviewPanel({ isOpen, onClose }: PagePreviewPanelProps) {
  const {
    pageCount,
    activePageIndex,
    setActivePage,
    addPage,
    removePage,
  } = useCanvasStore();

  const handlePageSelect = useCallback((pageIndex: number) => {
    setActivePage(pageIndex);
    onClose();
  }, [setActivePage, onClose]);

  const handleAddPage = useCallback(() => {
    addPage();
  }, [addPage]);

  const handleDeletePage = useCallback((pageIndex: number) => {
    removePage(pageIndex);
  }, [removePage]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Page Overview</DialogTitle>
          <DialogDescription>
            Click on a page to navigate to it. You can also add or remove pages from here.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 p-4">
            {Array.from({ length: pageCount }).map((_, pageIndex) => (
              <PageThumbnail
                key={pageIndex}
                pageIndex={pageIndex}
                isActive={pageIndex === activePageIndex}
                onSelect={() => handlePageSelect(pageIndex)}
                onDelete={() => handleDeletePage(pageIndex)}
                canDelete={pageCount > 1}
              />
            ))}

            {/* Add Page Card */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleAddPage}
                className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-primary hover:bg-primary/5 transition-all"
                style={{
                  width: 150,
                  height: 150 * (1050 / 810), // Use default aspect ratio
                }}
              >
                <div className="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                  <Plus className="h-8 w-8" />
                  <span className="text-sm font-medium">Add Page</span>
                </div>
              </button>
              <span className="text-sm font-medium text-transparent">New</span>
            </div>
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-sm text-muted-foreground">
            {pageCount} page{pageCount !== 1 ? 's' : ''} total
          </span>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
