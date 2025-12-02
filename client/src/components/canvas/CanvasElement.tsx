import { useDraggable } from "@dnd-kit/core";
import type { CanvasElement as CanvasElementType } from "@shared/schema";
import { useCanvasStore } from "@/stores/canvas-store";
import { useEffect, useState } from "react";
// REMOVED: Database icon import
import { isHtmlContent } from "@/lib/canvas-utils";

interface CanvasElementProps {
  element: CanvasElementType;
  isSelected: boolean;
  zoom: number;
  onSelect: (id: string, addToSelection?: boolean) => void;
}

export function CanvasElement({
  element,
  isSelected,
  zoom,
  onSelect,
}: CanvasElementProps) {
  const { excelData, selectedRowIndex, updateElement } = useCanvasStore();
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: element.id,
    disabled: element.locked,
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(element.id, e.shiftKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // For text elements, enable inline editing
    if (element.type === "text" || element.type === "dataField") {
      const { updateElement } = useCanvasStore.getState();
      const newContent = prompt("Edit text:", element.content || "");
      if (newContent !== null) {
        updateElement(element.id, { content: newContent });
      }
    }
  };

  // Get display content (resolve data bindings)
  const getDisplayContent = () => {
    if (element.dataBinding && excelData && excelData.rows[selectedRowIndex]) {
      const value = excelData.rows[selectedRowIndex][element.dataBinding];
      return value || `{{${element.dataBinding}}}`;
    }
    return element.content || "";
  };

  // Resolve image URL from data binding
  const getImageUrl = () => {
    if (element.type === "image") {
      if (element.dataBinding && excelData && excelData.rows[selectedRowIndex]) {
        return excelData.rows[selectedRowIndex][element.dataBinding] || element.imageSrc || null;
      }
      return element.imageSrc || null;
    }
    return null;
  };

  // Load image dimensions and update element with aspect ratio
  useEffect(() => {
    const url = getImageUrl();
    if (url && url !== imageUrl) {
      setImageUrl(url);
      const img = new Image();
      img.onload = () => {
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        setImageDimensions({ width: naturalWidth, height: naturalHeight });

        // Auto-adjust height to maintain aspect ratio
        const aspectRatio = naturalWidth / naturalHeight;
        const newHeight = Math.round(element.dimension.width / aspectRatio);
        updateElement(element.id, {
          dimension: { width: element.dimension.width, height: newHeight }
        });
      };
      img.onerror = () => {
        setImageDimensions(null);
      };
      img.crossOrigin = "anonymous";
      img.src = url;
    }
  }, [element.dataBinding, selectedRowIndex, element.type, excelData, element.id, element.dimension.width, imageUrl, updateElement]);

  const style: React.CSSProperties = {
    position: "absolute",
    left: element.position.x * zoom,
    top: element.position.y * zoom,
    width: element.dimension.width * zoom,
    height: element.dimension.height * zoom,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    opacity: isDragging ? 0.7 : element.visible ? 1 : 0.3,
    cursor: element.locked ? "not-allowed" : "move",
    userSelect: "none",
    zIndex: element.zIndex,
  };

  const renderContent = () => {
    switch (element.type) {
      case "text":
        const verticalAlignMap = {
          top: "flex-start",
          middle: "center",
          bottom: "flex-end",
        };
        return (
          <div
            className="w-full h-full overflow-hidden"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: verticalAlignMap[element.textStyle?.verticalAlign || "middle"] as any,
              fontFamily: element.textStyle?.fontFamily || "Inter",
              fontSize: (element.textStyle?.fontSize || 16) * zoom,
              fontWeight: element.textStyle?.fontWeight || 400,
              color: element.textStyle?.color || "#000000",
              textAlign: element.textStyle?.textAlign || "left",
              lineHeight: element.textStyle?.lineHeight || 1.5,
              letterSpacing: `${element.textStyle?.letterSpacing || 0}px`,
              padding: 4 * zoom,
            }}
          >
            {element.content || "Text"}
          </div>
        );

      case "dataField":
        const dataFieldVerticalAlignMap = {
          top: "flex-start",
          middle: "center",
          bottom: "flex-end",
        };
        const displayContent = getDisplayContent();
        const hasHtml = isHtmlContent(displayContent);
        return (
          <div
            className="w-full h-full rounded border-2 border-dashed overflow-hidden"
            style={{
              display: "flex",
              alignItems: dataFieldVerticalAlignMap[element.textStyle?.verticalAlign || "middle"] as any,
              justifyContent: element.textStyle?.textAlign === "center" ? "center" : element.textStyle?.textAlign === "right" ? "flex-end" : "flex-start",
              // UPDATED: Removed paddingLeft: 8 * zoom and gap that was accommodating the icon
              padding: 4 * zoom, 
              fontFamily: element.textStyle?.fontFamily || "JetBrains Mono",
              fontSize: (element.textStyle?.fontSize || 14) * zoom,
              fontWeight: element.textStyle?.fontWeight || 500,
              color: element.textStyle?.color || "#000000",
              backgroundColor: "transparent",
              // UPDATED: Changed border color to Violet (#8b5cf6) to distinguish Data Fields
              borderColor: "#8b5cf6", 
              lineHeight: element.textStyle?.lineHeight || 1.4,
              letterSpacing: `${element.textStyle?.letterSpacing || 0}px`,
            }}
          >
            {/* REMOVED: Database icon */}

            {hasHtml ? (
              <div
                style={{
                  flex: 1,
                  overflow: "auto",
                  fontSize: (element.textStyle?.fontSize || 14) * zoom,
                  lineHeight: element.textStyle?.lineHeight || 1.4,
                  display: "block",
                }}
              >
                <style>{`
                  ul { list-style-type: disc !important; margin: 0 !important; padding-left: 1.2em !important; display: block !important; }
                  li { margin: 0.2em 0 !important; display: list-item !important; }
                  ol { list-style-type: decimal !important; margin: 0 !important; padding-left: 1.2em !important; display: block !important; }
                  strong, b { font-weight: bold; }
                  em, i { font-style: italic; }
                  p { margin: 0.2em 0; display: block !important; }
                `}</style>
                <div style={{ display: "block" }} dangerouslySetInnerHTML={{ __html: displayContent }} />
              </div>
            ) : (
              <span className="truncate">{displayContent}</span>
            )}
          </div>
        );

      case "shape":
        const shapeStyle: React.CSSProperties = {
          backgroundColor: element.shapeStyle?.fill || "#e5e7eb",
          border: `${(element.shapeStyle?.strokeWidth || 1) * zoom}px solid ${element.shapeStyle?.stroke || "#9ca3af"}`,
          borderRadius:
            element.shapeType === "circle"
              ? "50%"
              : (element.shapeStyle?.borderRadius || 0) * zoom,
          opacity: element.shapeStyle?.opacity || 1,
        };

        if (element.shapeType === "line") {
          return (
            <div
              className="w-full h-full flex items-center justify-center"
            >
              <div
                className="w-full"
                style={{
                  height: (element.shapeStyle?.strokeWidth || 1) * zoom,
                  backgroundColor: element.shapeStyle?.stroke || "#9ca3af",
                }}
              />
            </div>
          );
        }

        return <div className="w-full h-full" style={shapeStyle} />;

      case "image":
        const displayImageUrl = getImageUrl();
        if (displayImageUrl) {
          return (
            <img
              src={displayImageUrl}
              alt=""
              className="w-full h-full object-contain"
              draggable={false}
              style={{ objectPosition: "center" }}
            />
          );
        }
        return (
          <div className="w-full h-full bg-muted/50 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
            <span className="text-muted-foreground text-xs" style={{ fontSize: 12 * zoom }}>
              {element.dataBinding ? `No image for ${element.dataBinding}` : "No image"}
            </span>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-testid={`canvas-element-${element.id}`}
      className={`absolute transition-shadow duration-100`}
      style={{
        ...style,
        ...(isSelected && {
          // Blue (#3b82f6) signifies "active state"
          outline: "2px solid #3b82f6", 
          outlineOffset: "2px", 
          backgroundColor: "transparent",
        }),
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {renderContent()}
    </div>
  );
}