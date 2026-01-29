import { useState, useEffect, useRef } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/use-subscription";
import {
  Download,
  Settings,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSignature,
  Plus,
  FileArchive,
  Monitor,
  Printer,
  AlertTriangle,
  Book,
  XCircle,
  Lock,
  Crown,
  History,
  RefreshCw
} from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
// UPDATED: Added calculateTableHeight to imports
import { isHtmlContent, getImageDimensions, calculateTableHeight } from "@/lib/canvas-utils";
import { formatContent } from "@/lib/formatter";
import QRCode from "qrcode";
import { type CanvasElement, availableFonts, openSourceFontMap } from "@shared/schema";
import { UpgradeDialog } from "@/components/dialogs/UpgradeDialog";

// History Item Interface
interface HistoryItem {
  id: string;
  status: string;
  type: string;
  createdAt: string;
  fileName: string;
  projectName?: string; // Optional field
  downloadUrl: string | null;
}

// --- NEW HELPER: Extract unique fonts used in elements ---
const getUsedFontsInElements = (elements: CanvasElement[]) => {
  const fonts = new Set<string>();
  elements.forEach(el => {
    // Standard Text/DataField Style
    if (el.textStyle?.fontFamily) fonts.add(el.textStyle.fontFamily);

    // Table specific styles
    if (el.type === 'table' && el.tableSettings) {
      if (el.tableSettings.headerStyle?.fontFamily) fonts.add(el.tableSettings.headerStyle.fontFamily);
      if (el.tableSettings.rowStyle?.fontFamily) fonts.add(el.tableSettings.rowStyle.fontFamily);
    }

    // TOC specific styles
    if (el.type === 'toc-list' && el.tocSettings) {
      if (el.tocSettings.titleStyle?.fontFamily) fonts.add(el.tocSettings.titleStyle.fontFamily);
      if (el.tocSettings.chapterStyle?.fontFamily) fonts.add(el.tocSettings.chapterStyle.fontFamily);
    }
  });
  return Array.from(fonts);
};

