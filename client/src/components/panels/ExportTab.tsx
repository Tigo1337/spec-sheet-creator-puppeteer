import { useState, useEffect } from "react";
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
  Book
} from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import JSZip from "jszip";
import { isHtmlContent, getImageDimensions, paginateTOC } from "@/lib/canvas-utils";
import { formatContent } from "@/lib/formatter";
import QRCode from "qrcode";
import type { CanvasElement } from "@shared/schema";

export function ExportTab() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<"idle" | "success" | "error">("idle");
  const [filenamePattern, setFilenamePattern] = useState("");
  const [exportMode, setExportMode] = useState<"digital" | "print">("digital");
  const [hasLowQualityImages, setHasLowQualityImages] = useState(false);

  const { toast } = useToast();

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
    chapterDesigns 
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
         elementDiv.style.fontFamily = `"${textStyle.fontFamily}", sans-serif`;
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
         const settings = element.tocSettings || { title: "Table of Contents", showTitle: true, columnCount: 1 };
         const columnCount = settings.columnCount || 1;

         // === STYLING UPDATES ===
         elementDiv.style.padding = "16px"; 
         elementDiv.style.display = "flex";
         elementDiv.style.flexDirection = "column";
         elementDiv.style.backgroundColor = "#ffffff"; 
         elementDiv.style.border = "1px dashed rgba(100, 100, 100, 0.2)"; 
         elementDiv.style.borderRadius = "4px"; 
         // ======================================

         const itemsToRender: any[] = (element as any)._renderItems || [];
         const isPaged = (element as any)._isPaged || false;

         // 1. Render Title (Only on First Page if paged)
         if (settings.showTitle && (!isPaged || (element as any)._isFirstPage)) {
             const titleDiv = document.createElement("div");
             titleDiv.textContent = settings.title;
             titleDiv.style.fontFamily = `"${settings.titleStyle?.fontFamily}", sans-serif`;
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
         // Apply default text styles to the container like Canvas does
         listDiv.style.fontFamily = `"${element.textStyle?.fontFamily}", sans-serif`;
         listDiv.style.fontSize = `${element.textStyle?.fontSize || 14}px`;
         listDiv.style.color = element.textStyle?.color || "#000000";
         listDiv.style.lineHeight = String(element.textStyle?.lineHeight || 1.5);

         // Apply Columns
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
    return container.outerHTML;
  };

  const createTocHeaderDiv = (text: string, settings: any) => {
      const div = document.createElement("div");
      div.textContent = text;
      div.style.fontFamily = `"${settings.chapterStyle?.fontFamily}", sans-serif`;
      div.style.fontSize = `${settings.chapterStyle?.fontSize || 18}px`; // Explicit fallback
      div.style.fontWeight = String(settings.chapterStyle?.fontWeight || 600);
      div.style.color = settings.chapterStyle?.color || "#333";
      div.style.textAlign = settings.chapterStyle?.textAlign || "left";
      div.style.lineHeight = String(settings.chapterStyle?.lineHeight || 1.5); 

      // UPDATED: No Margins
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
      // Explicit fallbacks to match Canvas defaults
      div.style.fontFamily = `"${style.fontFamily}", sans-serif`;
      div.style.fontSize = `${style.fontSize || 14}px`;
      div.style.color = style.color || "#000000";
      div.style.lineHeight = String(style.lineHeight || 1.5);
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
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <link href="https://fonts.googleapis.com/css2?family=Comic+Neue:wght@400;700&family=Oswald:wght@400;700&family=Inter:wght@400;700&family=JetBrains+Mono:wght@400&family=Lato:wght@400;700&family=Lora:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;700&family=Nunito:wght@400;700&family=Open+Sans:wght@400;700&family=Playfair+Display:wght@400;700&family=Poppins:wght@400;700&family=Raleway:wght@400;700&family=Roboto:wght@400;700&family=Roboto+Slab:wght@400;700&display=swap" rel="stylesheet">
          <style>
            @font-face { font-family: 'Arial'; src: local('Arimo'); }
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

    if (!response.ok) throw new Error("Server failed to generate PDF");
    return await response.blob();
  };

  // --- CATALOG GENERATION LOGIC ---
  const generateFullCatalogPDF = async () => {
    if (!excelData || excelData.rows.length === 0) {
      toast({ title: "No Data", description: "Import Excel data to generate a catalog.", variant: "destructive" });
      return;
    }

    setIsExporting(true);
    setProgress(0);
    setExportStatus("idle");

    try {
      let combinedHtml = "";
      let currentPageNumber = 1;
      const pageMap: Array<{ title: string, page: number, group?: string }> = [];

      // 1. COVER PAGE
      const coverSection = catalogSections.cover;
      if (coverSection && coverSection.elements.length > 0) {
         const coverHtml = await renderPageHTML(coverSection.elements, {}, coverSection.backgroundColor);
         combinedHtml += `<div class="page-container">${coverHtml}</div>`;
         currentPageNumber++;
      }

      // 2. PRE-CALCULATE PAGE NUMBERS & BUILD MAP
      const tocSection = catalogSections.toc;
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

         // Handle Chapter Page Numbering
         if (chapterCoversEnabled && group !== currentGroup) {
             currentGroup = group;
             productPageCounter++; // Skip a page number for the chapter cover
         }

         pageMap.push({ title, page: productPageCounter, group });
         productPageCounter++;
      }

      // 3. GENERATE TOC PAGES (Multi-Page)
      if (tocSection && tocSection.elements.length > 0 && tocElement) {
         // Re-paginate with real page numbers
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

      // 4. GENERATE CONTENT PAGES (Chapters + Products)
      const productSection = catalogSections.product;
      const chapterSection = catalogSections.chapter;
      currentGroup = undefined; // Reset for generation loop

      for (let i = 0; i < excelData.rows.length; i++) {
         const row = excelData.rows[i];
         const group = groupByField ? row[groupByField] : undefined;

         // Inject Chapter Cover if enabled and group changes
         if (chapterCoversEnabled && group !== currentGroup) {
             currentGroup = group;

             // === RESOLVE CHAPTER ELEMENTS ===
             let chapterElements = chapterSection?.elements || [];
             let chapterBg = chapterSection?.backgroundColor || "#ffffff";

             if (group && chapterDesigns[group]) {
                 chapterElements = chapterDesigns[group].elements;
                 chapterBg = chapterDesigns[group].backgroundColor;
             }

             if (chapterElements.length > 0) {
                 // Render Chapter Page using current row data
                 const chapterHtml = await renderPageHTML(chapterElements, row, chapterBg);
                 combinedHtml += `<div class="page-container">${chapterHtml}</div>`;
                 currentPageNumber++;
             }
         }

         // Render Product Page
         const productHtml = await renderPageHTML(productSection.elements, row, productSection.backgroundColor);
         combinedHtml += `<div class="page-container">${productHtml}</div>`;
         setProgress(Math.round(((i + 1) / excelData.rows.length) * 80) + 10);
         currentPageNumber++;
      }

      // 5. BACK COVER
      const backSection = catalogSections.back;
      if (backSection && backSection.elements.length > 0) {
         const backHtml = await renderPageHTML(backSection.elements, {}, backSection.backgroundColor);
         combinedHtml += `<div class="page-container">${backHtml}</div>`;
      }

      // 6. SEND TO PUPPETEER
      const pdfBlob = await fetchPdfBuffer(combinedHtml, currentPageNumber, "Full Catalog");
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Catalog_Full.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

      setExportStatus("success");
      toast({ title: "Catalog Exported", description: "Your full catalog PDF is ready." });

    } catch (error) {
      console.error("Catalog Generation Error", error);
      setExportStatus("error");
      toast({ title: "Export Failed", description: "Could not generate catalog.", variant: "destructive" });
    } finally {
      setIsExporting(false);
      setProgress(100);
      setTimeout(() => { setProgress(0); setExportStatus("idle"); }, 3000);
    }
  };

  const generatePDF = async () => {
    setIsExporting(true);
    setProgress(0);
    setExportStatus("idle");

    try {
      let combinedHtml = "";
      for (let i = 0; i < pageCount; i++) {
        const pageHtml = await renderPageHTML(
            currentElements.filter(el => (el.pageIndex ?? 0) === i), 
            excelData?.rows[selectedRowIndex], 
            backgroundColor
        );
        combinedHtml += `<div class="page-container">${pageHtml}</div>`;
        setProgress(Math.round(((i + 1) / pageCount) * 50)); 
      }

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
    } catch (error) {
      console.error("Export error:", error);
      setExportStatus("error");
      toast({ title: "Export failed", description: "An error occurred.", variant: "destructive" });
    } finally {
      setIsExporting(false);
      setProgress(100);
      setTimeout(() => { setProgress(0); setExportStatus("idle"); }, 3000);
    }
  };

  const generateBulkPDFs = async () => {
    if (!excelData || excelData.rows.length === 0) return;
    setIsExporting(true); setProgress(0); setExportStatus("idle");

    try {
      const zip = new JSZip();
      const usedFilenames = new Set<string>();

      for (let rowIndex = 0; rowIndex < excelData.rows.length; rowIndex++) {
        const rowData = excelData.rows[rowIndex];
        let combinedHtml = "";
        for (let i = 0; i < pageCount; i++) {
            const pageHtml = await renderPageHTML(
                currentElements.filter(el => (el.pageIndex ?? 0) === i),
                rowData,
                backgroundColor
            );
            combinedHtml += `<div class="page-container">${pageHtml}</div>`;
        }

        let pdfName = getConstructedFilename(rowIndex);
        let uniqueName = pdfName;
        let counter = 1;
        while (usedFilenames.has(uniqueName)) { uniqueName = `${pdfName}_${counter}`; counter++; }
        usedFilenames.add(uniqueName);

        const pdfBlob = await fetchPdfBuffer(combinedHtml, pageCount, uniqueName);
        zip.file(`${uniqueName}.pdf`, pdfBlob);
        setProgress(Math.round(((rowIndex + 1) / excelData.rows.length) * 100));
      }

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
    } catch (error) {
      setExportStatus("error");
      toast({ title: "Export failed", description: "An error occurred during bulk export.", variant: "destructive" });
    } finally {
      setIsExporting(false);
      setTimeout(() => { setProgress(0); setExportStatus("idle"); }, 3000);
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
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
                  <div onClick={() => setExportMode("print")} className={`cursor-pointer border rounded-lg p-3 flex flex-col items-center justify-center gap-2 transition-all hover:bg-muted/50 ${exportMode === "print" ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"}`}>
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

        {/* Progress Bar */}
        {isExporting && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Generating files...</span>
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

        {/* Buttons */}
        <div className="space-y-2">
          {/* CATALOG MODE BUTTON */}
          {isCatalogMode ? (
            <Button
              className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
              onClick={generateFullCatalogPDF}
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Book className="h-4 w-4" />}
              Generate Full Catalog PDF
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