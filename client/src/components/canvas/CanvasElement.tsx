import { useDraggable } from "@dnd-kit/core";
import type { CanvasElement as CanvasElementType } from "@shared/schema";
import { useCanvasStore } from "@/stores/canvas-store";
import { useEffect, useState } from "react";
import { isHtmlContent } from "@/lib/canvas-utils";
import { formatContent } from "@/lib/formatter";
import { AlertTriangle, List } from "lucide-react";
import QRCode from "qrcode";

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
  const { excelData, selectedRowIndex, updateElement, canvasWidth, canvasHeight } = useCanvasStore();
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // QR Code State
  const [qrSvg, setQrSvg] = useState<string>("");

  // Quality Check States
  const [isLowQuality, setIsLowQuality] = useState(false);
  const [effectiveDpi, setEffectiveDpi] = useState(0);

  // Generate a safe unique ID for CSS scoping
  const elementScopeId = `el-${element.id}`;

  // Check if this is a TOC element
  const isToc = element.type === "toc-list";

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: element.id,
    disabled: element.locked || isToc, // Disable dragging for TOC
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
    let content = element.content || (element.dataBinding ? `{{${element.dataBinding}}}` : "");

    if (excelData && excelData.rows[selectedRowIndex]) {
        const row = excelData.rows[selectedRowIndex];
        content = content.replace(/{{(.*?)}}/g, (match, p1) => {
            const fieldName = p1.trim();
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
    if (element.type !== "image") return;

    const url = getImageUrl();
    if (url && url !== imageUrl) {
      setImageUrl(url);
      const img = new Image();
      img.onload = () => {
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        setImageDimensions({ width: naturalWidth, height: naturalHeight });

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

  // QR Code Generation Effect
  useEffect(() => {
    if (element.type === "qrcode") { 
       const content = getDisplayContent();
       if (content) {
         QRCode.toString(content, {
           type: 'svg',
           errorCorrectionLevel: 'H',
           margin: 1,
           color: {
             dark: element.textStyle?.color || '#000000',
             light: '#00000000' 
           }
         }).then(svg => setQrSvg(svg))
           .catch(err => console.error("QR Gen Error", err));
       }
    }
  }, [element.content, element.type, element.dataBinding, excelData, selectedRowIndex, element.textStyle?.color]);

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

  // Style Construction - Override position/size for TOC
  const style: React.CSSProperties = {
    position: "absolute",
    // Force TOC to top-left and full canvas size
    left: (isToc ? 0 : element.position.x) * zoom,
    top: (isToc ? 0 : element.position.y) * zoom,
    width: (isToc ? canvasWidth : element.dimension.width) * zoom,
    height: (isToc ? canvasHeight : element.dimension.height) * zoom,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    opacity: isDragging ? 0.7 : element.visible ? 1 : 0.3,
    // Disable move cursor for TOC
    cursor: (element.locked || isToc) ? "default" : "move",
    userSelect: "none",
    zIndex: element.zIndex,
  };

  const renderContent = () => {
    const listStyleProp = element.format?.listStyle;
    const hasCustomListStyle = listStyleProp && listStyleProp !== 'none';

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
            id={elementScopeId}
            className={`w-full h-full overflow-hidden canvas-element-content ${isDataField ? "rounded-md border-2 border-dashed" : ""}`}
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: verticalAlignMap[element.textStyle?.verticalAlign || "middle"] as any,
              fontFamily: element.textStyle?.fontFamily || (isDataField ? "JetBrains Mono" : "Inter"),
              fontSize: (element.textStyle?.fontSize || (isDataField ? 14 : 16)) * zoom,
              fontWeight: element.textStyle?.fontWeight || (isDataField ? 500 : 400),
              color: element.textStyle?.color || "#000000",
              textAlign: element.textStyle?.textAlign || "left",
              lineHeight: element.textStyle?.lineHeight || (isDataField ? 1.4 : 1.5),
              letterSpacing: `${element.textStyle?.letterSpacing || 0}px`,
              padding: 4 * zoom,
              borderColor: isDataField ? "#8b5cf6" : "transparent",
              backgroundColor: isDataField ? "transparent" : "rgba(139, 92, 246, 0.05)",
              whiteSpace: hasHtml ? "normal" : "pre-wrap", 
            }}
          >
            {hasHtml ? (
               <div style={{ width: "100%" }}>
                 <style>{`
                  #${elementScopeId} ul { list-style-type: ${hasCustomListStyle ? listStyleProp : 'disc'} !important; }
                  #${elementScopeId} ol { list-style-type: ${hasCustomListStyle ? listStyleProp : 'decimal'} !important; }
                  #${elementScopeId} ul, #${elementScopeId} ol { margin: 0 !important; padding-left: 1.5em !important; display: block !important; }
                  #${elementScopeId} li { position: relative !important; margin: 0.2em 0 !important; display: list-item !important; text-align: left !important; }
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
          borderRadius: element.shapeType === "circle" ? "50%" : (element.shapeStyle?.borderRadius || 0) * zoom,
          opacity: element.shapeStyle?.opacity || 1,
        };

        if (element.shapeType === "line") {
          return (
            <div className="w-full h-full flex items-center justify-center">
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
            <div 
              className="relative w-full h-full" 
              style={{ opacity: element.shapeStyle?.opacity ?? 1 }}
            >
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

      case "qrcode": 
        return (
          <div 
            className="w-full h-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
        );

      // --- TOC RENDERER ---
      case "toc-list":
        const settings = element.tocSettings || { title: "Table of Contents", showTitle: true };
        const groupBy = settings.groupByField;

        let renderedItems = [];
        if (excelData && element.dataBinding) {
            // FIXED: Removed the slice logic so it renders everything in the editor
            const rows = excelData.rows; 

            if (groupBy) {
                // Grouping Logic
                const groups: Record<string, any[]> = {};
                rows.forEach((row, i) => {
                    const groupKey = row[groupBy] || "Uncategorized";
                    if (!groups[groupKey]) groups[groupKey] = [];
                    groups[groupKey].push({ title: row[element.dataBinding!] || `Item ${i+1}`, page: i + 1 });
                });

                Object.keys(groups).forEach(groupTitle => {
                    renderedItems.push({ type: "header", text: groupTitle });
                    groups[groupTitle].forEach(item => renderedItems.push({ type: "item", ...item }));
                });
            } else {
                // Flat list
                renderedItems = rows.map((row, i) => ({ type: "item", title: row[element.dataBinding!] || `Item ${i+1}`, page: i + 1 }));
            }
        } else {
            // Placeholder Data
            if (groupBy) renderedItems.push({ type: "header", text: "Electronics" });
            renderedItems.push({ type: "item", title: "Smartphone X1", page: 1 });
            renderedItems.push({ type: "item", title: "Laptop Pro", page: 2 });
            if (groupBy) renderedItems.push({ type: "header", text: "Furniture" });
            renderedItems.push({ type: "item", title: "Office Chair", page: 3 });
        }

        return (
          <div className="w-full h-full p-8 bg-white flex flex-col overflow-hidden">
            {/* Title */}
            {settings.showTitle && (
                <div style={{
                    fontFamily: settings.titleStyle?.fontFamily,
                    fontSize: (settings.titleStyle?.fontSize || 24) * zoom,
                    fontWeight: settings.titleStyle?.fontWeight,
                    textAlign: settings.titleStyle?.textAlign as any,
                    color: settings.titleStyle?.color,
                    marginBottom: 20 * zoom,
                    lineHeight: settings.titleStyle?.lineHeight || 1.2
                }}>
                    {settings.title}
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-hidden" style={{
                fontFamily: element.textStyle?.fontFamily,
                fontSize: (element.textStyle?.fontSize || 14) * zoom,
                color: element.textStyle?.color,
                lineHeight: element.textStyle?.lineHeight
            }}>
                {renderedItems.map((item: any, idx) => {
                    if (item.type === "header") {
                        return (
                            <div key={idx} style={{
                                fontFamily: settings.chapterStyle?.fontFamily,
                                fontSize: (settings.chapterStyle?.fontSize || 18) * zoom,
                                fontWeight: settings.chapterStyle?.fontWeight,
                                color: settings.chapterStyle?.color,
                                textAlign: settings.chapterStyle?.textAlign as any,
                                marginTop: 15 * zoom,
                                marginBottom: 5 * zoom,
                                paddingBottom: 2 * zoom
                                // FIXED: Removed borderBottom style
                            }}>
                                {item.text}
                            </div>
                        );
                    }
                    return (
                        <div key={idx} className="flex justify-between items-baseline w-full">
                            <span className="bg-white z-10 pr-2">{item.title}</span>
                            <span className="flex-1 border-b border-dotted border-gray-300 mx-1 relative top-[-4px]"></span>
                            <span className="bg-white z-10 pl-2">{item.page}</span>
                        </div>
                    );
                })}
                {!excelData && <div className="text-center mt-8 text-muted-foreground italic text-sm">(Import data to preview real content)</div>}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Only apply selection outline if NOT a TOC element
  const outlineStyle = (isSelected && !isToc) ? {
    outline: "2px solid #3b82f6", 
    outlineOffset: "0px",
    backgroundColor: "transparent",
  } : {};

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-testid={`canvas-element-${element.id}`}
      className={`absolute transition-shadow duration-100 canvas-element-wrapper`}
      style={{
        ...style,
        ...outlineStyle,
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {renderContent()}
    </div>
  );
}