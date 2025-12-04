import { useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
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
} from "lucide-react";
import { pageSizes } from "@shared/schema";
import JSZip from "jszip";
import { isHtmlContent } from "@/lib/canvas-utils";
import { formatContent } from "@/lib/formatter";
import html2canvas from "html2canvas";

export function ExportTab() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<"idle" | "success" | "error">("idle");
  const [filenamePattern, setFilenamePattern] = useState("");

  const { toast } = useToast();

  const {
    exportSettings,
    setExportSettings,
    elements,
    excelData,
    canvasWidth,
    canvasHeight,
    backgroundColor,
    selectedRowIndex,
    pageCount,
  } = useCanvasStore();

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

  // Helper to compress image to reduce file size
  const compressImage = async (
    imgSrc: string, 
    maxWidth: number, 
    maxHeight: number, 
    quality: number
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        // Scale down if larger than target dimensions
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

        ctx.drawImage(img, 0, 0, width, height);

        // Try JPEG for photos (smaller), PNG for graphics with transparency
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(imgSrc); // Fallback to original on error
      img.src = imgSrc;
    });
  };

  // Helper to generate the full HTML string for a single page
  const generateHTMLForPage = async (pageIndex: number, rowData: Record<string, string> = {}) => {
    const container = document.createElement("div");
    container.style.width = `${canvasWidth}px`;
    container.style.height = `${canvasHeight}px`;
    container.style.backgroundColor = backgroundColor;
    container.style.position = "relative";
    container.style.overflow = "hidden";

    const pageElements = elements
      .filter(el => (el.pageIndex ?? 0) === pageIndex)
      .sort((a, b) => a.zIndex - b.zIndex);

    for (const element of pageElements) {
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

      if (element.type === "text" || element.type === "dataField") {
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
         elementDiv.style.overflow = "visible"; // Allow text overflow

         const hAlign = textStyle.textAlign || "left";
         elementDiv.style.textAlign = hAlign;

         const vAlign = textStyle.verticalAlign || "middle";
         const justifyMap: Record<string, string> = {
           top: "flex-start",
           middle: "center",
           bottom: "flex-end"
         };
         elementDiv.style.justifyContent = justifyMap[vAlign];

         if (hAlign === "center") {
           elementDiv.style.alignItems = "center";
         } else if (hAlign === "right") {
           elementDiv.style.alignItems = "flex-end";
         } else {
           elementDiv.style.alignItems = "flex-start";
         }

         let content = element.content || "";
         if (element.dataBinding && rowData[element.dataBinding]) {
           content = rowData[element.dataBinding];
         } else if (element.dataBinding && excelData && excelData.rows[selectedRowIndex]) {
             // Fallback to selected row if no specific row passed (single export)
             content = excelData.rows[selectedRowIndex][element.dataBinding] || content;
         }

         content = formatContent(content, element.format);

         if (isHtmlContent(content)) {
            // Inject basic list styling for HTML content
            const styles = `
              <style>
                ul, ol { margin: 0; padding-left: 1.2em; }
                li { position: relative; margin: 0.2em 0; }
                p { margin: 0.2em 0; }
              </style>
            `;
            elementDiv.innerHTML = styles + content;
            elementDiv.style.display = "block";
         } else {
           elementDiv.textContent = content;
         }
      } else if (element.type === "shape") {
         const shapeStyle = element.shapeStyle || {};
         elementDiv.style.opacity = String(shapeStyle.opacity || 1);

         if (element.shapeType === "line") {
            // FIX: Don't change top/left of container. Use flex to center child.
            elementDiv.style.display = "flex";
            elementDiv.style.alignItems = "center";
            elementDiv.style.justifyContent = "center";

            const lineStroke = document.createElement("div");
            lineStroke.style.width = "100%";
            lineStroke.style.height = `${shapeStyle.strokeWidth || 1}px`;
            lineStroke.style.backgroundColor = shapeStyle.stroke || "#9ca3af";

            elementDiv.appendChild(lineStroke);
         } else {
            // Rectangle or Circle
            elementDiv.style.backgroundColor = shapeStyle.fill || "#e5e7eb";
            elementDiv.style.border = `${shapeStyle.strokeWidth || 1}px solid ${shapeStyle.stroke || "#9ca3af"}`;
            elementDiv.style.borderRadius = element.shapeType === "circle" ? "50%" : `${shapeStyle.borderRadius || 0}px`;
         }
      } else if (element.type === "image") {
         let imgSrc = element.imageSrc;
         if (element.dataBinding) {
            if (rowData[element.dataBinding]) {
                imgSrc = rowData[element.dataBinding];
            } else if (excelData && excelData.rows[selectedRowIndex]) {
                imgSrc = excelData.rows[selectedRowIndex][element.dataBinding];
            }
         }

         if (imgSrc) {
           const img = document.createElement("img");
           // Compress image based on element dimensions and quality setting
           try {
             const compressedSrc = await compressImage(
               imgSrc, 
               element.dimension.width * 2, // 2x for retina
               element.dimension.height * 2,
               exportSettings.quality
             );
             img.src = compressedSrc;
           } catch {
             img.src = imgSrc; // Fallback to original
           }
           img.style.width = "100%";
           img.style.height = "100%";
           img.style.objectFit = "contain";
           elementDiv.appendChild(img);
         }
      }

      container.appendChild(elementDiv);
    }

    return container.outerHTML;
  };

  // Helper to call server API
  const fetchPdfBuffer = async (html: string, pages: number) => {
    // Add Google Fonts link to ensure fonts render correctly on server
    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=JetBrains+Mono:wght@400&family=Lato:wght@400;700&family=Lora:wght@400;700&family=Merriweather:wght@400;700&family=Montserrat:wght@400;700&family=Nunito:wght@400;700&family=Open+Sans:wght@400;700&family=Oswald:wght@400;700&family=Playfair+Display:wght@400;700&family=Poppins:wght@400;700&family=Raleway:wght@400;700&family=Roboto:wght@400;700&family=Roboto+Slab:wght@400;700&display=swap" rel="stylesheet">
          <style>
            @page {
              size: ${canvasWidth}px ${canvasHeight}px;
              margin: 0;
            }
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
            .page-container:last-child {
              page-break-after: auto;
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;

    const response = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: fullHtml,
        width: canvasWidth,
        height: canvasHeight,
        pageCount: pages,
        quality: exportSettings.quality,
      }),
    });

    if (!response.ok) {
      throw new Error("Server failed to generate PDF");
    }

    return await response.blob();
  };

  const generatePDF = async () => {
    setIsExporting(true);
    setProgress(0);
    setExportStatus("idle");

    try {
      let combinedHtml = "";
      for (let i = 0; i < pageCount; i++) {
        const pageHtml = await generateHTMLForPage(i);
        combinedHtml += `<div class="page-container">${pageHtml}</div>`;
        setProgress(Math.round(((i + 1) / pageCount) * 50)); // 50% for HTML generation
      }

      const pdfBlob = await fetchPdfBuffer(combinedHtml, pageCount);

      const fileName = getConstructedFilename(selectedRowIndex);
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);

      setExportStatus("success");
      toast({
        title: "PDF exported successfully",
        description: `Downloaded as ${fileName}.pdf`,
      });
    } catch (error) {
      console.error("Export error:", error);
      setExportStatus("error");
      toast({
        title: "Export failed",
        description: "An error occurred while generating the PDF.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setProgress(100);
      setTimeout(() => {
        setProgress(0);
        setExportStatus("idle");
      }, 3000);
    }
  };

  const generateBulkPDFs = async () => {
    if (!excelData || excelData.rows.length === 0) {
      toast({
        title: "No data loaded",
        description: "Please import an Excel file first to generate bulk PDFs.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    setProgress(0);
    setExportStatus("idle");

    try {
      const zip = new JSZip();
      const usedFilenames = new Set<string>();

      for (let rowIndex = 0; rowIndex < excelData.rows.length; rowIndex++) {
        const rowData = excelData.rows[rowIndex];

        let combinedHtml = "";
        for (let i = 0; i < pageCount; i++) {
            const pageHtml = await generateHTMLForPage(i, rowData);
            combinedHtml += `<div class="page-container">${pageHtml}</div>`;
        }

        const pdfBlob = await fetchPdfBuffer(combinedHtml, pageCount);

        let pdfName = getConstructedFilename(rowIndex);
        let uniqueName = pdfName;
        let counter = 1;
        while (usedFilenames.has(uniqueName)) {
            uniqueName = `${pdfName}_${counter}`;
            counter++;
        }
        usedFilenames.add(uniqueName);

        zip.file(`${uniqueName}.pdf`, pdfBlob);

        setProgress(Math.round(((rowIndex + 1) / excelData.rows.length) * 100));
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const timestamp = new Date().toISOString().slice(0, 10);
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `specsheets-bulk-${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportStatus("success");
      toast({
        title: "Bulk export complete",
        description: `Downloaded ZIP containing ${excelData.rows.length} files.`,
      });
    } catch (error) {
      console.error("Bulk export error:", error);
      setExportStatus("error");
      toast({
        title: "Export failed",
        description: "An error occurred during bulk export.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
      setTimeout(() => {
        setProgress(0);
        setExportStatus("idle");
      }, 3000);
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Filename Construction Section */}
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
                      <Button
                         variant="outline"
                         size="sm"
                         className="h-6 px-2 text-[10px] bg-muted/50 hover:bg-muted border-dashed"
                         onClick={() => setFilenamePattern((prev) => `${prev}{{Date}}`)}
                      >
                         <Plus className="h-2 w-2 mr-1" /> Date
                      </Button>
                      {excelData.headers.map((header) => (
                         <Button
                            key={header}
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[10px] bg-muted/50 hover:bg-muted border-dashed"
                            onClick={() => insertVariable(header)}
                         >
                            <Plus className="h-2 w-2 mr-1" /> {header}
                         </Button>
                      ))}
                   </div>
                </div>
             )}
          </div>
        </div>

        <Separator />

        <div>
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Export Settings
          </h3>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Page Size</Label>
              <Select
                value={exportSettings.pageSize}
                onValueChange={(value) =>
                  setExportSettings({ pageSize: value as typeof exportSettings.pageSize })
                }
              >
                <SelectTrigger data-testid="select-export-page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="letter">US Letter (8.5" x 11")</SelectItem>
                  <SelectItem value="a4">A4 (210mm x 297mm)</SelectItem>
                  <SelectItem value="legal">US Legal (8.5" x 14")</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Orientation</Label>
              <Select
                value={exportSettings.orientation}
                onValueChange={(value) =>
                  setExportSettings({ orientation: value as typeof exportSettings.orientation })
                }
              >
                <SelectTrigger data-testid="select-export-orientation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Quality: {Math.round(exportSettings.quality * 100)}%
              </Label>
              <Slider
                value={[exportSettings.quality * 100]}
                onValueChange={([value]) =>
                  setExportSettings({ quality: value / 100 })
                }
                min={50}
                max={100}
                step={5}
                data-testid="slider-export-quality"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Export status */}
        {isExporting && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Generating files...</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

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

        <div className="space-y-2">
          <Button
            className="w-full gap-2"
            onClick={generatePDF}
            disabled={isExporting || elements.length === 0}
            data-testid="btn-export-pdf"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
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
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileArchive className="h-4 w-4" />
              )}
              Bulk Export as ZIP ({excelData.rows.length} files)
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded-lg">
          <p className="font-medium">Tips:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Uses high-fidelity server rendering (Puppeteer)</li>
            <li>Images must be public URLs for proper rendering</li>
            <li>Text remains selectable and crisp</li>
          </ul>
        </div>
      </div>
    </ScrollArea>
  );
}