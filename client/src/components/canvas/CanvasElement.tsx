import { useDraggable } from "@dnd-kit/core";
import type { CanvasElement as CanvasElementType } from "@shared/schema";
import { useCanvasStore } from "@/stores/canvas-store";
import { useEffect, useState } from "react";
import { isHtmlContent } from "@/lib/canvas-utils";
import { formatContent } from "@/lib/formatter";
import { AlertTriangle } from "lucide-react";

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

  // Quality Check States
  const [isLowQuality, setIsLowQuality] = useState(false);
  const [effectiveDpi, setEffectiveDpi] = useState(0);

  // Generate a safe unique ID for CSS scoping
  const elementScopeId = `el-${element.id}`;

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
    if (element.type === "text" || element.type === "dataField") {
      const { updateElement } = useCanvasStore.getState();
      const newContent = prompt("Edit text:", element.content || "");
      if (newContent !== null) {
        updateElement(element.id, { content: newContent });
      }
    }
  };

  const getDisplayContent = () => {
    // 1. Use content as base, fallback to dataBinding pattern if empty
    let content = element.content || (element.dataBinding ? `{{${element.dataBinding}}}` : "");

    // 2. Handle Text Interpolation (Replace {{Variables}} with data)
    if (excelData && excelData.rows[selectedRowIndex]) {
        const row = excelData.rows[selectedRowIndex];
        content = content.replace(/{{(.*?)}}/g, (match, p1) => {
            const fieldName = p1.trim();
            // Only replace if we have data for this field
            return row[fieldName] !== undefined ? row[fieldName] : match; 
        });
    }

    return content;
  };

  const getImageUrl = () => {
    if (element.type === "image") {
      if (element.dataBinding && excelData && excelData.rows[selectedRowIndex]) {
        return excelData.rows[selectedRowIndex][element.dataBinding] || element.imageSrc || null;
      }
      return element.imageSrc || null;
    }
    return null;
  };

  // Update image dimensions when URL changes
  useEffect(() => {
    const url = getImageUrl();
    if (url && url !== imageUrl) {
      setImageUrl(url);
      const img = new Image();
      img.onload = () => {
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        setImageDimensions({ width: naturalWidth, height: naturalHeight });

        // Only resize static images automatically
        if (!element.dataBinding) { 
             const aspectRatio = naturalWidth / naturalHeight;
             const newHeight = Math.round(element.dimension.width / aspectRatio);
             updateElement(element.id, {
                dimension: { width: element.dimension.width, height: newHeight }
             });
        }
      };
      img.onerror = () => {
        setImageDimensions(null);
      };
      img.crossOrigin = "anonymous";
      img.src = url;
    }
  }, [element.dataBinding, selectedRowIndex, element.type, excelData, element.id, element.dimension.width, imageUrl, updateElement]);

  // Calculate Effective DPI
  useEffect(() => {
    if (imageDimensions && element.dimension.width > 0) {
      const dpi = (imageDimensions.width / element.dimension.width) * 96;
      setEffectiveDpi(Math.round(dpi));
      setIsLowQuality(dpi < 295);
    } else {
      setIsLowQuality(false);
      setEffectiveDpi(0);
    }
  }, [imageDimensions, element.dimension.width]);

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
    const listStyleType = element.format?.listStyle && element.format.listStyle !== 'none' 
      ? element.format.listStyle 
      : 'none';

    switch (element.type) {
      case "text":
      case "dataField":
        const isDataField = element.type === "dataField";
        const verticalAlignMap = {
          top: "flex-start",
          middle: "center",
          bottom: "flex-end",
        };
        const rawTextContent = getDisplayContent();
        const displayContent = formatContent(rawTextContent, element.format);
        const hasHtml = isHtmlContent(displayContent);

        return (
          <div
            id={elementScopeId} // Unique ID for CSS scoping
            // CONDITIONAL CLASS: Add border and rounded corners if it's a dataField
            className={`w-full h-full overflow-hidden canvas-element-content ${isDataField ? "rounded-md border-2 border-dashed" : ""}`}
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: verticalAlignMap[element.textStyle?.verticalAlign || "middle"] as any,
              // FONT: Default to JetBrains Mono for dataFields, Inter for Text
              fontFamily: element.textStyle?.fontFamily || (isDataField ? "JetBrains Mono" : "Inter"),
              fontSize: (element.textStyle?.fontSize || (isDataField ? 14 : 16)) * zoom,
              fontWeight: element.textStyle?.fontWeight || (isDataField ? 500 : 400),
              color: element.textStyle?.color || "#000000",
              textAlign: element.textStyle?.textAlign || "left",
              lineHeight: element.textStyle?.lineHeight || (isDataField ? 1.4 : 1.5),
              letterSpacing: `${element.textStyle?.letterSpacing || 0}px`,
              padding: 4 * zoom,
              // COLORS: Restore Purple styling for Data Fields
              borderColor: isDataField ? "#8b5cf6" : "transparent",
              backgroundColor: isDataField ? "transparent" : "rgba(139, 92, 246, 0.05)",
              whiteSpace: hasHtml ? "normal" : "pre-wrap", 
            }}
          >
            {hasHtml ? (
               <div
                  style={{
                    width: "100%",
                  }}
               >
                 {/* SCOPED CSS: Only affects this element ID */}
                 <style>{`
                  #${elementScopeId} ul, #${elementScopeId} ol { 
                    list-style-type: ${listStyleType} !important; 
                    margin: 0 !important; 
                    padding-left: ${listStyleType === 'none' ? '0' : '1.5em'} !important; 
                    display: block !important; 
                  }
                  #${elementScopeId} li { 
                    position: relative !important;
                    margin: 0.2em 0 !important; 
                    display: list-item !important;
                    text-align: left !important;
                  }
                  #${elementScopeId} p { margin: 0.2em 0; display: block !important; }
                `}</style>
                <div dangerouslySetInnerHTML={{ __html: displayContent }} />
               </div>
            ) : (
              displayContent
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
          const neededWidth = Math.ceil(element.dimension.width * 3.125);
          const neededHeight = Math.ceil(element.dimension.height * 3.125);
          const tooltipText = `Quality: ${effectiveDpi} DPI\nFor 300 DPI print quality at this size, use an image at least ${neededWidth} x ${neededHeight} pixels.`;

          return (
            <div className="relative w-full h-full">
              <img
                src={displayImageUrl}
                alt=""
                crossOrigin="anonymous"
                className="w-full h-full object-contain"
                draggable={false}
                style={{ objectPosition: "center" }}
              />
               {isLowQuality && !element.locked && (
                <div 
                  className="absolute top-0 right-0 m-1 bg-yellow-500 text-white p-1 rounded-sm shadow-md z-50 flex items-center gap-1 cursor-help"
                  title={tooltipText}
                >
                  <AlertTriangle size={14} />
                </div>
              )}
            </div>
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
      className={`absolute transition-shadow duration-100 canvas-element-wrapper`}
      style={{
        ...style,
        ...(isSelected && {
          outline: "2px solid #3b82f6", 
          outlineOffset: "0px",
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