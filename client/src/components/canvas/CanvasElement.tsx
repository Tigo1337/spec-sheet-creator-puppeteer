import { useDraggable } from "@dnd-kit/core";
import type { CanvasElement as CanvasElementType } from "@shared/schema";
import { useCanvasStore } from "@/stores/canvas-store";
import { Database } from "lucide-react";

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
  const { excelData, selectedRowIndex } = useCanvasStore();
  
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
        return (
          <div
            className="w-full h-full flex items-center overflow-hidden"
            style={{
              fontFamily: element.textStyle?.fontFamily || "Inter",
              fontSize: (element.textStyle?.fontSize || 16) * zoom,
              fontWeight: element.textStyle?.fontWeight || 400,
              color: element.textStyle?.color || "#000000",
              textAlign: element.textStyle?.textAlign || "left",
              lineHeight: element.textStyle?.lineHeight || 1.5,
              letterSpacing: element.textStyle?.letterSpacing || 0,
              padding: 4 * zoom,
            }}
          >
            {element.content || "Text"}
          </div>
        );

      case "dataField":
        return (
          <div
            className="w-full h-full flex items-center gap-1 px-2 rounded border-2 border-dashed"
            style={{
              fontFamily: element.textStyle?.fontFamily || "JetBrains Mono",
              fontSize: (element.textStyle?.fontSize || 14) * zoom,
              fontWeight: element.textStyle?.fontWeight || 500,
              color: element.textStyle?.color || "#3b82f6",
              backgroundColor: "hsl(217 91% 60% / 0.08)",
              borderColor: "hsl(217 91% 60% / 0.4)",
              lineHeight: element.textStyle?.lineHeight || 1.4,
            }}
          >
            <Database className="w-3 h-3 opacity-60 flex-shrink-0" style={{ width: 12 * zoom, height: 12 * zoom }} />
            <span className="truncate">{getDisplayContent()}</span>
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
        if (element.imageSrc) {
          return (
            <img
              src={element.imageSrc}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
            />
          );
        }
        return (
          <div className="w-full h-full bg-muted/50 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
            <span className="text-muted-foreground text-xs" style={{ fontSize: 12 * zoom }}>
              No image
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
      className={`absolute transition-shadow duration-100 ${
        isSelected
          ? "ring-2 ring-primary ring-offset-1"
          : "hover:ring-1 hover:ring-primary/50"
      }`}
      style={style}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {renderContent()}
    </div>
  );
}
