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
  Crown
} from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import JSZip from "jszip";
import { isHtmlContent, getImageDimensions, paginateTOC } from "@/lib/canvas-utils";
import { formatContent } from "@/lib/formatter";
import QRCode from "qrcode";
import { type CanvasElement, availableFonts, openSourceFontMap } from "@shared/schema";
import { UpgradeDialog } from "@/components/dialogs/UpgradeDialog";

export function ExportTab() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<"idle" | "success" | "error" | "cancelled">("idle");
  const [filenamePattern, setFilenamePattern] = useState("");
  const [exportMode, setExportMode] = useState<"digital" | "print">("digital");
  const [hasLowQualityImages, setHasLowQualityImages] = useState(false);

  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  // UX State for Bulk Export
  const [currentAction, setCurrentAction] = useState(""); 
  const [timeRemaining, setTimeRemaining] = useState("");
  const abortRef = useRef(false); // To handle cancellation

  const { toast } = useToast();
  // UPDATED: Destructure isLoading to prevent UI flicker
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
    quality: number
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

        const isPNG = imgSrc.toLowerCase().includes(".png") || imgSrc.startsWith("data:image/png");

        if (isPNG) {
           const dataUrl = canvas.toDataURL("image/png");
           resolve(dataUrl);
        } else {
           const dataUrl = canvas.toDataURL("image/jpeg", quality);
           resolve(dataUrl);
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

    const sortedElements = [...targetElements].sort((a, b) => a.zIndex - b.zIndex);

    for (const element of sortedElements) {
      if (!element.visible) continue;

      const elementDiv = document.createElement("div");
      elementDiv.style.position = "absolute";
      elementDiv.style.left = `${element.position.x}px`;
      elementDiv.style.top = `${element.position.y}px`;
      elementDiv.style.width = `${element.dimension.width}px`;
      elementDiv.style.height = `${element.dimension.height}px`;
      elementDiv.style.transform = element.rotation ? `rotate(${element.rotation}deg)` : "";
      elementDiv.style.boxSizing = "border-box";
      elementDiv.style.zIndex = String(element.zIndex ?? 0);

      // --- TEXT & DATA FIELDS ---
      if (element.type === "text" || element.type === "dataField") {
         const elementId = `el-${element.id}`; 
         elementDiv.id = elementId;

         const textStyle = element.textStyle || {};
         // Map font name to Google Font name if applicable (e.g. Arial -> Arimo)
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
         elementDiv.style.padding = "4px";
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
                 const compressedSrc = await compressImage(imgSrc, element.dimension.width * 2, element.dimension.height * 2, 0.75);
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
      // --- TABLE OF CONTENTS (TOC) ---
      else if (element.type === "toc-list") {
         // ... existing toc logic ...
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

         if (itemsToRender.length > 0) {
             itemsToRender.forEach(item => {
                 if (item.type === "header") {
                     const chapterDiv = createTocHeaderDiv(item.text, settings);
                     listDiv.appendChild(chapterDiv);
                 } else {
                     const itemDiv = createTocItemDiv(item, element.textStyle || {});
                     listDiv.appendChild(itemDiv);
                 }
             });
         } else {
             const groupBy = settings.groupByField;
             if (groupBy) {
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
                 pageMap.forEach(item => {
                     listDiv.appendChild(createTocItemDiv(item, element.textStyle || {}));
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

  const fetchPdfBuffer = async (html: string, pages: number, title: string) => {
    // ... existing fetchPdfBuffer code ...
    const fontFamilies = availableFonts.map(font => {
        const googleFont = openSourceFontMap[font] || font;
        return `family=${googleFont.replace(/\s+/g, '+')}:wght@400;700`;
    }).join('&');

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <link href="https://fonts.googleapis.com/css2?${fontFamilies}&display=swap" rel="stylesheet">
          <style>
            @page { size: ${canvasWidth}px ${canvasHeight}px; margin: 0; }
            body { margin: 0; padding: 0; box-sizing: border-box; }
            * { box-sizing: inherit; }
            .page-container {
              width: ${canvasWidth}px;
              height: ${canvasHeight}px;
              page-break-after: always;
              page-break-inside: avoid;
              position: relative;
              overflow: hidden;
            }
            .page-container:last-child { page-break-after: auto; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `;

    const scaleFactor = exportMode === 'print' ? 3.125 : 2;
    const colorMode = exportMode === 'print' ? 'cmyk' : 'rgb';

    const response = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: fullHtml,
        width: canvasWidth,
        height: canvasHeight,
        scale: scaleFactor,
        pageCount: pages,
        colorModel: colorMode,
      }),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Server failed to generate PDF");
    }
    return await response.blob();
  };

  const generateFullCatalogPDF = async () => {
    // ... existing catalog generation logic ...
    if (!excelData || excelData.rows.length === 0) {
      toast({ title: "No Data", description: "Import Excel data to generate a catalog.", variant: "destructive" });
      return;
    }

    setIsExporting(true);
    setProgress(0);
    setExportStatus("idle");
    setCurrentAction("Preparing Catalog...");

    // ... (same as before, just omitting for brevity unless asked) ...
    const sectionsForExport = { ...catalogSections };
    const chaptersForExport = { ...chapterDesigns };

    if (isCatalogMode) {
        const currentData = {
            elements: currentElements,
            backgroundColor: backgroundColor
        };

        if (activeSectionType === 'chapter' && activeChapterGroup) {
            chaptersForExport[activeChapterGroup] = currentData;
        } else {
            sectionsForExport[activeSectionType] = {
                ...sectionsForExport[activeSectionType],
                elements: currentElements,
                backgroundColor: backgroundColor
            };
        }
    }

    try {
      let combinedHtml = "";
      let currentPageNumber = 1;
      const pageMap: Array<{ title: string, page: number, group?: string }> = [];

      // 1. COVER PAGE
      const coverSection = sectionsForExport.cover;
      if (coverSection && coverSection.elements.length > 0) {
         setCurrentAction("Generating Cover Page...");
         const coverHtml = await renderPageHTML(coverSection.elements, {}, coverSection.backgroundColor);
         combinedHtml += `<div class="page-container">${coverHtml}</div>`;
         currentPageNumber++;
      }

      // ... TOC Logic ...
      const tocSection = sectionsForExport.toc;
      let tocTitleField = "Name";
      let groupByField = undefined;
      let tocElement: CanvasElement | undefined;
      let chapterCoversEnabled = false;

      if (tocSection && tocSection.elements.length > 0) {
         tocElement = tocSection.elements.find(el => el.type === "toc-list");
         if (tocElement) {
             if (tocElement.dataBinding) tocTitleField = tocElement.dataBinding;
             if (tocElement.tocSettings?.groupByField) groupByField = tocElement.tocSettings.groupByField;
             chapterCoversEnabled = !!(groupByField && tocElement.tocSettings?.chapterCoversEnabled);
         }
      }

      const dummyMap: any[] = [];
      for (let i = 0; i < excelData.rows.length; i++) {
         const row = excelData.rows[i];
         const title = row[tocTitleField] || `Product ${i + 1}`;
         const group = groupByField ? row[groupByField] : undefined;
         dummyMap.push({ title, page: 0, group }); 
      }

      let tocPageCount = 0;
      let tocChunks: any[][] = [];

      if (tocElement) {
          tocChunks = paginateTOC(tocElement, dummyMap, tocElement.dimension.height);
          tocPageCount = tocChunks.length;
      }

      const productStartPage = currentPageNumber + tocPageCount;
      let productPageCounter = productStartPage;
      let currentGroup: string | undefined = undefined;

      for (let i = 0; i < excelData.rows.length; i++) {
         const row = excelData.rows[i];
         const title = row[tocTitleField] || `Product ${i + 1}`;
         const group = groupByField ? row[groupByField] : undefined;

         if (chapterCoversEnabled && group !== currentGroup) {
             currentGroup = group;
             productPageCounter++; 
         }

         pageMap.push({ title, page: productPageCounter, group });
         productPageCounter++;
      }

      // TOC PAGES
      if (tocSection && tocSection.elements.length > 0 && tocElement) {
         setCurrentAction("Generating Table of Contents...");
         tocChunks = paginateTOC(tocElement, pageMap, tocElement.dimension.height);

         for (let i = 0; i < tocChunks.length; i++) {
             const pageElements = JSON.parse(JSON.stringify(tocSection.elements));
             const clonedToc = pageElements.find((el: any) => el.id === tocElement!.id);
             if (clonedToc) {
                 (clonedToc as any)._renderItems = tocChunks[i];
                 (clonedToc as any)._isPaged = true;
                 (clonedToc as any)._isFirstPage = (i === 0);
             }

             const tocHtml = await renderPageHTML(pageElements, {}, tocSection.backgroundColor);
             combinedHtml += `<div class="page-container">${tocHtml}</div>`;
             currentPageNumber++;
         }
      }

      // PRODUCT PAGES
      const productSection = sectionsForExport.product;
      const chapterSection = sectionsForExport.chapter;
      currentGroup = undefined; 

      for (let i = 0; i < excelData.rows.length; i++) {
         const row = excelData.rows[i];
         const group = groupByField ? row[groupByField] : undefined;
         const productName = row[tocTitleField] || `Item ${i+1}`;

         setCurrentAction(`Rendering: ${productName} (${i+1}/${excelData.rows.length})`);

         if (chapterCoversEnabled && group !== currentGroup) {
             currentGroup = group;
             let chapterElements = chapterSection?.elements || [];
             let chapterBg = chapterSection?.backgroundColor || "#ffffff";

             if (group && chaptersForExport[group]) {
                 chapterElements = chaptersForExport[group].elements;
                 chapterBg = chaptersForExport[group].backgroundColor;
             }

             if (chapterElements.length > 0) {
                 const chapterHtml = await renderPageHTML(chapterElements, row, chapterBg);
                 combinedHtml += `<div class="page-container">${chapterHtml}</div>`;
                 currentPageNumber++;
             }
         }

         const productHtml = await renderPageHTML(productSection.elements, row, productSection.backgroundColor);
         combinedHtml += `<div class="page-container">${productHtml}</div>`;
         setProgress(Math.round(((i + 1) / excelData.rows.length) * 80) + 10);
         currentPageNumber++;
      }

      // BACK COVER
      const backSection = sectionsForExport.back;
      if (backSection && backSection.elements.length > 0) {
         setCurrentAction("Generating Back Cover...");
         const backHtml = await renderPageHTML(backSection.elements, {}, backSection.backgroundColor);
         combinedHtml += `<div class="page-container">${backHtml}</div>`;
      }

      setCurrentAction("Finalizing PDF (Server)...");
      const pdfBlob = await fetchPdfBuffer(combinedHtml, currentPageNumber, "Full Catalog");
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Catalog_Full.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

      setExportStatus("success");
      toast({ title: "Catalog Exported", description: "Your full catalog PDF is ready." });

    } catch (error: any) {
      console.error("Catalog Generation Error", error);
      if (error.message.includes("Monthly PDF limit reached")) {
         setExportStatus("error");
         toast({ 
            title: "Limit Reached", 
            description: "You have used your 50 free PDFs for this month. Please upgrade to Pro.",
            variant: "destructive",
            action: <Button variant="outline" size="sm" onClick={() => setShowUpgradeDialog(true)}>Upgrade</Button>
         });
      } else {
         setExportStatus("error");
         toast({ title: "Export Failed", description: "Could not generate catalog.", variant: "destructive" });
      }
    } finally {
      setIsExporting(false);
      setProgress(100);
      setCurrentAction("");
      setTimeout(() => { setProgress(0); setExportStatus("idle"); }, 3000);
    }
  };

  const generatePDF = async () => {
    setIsExporting(true);
    setProgress(0);
    setExportStatus("idle");
    setCurrentAction("Preparing PDF...");

    try {
      let combinedHtml = "";
      for (let i = 0; i < pageCount; i++) {
        setCurrentAction(`Rendering Page ${i + 1}/${pageCount}`);
        const pageHtml = await renderPageHTML(
            currentElements.filter(el => (el.pageIndex ?? 0) === i), 
            excelData?.rows[selectedRowIndex], 
            backgroundColor
        );
        combinedHtml += `<div class="page-container">${pageHtml}</div>`;
        setProgress(Math.round(((i + 1) / pageCount) * 50)); 
      }

      setCurrentAction("Generating PDF on server...");
      const fileName = getConstructedFilename(selectedRowIndex);
      const pdfBlob = await fetchPdfBuffer(combinedHtml, pageCount, fileName);

      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

      setExportStatus("success");
      toast({ title: "PDF exported successfully", description: `Downloaded as ${fileName}.pdf` });
    } catch (error: any) {
      console.error("Export error:", error);
      if (error.message.includes("Monthly PDF limit reached")) {
         setExportStatus("error");
         toast({ 
            title: "Limit Reached", 
            description: "You have used your 50 free PDFs for this month. Please upgrade to Pro.",
            variant: "destructive",
            action: <Button variant="outline" size="sm" onClick={() => setShowUpgradeDialog(true)}>Upgrade</Button>
         });
      } else {
         setExportStatus("error");
         toast({ title: "Export failed", description: "An error occurred.", variant: "destructive" });
      }
    } finally {
      setIsExporting(false);
      setProgress(100);
      setCurrentAction("");
      setTimeout(() => { setProgress(0); setExportStatus("idle"); }, 3000);
    }
  };

  // --- UPDATED BULK EXPORT LOGIC ---
  const generateBulkPDFs = async () => {
    if (!excelData || excelData.rows.length === 0) return;

    // Reset state
    setIsExporting(true); 
    setProgress(0); 
    setExportStatus("idle");
    abortRef.current = false; // Reset abort signal

    const totalItems = excelData.rows.length;
    const startTime = Date.now();

    try {
      const zip = new JSZip();
      const usedFilenames = new Set<string>();

      for (let rowIndex = 0; rowIndex < totalItems; rowIndex++) {
        // 1. Check for cancellation
        if (abortRef.current) {
            throw new Error("ABORT_EXPORT");
        }

        const rowData = excelData.rows[rowIndex];

        // 2. Generate Name
        let pdfName = getConstructedFilename(rowIndex);
        let uniqueName = pdfName;
        let counter = 1;
        while (usedFilenames.has(uniqueName)) { uniqueName = `${pdfName}_${counter}`; counter++; }
        usedFilenames.add(uniqueName);

        // 3. Update Status UI
        setCurrentAction(`Exporting: ${uniqueName}.pdf (${rowIndex + 1} of ${totalItems})`);

        // 4. Update Time Estimate
        if (rowIndex > 0) {
            const elapsed = (Date.now() - startTime) / 1000; // seconds
            const avgTime = elapsed / rowIndex; 
            const remaining = Math.ceil(avgTime * (totalItems - rowIndex));

            if (remaining > 60) {
                setTimeRemaining(`~${Math.ceil(remaining / 60)} min remaining`);
            } else {
                setTimeRemaining(`~${remaining} sec remaining`);
            }
        } else {
            setTimeRemaining("Calculating time...");
        }

        // 5. Generate HTML & PDF (One by one)
        let combinedHtml = "";
        for (let i = 0; i < pageCount; i++) {
            const pageHtml = await renderPageHTML(
                currentElements.filter(el => (el.pageIndex ?? 0) === i),
                rowData,
                backgroundColor
            );
            combinedHtml += `<div class="page-container">${pageHtml}</div>`;
        }

        const pdfBlob = await fetchPdfBuffer(combinedHtml, pageCount, uniqueName);
        zip.file(`${uniqueName}.pdf`, pdfBlob);

        // 6. Update Progress Bar
        setProgress(Math.round(((rowIndex + 1) / totalItems) * 100));
      }

      setCurrentAction("Creating ZIP archive...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `specsheets-bulk-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportStatus("success");
      toast({ title: "Bulk export complete", description: `Downloaded ZIP containing ${excelData.rows.length} files.` });
    } catch (error: any) {
      if (error.message === "ABORT_EXPORT") {
          setExportStatus("cancelled");
          toast({ title: "Export Cancelled", description: "Bulk export was stopped by user." });
      } else if (error.message.includes("Monthly PDF limit reached")) {
          setExportStatus("error");
          toast({ 
            title: "Limit Reached", 
            description: "Usage limit reached during bulk export. Upgrade to Pro to continue.",
            variant: "destructive",
            action: <Button variant="outline" size="sm" onClick={() => setShowUpgradeDialog(true)}>Upgrade</Button>
          });
      } else {
          setExportStatus("error");
          toast({ title: "Export failed", description: "An error occurred during bulk export.", variant: "destructive" });
      }
    } finally {
      setIsExporting(false);
      setCurrentAction("");
      setTimeRemaining("");
      setTimeout(() => { setProgress(0); setExportStatus("idle"); }, 3000);
    }
  };

  const handleCancelExport = () => {
      abortRef.current = true;
      setCurrentAction("Cancelling...");
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <UpgradeDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog} />

        {/* File Naming Section */}
        <div>
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            <FileSignature className="h-4 w-4" />
            File Naming
          </h3>
          <div className="space-y-3">
             <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Filename Pattern</Label>
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

                  {/* UPDATED: Print Ready Option - assume Pro while loading to prevent flicker */}
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
                     {/* Only show lock if NOT loading and NOT pro */}
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
              onClick={(isPro || isLoading) ? generateFullCatalogPDF : () => setShowUpgradeDialog(true)}
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
                onClick={generatePDF}
                disabled={isExporting || currentElements.length === 0}
                data-testid="btn-export-pdf"
              >
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export as PDF (Server-Side)
              </Button>

              {excelData && excelData.rows.length > 0 && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={generateBulkPDFs}
                  disabled={isExporting}
                  data-testid="btn-export-bulk"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
                  Bulk Export as ZIP ({excelData.rows.length} files)
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
      </div>
    </ScrollArea>
  );
}