export function ExportTab() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<"idle" | "success" | "error" | "cancelled">("idle");
  const [filenamePattern, setFilenamePattern] = useState("");
  const [projectName, setProjectName] = useState(""); // New State
  const [exportMode, setExportMode] = useState<"digital" | "print">("digital");
  const [hasLowQualityImages, setHasLowQualityImages] = useState(false);

  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  // UX State for Bulk Export
  const [currentAction, setCurrentAction] = useState(""); 
  const [timeRemaining, setTimeRemaining] = useState("");
  const abortRef = useRef(false); // To handle cancellation

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const { toast } = useToast();
  const { isPro, isLoading } = useSubscription();

  const {
    exportSettings,
    setExportSettings,
    elements: currentElements,
    excelData,
    canvasWidth,
    canvasHeight,
    backgroundColor,
    selectedRowIndex,
    pageCount,
    isCatalogMode,
    catalogSections,
    chapterDesigns,
    activeSectionType, 
    activeChapterGroup 
  } = useCanvasStore();

  useEffect(() => {
    const checkImageQuality = async () => {
      if (exportMode !== 'print') {
        setHasLowQualityImages(false);
        return;
      }

      let foundIssue = false;
      for (const element of currentElements) {
        if (element.type === 'image' && element.visible) {
          let url = element.imageSrc;
          if (element.dataBinding && excelData && excelData.rows[selectedRowIndex]) {
             url = excelData.rows[selectedRowIndex][element.dataBinding] || url;
          }

          if (url) {
            const dimensions = await getImageDimensions(url);
            if (dimensions && element.dimension.width > 0) {
              const effectiveDpi = (dimensions.width / element.dimension.width) * 96;
              if (effectiveDpi < 295) {
                foundIssue = true;
                break;
              }
            }
          }
        }
      }
      setHasLowQualityImages(foundIssue);
    };

    checkImageQuality();
  }, [currentElements, excelData, selectedRowIndex, exportMode]);

  // Load History on Mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
        const res = await fetch("/api/export/history");
        if (res.ok) {
            const data = await res.json();
            setHistory(data);
        }
    } catch (err) {
        console.error("Failed to load history", err);
    } finally {
        setLoadingHistory(false);
    }
  };

  // --- Helper Functions ---

  const insertVariable = (header: string) => {
    setFilenamePattern((prev) => `${prev}{{${header}}}`);
  };

  const getConstructedFilename = (rowIndex: number) => {
    if (!filenamePattern.trim()) {
      const timestamp = new Date().toISOString().slice(0, 10);
      return `specsheet-${timestamp}`;
    }

    let finalName = filenamePattern;
    const rowData = excelData?.rows[rowIndex] || {};

    const dateStr = new Date().toISOString().slice(0, 10);
    finalName = finalName.replace(/{{Date}}/gi, dateStr);

    finalName = finalName.replace(/{{(.*?)}}/g, (match, p1) => {
      const headerName = p1.trim();
      if (rowData[headerName] !== undefined && rowData[headerName] !== null) {
        return String(rowData[headerName]);
      }
      return ""; 
    });

    return finalName.replace(/[^a-z0-9\s\-_.]/gi, "_");
  };

  const compressImage = async (
    imgSrc: string, 
    maxWidth: number, 
    maxHeight: number, 
    quality: number,
    forceJpeg: boolean = false // Added parameter to handle regression
  ): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.naturalWidth;
        let height = img.naturalHeight;
        const scale = Math.min(1, maxWidth / width, maxHeight / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(imgSrc);
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // --- CRITICAL FIX: REGRESSION RESOLUTION ---
        // Lossless PNG re-encoding was causing huge file sizes.
        // In "Digital" mode, we now force JPEG conversion to enable lossy compression.
        const isPNG = !forceJpeg && (imgSrc.toLowerCase().includes(".png") || imgSrc.startsWith("data:image/png"));

        if (isPNG) {
           resolve(canvas.toDataURL("image/png"));
        } else {
           resolve(canvas.toDataURL("image/jpeg", quality));
        }
      };
      img.onerror = () => resolve(imgSrc);
      img.src = imgSrc;
    });
  };

  // --- HTML Generator Engine ---
  const renderPageHTML = async (
    targetElements: CanvasElement[], 
    rowData: Record<string, string> = {}, 
    bg: string = "#ffffff",
    pageMap: Array<{ title: string, page: number, group?: string }> = [] 
  ) => {
    const container = document.createElement("div");
    container.style.width = `${canvasWidth}px`;
    container.style.height = `${canvasHeight}px`;
    container.style.backgroundColor = bg;
    container.style.position = "relative";
    container.style.overflow = "hidden";

    const sourceData = Object.keys(rowData).length > 0 ? rowData : (excelData?.rows[selectedRowIndex] || {});

    // --- BLOCK START: DYNAMIC EXPORT PRE-FLIGHT (DELTA & DOMINO LOGIC) ---
    // This strictly mirrors CanvasElement.tsx to ensure the PDF looks exactly like the editor

    // 1. Create a simulation map of where everything is currently
    // We use this to track positions as they move during the wave
    const simulatedPositions = new Map(targetElements.map(el => [el.id, { ...el.position, width: el.dimension.width, height: el.dimension.height }]));

    // 2. Identify Driver Tables (Top to Bottom)
    // We sort by Y so top tables push lower elements (including lower tables) correctly
    const driverTables = targetElements
        .filter(el => el.type === 'table' && el.tableSettings?.autoHeightAdaptation)
        .sort((a, b) => a.position.y - b.position.y);

    driverTables.forEach(table => {
        const settings = table.tableSettings!;
        const groupValue = settings.groupByField ? sourceData[settings.groupByField] : null;

        // Calculate correct height using the shared utility
        const correctH = calculateTableHeight(table, excelData ? excelData.rows : [], groupValue);

        // Get current state from simulation (it might have already moved down due to a table above it)
        const currentSimState = simulatedPositions.get(table.id)!;

        // Calculate Delta
        const heightDelta = correctH - currentSimState.height;

        if (Math.abs(heightDelta) > 0.5) {
            // Update the table's height in the simulation
            simulatedPositions.set(table.id, { ...currentSimState, height: correctH });

            // Start the Domino Wave
            // We use the current simulated position (which includes prior shifts) to start the push
            const waveQueue = [{ 
                id: table.id, 
                delta: heightDelta, 
                rect: { ...currentSimState, height: correctH } // Use new height for overlap check
            }];

            const processedInWave = new Set<string>([table.id]);

            while (waveQueue.length > 0) {
                const pusher = waveQueue.shift()!;

                targetElements.forEach(candidate => {
                    // Skip self, already processed in this wave, or LOCKED elements
                    if (candidate.id === pusher.id || processedInWave.has(candidate.id) || candidate.locked) return;

                    const candPos = simulatedPositions.get(candidate.id)!;

                    // Horizontal Overlap Check
                    const hasHorizontalOverlap = 
                        (candPos.x < pusher.rect.x + pusher.rect.width) && 
                        (candPos.x + candPos.width > pusher.rect.x);

                    // Vertical Check: Strictly below the pusher's top edge
                    // (Using top edge > pusher.y is safer to avoid moving top-aligned headers)
                    if (hasHorizontalOverlap && candPos.y > pusher.rect.y) {

                        // Apply Delta (Push or Pull)
                        const newY = candPos.y + pusher.delta;
                        const newRect = { ...candPos, y: newY };

                        simulatedPositions.set(candidate.id, newRect);

                        // Add to queue to propagate the shift to items below IT
                        waveQueue.push({
                            id: candidate.id,
                            delta: pusher.delta,
                            rect: newRect
                        });

                        processedInWave.add(candidate.id);
                    }
                });
            }
        }
    });
    // --- BLOCK END: DYNAMIC EXPORT PRE-FLIGHT ---

    const sortedElements = [...targetElements].sort((a, b) => a.zIndex - b.zIndex);

    for (const element of sortedElements) {
      if (!element.visible) continue;

      const elementDiv = document.createElement("div");
      elementDiv.style.position = "absolute";

      // USE SIMULATED POSITIONS FOR RENDERING
      const simState = simulatedPositions.get(element.id)!;

      elementDiv.style.left = `${simState.x}px`;
      elementDiv.style.top = `${simState.y}px`;
      elementDiv.style.width = `${simState.width}px`;
      elementDiv.style.height = `${simState.height}px`;

      elementDiv.style.transform = element.rotation ? `rotate(${element.rotation}deg)` : "";
      elementDiv.style.boxSizing = "border-box";
      elementDiv.style.zIndex = String(element.zIndex ?? 0);
      elementDiv.style.overflow = "hidden"; // CLIPS TEXT TO PRESERVE GAP BETWEEN ELEMENTS

      // --- TEXT & DATA FIELDS ---
      if (element.type === "text" || element.type === "dataField") {
         const elementId = `el-${element.id}`; 
         elementDiv.id = elementId;

         const textStyle = element.textStyle || {};
         const rawFont = textStyle.fontFamily || "Inter";
         const mappedFont = openSourceFontMap[rawFont] || rawFont;
         elementDiv.style.fontFamily = `"${mappedFont}", sans-serif`;

         elementDiv.style.fontSize = `${textStyle.fontSize || 16}px`;
         elementDiv.style.fontWeight = String(textStyle.fontWeight || 400);
         elementDiv.style.color = textStyle.color || "#000000";
         elementDiv.style.lineHeight = String(textStyle.lineHeight || 1.5);
         elementDiv.style.letterSpacing = `${textStyle.letterSpacing || 0}px`;
         elementDiv.style.display = "flex";
         elementDiv.style.flexDirection = "column";
         elementDiv.style.padding = "0px"; // REMOVED 4px PADDING
         elementDiv.style.wordBreak = "break-word";
         elementDiv.style.overflow = "visible";

         const hAlign = textStyle.textAlign || "left";
         elementDiv.style.textAlign = hAlign;

         const vAlign = textStyle.verticalAlign || "middle";
         const justifyMap: Record<string, string> = { top: "flex-start", middle: "center", bottom: "flex-end" };
         elementDiv.style.justifyContent = justifyMap[vAlign];
         elementDiv.style.alignItems = hAlign === "center" ? "center" : hAlign === "right" ? "flex-end" : "flex-start";

         let content = element.content || (element.dataBinding ? `{{${element.dataBinding}}}` : "");

         content = content.replace(/{{(.*?)}}/g, (match, p1) => {
             const fieldName = p1.trim();
             const val = sourceData[fieldName];
             return val !== undefined ? val : match;
         });

         content = formatContent(content, element.format);
         const hasHtml = isHtmlContent(content);
         elementDiv.style.whiteSpace = hasHtml ? "normal" : "pre-wrap";

         if (hasHtml) {
            const listStyleProp = element.format?.listStyle;
            const hasCustomListStyle = listStyleProp && listStyleProp !== 'none';
            const styles = `<style>
                #${elementId} ul, #${elementId} ol { margin: 0 !important; padding-left: 1.5em !important; display: block !important; ${hasCustomListStyle ? `list-style-type: ${listStyleProp} !important;` : ''} }
                #${elementId} li { position: relative !important; margin: 0.2em 0 !important; display: list-item !important; }
                #${elementId} p { margin: 0.2em 0; }
              </style>`;
            elementDiv.innerHTML = styles + content;
         } else {
            elementDiv.textContent = content;
         }
      } 
      // --- SHAPES ---
      else if (element.type === "shape") {
         const shapeStyle = element.shapeStyle || {};
         elementDiv.style.opacity = String(shapeStyle.opacity || 1);

         if (element.shapeType === "line") {
            elementDiv.style.display = "flex";
            elementDiv.style.alignItems = "center";
            elementDiv.style.justifyContent = "center";
            const lineStroke = document.createElement("div");
            lineStroke.style.width = "100%";
            lineStroke.style.height = `${shapeStyle.strokeWidth || 1}px`;
            lineStroke.style.backgroundColor = shapeStyle.stroke || "#9ca3af";
            elementDiv.appendChild(lineStroke);
         } else {
            elementDiv.style.backgroundColor = shapeStyle.fill || "#e5e7eb";
            elementDiv.style.border = `${shapeStyle.strokeWidth || 1}px solid ${shapeStyle.stroke || "#9ca3af"}`;
            elementDiv.style.borderRadius = element.shapeType === "circle" ? "50%" : `${shapeStyle.borderRadius || 0}px`;
         }
      } 
      // --- IMAGES ---
      else if (element.type === "image") {
         let imgSrc = element.imageSrc;
         if (element.dataBinding && sourceData[element.dataBinding]) {
            imgSrc = sourceData[element.dataBinding];
         }

         if (imgSrc) {
           const img = document.createElement("img");
           if (exportMode === "digital") {
               try {
                 const compressedSrc = await compressImage(imgSrc, element.dimension.width * 2, element.dimension.height * 2, 0.75, true);
                 img.src = compressedSrc;
               } catch { img.src = imgSrc; }
           } else {
               img.src = imgSrc;
           }
           img.style.width = "100%";
           img.style.height = "100%";
           img.style.objectFit = "contain";
           elementDiv.appendChild(img);
         }
      } 
      // --- QR CODES ---
      else if (element.type === "qrcode") { 
         let content = element.content || "https://doculoom.io";
         content = content.replace(/{{(.*?)}}/g, (match, p1) => {
             const fieldName = p1.trim();
             const val = sourceData[fieldName];
             return val !== undefined ? val : match;
         });

         if (content) {
             try {
                 const svgString = await QRCode.toString(content, {
                    type: 'svg',
                    errorCorrectionLevel: 'H',
                    margin: 0, 
                    color: { dark: element.textStyle?.color || '#000000', light: '#00000000' }
                 });
                 elementDiv.innerHTML = svgString;
                 const svgEl = elementDiv.querySelector("svg");
                 if (svgEl) { svgEl.style.width = "100%"; svgEl.style.height = "100%"; }
             } catch (e) { console.error("Error generating QR", e); }
         }
      }
      // --- TABLE EXPORT (ACROBAT WYSIWYG FIX) ---
      else if (element.type === "table") {
         const tableSettings = element.tableSettings;
         if (tableSettings) {
             const tableEl = document.createElement("table");

             // ACROBAT FIX: Use separate borders to prevent inconsistent thickness artifacts
             tableEl.style.width = "100%";
             tableEl.style.height = "100%";
             tableEl.style.borderCollapse = "separate"; 
             tableEl.style.borderSpacing = "0";
             tableEl.style.backgroundColor = "#ffffff";
             tableEl.style.tableLayout = "fixed"; 

             const bWidth = tableSettings.borderWidth || 1;
             const bColor = tableSettings.borderColor || "#e5e7eb";
             tableEl.style.borderTop = `${bWidth}px solid ${bColor}`;
             tableEl.style.borderLeft = `${bWidth}px solid ${bColor}`;

             // Data resolution
             const isPropertiesTable = tableSettings.variant === "properties";
             let displayRows: any[] = [];

             if (isPropertiesTable && tableSettings.staticData) {
                 // Properties tables use static data with variable substitution
                 const valueColHeader = tableSettings.columns[1]?.header || "Value";

                 displayRows = tableSettings.staticData
                     .map((row: Record<string, string>) => {
                         const processedRow: Record<string, string> = {};
                         let valueHadVariable = false;
                         let resolvedValueIsEmpty = false;

                         for (const [key, val] of Object.entries(row)) {
                             let processedVal = val || "";

                             // Check if this is the value column and if it contains variables
                             const hasVariable = /{{.*?}}/.test(processedVal);
                             if (key === valueColHeader && hasVariable) {
                                 valueHadVariable = true;
                             }

                             // Substitute variables with product data
                             if (hasVariable) {
                                 processedVal = processedVal.replace(/{{(.*?)}}/g, (match, p1) => {
                                     const fieldName = p1.trim();
                                     return sourceData[fieldName] !== undefined ? sourceData[fieldName] : "";
                                 });
                             }

                             // Check if the resolved value is empty (for the value column)
                             if (key === valueColHeader && valueHadVariable) {
                                 resolvedValueIsEmpty = processedVal.trim() === "";
                             }

                             processedRow[key] = processedVal;
                         }

                         // Attach metadata for filtering
                         return { ...processedRow, _hideRow: valueHadVariable && resolvedValueIsEmpty };
                     })
                     .filter((row: any) => !row._hideRow)
                     .map(({ _hideRow, ...rest }: any) => rest); // Remove metadata from final rows
             } else if (excelData && excelData.rows.length > 0) {
                 // Standard tables use Excel data
                 if (tableSettings.groupByField) {
                     const groupVal = sourceData[tableSettings.groupByField];
                     displayRows = groupVal ? excelData.rows.filter(r => r[tableSettings.groupByField!] === groupVal) : [sourceData];
                 } else {
                     displayRows = [sourceData];
                 }
             }

             // --- THEAD (HEADER) ---
             const thead = document.createElement("thead");
             const headerRow = document.createElement("tr");
             headerRow.style.backgroundColor = tableSettings.headerBackgroundColor || "#f3f4f6";

             const hRaw = tableSettings.headerStyle?.fontFamily || "Inter";
             const hMapped = openSourceFontMap[hRaw] || hRaw;
             const hFont = `"${hMapped}", sans-serif`;
             const totalWidth = tableSettings.columns.reduce((acc, c) => acc + (c.width || 100), 0);

             // Properties tables use 40%/60% split by default for key/value layout
             const getColumnWidth = (col: any, idx: number) => {
                 if (isPropertiesTable && tableSettings.columns.length === 2) {
                     return idx === 0 ? "40%" : "60%";
                 }
                 return `${((col.width || 100) / totalWidth) * 100}%`;
             };

             tableSettings.columns.forEach((col: any, idx: number) => {
                 const th = document.createElement("th");
                 th.textContent = col.header;
                 th.style.width = getColumnWidth(col, idx);
                 th.style.padding = "2px 4px"; // MATCHES COMPACT CANVAS HEADER PADDING
                 th.style.borderBottom = `${bWidth}px solid ${bColor}`;
                 th.style.borderRight = `${bWidth}px solid ${bColor}`;
                 th.style.fontFamily = hFont;
                 th.style.fontSize = `${tableSettings.headerStyle?.fontSize || 14}px`;
                 th.style.fontWeight = String(tableSettings.headerStyle?.fontWeight || 700);
                 th.style.color = tableSettings.headerStyle?.color || "#000";

                 const alignment = col.headerAlign || tableSettings.headerStyle?.textAlign || 'left';
                 th.style.textAlign = alignment;
                 th.style.verticalAlign = "middle";
                 th.style.whiteSpace = "nowrap";
                 th.style.overflow = "hidden";
                 th.style.textOverflow = "ellipsis";

                 headerRow.appendChild(th);
             });
             thead.appendChild(headerRow);
             tableEl.appendChild(thead);

             // --- TBODY (BODY) ---
             const tbody = document.createElement("tbody");
             const rRaw = tableSettings.rowStyle?.fontFamily || "Inter";
             const rMapped = openSourceFontMap[rRaw] || rRaw;
             const rFont = `"${rMapped}", sans-serif`;

             displayRows.forEach((row, rIdx) => {
                 const tr = document.createElement("tr");
                 tr.style.backgroundColor = (tableSettings.alternateRowColor && rIdx % 2 === 1) 
                    ? tableSettings.alternateRowColor 
                    : tableSettings.rowBackgroundColor || "#fff";

                 tableSettings.columns.forEach((col: any) => {
                     const td = document.createElement("td");
                     // Properties tables use header as key, standard tables use dataField
                     td.textContent = isPropertiesTable
                         ? (row[col.header] || "-")
                         : (row[col.dataField || ""] || "-");
                     td.style.padding = "0px 4px"; // MATCHES COMPACT CANVAS ROW PADDING
                     td.style.borderBottom = `${bWidth}px solid ${bColor}`;
                     td.style.borderRight = `${bWidth}px solid ${bColor}`;
                     td.style.fontFamily = rFont;
                     td.style.fontSize = `${tableSettings.rowStyle?.fontSize || 12}px`;
                     td.style.fontWeight = String(tableSettings.rowStyle?.fontWeight || 400);
                     td.style.color = tableSettings.rowStyle?.color || "#000";

                     const alignment = col.rowAlign || tableSettings.rowStyle?.textAlign || 'left';
                     td.style.textAlign = alignment;
                     td.style.verticalAlign = "middle";

                     // ENSURES TEXT CLIPPING MATCHES CANVAS TRUNCATION
                     td.style.whiteSpace = "nowrap"; 
                     td.style.overflow = "hidden";
                     td.style.textOverflow = "ellipsis";

                     tr.appendChild(td);
                 });
                 tbody.appendChild(tr);
             });
             tableEl.appendChild(tbody);

             elementDiv.appendChild(tableEl);
         }
      }
      // --- TABLE OF CONTENTS (TOC) ---
      else if (element.type === "toc-list") {
         const settings = element.tocSettings || { title: "Table of Contents", showTitle: true, columnCount: 1 };
         const columnCount = settings.columnCount || 1;

         elementDiv.style.padding = "16px"; 
         elementDiv.style.display = "flex";
         elementDiv.style.flexDirection = "column";
         elementDiv.style.backgroundColor = "#ffffff"; 
         elementDiv.style.border = "1px dashed rgba(100, 100, 100, 0.2)"; 
         elementDiv.style.borderRadius = "4px"; 

         const itemsToRender: any[] = (element as any)._renderItems || [];
         const isPaged = (element as any)._isPaged || false;

         if (settings.showTitle && (!isPaged || (element as any)._isFirstPage)) {
             const titleDiv = document.createElement("div");
             titleDiv.textContent = settings.title;
             const tRaw = settings.titleStyle?.fontFamily || "Inter";
             const tMapped = openSourceFontMap[tRaw] || tRaw;
             titleDiv.style.fontFamily = `"${tMapped}", sans-serif`;
             titleDiv.style.fontSize = `${settings.titleStyle?.fontSize}px`;
             titleDiv.style.fontWeight = String(settings.titleStyle?.fontWeight);
             titleDiv.style.color = settings.titleStyle?.color || "#000";
             titleDiv.style.textAlign = settings.titleStyle?.textAlign || "left";
             titleDiv.style.marginBottom = "10px";
             titleDiv.style.lineHeight = String(settings.titleStyle?.lineHeight || 1.2);
             titleDiv.style.flexShrink = "0"; 
             elementDiv.appendChild(titleDiv);
         }

         const listDiv = document.createElement("div");
         listDiv.style.flex = "1";
         listDiv.style.overflow = "hidden";
         const bRaw = element.textStyle?.fontFamily || "Inter";
         const bMapped = openSourceFontMap[bRaw] || bRaw;
         listDiv.style.fontFamily = `"${bMapped}", sans-serif`;
         listDiv.style.fontSize = `${element.textStyle?.fontSize || 14}px`;
         listDiv.style.color = element.textStyle?.color || "#000000";
         listDiv.style.lineHeight = String(element.textStyle?.lineHeight || 1.5);
         listDiv.style.fontWeight = String(element.textStyle?.fontWeight || 400);

         if (columnCount > 1) {
             listDiv.style.columnCount = String(columnCount);
             listDiv.style.columnGap = "24px"; 
             listDiv.style.setProperty("column-fill", "auto");
         }

         // FIX: Use the pageMap (calculated structure) if available, falling back to dummy
         const effectivePageMap = pageMap.length > 0 ? pageMap : itemsToRender;

         if (effectivePageMap.length > 0) {
             const groupBy = settings.groupByField;
             if (groupBy && pageMap.length > 0) {
                 const groups: Record<string, any[]> = {};
                 pageMap.forEach(item => {
                     const key = item.group || "Uncategorized";
                     if (!groups[key]) groups[key] = [];
                     groups[key].push(item);
                 });

                 Object.keys(groups).forEach(groupTitle => {
                     listDiv.appendChild(createTocHeaderDiv(groupTitle, settings));
                     groups[groupTitle].forEach(item => {
                         listDiv.appendChild(createTocItemDiv(item, element.textStyle || {}));
                     });
                 });
             } else {
                 effectivePageMap.forEach(item => {
                     if (item.type === "header") {
                         listDiv.appendChild(createTocHeaderDiv(item.text, settings));
                     } else {
                         listDiv.appendChild(createTocItemDiv(item, element.textStyle || {}));
                     }
                 });
             }
         }
         elementDiv.appendChild(listDiv);
      }

      container.appendChild(elementDiv);
    }

    // WATERMARK INJECTION FOR FREE USERS
    if (!isPro) {
        const watermark = document.createElement("div");
        watermark.style.position = "absolute";
        watermark.style.bottom = "16px";
        watermark.style.right = "16px";
        watermark.style.opacity = "0.5";
        watermark.style.pointerEvents = "none";
        watermark.style.zIndex = "9999";
        watermark.style.fontFamily = "sans-serif";
        watermark.style.fontSize = "12px";
        watermark.style.color = "#000000";
        watermark.style.backgroundColor = "rgba(255,255,255,0.7)";
        watermark.style.padding = "4px 8px";
        watermark.style.borderRadius = "4px";
        watermark.innerHTML = "Created with <b>Doculoom</b>";
        container.appendChild(watermark);
    }

    return container.outerHTML;
  };

  const createTocHeaderDiv = (text: string, settings: any) => {
      const div = document.createElement("div");
      div.textContent = text;
      const cRaw = settings.chapterStyle?.fontFamily || "Inter";
      const cMapped = openSourceFontMap[cRaw] || cRaw;
      div.style.fontFamily = `"${cMapped}", sans-serif`;
      div.style.fontSize = `${settings.chapterStyle?.fontSize || 18}px`; 
      div.style.fontWeight = String(settings.chapterStyle?.fontWeight || 600);
      div.style.color = settings.chapterStyle?.color || "#333";
      div.style.textAlign = settings.chapterStyle?.textAlign || "left";
      div.style.lineHeight = String(settings.chapterStyle?.lineHeight || 1.1); 
      div.style.marginTop = "0px"; 
      div.style.marginBottom = "0px";
      div.style.breakInside = "avoid"; 
      return div;
  };

  const createTocItemDiv = (item: {title: string, page: number}, style: any) => {
      const div = document.createElement("div");
      div.style.display = "flex"; 
      div.style.justifyContent = "space-between"; 
      div.style.alignItems = "baseline";
      div.style.marginBottom = "0px"; 
      div.style.paddingBottom = "2px"; 
      const raw = style.fontFamily || "Inter";
      const mapped = openSourceFontMap[raw] || raw;
      div.style.fontFamily = `"${mapped}", sans-serif`;
      div.style.fontSize = `${style.fontSize || 14}px`;
      div.style.color = style.color || "#000000";
      div.style.lineHeight = String(style.lineHeight || 1.5);
      div.style.fontWeight = String(style.fontWeight || 400);
      div.style.breakInside = "avoid"; 
      const titleSpan = document.createElement("span");
      titleSpan.textContent = item.title;
      titleSpan.style.backgroundColor = "#fff"; 
      titleSpan.style.paddingRight = "5px";
      titleSpan.style.position = "relative";
      titleSpan.style.zIndex = "10";
      titleSpan.style.overflow = "hidden";
      titleSpan.style.textOverflow = "ellipsis";
      titleSpan.style.whiteSpace = "nowrap";
      const pageSpan = document.createElement("span");
      pageSpan.textContent = String(item.page);
      pageSpan.style.backgroundColor = "#fff";
      pageSpan.style.paddingLeft = "5px";
      pageSpan.style.position = "relative";
      pageSpan.style.zIndex = "10";
      div.appendChild(titleSpan); div.appendChild(pageSpan);
      return div;
  };

  // --- ASYNC POLLING HELPER ---
  const pollJobStatus = async (jobId: string) => {
    return new Promise<{ resultUrl: string, fileName: string }>((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}`);
          if (!res.ok) throw new Error("Failed to check status");

          const job = await res.json();
          setProgress(job.progress || 10);

          if (job.status === "completed") {
            clearInterval(interval);
            // FIX: Prefer the signed 'downloadUrl' generated by backend
            resolve({ 
                resultUrl: job.downloadUrl || job.resultUrl, 
                fileName: job.fileName 
            });
          } else if (job.status === "failed") {
            clearInterval(interval);
            reject(new Error(job.error || "Export failed"));
          }
        } catch (e) {
          clearInterval(interval);
          reject(e);
        }
      }, 3000); 
    });
  };

  // --- DOWNLOAD TRIGGER HELPER (FIXED) ---
  const triggerDownload = (url: string, filename: string) => {
    try {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename); 
        // FIX: Removed target="_blank" because long-running async jobs 
        // lose user activation, causing popup blockers to block the window.open.
        // Since we use 'Content-Disposition: attachment', it will download safely 
        // without navigating away.
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) {
        console.error("Download trigger failed", e);
    }
  };

  // UPDATED: Accept usedFonts parameter to optimize loading
  const wrapHtmlWithStyles = (innerHtml: string, title: string, usedFonts: string[] = ["Inter"]) => {
    const finalFonts = usedFonts.length > 0 ? usedFonts : ["Inter"];

    const fontFamilies = finalFonts.map(font => {
      const googleFont = openSourceFontMap[font] || font;
      return `family=${googleFont.replace(/\s+/g, '+')}:wght@400;700`;
    }).join('&');

    return `<!DOCTYPE html><html><head><title>${title}</title>
          <link href="https://fonts.googleapis.com/css2?${fontFamilies}&display=swap" rel="stylesheet">
          <style>
            @page { size: ${canvasWidth}px ${canvasHeight}px; margin: 0; } 
            body { 
                margin: 0; 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
            }
            table { page-break-inside: avoid; }
          </style>
        </head><body>${innerHtml}</body></html>`;
  };

  const generatePDF = async () => {
    setIsExporting(true);
    setProgress(5);
    setExportStatus("idle");
    setCurrentAction("Rendering content...");

    try {
      let combinedHtml = "";
      for (let i = 0; i < pageCount; i++) {
        const pageHtml = await renderPageHTML(
            currentElements.filter(el => (el.pageIndex ?? 0) === i), 
            excelData?.rows[selectedRowIndex], 
            backgroundColor
        );
        combinedHtml += `<div class="page-container">${pageHtml}</div>`;
      }

      const desiredFilename = `${getConstructedFilename(selectedRowIndex)}.pdf`;

      // OPTIMIZED FONT LOADING
      const usedFonts = getUsedFontsInElements(currentElements);
      const fullHtml = wrapHtmlWithStyles(combinedHtml, desiredFilename, usedFonts);

      setCurrentAction("Queuing job...");

    const res = await fetch("/api/export/async/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: fullHtml,
          width: canvasWidth,
          height: canvasHeight,
          scale: exportMode === 'print' ? 3.125 : 2,
          colorModel: exportMode === 'print' ? 'cmyk' : 'rgb',
          projectName: projectName || desiredFilename, 
          fileName: desiredFilename 
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to start export");
      }
      const { jobId } = await res.json();

      setCurrentAction("Processing on server...");
      const { resultUrl } = await pollJobStatus(jobId);

      triggerDownload(resultUrl, desiredFilename);

      setExportStatus("success");
      toast({ title: "Success", description: "PDF downloaded successfully." });
    } catch (error: any) {
      setExportStatus("error");
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
      setProgress(100);
      fetchHistory(); // Refresh history
    }
  };

  const generateBulkPDFs = async () => {
    if (!excelData || excelData.rows.length === 0) return;
    setIsExporting(true);
    setProgress(0);
    setExportStatus("idle");
    setCurrentAction("Preparing bulk data...");

    try {
      const items: { html: string; filename: string }[] = [];
      const total = Math.min(excelData.rows.length, 50);

      const usedFilenames = new Set<string>();

      // OPTIMIZED FONT LOADING
      const usedFonts = getUsedFontsInElements(currentElements);

      for (let i = 0; i < total; i++) {
        setCurrentAction(`Preparing item ${i + 1}/${total}...`);
        const rowData = excelData.rows[i];

        let baseName = getConstructedFilename(i);
        let uniqueName = baseName;
        let counter = 1;

        while (usedFilenames.has(uniqueName)) {
            uniqueName = `${baseName}_${counter}`;
            counter++;
        }
        usedFilenames.add(uniqueName);

        let itemHtml = "";
        for (let p = 0; p < pageCount; p++) {
          const pageContent = await renderPageHTML(currentElements.filter(el => (el.pageIndex ?? 0) === p), rowData, backgroundColor);
          itemHtml += `<div class="page-container">${pageContent}</div>`;
        }

        items.push({ 
          html: wrapHtmlWithStyles(itemHtml, uniqueName, usedFonts), 
          filename: uniqueName 
        });

        await new Promise(r => setTimeout(r, 0));
        setProgress(Math.round((i / total) * 30)); 
      }

      // --- FIX: USE PROJECT NAME FOR ZIP ---
      const defaultBase = `Bulk_Export_${new Date().toISOString().slice(0, 10)}`;
      const baseName = projectName ? projectName : defaultBase;
      const zipFileName = `${baseName}.zip`;

      setCurrentAction("Uploading job...");
      const res = await fetch("/api/export/async/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            items, 
            width: canvasWidth, 
            height: canvasHeight, 
            scale: 2,
            projectName: baseName, // Pass project name
            fileName: zipFileName  // Pass zip filename
        }),
      });

      if (!res.ok) throw new Error("Failed to start bulk job");
      const { jobId } = await res.json();

      setCurrentAction("Server processing...");
      const { resultUrl, fileName } = await pollJobStatus(jobId);

      triggerDownload(resultUrl, fileName || zipFileName);

      setExportStatus("success");
    } catch (error: any) {
      setExportStatus("error");
      toast({ title: "Bulk Export Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsExporting(false);
      fetchHistory(); // Refresh history
    }
  };

  // --- NEW: GENERATE CATALOG (FULL CHUNKING SUPPORT) ---
  const generateCatalogPDF = async () => {
    if (!excelData || excelData.rows.length === 0) {
        toast({ title: "Error", description: "No data available for catalog.", variant: "destructive" });
        return;
    }

    setIsExporting(true);
    setProgress(5);
    setExportStatus("idle");
    setCurrentAction("Planning catalog structure...");

    try {
      // 1. STRUCTURE PLANNING
      let pageIndex = 1;
      const structure: Array<{ type: 'cover' | 'toc' | 'chapter' | 'product' | 'back', data?: any, group?: string }> = [];
      const pageMap: Array<{ title: string, page: number, group?: string }> = [];

      // A. COVER PAGE
      if (catalogSections.cover.elements.length > 0) {
          structure.push({ type: 'cover' });
          pageIndex++;
      }

      // B. TABLE OF CONTENTS
      if (catalogSections.toc.elements.length > 0) {
          structure.push({ type: 'toc' });
          pageIndex++; 
      }

      // C. PRODUCTS & CHAPTERS
      const tocElement = catalogSections.toc.elements.find(e => e.type === 'toc-list');
      const groupByField = tocElement?.tocSettings?.groupByField; 
      let currentGroup = "";

      // --- SMARTER TITLE COLUMN DETECTION ---
      const nameCandidates = ["name", "product name", "item name", "title", "model", "product", "description"];
      let titleKey = excelData.headers.find(h => nameCandidates.includes(h.toLowerCase()));

      if (!titleKey) {
          if (groupByField && excelData.headers[0] === groupByField && excelData.headers.length > 1) {
              titleKey = excelData.headers[1];
          } else {
              titleKey = excelData.headers[0];
          }
      }

      for (let i = 0; i < excelData.rows.length; i++) {
          const row = excelData.rows[i];

          // Handle Grouping / Chapter Dividers
          if (groupByField) {
              const groupVal = row[groupByField] || "Uncategorized";

              if (groupVal !== currentGroup) {
                  currentGroup = groupVal;

                  // --- FORCE CHAPTER PAGE IF GROUPING IS ENABLED ---
                  structure.push({ type: 'chapter', group: groupVal });
                  pageIndex++;
              }
          }

          const title = row[titleKey] || `Item ${i+1}`;

          pageMap.push({ title, page: pageIndex, group: currentGroup });
          structure.push({ type: 'product', data: row });
          pageIndex++;
      }

      // D. BACK COVER
      if (catalogSections.back.elements.length > 0) {
          structure.push({ type: 'back' });
      }

      // 2. Identify all fonts used across ALL sections and custom chapters
      const allElementsForFonts = [
        ...catalogSections.cover.elements,
        ...catalogSections.toc.elements,
        ...catalogSections.chapter.elements,
        ...catalogSections.product.elements,
        ...catalogSections.back.elements,
        ...Object.values(chapterDesigns).flatMap(d => d.elements)
      ];
      const usedFonts = getUsedFontsInElements(allElementsForFonts);

      // 3. CHUNKED RENDERING (Reduced Size for Stability)
      const CHUNK_SIZE = 5; 
      const chunks: string[] = [];

      let currentChunkHtml = "";
      let pagesInChunk = 0;

      for (let i = 0; i < structure.length; i++) {
          const item = structure[i];

          if (i % 5 === 0) {
              setCurrentAction(`Rendering page ${i + 1}/${structure.length}...`);
              setProgress(Math.round((i / structure.length) * 50));
          }

          let elements: CanvasElement[] = [];
          let bg = "#ffffff";
          let rowData: any = {};

          if (item.type === 'cover') { 
              elements = catalogSections.cover.elements; 
              bg = catalogSections.cover.backgroundColor; 
          } else if (item.type === 'toc') { 
              elements = catalogSections.toc.elements; 
              bg = catalogSections.toc.backgroundColor; 
          } else if (item.type === 'chapter') {
              const specificDesign = item.group ? chapterDesigns[item.group] : null;
              if (specificDesign && specificDesign.elements.length > 0) { 
                  elements = specificDesign.elements; 
                  bg = specificDesign.backgroundColor; 
              } else { 
                  elements = catalogSections.chapter.elements; 
                  bg = catalogSections.chapter.backgroundColor; 
              }
              rowData = { 
                  [groupByField || "Chapter"]: item.group, 
                  "Chapter Name": item.group,              
                  "Group": item.group 
              }; 
          } else if (item.type === 'product') { 
              elements = catalogSections.product.elements; 
              bg = catalogSections.product.backgroundColor; 
              rowData = item.data; 
          } else if (item.type === 'back') { 
              elements = catalogSections.back.elements; 
              bg = catalogSections.back.backgroundColor; 
          }

          const pageHtml = await renderPageHTML(elements, rowData, bg, pageMap);

          currentChunkHtml += `
              <div class="page-container" style="position: relative; width: ${canvasWidth}px; height: ${canvasHeight}px; page-break-after: always; overflow: hidden;">
                  ${pageHtml}
              </div>
          `;
          pagesInChunk++;

          if (pagesInChunk >= CHUNK_SIZE || i === structure.length - 1) {
              chunks.push(wrapHtmlWithStyles(currentChunkHtml, `Chunk`, usedFonts));
              currentChunkHtml = "";
              pagesInChunk = 0;
          }

          await new Promise(r => setTimeout(r, 0));
      }

      // --- FIX: USE FILENAME PATTERN ---
      const filenameBase = getConstructedFilename(0); 
      const filename = `${filenameBase}.pdf`;

      setCurrentAction("Uploading chunks...");

      const res = await fetch("/api/export/async/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: chunks, // Send chunks instead of full HTML
          width: canvasWidth,
          height: canvasHeight,
          scale: exportMode === 'print' ? 3.125 : 2, 
          colorModel: exportMode === 'print' ? 'cmyk' : 'rgb',
          type: "pdf_catalog",
          projectName: projectName || filenameBase, 
          fileName: filename 
        }),
      });

      if (!res.ok) throw new Error("Failed to start catalog export");
      const { jobId } = await res.json();

      setCurrentAction("Processing catalog (this may take a few minutes)...");
      const { resultUrl } = await pollJobStatus(jobId);

      triggerDownload(resultUrl, filename);
      setExportStatus("success");
      toast({ title: "Success", description: "Catalog downloaded successfully." });

    } catch (error: any) {
        setExportStatus("error");
        toast({ title: "Catalog Error", description: error.message, variant: "destructive" });
    } finally {
        setIsExporting(false);
        setProgress(100);
        fetchHistory(); // Refresh history
    }
  };

  const handleCancelExport = () => {
    abortRef.current = true;
    setIsExporting(false);
    setExportStatus("cancelled");
    setCurrentAction("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <UpgradeDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog} />

        {/* File Naming Section */}
        <div>
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            Project & File Naming
          </h3>
          <div className="space-y-3">
             <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Project Name (For History)</Label>
                <Input 
                   value={projectName}
                   onChange={(e) => setProjectName(e.target.value)}
                   placeholder="e.g. Winter 2025 Collection"
                   className="font-mono text-xs"
                />
             </div>

             <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Filename Pattern (For File)</Label>
                <Input 
                   value={filenamePattern}
                   onChange={(e) => setFilenamePattern(e.target.value)}
                   placeholder="e.g. Specsheet-{{Model}}-{{Date}}"
                   className="font-mono text-xs"
                   data-testid="input-filename-pattern"
                />
                <p className="text-[10px] text-muted-foreground">
                   Use valid characters only. Illegal characters will be replaced with _.
                </p>
             </div>

             {excelData && excelData.headers.length > 0 && (
                <div className="space-y-1.5">
                   <Label className="text-xs text-muted-foreground">Insert Variable</Label>
                   <div className="flex flex-wrap gap-1">
                      <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] bg-muted/50 hover:bg-muted border-dashed" onClick={() => setFilenamePattern((prev) => `${prev}{{Date}}`)}>
                         <Plus className="h-2 w-2 mr-1" /> Date
                      </Button>
                      {excelData.headers.map((header) => (
                         <Button key={header} variant="outline" size="sm" className="h-6 px-2 text-[10px] bg-muted/50 hover:bg-muted border-dashed" onClick={() => insertVariable(header)}>
                            <Plus className="h-2 w-2 mr-1" /> {header}
                         </Button>
                      ))}
                   </div>
                </div>
             )}
          </div>
        </div>

        <Separator />

        {/* Export Settings */}
        <div>
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Export Settings
          </h3>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Page Size</Label>
              <Select value={exportSettings.pageSize} onValueChange={(value) => setExportSettings({ pageSize: value as typeof exportSettings.pageSize })}>
                <SelectTrigger data-testid="select-export-page-size"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="letter">US Letter (8.5" x 11")</SelectItem>
                  <SelectItem value="a4">A4 (210mm x 297mm)</SelectItem>
                  <SelectItem value="legal">US Legal (8.5" x 14")</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Orientation</Label>
              <Select value={exportSettings.orientation} onValueChange={(value) => setExportSettings({ orientation: value as typeof exportSettings.orientation })}>
                <SelectTrigger data-testid="select-export-orientation"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 pt-2">
               <Label className="text-xs text-muted-foreground">Output Quality</Label>
               <div className="grid grid-cols-2 gap-2">
                  <div onClick={() => setExportMode("digital")} className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-all hover:bg-muted/50 ${exportMode === "digital" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"}`}>
                     <Monitor className={`h-5 w-5 ${exportMode === "digital" ? "text-primary" : "text-muted-foreground"}`} />
                     <div className="text-center"><p className="text-xs font-medium">Digital Ready</p><p className="text-[10px] text-muted-foreground">Compressed (Small)</p></div>
                  </div>

                  <div 
                    onClick={() => {
                        if (isPro || isLoading) setExportMode("print");
                        else setShowUpgradeDialog(true);
                    }} 
                    className={`relative cursor-pointer border rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-all 
                        ${(isPro || isLoading) ? "hover:bg-muted/50" : "opacity-70 bg-muted/10"} 
                        ${exportMode === "print" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"}`
                    }
                  >
                      {!isPro && !isLoading && <Lock className="absolute top-2 right-2 h-3 w-3 text-muted-foreground" />}
                      <Printer className={`h-5 w-5 ${exportMode === "print" ? "text-primary" : "text-muted-foreground"}`} />
                      <div className="text-center"><p className="text-xs font-medium">Print Ready</p><p className="text-[10px] text-muted-foreground">High Quality (Big)</p></div>
                  </div>
               </div>
            </div>

            {hasLowQualityImages && exportMode === "print" && (
               <Alert variant="destructive" className="mt-2 text-xs py-2 bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200">
                  <AlertTriangle className="h-4 w-4 !text-yellow-600 dark:!text-yellow-400" />
                  <AlertTitle className="text-xs font-semibold mb-1">Low Resolution Detected</AlertTitle>
                  <AlertDescription className="text-[10px] leading-tight opacity-90">Some images may appear pixelated in print (effective DPI &lt; 300).</AlertDescription>
               </Alert>
            )}
          </div>
        </div>

        <Separator />

        {/* Progress Bar (UPDATED UX) */}
        {isExporting && (
          <div className="space-y-3 bg-muted/30 p-3 rounded-md border border-primary/20">
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span>{currentAction || "Processing..."}</span>
                    </div>
                    {timeRemaining && (
                        <p className="text-xs text-muted-foreground pl-6">{timeRemaining}</p>
                    )}
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    onClick={handleCancelExport}
                    title="Cancel Export"
                >
                    <XCircle className="h-4 w-4" />
                </Button>
            </div>

            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Status Messages */}
        {!isExporting && exportStatus === "success" && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/50 p-3 rounded-lg">
            <CheckCircle2 className="h-4 w-4" />
            <span>Export completed successfully!</span>
          </div>
        )}

        {!isExporting && exportStatus === "error" && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span>Export failed. Please try again.</span>
          </div>
        )}

        {!isExporting && exportStatus === "cancelled" && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span>Export cancelled by user.</span>
          </div>
        )}

        {/* Buttons */}
        <div className="space-y-2">
          {/* UPDATED: Catalog Mode Button - Assume Pro/Unlocked while loading */}
          {isCatalogMode ? (
            <Button
              className={`w-full gap-2 ${(isPro || isLoading) ? "bg-purple-600 hover:bg-purple-700" : "bg-slate-200 text-slate-500 hover:bg-slate-200"}`}
              onClick={(isPro || isLoading) ? generateCatalogPDF : () => setShowUpgradeDialog(true)}
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : (isPro || isLoading) ? <Book className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {(isPro || isLoading) ? "Generate Full Catalog PDF" : "Unlock Catalog Export"}
            </Button>
          ) : (
            // BASIC MODE BUTTONS
            <>
              <Button
                className="w-full gap-2"
                onClick={generatePDF} // Calls new async function
                disabled={isExporting || currentElements.length === 0}
                data-testid="btn-export-pdf"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export as PDF (Async)
              </Button>

              {excelData && excelData.rows.length > 0 && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={generateBulkPDFs} // Calls new async function
                  disabled={isExporting}
                  data-testid="btn-export-bulk"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
                  Bulk Export as ZIP (Async)
                </Button>
              )}
            </>
          )}
        </div>

        {/* UPDATED: Free Plan Info Footer - Only show if NOT loading and NOT pro */}
        {!isPro && !isLoading && (
            <div 
              className="text-xs text-center p-2 bg-blue-50 text-blue-700 rounded border border-blue-100 flex flex-col gap-1 cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={() => setShowUpgradeDialog(true)}
              title="Click to upgrade"
            >
                <p className="font-semibold flex items-center justify-center gap-1"><Crown className="h-3 w-3" /> Free Plan Active</p>
                <p>Exports will include a watermark. <span className="underline">Upgrade to remove.</span></p>
            </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded-lg">
          <p className="font-medium">Tips:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Digital mode compresses images for email</li>
            <li>Print mode keeps original high-res images</li>
            <li>Text remains selectable in both modes</li>
          </ul>
        </div>

        {/* --- HISTORY SECTION --- */}
        <div className="mt-8 border-t pt-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Recent Exports
                </h3>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={fetchHistory} disabled={loadingHistory}>
                   <RefreshCw className={`h-3 w-3 ${loadingHistory ? "animate-spin" : ""}`} />
                </Button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {history.length === 0 && !loadingHistory && (
                    <p className="text-gray-500 text-xs italic">No export history found.</p>
                )}

                {history.map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-2.5 border rounded-lg bg-white/50 hover:bg-white transition-colors">
                        <div className="flex flex-col">
                            {/* UPDATED: Show Project Name if available, else show Type */}
                            <span className="font-medium text-xs truncate max-w-[150px]" title={job.projectName || job.fileName}>
                                {job.projectName || (job.type === 'pdf_catalog' ? '📚 Full Catalog' : '📄 Single Export')}
                            </span>
                            <span className="text-[10px] text-gray-400">
                                {new Date(job.createdAt).toLocaleString()}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Status Badge */}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${
                                job.status === 'completed' ? 'bg-green-100 text-green-700' :
                                job.status === 'failed' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                            }`}>
                                {job.status}
                            </span>

                            {/* Download Button */}
                            {job.status === 'completed' && job.downloadUrl && (
                                <a 
                                    href={job.downloadUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="text-xs bg-primary/10 text-primary hover:bg-primary hover:text-white px-2 py-1 rounded transition-colors no-underline"
                                    title="Download File"
                                >
                                    <Download className="h-3 w-3" />
                                </a>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </ScrollArea>
  );
}