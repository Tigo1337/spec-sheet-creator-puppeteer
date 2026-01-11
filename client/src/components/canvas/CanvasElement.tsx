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
  Unlock,
  MoveDown
} from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button"; 
import { loadFont } from "@/lib/font-loader"; 
import { useToast } from "@/hooks/use-toast";
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
    setSelectedRowIndex, 
    updateElement, 
    duplicateElement, 
    deleteElement, 
    bringToFront, 
    sendToBack,
    elements: allElements 
  } = useCanvasStore();

  const { toast } = useToast();

  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Inline Editing State
  const [isEditing, setIsEditing] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const [previewPage, setPreviewPage] = useState(0);
  const [qrSvg, setQrSvg] = useState<string>("");
  const [isLowQuality, setIsLowQuality] = useState(false);
  const [effectiveDpi, setEffectiveDpi] = useState(0);

  // --- Dataset Audit State ---
  const [overflowReport, setOverflowReport] = useState<{ count: number; firstIndex: number | null }>({ count: 0, firstIndex: null });
  const [auditDimensions, setAuditDimensions] = useState<{ 
    neededHeightAtCurrentWidth: number; 
    neededWidthToFitCurrentHeight: number; 
  }>({ neededHeightAtCurrentWidth: 0, neededWidthToFitCurrentHeight: 0 });

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
    if (element.tableSettings?.headerStyle?.fontFamily) loadFont(element.tableSettings.headerStyle.fontFamily);
    if (element.tableSettings?.rowStyle?.fontFamily) loadFont(element.tableSettings.rowStyle.fontFamily);
  }, [
      element.textStyle?.fontFamily, 
      element.tocSettings?.titleStyle?.fontFamily,
      element.tocSettings?.chapterStyle?.fontFamily,
      element.tableSettings?.headerStyle?.fontFamily,
      element.tableSettings?.rowStyle?.fontFamily
  ]);

  // --- DYNAMIC HEIGHT ADAPTATION LOGIC (Real-time Flow) ---
  useEffect(() => {
    if (element.type !== 'table' || !element.tableSettings?.autoHeightAdaptation || !excelData || selectedRowIndex === undefined) return;

    const settings = element.tableSettings;
    const currentRow = excelData.rows[selectedRowIndex];
    const groupValue = settings.groupByField ? currentRow[settings.groupByField] : null;

    // 1. Calculate current row count for this specific group
    const currentRowsCount = groupValue 
        ? excelData.rows.filter(r => r[settings.groupByField!] === groupValue).length 
        : Math.min(excelData.rows.length, 5);

    // 2. Calculate correct height needed
    const hFS = settings.headerStyle?.fontSize || 14;
    const hLH = settings.headerStyle?.lineHeight || 1.2;
    const rFS = settings.rowStyle?.fontSize || 12;
    const rLH = settings.rowStyle?.lineHeight || 1.2;
    const bWidth = settings.borderWidth || 1;
    const safety = 6;

    const correctH = (hFS * hLH + safety) + (currentRowsCount * (rFS * rLH + safety)) + ((currentRowsCount + 2) * bWidth);

    // 3. Only trigger update if height has changed
    if (Math.abs(correctH - element.dimension.height) > 0.5) {
        updateElement(element.id, { dimension: { ...element.dimension, height: correctH } });

        const currentPage = element.pageIndex ?? 0;
        const newBottom = element.position.y + correctH;
        const safetyBuffer = 10;

        allElements.forEach(el => {
            if (el.id !== element.id && (el.pageIndex ?? 0) === currentPage) {
                // Check for horizontal overlap
                const hasOverlap = (el.position.x < element.position.x + element.dimension.width) && 
                                   (el.position.x + el.dimension.width > element.position.x);

                // Selective push: only if below table and within 10px of the new bottom
                if (hasOverlap && el.position.y > element.position.y && el.position.y < newBottom + safetyBuffer) {
                    updateElement(el.id, { position: { ...el.position, y: newBottom + safetyBuffer } });
                }
            }
        });
    }
  }, [selectedRowIndex, element.tableSettings?.autoHeightAdaptation, element.tableSettings?.groupByField]);

  // --- FINAL: "Path to Safety" Solver (Updated for Tables) ---
  useEffect(() => {
    if ((element.type !== 'text' && element.type !== 'dataField' && element.type !== 'table') || !excelData?.rows.length || isEditing) {
      setOverflowReport({ count: 0, firstIndex: null });
      return;
    }

    const validateDataset = async () => {
      if (element.type === 'text' || element.type === 'dataField') {
        await document.fonts.ready;

        const isDataField = element.type === "dataField";
        const listStyleProp = element.format?.listStyle;
        const hasCustomListStyle = listStyleProp && listStyleProp !== 'none';
        const activeFont = element.textStyle?.fontFamily || (isDataField ? "JetBrains Mono" : "Inter");
        const fontValue = activeFont.includes(" ") ? `"${activeFont}"` : activeFont;

        const verticalAlignMap = {
          top: "flex-start",
          middle: "center",
          bottom: "flex-end",
        };

        const measurer = document.createElement('div');
        measurer.style.position = 'absolute';
        measurer.style.visibility = 'hidden';
        measurer.style.boxSizing = 'border-box';
        measurer.style.wordBreak = 'break-word';
        measurer.style.overflowWrap = 'anywhere';

        measurer.style.display = 'flex';
        measurer.style.flexDirection = 'column';
        measurer.style.justifyContent = verticalAlignMap[element.textStyle?.verticalAlign || "middle"];

        measurer.style.fontFamily = fontValue;
        measurer.style.fontSize = `${(element.textStyle?.fontSize || (isDataField ? 14 : 16)) * zoom}px`;
        measurer.style.fontWeight = String(element.textStyle?.fontWeight || (isDataField ? 500 : 400));
        measurer.style.color = element.textStyle?.color || "#000000";
        measurer.style.textAlign = (element.textStyle?.textAlign || "left") as any;
        measurer.style.lineHeight = String(element.textStyle?.lineHeight || (isDataField ? 1.4 : 1.5));
        measurer.style.letterSpacing = `${(element.textStyle?.letterSpacing || 0) * zoom}px`;
        measurer.style.padding = `0px`;

        if (isDataField) {
          measurer.style.border = `${2 * zoom}px solid transparent`;
        }

        const styleTag = document.createElement('style');
        styleTag.textContent = `
          .safety-measurer ul { list-style-type: ${hasCustomListStyle ? listStyleProp : 'disc'} !important; }
          .safety-measurer ol { list-style-type: ${hasCustomListStyle ? listStyleProp : 'decimal'} !important; }
          .safety-measurer ul, .safety-measurer ol { margin: 0 !important; padding-left: 1.5em !important; display: block !important; }
          .safety-measurer li { position: relative !important; margin: 0.2em 0 !important; display: list-item !important; text-align: left !important; }
        `;
        measurer.className = "safety-measurer";
        document.body.appendChild(styleTag);
        document.body.appendChild(measurer);

        let overflowCount = 0;
        let firstIdx = null;
        let maxHAtCurrentW = 0;
        let maxWToFitCurrentH = 0;

        const TOLERANCE = 1; 
        const currentWidthPx = element.dimension.width * zoom;
        const currentHeightPx = element.dimension.height * zoom;

        const checkFit = (w: number, h: number, content: string, isHtml: boolean) => {
          measurer.style.width = `${w}px`;
          measurer.style.height = `${h}px`;
          measurer.style.whiteSpace = isHtml ? 'normal' : 'pre-wrap';
          if (isHtml) measurer.innerHTML = content; else measurer.innerText = content;

          const fitsHeight = measurer.scrollHeight <= measurer.clientHeight + TOLERANCE;
          const fitsWidth = measurer.scrollWidth <= measurer.clientWidth + TOLERANCE;

          return fitsHeight && fitsWidth;
        };

        excelData.rows.forEach((row, idx) => {
          let content = (element.content || (element.dataBinding ? `{{${element.dataBinding}}}` : ""))
            .replace(/{{(.*?)}}/g, (_, p1) => row[p1.trim()] !== undefined ? row[p1.trim()] : "");

          content = formatContent(content, element.format);
          const isHtml = isHtmlContent(content);

          const fitsCurrently = checkFit(currentWidthPx, currentHeightPx, content, isHtml);

          if (!fitsCurrently) {
            overflowCount++;
            if (firstIdx === null) firstIdx = idx;

            measurer.style.height = 'auto';
            const autoHeight = Math.ceil(measurer.getBoundingClientRect().height);

            let safeH = autoHeight;
            for (let h = autoHeight; h > currentHeightPx; h--) {
               if (checkFit(currentWidthPx, h, content, isHtml)) {
                  safeH = h;
               } else {
                  break;
               }
            }
            maxHAtCurrentW = Math.max(maxHAtCurrentW, safeH);

            measurer.style.width = 'auto';
            measurer.style.height = `${currentHeightPx}px`; 
            const singleLineWidth = Math.ceil(measurer.scrollWidth);

            let low = currentWidthPx;
            let high = singleLineWidth + 100; 
            let safeW = singleLineWidth;

            if (checkFit(high, currentHeightPx, content, isHtml)) {
               while (low <= high) {
                  const mid = Math.floor((low + high) / 2);
                  if (checkFit(mid, currentHeightPx, content, isHtml)) {
                     safeW = mid;
                     high = mid - 1; 
                  } else {
                     low = mid + 1; 
                  }
               }
               maxWToFitCurrentH = Math.max(maxWToFitCurrentH, safeW);
            } else {
               maxWToFitCurrentH = Math.max(maxWToFitCurrentH, singleLineWidth);
            }
          }
        });

        document.body.removeChild(measurer);
        document.body.removeChild(styleTag);

        setOverflowReport({ count: overflowCount, firstIndex: firstIdx });
        setAuditDimensions({ 
          neededHeightAtCurrentWidth: maxHAtCurrentW / zoom, 
          neededWidthToFitCurrentHeight: maxWToFitCurrentH / zoom 
        });
      } else if (element.type === 'table') {
        // --- TABLE AUDIT LOGIC: SCAN ENTIRE DATASET ---
        const settings = element.tableSettings;
        if (!settings) return;

        let maxRowsInAnyGroup = 1;
        if (settings.groupByField) {
            const counts: Record<string, number> = {};
            excelData.rows.forEach(r => {
                const val = String(r[settings.groupByField!] || "unnamed");
                counts[val] = (counts[val] || 0) + 1;
            });
            maxRowsInAnyGroup = Math.max(...Object.values(counts), 1);
        } else {
            maxRowsInAnyGroup = Math.min(excelData.rows.length, 5);
        }

        const hFS = settings.headerStyle?.fontSize || 14;
        const hLH = settings.headerStyle?.lineHeight || 1.2;
        const rFS = settings.rowStyle?.fontSize || 12;
        const rLH = settings.rowStyle?.lineHeight || 1.2;
        const bWidth = settings.borderWidth || 1;
        const safety = 6;

        const neededH = (hFS * hLH + safety) + (maxRowsInAnyGroup * (rFS * rLH + safety)) + ((maxRowsInAnyGroup + 2) * bWidth);

        if (neededH > element.dimension.height + 0.5) {
            setOverflowReport({ count: 1, firstIndex: null });
            setAuditDimensions({ 
                neededHeightAtCurrentWidth: neededH, 
                neededWidthToFitCurrentHeight: element.dimension.width 
            });
        } else {
            setOverflowReport({ count: 0, firstIndex: null });
        }
      }
    };

    validateDataset();
  }, [element.dimension, element.textStyle, element.content, element.dataBinding, element.format, element.tableSettings, excelData, zoom, isEditing]);

  const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    onSelect(element.id, e.shiftKey);
  };

  const handleDoubleInteraction = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!element.locked && (element.type === "text" || element.type === "dataField")) {
      setIsEditing(true);
    }
  };

  const handleAutoFlow = () => {
    if (element.type !== 'table' || overflowReport.count === 0) return;

    const neededHeight = auditDimensions.neededHeightAtCurrentWidth;
    const currentPage = element.pageIndex ?? 0;
    const newBottom = element.position.y + neededHeight;
    const safetyBuffer = 10;

    updateElement(element.id, { dimension: { ...element.dimension, height: neededHeight } });

    const stateElements = useCanvasStore.getState().elements;
    let shiftCount = 0;
    stateElements.forEach(el => {
      if ((el.pageIndex ?? 0) === currentPage && el.id !== element.id) {
        const hasOverlap = (el.position.x < element.position.x + element.dimension.width) && 
                           (el.position.x + el.dimension.width > element.position.x);

        if (hasOverlap && el.position.y > element.position.y && el.position.y < newBottom + safetyBuffer) {
           updateElement(el.id, { position: { ...el.position, y: newBottom + safetyBuffer } });
           shiftCount++;
        }
      }
    });

    toast({ 
      title: "Table Adjusted", 
      description: `Table expanded and ${shiftCount} overlapping elements pushed down.` 
    });
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
       if (isEditing) {
         setIsEditing(false);
         if (editorRef.current) {
            updateElement(element.id, { content: editorRef.current.value });
         }
       } else {
         handleDoubleInteraction(e);
       }
    } else if (e.key === " " && !isEditing) {
       e.preventDefault();
       handleClick(e);
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
  }, [elementType, elementHeight, tocSettingsString, textStyleString, elementDataBinding, excelData]);

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
          aria-label="Inline text editor"
          className="w-full h-full resize-none outline-none overflow-hidden bg-transparent p-1"
          style={{
            fontFamily: fontValue,
            fontSize: (element.textStyle?.fontSize || 16) * zoom,
            fontWeight: element.textStyle?.fontWeight || 400,
            color: element.textStyle?.color || "#000000",
            textAlign: (element.textStyle?.textAlign || "left") as any,
            lineHeight: element.textStyle?.lineHeight || 1.5,
            letterSpacing: `${element.textStyle?.letterSpacing || 0}px`,
            padding: 0, 
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
            role="none"
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
              padding: 0, 
              borderColor: isDataField ? "#8b5cf6" : "transparent",
              backgroundColor: isDataField ? "transparent" : "rgba(139, 92, 246, 0.05)",
              whiteSpace: hasHtml ? "normal" : "pre-wrap", 
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            {overflowReport.count > 0 && !element.locked && (
              <div 
                className="absolute top-0 left-0 m-1 bg-destructive text-white p-1 rounded-sm shadow-md z-[100] flex items-center gap-1 cursor-pointer animate-in fade-in zoom-in duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  if (overflowReport.firstIndex !== null) setSelectedRowIndex(overflowReport.firstIndex);
                }}
                title={`${overflowReport.count} rows will be cut off. Click to view first case.`}
              >
                <AlertTriangle size={14} aria-hidden="true" />
                <span className="text-[10px] font-bold">{overflowReport.count}</span>
              </div>
            )}

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
            <div className="w-full h-full flex items-center justify-center" aria-hidden="true">
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

        return <div className="w-full h-full" style={shapeStyle} aria-hidden="true" />;

      case "image":
        const displayImageUrl = activeUrl; 
        if (displayImageUrl) {
          const neededWidth = Math.ceil(element.dimension.width * 3.125);
          const neededHeight = Math.ceil(element.dimension.height * 3.125);
          const tooltipText = `Quality: ${effectiveDpi} DPI\nFor 300 DPI print quality at this size, use an image at least ${neededWidth} x ${neededHeight} pixels.`;

          return (
            <div className="relative w-full h-full" style={{ opacity: element.shapeStyle?.opacity ?? 1 }}>
              <img
                src={displayImageUrl}
                alt={element.dataBinding || "Product image"}
                loading="eager" 
                className="w-full h-full object-contain"
                draggable={false}
                style={{ objectPosition: "center", transform: "translateZ(0)", backfaceVisibility: "hidden" }}
              />
               {isLowQuality && !element.locked && (
                <div className="absolute top-0 right-0 m-1 bg-yellow-500 text-white p-1 rounded-sm shadow-md z-50 flex items-center gap-1 cursor-help" title={tooltipText}>
                  <AlertTriangle size={14} aria-hidden="true" />
                </div>
              )}
            </div>
          );
        }
        return (
          <div className="w-full h-full bg-muted/50 border-2 border-dashed border-muted-foreground/30 flex items-center justify-center" role="img" aria-label="Image placeholder">
            <span className="text-muted-foreground text-xs" style={{ fontSize: 12 * zoom }}>
              {element.dataBinding || element.imageSrc || "No image"}
            </span>
          </div>
        );

      case "qrcode": 
        return <div className="w-full h-full" role="img" aria-label="QR Code" dangerouslySetInnerHTML={{ __html: qrSvg }} />;

      case "table":
        const tableSettings = element.tableSettings;
        if (!tableSettings) return null;

        const previewRows = [
            { "Name": "Product A", "Description": "Sample Item", "Price": "$10.00" },
            { "Name": "Product B", "Description": "Sample Item", "Price": "$20.00" },
            { "Name": "Product C", "Description": "Sample Item", "Price": "$30.00" }
        ];

        let displayRows = previewRows;

        if (excelData && excelData.rows.length > 0) {
            if (tableSettings.groupByField && selectedRowIndex !== undefined) {
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

        let columnWidths: Record<string, string> = {}; 

        if (tableSettings.autoFitColumns) {
            const colWeights = tableSettings.columns.map(col => {
                const headerLen = (col.header || "").length;
                const maxContentLen = displayRows.reduce((max, row) => {
                    const cellValue = row[col.dataField || ""] || "";
                    return Math.max(max, String(cellValue).length);
                }, 0);
                return { id: col.id, weight: Math.max(headerLen, maxContentLen, 3) };
            });
            const totalWeight = colWeights.reduce((sum, c) => sum + c.weight, 0);
            colWeights.forEach(c => {
                columnWidths[c.id] = `${(c.weight / totalWeight) * 100}%`;
            });
        } else {
            const totalConfigWidth = tableSettings.columns.reduce((acc, col) => acc + (col.width || 100), 0);
            tableSettings.columns.forEach(col => {
                columnWidths[col.id] = `${((col.width || 100) / totalConfigWidth) * 100}%`;
            });
        }

        const getJustifyContent = (align?: string) => {
            switch(align) {
                case 'center': return 'center';
                case 'right': return 'flex-end';
                default: return 'flex-start';
            }
        };

        return (
          <div className="w-full h-full overflow-hidden flex flex-col bg-white" role="table" aria-label="Product data table" style={{
              borderColor: tableSettings.borderColor,
              borderWidth: tableSettings.borderWidth * zoom,
              borderStyle: "solid"
          }}>
            <div className="flex w-full shrink-0" role="rowgroup" style={{ backgroundColor: tableSettings.headerBackgroundColor }}>
                {tableSettings.columns.map((col: any, idx) => (
                    <div key={col.id} role="columnheader" className="flex items-center overflow-hidden" style={{
                        width: columnWidths[col.id],
                        justifyContent: getJustifyContent(col.headerAlign || tableSettings.headerStyle?.textAlign), 
                        borderRightWidth: idx === tableSettings.columns.length - 1 ? 0 : tableSettings.borderWidth * zoom,
                        borderStyle: "solid",
                        borderColor: tableSettings.borderColor,
                        fontFamily: tableSettings.headerStyle?.fontFamily || "Inter",
                        fontSize: (tableSettings.headerStyle?.fontSize || 14) * zoom,
                        padding: `2px ${4 * zoom}px`, 
                    }}>
                        {col.header}
                    </div>
                ))}
            </div>
            <div className="flex-1 flex flex-col w-full overflow-hidden" role="rowgroup">
                {displayRows.map((row, rIdx) => (
                    <div key={rIdx} role="row" className="flex w-full border-t flex-1" style={{
                        backgroundColor: (tableSettings.alternateRowColor && rIdx % 2 === 1) ? tableSettings.alternateRowColor : tableSettings.rowBackgroundColor,
                        borderColor: tableSettings.borderColor,
                        borderTopWidth: tableSettings.borderWidth * zoom,
                        borderStyle: "solid"
                    }}>
                        {tableSettings.columns.map((col: any, cIdx) => (
                            <div key={col.id} role="cell" className="overflow-hidden flex items-center" style={{
                                width: columnWidths[col.id],
                                justifyContent: getJustifyContent(col.rowAlign || tableSettings.rowStyle?.textAlign), 
                                borderRightWidth: cIdx === tableSettings.columns.length - 1 ? 0 : tableSettings.borderWidth * zoom,
                                borderStyle: "solid",
                                borderColor: tableSettings.borderColor,
                                fontFamily: tableSettings.rowStyle?.fontFamily || "Inter",
                                fontSize: (tableSettings.rowStyle?.fontSize || 12) * zoom,
                                padding: `0 ${4 * zoom}px`, 
                            }}>
                                <span className="truncate w-full">{row[col.dataField || ""] || "-"}</span>
                            </div>
                        ))}
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
            <div className="w-full h-full p-4 border border-dashed border-muted-foreground/20 bg-white rounded flex flex-col overflow-hidden relative group" role="navigation" aria-label="Table of contents">
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
                    <div className="absolute left-[-50px] top-1/2 -translate-y-1/2 z-50" onMouseDown={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="outline" className="h-10 w-10 rounded-full shadow-md bg-white hover:bg-gray-50 border-gray-300" disabled={previewPage === 0} onClick={(e) => { e.stopPropagation(); setPreviewPage(p => p - 1); }} aria-label="Previous TOC page">
                            <ChevronLeft className="h-6 w-6 text-gray-700" aria-hidden="true" />
                        </Button>
                    </div>
                    <div className="absolute right-[-50px] top-1/2 -translate-y-1/2 z-50" onMouseDown={(e) => e.stopPropagation()}>
                        <Button size="icon" variant="outline" className="h-10 w-10 rounded-full shadow-md bg-white hover:bg-gray-50 border-gray-300" disabled={previewPage === (tocData?.length || 1) - 1} onClick={(e) => { e.stopPropagation(); setPreviewPage(p => p + 1); }} aria-label="Next TOC page">
                            <ChevronRight className="h-6 w-6 text-gray-700" aria-hidden="true" />
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
          role="button"
          aria-pressed={isSelected}
          aria-label={`Canvas element: ${element.type} ${element.dataBinding || ""}`}
          tabIndex={element.locked ? -1 : 0}
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
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onDoubleClick={handleDoubleInteraction}
        >
          {/* BLOCK START: PERSISTENT GHOST OUTLINE LOGIC */}
          {!element.locked && overflowReport.count > 0 && (
            <>
              {/* TEXT FIELD GUIDES (only when selected - Red lines with text labels) */}
              {isSelected && (element.type === 'text' || element.type === 'dataField') && (
                <>
                  {auditDimensions.neededHeightAtCurrentWidth > element.dimension.height + 0.1 && (
                    <div 
                      className="absolute top-0 left-0 border-2 border-dashed border-red-500/40 pointer-events-none z-[-1]"
                      aria-hidden="true"
                      style={{
                        width: element.dimension.width * zoom,
                        height: auditDimensions.neededHeightAtCurrentWidth * zoom,
                        backgroundColor: "rgba(239, 68, 68, 0.02)"
                      }}
                    >
                      <span className="absolute -bottom-5 left-0 text-[9px] text-red-600 font-bold bg-white/90 px-1 rounded shadow-sm whitespace-nowrap border border-red-100">
                        Fix: taller container ({Math.ceil(auditDimensions.neededHeightAtCurrentWidth)}px)
                      </span>
                    </div>
                  )}

                  {auditDimensions.neededWidthToFitCurrentHeight > element.dimension.width + 0.1 && (
                    <div 
                      className="absolute top-0 left-0 border-2 border-dashed border-blue-500/40 pointer-events-none z-[-1]"
                      aria-hidden="true"
                      style={{
                        width: auditDimensions.neededWidthToFitCurrentHeight * zoom,
                        height: element.dimension.height * zoom,
                        backgroundColor: "rgba(59, 130, 246, 0.02)"
                      }}
                    >
                      <span className="absolute top-[-18px] right-0 text-[9px] text-blue-600 font-bold bg-white/90 px-1 rounded shadow-sm whitespace-nowrap border border-blue-100">
                        Fix: wider container ({Math.ceil(auditDimensions.neededWidthToFitCurrentHeight)}px)
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* TABLE GHOST GUIDE (always persistent yellow line, no text) */}
              {element.type === 'table' && (
                <div 
                  className="absolute top-0 left-0 border-2 border-dashed border-yellow-500/50 pointer-events-none z-[-1]"
                  aria-hidden="true"
                  style={{
                    width: element.dimension.width * zoom,
                    height: auditDimensions.neededHeightAtCurrentWidth * zoom,
                    backgroundColor: "rgba(234, 179, 8, 0.05)"
                  }}
                />
              )}
            </>
          )}
          {/* BLOCK END: PERSISTENT GHOST OUTLINE LOGIC */}

          {renderContent()}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {element.type === 'table' && overflowReport.count > 0 && (
          <ContextMenuItem onClick={handleAutoFlow} className="text-blue-600 focus:text-blue-700">
            <MoveDown className="w-4 h-4 mr-2" /> Auto-Fit & Push Below
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => bringToFront(element.id)}>
          <BringToFront className="w-4 h-4 mr-2" aria-hidden="true" /> Bring to Front
        </ContextMenuItem>
        <ContextMenuItem onClick={() => sendToBack(element.id)}>
          <SendToBack className="w-4 h-4 mr-2" aria-hidden="true" /> Send to Back
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => updateElement(element.id, { locked: !element.locked })}>
          {element.locked ? <Unlock className="w-4 h-4 mr-2" aria-hidden="true" /> : <Lock className="w-4 h-4 mr-2" aria-hidden="true" />}
          {element.locked ? "Unlock" : "Lock"}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateElement(element.id)}>
          <Copy className="w-4 h-4 mr-2" aria-hidden="true" /> Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => deleteElement(element.id)} className="text-destructive focus:text-destructive">
          <Trash2 className="w-4 h-4 mr-2" aria-hidden="true" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}