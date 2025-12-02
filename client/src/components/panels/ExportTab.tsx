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
  FileText,
  Settings,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileSignature,
  Plus,
  FileArchive, // Added icon for ZIP
} from "lucide-react";
import { pageSizes } from "@shared/schema";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import JSZip from "jszip"; // NEW IMPORT
import { isHtmlContent } from "@/lib/canvas-utils";

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

  const generatePDF = async () => {
    setIsExporting(true);
    setProgress(0);
    setExportStatus("idle");

    try {
      const tempDiv = document.createElement("div");
      tempDiv.style.position = "fixed"; 
      tempDiv.style.left = "0";
      tempDiv.style.top = "0";
      tempDiv.style.zIndex = "-9999"; 
      tempDiv.style.width = `${canvasWidth}px`;
      tempDiv.style.height = `${canvasHeight}px`;
      tempDiv.style.backgroundColor = backgroundColor;
      tempDiv.style.boxSizing = "border-box"; 
      document.body.appendChild(tempDiv);

      setProgress(20);

      const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

      for (const element of sortedElements) {
        if (!element.visible) continue;

        const elementDiv = document.createElement("div");
        elementDiv.style.position = "absolute";
        elementDiv.style.left = `${element.position.x}px`;
        elementDiv.style.top = `${element.position.y}px`;
        elementDiv.style.width = `${element.dimension.width}px`;
        elementDiv.style.height = `${element.dimension.height}px`;
        elementDiv.style.transform = element.rotation ? `rotate(${element.rotation}deg)` : "";

        if (element.type === "text" || element.type === "dataField") {
           const textStyle = element.textStyle || {};
           elementDiv.style.fontFamily = textStyle.fontFamily || "Inter";
           elementDiv.style.fontSize = `${textStyle.fontSize || 16}px`;
           elementDiv.style.fontWeight = String(textStyle.fontWeight || 400);
           elementDiv.style.color = textStyle.color || "#000000";
           elementDiv.style.lineHeight = String(textStyle.lineHeight || 1.5);
           elementDiv.style.letterSpacing = `${textStyle.letterSpacing || 0}px`;
           elementDiv.style.display = "flex";
           elementDiv.style.flexDirection = "column";
           elementDiv.style.padding = "4px";
           elementDiv.style.wordBreak = "break-word";
           elementDiv.style.overflow = "hidden";

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
           if (element.dataBinding && excelData && excelData.rows[selectedRowIndex]) {
             content = excelData.rows[selectedRowIndex][element.dataBinding] || content;
           }
           if (isHtmlContent(content)) {
             const style = document.createElement("style");
             style.textContent = `
               ul { list-style-type: disc !important; margin: 0 !important; padding-left: 1.2em !important; display: block !important; }
               li { margin: 0.2em 0 !important; display: list-item !important; }
               ol { list-style-type: decimal !important; margin: 0 !important; padding-left: 1.2em !important; display: block !important; }
               strong, b { font-weight: bold; }
               em, i { font-style: italic; }
               p { margin: 0.2em 0; display: block !important; }
             `;
             elementDiv.appendChild(style);
             elementDiv.style.display = "block";
             elementDiv.innerHTML += content;
           } else {
             elementDiv.textContent = content;
           }
        } else if (element.type === "shape") {
           const shapeStyle = element.shapeStyle || {};
           elementDiv.style.backgroundColor = shapeStyle.fill || "#e5e7eb";
           elementDiv.style.border = `${shapeStyle.strokeWidth || 1}px solid ${shapeStyle.stroke || "#9ca3af"}`;
           elementDiv.style.borderRadius = element.shapeType === "circle" ? "50%" : `${shapeStyle.borderRadius || 0}px`;
           elementDiv.style.opacity = String(shapeStyle.opacity || 1);

           if (element.shapeType === "line") {
             elementDiv.style.height = `${shapeStyle.strokeWidth || 1}px`;
             elementDiv.style.backgroundColor = shapeStyle.stroke || "#9ca3af";
             elementDiv.style.border = "none";
             elementDiv.style.position = "absolute";
             elementDiv.style.top = `${element.position.y + element.dimension.height / 2}px`;
           }
        } else if (element.type === "image") {
           let imgSrc = element.imageSrc;
           if (element.dataBinding && excelData && excelData.rows[selectedRowIndex]) {
             imgSrc = excelData.rows[selectedRowIndex][element.dataBinding];
           }
           if (imgSrc) {
             const img = document.createElement("img");
             img.src = imgSrc;
             img.style.width = "100%";
             img.style.height = "100%";
             img.style.objectFit = "contain";
             img.style.objectPosition = "center";
             elementDiv.appendChild(img);
           }
        }

        tempDiv.appendChild(elementDiv);
      }

      setProgress(40);

      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await html2canvas(tempDiv, {
        scale: 2 * exportSettings.quality,
        backgroundColor: backgroundColor,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: canvasWidth,
        height: canvasHeight,
        windowWidth: canvasWidth,
        windowHeight: canvasHeight,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0
      });

      setProgress(70);

      const pageSize = pageSizes[exportSettings.pageSize];
      const orientation = exportSettings.orientation;

      const pdfWidth = orientation === "portrait" ? pageSize.width : pageSize.height;
      const pdfHeight = orientation === "portrait" ? pageSize.height : pageSize.width;

      const mmWidth = (pdfWidth / 96) * 25.4;
      const mmHeight = (pdfHeight / 96) * 25.4;

      const pdf = new jsPDF({
        orientation: orientation,
        unit: "mm",
        format: [mmWidth, mmHeight],
      });

      const imgData = canvas.toDataURL("image/png", exportSettings.quality);

      pdf.addImage(
        imgData,
        "PNG",
        0,
        0,
        mmWidth,
        mmHeight,
        undefined, 
        "FAST"
      );

      setProgress(90);

      const fileName = getConstructedFilename(selectedRowIndex);
      pdf.save(`${fileName}.pdf`);

      document.body.removeChild(tempDiv);
      setProgress(100);
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
      // Initialize ZIP
      const zip = new JSZip();

      // Track used filenames to prevent overwrites
      const usedFilenames = new Set<string>();

      const pageSize = pageSizes[exportSettings.pageSize];
      const orientation = exportSettings.orientation;
      const pdfWidth = orientation === "portrait" ? pageSize.width : pageSize.height;
      const pdfHeight = orientation === "portrait" ? pageSize.height : pageSize.width;

      const mmWidth = (pdfWidth / 96) * 25.4;
      const mmHeight = (pdfHeight / 96) * 25.4;

      // Loop through every row
      for (let rowIndex = 0; rowIndex < excelData.rows.length; rowIndex++) {
        const rowData = excelData.rows[rowIndex];

        // Update progress (0% to 80% covers the generation phase)
        setProgress(Math.round((rowIndex / excelData.rows.length) * 80));

        // Create temp container
        const tempDiv = document.createElement("div");
        tempDiv.style.position = "fixed";
        tempDiv.style.left = "0";
        tempDiv.style.top = "0";
        tempDiv.style.zIndex = "-9999";
        tempDiv.style.width = `${canvasWidth}px`;
        tempDiv.style.height = `${canvasHeight}px`;
        tempDiv.style.backgroundColor = backgroundColor;
        tempDiv.style.boxSizing = "border-box";
        document.body.appendChild(tempDiv);

        // Render elements
        const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);
        for (const element of sortedElements) {
            if (!element.visible) continue;

            const elementDiv = document.createElement("div");
            elementDiv.style.position = "absolute";
            elementDiv.style.left = `${element.position.x}px`;
            elementDiv.style.top = `${element.position.y}px`;
            elementDiv.style.width = `${element.dimension.width}px`;
            elementDiv.style.height = `${element.dimension.height}px`;

            if (element.type === "text" || element.type === "dataField") {
                const textStyle = element.textStyle || {};
                elementDiv.style.fontFamily = textStyle.fontFamily || "Inter";
                elementDiv.style.fontSize = `${textStyle.fontSize || 16}px`;
                elementDiv.style.fontWeight = String(textStyle.fontWeight || 400);
                elementDiv.style.color = textStyle.color || "#000000";
                elementDiv.style.lineHeight = String(textStyle.lineHeight || 1.5);
                elementDiv.style.letterSpacing = `${textStyle.letterSpacing || 0}px`;
                elementDiv.style.display = "flex";
                elementDiv.style.flexDirection = "column";
                elementDiv.style.padding = "4px";
                elementDiv.style.overflow = "hidden";

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
                }
                if (isHtmlContent(content)) {
                const style = document.createElement("style");
                style.textContent = `
                    ul { list-style-type: disc !important; margin: 0 !important; padding-left: 1.2em !important; display: block !important; }
                    li { margin: 0.2em 0 !important; display: list-item !important; }
                    ol { list-style-type: decimal !important; margin: 0 !important; padding-left: 1.2em !important; display: block !important; }
                    strong, b { font-weight: bold; }
                    em, i { font-style: italic; }
                    p { margin: 0.2em 0; display: block !important; }
                `;
                elementDiv.appendChild(style);
                elementDiv.style.display = "block";
                elementDiv.innerHTML += content;
                } else {
                elementDiv.textContent = content;
                }
            } else if (element.type === "shape") {
                const shapeStyle = element.shapeStyle || {};
                elementDiv.style.backgroundColor = shapeStyle.fill || "#e5e7eb";
                elementDiv.style.border = `${shapeStyle.strokeWidth || 1}px solid ${shapeStyle.stroke || "#9ca3af"}`;
                elementDiv.style.borderRadius = element.shapeType === "circle" ? "50%" : `${shapeStyle.borderRadius || 0}px`;
            } else if (element.type === "image") {
                let imgSrc = element.imageSrc;
                if (element.dataBinding && rowData[element.dataBinding]) {
                    imgSrc = rowData[element.dataBinding];
                }
                if (imgSrc) {
                const img = document.createElement("img");
                img.src = imgSrc;
                img.style.width = "100%";
                img.style.height = "100%";
                img.style.objectFit = "contain";
                img.style.objectPosition = "center";
                elementDiv.appendChild(img);
                }
            }

            tempDiv.appendChild(elementDiv);
        }

        // Slight delay to ensure DOM rendering
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Capture Canvas
        const canvas = await html2canvas(tempDiv, {
          scale: 2 * exportSettings.quality,
          backgroundColor: backgroundColor,
          useCORS: true,
          logging: false,
          width: canvasWidth,
          height: canvasHeight,
          windowWidth: canvasWidth,
          windowHeight: canvasHeight,
          scrollX: 0,
          scrollY: 0,
          x: 0,
          y: 0
        });

        // Create PDF for this specific row
        const pdf = new jsPDF({
            orientation: orientation,
            unit: "mm",
            format: [mmWidth, mmHeight],
        });

        const imgData = canvas.toDataURL("image/png", exportSettings.quality);
        pdf.addImage(
          imgData,
          "PNG",
          0,
          0,
          mmWidth,
          mmHeight,
          undefined,
          "FAST"
        );

        // Calculate Filename for this specific PDF
        let pdfName = getConstructedFilename(rowIndex);

        // Deduplication logic: If name exists, append _1, _2, etc.
        let uniqueName = pdfName;
        let counter = 1;
        while (usedFilenames.has(uniqueName)) {
            uniqueName = `${pdfName}_${counter}`;
            counter++;
        }
        usedFilenames.add(uniqueName);

        // Add to ZIP (get PDF as blob)
        zip.file(`${uniqueName}.pdf`, pdf.output('blob'));

        // Clean up DOM
        document.body.removeChild(tempDiv);
      }

      // Generation Phase (80% -> 100%)
      setProgress(85);

      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });
      setProgress(100);

      // Trigger download
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

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Margin (px)</Label>
              <Input
                type="number"
                value={exportSettings.margin}
                onChange={(e) =>
                  setExportSettings({ margin: Number(e.target.value) })
                }
                min={0}
                max={100}
                data-testid="input-export-margin"
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
            Export as PDF
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
            <li>Single export uses the current preview row</li>
            <li>Use <strong>{`{{Variable}}`}</strong> tags to create dynamic file names</li>
            <li>Bulk export creates a ZIP containing individual PDF files</li>
          </ul>
        </div>
      </div>
    </ScrollArea>
  );
}