import { useDraggable } from "@dnd-kit/core";
import type { CanvasElement as CanvasElementType } from "@shared/schema";
import { useCanvasStore } from "@/stores/canvas-store";
import { useEffect, useState, useMemo, useRef } from "react";
import { isHtmlContent, paginateTOC } from "@/lib/canvas-utils"; 
import { formatContent } from "@/lib/formatter";
import { 
  AlertTriangle, 
  ChevronLeft, 
  ChevronRight, 
  Copy, 
  Trash2, 
  BringToFront, 
  SendToBack, 
  Lock, 
  Unlock 
} from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button"; 
import { loadFont } from "@/lib/font-loader"; 
import { 
  ContextMenu, 
  ContextMenuContent, 
  ContextMenuItem, 
  ContextMenuSeparator, 
  ContextMenuTrigger 
} from "@/components/ui/context-menu";

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
  const { 
    excelData, 
    selectedRowIndex, 
    updateElement, 
    duplicateElement, 
    deleteElement, 
    bringToFront, 
    sendToBack 
  } = useCanvasStore();

  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Inline Editing State
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const [previewPage, setPreviewPage] = useState(0);
  const [qrSvg, setQrSvg] = useState<string>("");
  const [isLowQuality, setIsLowQuality] = useState(false);
  const [effectiveDpi, setEffectiveDpi] = useState(0);

  const elementScopeId = `el-${element.id}`;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: element.id,
    disabled: element.locked || isEditing, 
  });

  // Load Fonts
  useEffect(() => {
    if (element.textStyle?.fontFamily) loadFont(element.textStyle.fontFamily);
    if (element.tocSettings?.titleStyle?.fontFamily) loadFont(element.tocSettings.titleStyle.fontFamily);
    if (element.tocSettings?.chapterStyle?.fontFamily) loadFont(element.tocSettings.chapterStyle.fontFamily);
    // Table fonts
    if (element.tableSettings?.headerStyle?.fontFamily) loadFont(element.tableSettings.headerStyle.fontFamily);
    if (element.tableSettings?.rowStyle?.fontFamily) loadFont(element.tableSettings.rowStyle.fontFamily);
  }, [
      element.textStyle?.fontFamily, 
      element.tocSettings?.titleStyle?.fontFamily,
      element.tocSettings?.chapterStyle?.fontFamily,
      element.tableSettings?.headerStyle?.fontFamily,
      element.tableSettings?.rowStyle?.fontFamily
  ]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(element.id, e.shiftKey);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!element.locked && (element.type === "text" || element.type === "dataField")) {
      setIsEditing(true);
    }
  };

  useEffect(() => {
    if (isEditing && editorRef.current) {
      editorRef.current.focus();
      editorRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (editorRef.current) {
       updateElement(element.id, { content: editorRef.current.value });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
       e.preventDefault();
       setIsEditing(false);
       if (editorRef.current) {
          updateElement(element.id, { content: editorRef.current.value });
       }
    }
    if (e.key === "Escape") {
       setIsEditing(false);
    }
    e.stopPropagation();
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

  // --- 1. DERIVE URL DIRECTLY (No State) ---
  const getImageUrl = () => {
    if (element.type === "image") {
      if (element.dataBinding && excelData && excelData.rows[selectedRowIndex]) {
        return excelData.rows[selectedRowIndex][element.dataBinding] || element.imageSrc || null;
      }

      if (element.imageSrc && excelData && excelData.rows[selectedRowIndex]) {
         return element.imageSrc.replace(/{{([\w\s]+)}}/g, (match, p1) => {
            const val = excelData.rows[selectedRowIndex][p1.trim()];
            return val !== undefined ? val : match;
         });
      }

      return element.imageSrc || null;
    }
    return null;
  };

  const activeUrl = getImageUrl();

  // --- 2. ROBUST IMAGE LOADER ---
  useEffect(() => {
    if (element.type !== "image" || !activeUrl) return;

    let isMounted = true; 
    const img = new Image();

    img.onload = () => {
      if (!isMounted) return;
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      setImageDimensions({ width: naturalWidth, height: naturalHeight });

      const naturalRatio = naturalWidth / naturalHeight;
      if (!element.aspectRatio) {
           const newHeight = Math.round(element.dimension.width / naturalRatio);
           updateElement(element.id, {
              dimension: { width: element.dimension.width, height: newHeight },
              aspectRatio: naturalRatio,
              aspectRatioLocked: true 
           });
      }
    };

    img.onerror = () => {
      if (!isMounted) return;
      setImageDimensions(null);
    };

    // Keep crossOrigin here for calculation (prevents tainting logic issues)
    img.crossOrigin = "anonymous";
    img.src = activeUrl;

    return () => {
        isMounted = false; 
        img.onload = null;
        img.onerror = null;
    };
  }, [activeUrl, element.type, element.id, element.dimension.width, element.aspectRatio, updateElement]);

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

  // STABLE DEPENDENCIES FOR TOC
  const elementType = element.type;
  const elementHeight = element.dimension.height;
  const elementDataBinding = element.dataBinding;
  const tocSettingsString = JSON.stringify(element.tocSettings);
  const textStyleString = JSON.stringify(element.textStyle);

  const tocData = useMemo(() => {
    if (elementType !== "toc-list") return null;

    const settings = JSON.parse(tocSettingsString || "{}");
    const groupBy = settings.groupByField;
    const dummyMap: any[] = [];

    if (excelData && excelData.rows.length > 0) {
        for (let i = 0; i < excelData.rows.length; i++) {
            const row = excelData.rows[i];
            const title = row[elementDataBinding || "Name"] || `Product ${i + 1}`;
            const group = groupBy ? row[groupBy] : undefined;
            dummyMap.push({ title, page: i + 2, group }); 
        }
    } else {
        if (groupBy) dummyMap.push({ title: "Product 1", page: 2, group: "Category A" });
        dummyMap.push({ title: "Product 2", page: 3, group: groupBy ? "Category A" : undefined });
        if (groupBy) dummyMap.push({ title: "Product 3", page: 4, group: "Category B" });
    }

    const tempElement = {
        ...element,
        textStyle: JSON.parse(textStyleString || "{}"),
        tocSettings: settings
    };

    return paginateTOC(tempElement, dummyMap, elementHeight);
  }, [
      elementType, 
      elementHeight, 
      tocSettingsString, 
      textStyleString,
      elementDataBinding, 
      excelData
  ]);

  useEffect(() => {
    if (tocData && previewPage >= tocData.length) {
        setPreviewPage(0);
    }
  }, [tocData?.length]);


  const style: React.CSSProperties = {
    position: "absolute",
    left: element.position.x * zoom,
    top: element.position.y * zoom,
    width: element.dimension.width * zoom,
    height: element.dimension.height * zoom,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    opacity: isDragging ? 0.7 : element.visible ? 1 : 0.3,
    cursor: element.locked ? "not-allowed" : isEditing ? "text" : "move",
    userSelect: "none",
    zIndex: element.zIndex,
  };

  const renderContent = () => {
    if (isEditing) {
      const activeFont = element.textStyle?.fontFamily || "Inter";
      const fontValue = activeFont.includes(" ") ? `"${activeFont}"` : activeFont;
      return (
        <textarea
          ref={editorRef}
          defaultValue={element.content}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full h-full resize-none outline-none overflow-hidden bg-transparent p-1"
          style={{
            fontFamily: fontValue,
            fontSize: (element.textStyle?.fontSize || 16) * zoom,
            fontWeight: element.textStyle?.fontWeight || 400,
            color: element.textStyle?.color || "#000000",
            textAlign: (element.textStyle?.textAlign || "left") as any,
            lineHeight: element.textStyle?.lineHeight || 1.5,
            letterSpacing: `${element.textStyle?.letterSpacing || 0}px`,
            padding: 4 * zoom,
          }}
        />
      );
    }

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

        const activeFont = element.textStyle?.fontFamily || (isDataField ? "JetBrains Mono" : "Inter");
        const fontValue = activeFont.includes(" ") ? `"${activeFont}"` : activeFont;

        return (
          <div
            id={elementScopeId}
            className={`w-full h-full overflow-hidden canvas-element-content ${isDataField ? "rounded-md border-2 border-dashed" : ""}`}
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: verticalAlignMap[element.textStyle?.verticalAlign || "middle"] as any,
              fontFamily: fontValue, 
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
        const displayImageUrl = activeUrl; 
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
                loading="eager" 
                className="w-full h-full object-contain"
                draggable={false}
                style={{ 
                    objectPosition: "center",
                    transform: "translateZ(0)", 
                    backfaceVisibility: "hidden"
                }}
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
              {element.dataBinding || element.imageSrc || "No image"}
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

      case "table":
        const tableSettings = element.tableSettings;
        if (!tableSettings) return null;

        // --- 1. Data Processing ---
        const previewRows = [
            { "Name": "Product A", "Description": "Sample Item", "Price": "$10.00" },
            { "Name": "Product B", "Description": "Sample Item", "Price": "$20.00" },
            { "Name": "Product C", "Description": "Sample Item", "Price": "$30.00" }
        ];

        let displayRows = previewRows;

        if (excelData && excelData.rows.length > 0) {
            if (tableSettings.groupByField && selectedRowIndex !== undefined) {
               // Grouping Logic
               const currentRow = excelData.rows[selectedRowIndex];
               const groupValue = currentRow[tableSettings.groupByField];

               if (groupValue) {
                   displayRows = excelData.rows.filter(r => r[tableSettings.groupByField!] === groupValue);
               } else {
                   displayRows = [currentRow]; 
               }
            } else {
               displayRows = excelData.rows.slice(0, 5); 
            }
        }

        // --- 2. Dynamic Layout Calculations ---

        // Column Width Logic (Manual vs Autofit)
        let columnWidths: Record<string, string> = {}; // map id -> percentage string

        if (tableSettings.autoFitColumns) {
            // Calculate weights based on character length
            const colWeights = tableSettings.columns.map(col => {
                const headerLen = (col.header || "").length;

                // Find max length among all displayed rows for this column
                const maxContentLen = displayRows.reduce((max, row) => {
                    const cellValue = row[col.dataField || ""] || "";
                    return Math.max(max, String(cellValue).length);
                }, 0);

                // Weight = Max length (min 3 chars to prevent collapse)
                return { 
                    id: col.id, 
                    weight: Math.max(headerLen, maxContentLen, 3) 
                };
            });

            const totalWeight = colWeights.reduce((sum, c) => sum + c.weight, 0);

            // Convert to percentages
            colWeights.forEach(c => {
                columnWidths[c.id] = `${(c.weight / totalWeight) * 100}%`;
            });

        } else {
            // Existing Manual Width Logic
            const totalConfigWidth = tableSettings.columns.reduce((acc, col) => acc + (col.width || 100), 0);
            tableSettings.columns.forEach(col => {
                columnWidths[col.id] = `${((col.width || 100) / totalConfigWidth) * 100}%`;
            });
        }

        // Map text-align (left/center/right) to flex justify-content (start/center/end)
        const getJustifyContent = (align?: string) => {
            switch(align) {
                case 'center': return 'center';
                case 'right': return 'flex-end';
                default: return 'flex-start';
            }
        };

        return (
          <div className="w-full h-full overflow-hidden flex flex-col bg-white" style={{
              borderColor: tableSettings.borderColor,
              borderWidth: tableSettings.borderWidth * zoom,
              borderStyle: "solid"
          }}>
            {/* Table Header */}
            <div className="flex w-full" style={{ backgroundColor: tableSettings.headerBackgroundColor }}>
                {tableSettings.columns.map((col: any, idx) => {
                    // NEW: Prioritize column-specific alignment, fallback to header row style
                    const alignment = col.align || tableSettings.headerStyle?.textAlign || 'left';
                    return (
                          <div key={col.id} className="p-1 px-2 border-r last:border-r-0 flex items-center overflow-hidden" style={{
                            width: columnWidths[col.id],
                            justifyContent: getJustifyContent(col.headerAlign || tableSettings.headerStyle?.textAlign), 
                            textAlign: (col.headerAlign || tableSettings.headerStyle?.textAlign || 'left') as any,
                            borderColor: tableSettings.borderColor,
                            borderRightWidth: tableSettings.borderWidth * zoom,
                            borderStyle: "solid",
                            fontFamily: tableSettings.headerStyle?.fontFamily || "Inter",
                            fontSize: (tableSettings.headerStyle?.fontSize || 14) * zoom,
                            fontWeight: tableSettings.headerStyle?.fontWeight || 700,
                            color: tableSettings.headerStyle?.color,
                            minHeight: 30 * zoom 
                        }}>
                            {col.header}
                        </div>
                    );
                })}
            </div>

            {/* Table Body - Scalable Rows */}
            <div className="flex-1 flex flex-col w-full overflow-hidden">
                {displayRows.map((row, rIdx) => (
                    <div key={rIdx} className="flex w-full border-t flex-1" style={{  // flex-1 forces equal scaling
                        backgroundColor: (tableSettings.alternateRowColor && rIdx % 2 === 1) ? tableSettings.alternateRowColor : tableSettings.rowBackgroundColor,
                        borderColor: tableSettings.borderColor,
                        borderTopWidth: tableSettings.borderWidth * zoom,
                        borderStyle: "solid"
                    }}>
                        {tableSettings.columns.map((col: any, cIdx) => {
                            // NEW: Prioritize column-specific alignment, fallback to default body row style
                            const alignment = col.align || tableSettings.rowStyle?.textAlign || 'left';
                            return (
                                  <div key={col.id} className="p-1 px-2 border-r last:border-r-0 overflow-hidden flex items-center" style={{
                                    width: columnWidths[col.id],
                                    justifyContent: getJustifyContent(col.rowAlign || tableSettings.rowStyle?.textAlign), 
                                    textAlign: (col.rowAlign || tableSettings.rowStyle?.textAlign || 'left') as any,
                                    borderColor: tableSettings.borderColor,
                                    borderRightWidth: tableSettings.borderWidth * zoom,
                                    borderStyle: "solid",
                                    fontFamily: tableSettings.rowStyle?.fontFamily || "Inter",
                                    fontSize: (tableSettings.rowStyle?.fontSize || 12) * zoom,
                                    fontWeight: tableSettings.rowStyle?.fontWeight || 400,
                                    color: tableSettings.rowStyle?.color,
                                    padding: (tableSettings.cellPadding || 8) * zoom
                                }}>
                                    <span className="truncate w-full">{row[col.dataField || ""] || "-"}</span>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
          </div>
        );

      case "toc-list":
        const settings = element.tocSettings || { title: "Table of Contents", showTitle: true, columnCount: 1 };
        const columnCount = settings.columnCount || 1;

        const currentItems = tocData ? tocData[previewPage] || [] : [];
        const isMultiPage = (tocData?.length || 0) > 1;
        const isFirstPage = previewPage === 0;

        const titleFont = settings.titleStyle?.fontFamily || "Inter";
        const titleFontValue = titleFont.includes(" ") ? `"${titleFont}"` : titleFont;

        const chapterFont = settings.chapterStyle?.fontFamily || "Inter";
        const chapterFontValue = chapterFont.includes(" ") ? `"${chapterFont}"` : chapterFont;

        const itemFont = element.textStyle?.fontFamily || "Inter";
        const itemFontValue = itemFont.includes(" ") ? `"${itemFont}"` : itemFont;

        return (
          <>
            <div 
              className="w-full h-full p-4 border border-dashed border-muted-foreground/20 bg-white rounded flex flex-col overflow-hidden relative group"
            >
              {settings.showTitle && isFirstPage && (
                  <div style={{
                      fontFamily: titleFontValue,
                      fontSize: (settings.titleStyle?.fontSize || 24) * zoom,
                      fontWeight: settings.titleStyle?.fontWeight,
                      textAlign: settings.titleStyle?.textAlign as any,
                      color: settings.titleStyle?.color,
                      marginBottom: 10 * zoom,
                      lineHeight: settings.titleStyle?.lineHeight || 1.2,
                      flexShrink: 0
                  }}>
                      {settings.title}
                  </div>
              )}

              <div className="flex-1 overflow-hidden" style={{
                  fontFamily: itemFontValue,
                  fontSize: (element.textStyle?.fontSize || 14) * zoom,
                  color: element.textStyle?.color,
                  fontWeight: element.textStyle?.fontWeight || 400,
                  lineHeight: element.textStyle?.lineHeight,
                  columnCount: columnCount,
                  columnGap: 24 * zoom,
                  columnFill: "auto"
              }}>
                  {currentItems.map((item: any, idx: number) => {
                      if (item.type === "header") {
                          return (
                              <div key={idx} style={{
                                  fontFamily: chapterFontValue,
                                  fontSize: (settings.chapterStyle?.fontSize || 18) * zoom,
                                  fontWeight: settings.chapterStyle?.fontWeight,
                                  color: settings.chapterStyle?.color,
                                  marginTop: 0,
                                  marginBottom: 0,
                                  lineHeight: settings.chapterStyle?.lineHeight || 1.1,
                                  breakInside: "avoid"
                              }}>
                                  {item.text}
                              </div>
                          );
                      }
                      return (
                          <div key={idx} className="flex justify-between items-baseline" style={{ breakInside: "avoid" }}>
                              <span className="truncate pr-2 bg-white z-10">{item.title}</span>
                              <span className="flex-shrink-0 bg-white z-10 pl-2">{item.page}</span>
                          </div>
                      );
                  })}
              </div>
            </div>

            {isSelected && isMultiPage && (
                <>
                    <div 
                        className="absolute left-[-50px] top-1/2 -translate-y-1/2 z-50"
                        onMouseDown={(e) => e.stopPropagation()} 
                    >
                        <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-10 w-10 rounded-full shadow-md bg-white hover:bg-gray-50 border-gray-300" 
                            disabled={previewPage === 0}
                            onClick={(e) => { e.stopPropagation(); setPreviewPage(p => p - 1); }}
                        >
                            <ChevronLeft className="h-6 w-6 text-gray-700" />
                        </Button>
                    </div>

                    <div 
                        className="absolute right-[-50px] top-1/2 -translate-y-1/2 z-50"
                        onMouseDown={(e) => e.stopPropagation()} 
                    >
                        <Button 
                            size="icon" 
                            variant="outline" 
                            className="h-10 w-10 rounded-full shadow-md bg-white hover:bg-gray-50 border-gray-300" 
                            disabled={previewPage === (tocData?.length || 1) - 1}
                            onClick={(e) => { e.stopPropagation(); setPreviewPage(p => p + 1); }}
                        >
                            <ChevronRight className="h-6 w-6 text-gray-700" />
                        </Button>
                    </div>

                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm border shadow-sm rounded-full px-3 py-1 text-xs font-medium text-gray-600 whitespace-nowrap z-50">
                        Page {previewPage + 1} of {tocData?.length}
                    </div>
                </>
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          ref={setNodeRef}
          {...listeners}
          {...attributes}
          data-testid={`canvas-element-${element.id}`}
          className={`absolute transition-shadow duration-100 canvas-element-wrapper`}
          style={{
            ...style,
            ...(isSelected && !isEditing && {
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
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => bringToFront(element.id)}>
          <BringToFront className="w-4 h-4 mr-2" /> Bring to Front
        </ContextMenuItem>
        <ContextMenuItem onClick={() => sendToBack(element.id)}>
          <SendToBack className="w-4 h-4 mr-2" /> Send to Back
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => updateElement(element.id, { locked: !element.locked })}>
          {element.locked ? <Unlock className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
          {element.locked ? "Unlock" : "Lock"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateElement(element.id)}>
          <Copy className="w-4 h-4 mr-2" /> Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => deleteElement(element.id)} className="text-destructive focus:text-destructive">
          <Trash2 className="w-4 h-4 mr-2" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}