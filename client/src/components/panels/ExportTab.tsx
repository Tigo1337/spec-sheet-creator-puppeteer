import { useState, useRef } from "react";
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
} from "lucide-react";
import { pageSizes } from "@shared/schema";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export function ExportTab() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<"idle" | "success" | "error">("idle");
  const { toast } = useToast();

  const {
    exportSettings,
    setExportSettings,
    elements,
    excelData,
    canvasWidth,
    canvasHeight,
    backgroundColor,
  } = useCanvasStore();

  const generatePDF = async () => {
    setIsExporting(true);
    setProgress(0);
    setExportStatus("idle");

    try {
      // Create a temporary canvas for rendering
      const tempDiv = document.createElement("div");
      tempDiv.style.position = "absolute";
      tempDiv.style.left = "-9999px";
      tempDiv.style.top = "-9999px";
      tempDiv.style.width = `${canvasWidth}px`;
      tempDiv.style.height = `${canvasHeight}px`;
      tempDiv.style.backgroundColor = backgroundColor;
      document.body.appendChild(tempDiv);

      setProgress(20);

      // Render elements to the temp div
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
          elementDiv.style.textAlign = textStyle.textAlign || "left";
          elementDiv.style.lineHeight = String(textStyle.lineHeight || 1.5);
          elementDiv.style.letterSpacing = `${textStyle.letterSpacing || 0}px`;
          elementDiv.style.display = "flex";
          elementDiv.style.alignItems = "center";
          elementDiv.style.padding = "4px";
          elementDiv.style.wordBreak = "break-word";
          elementDiv.style.overflow = "hidden";

          // Resolve data bindings
          let content = element.content || "";
          if (element.dataBinding && excelData && excelData.rows[0]) {
            content = excelData.rows[0][element.dataBinding] || content;
          }
          elementDiv.textContent = content;
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
        } else if (element.type === "image" && element.imageSrc) {
          const img = document.createElement("img");
          img.src = element.imageSrc;
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = "cover";
          elementDiv.appendChild(img);
        }

        tempDiv.appendChild(elementDiv);
      }

      setProgress(40);

      // Wait a bit for fonts to load
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Capture to canvas
      const canvas = await html2canvas(tempDiv, {
        scale: 2 * exportSettings.quality,
        backgroundColor: backgroundColor,
        useCORS: true,
        allowTaint: true,
        logging: false,
      });

      setProgress(70);

      // Create PDF
      const pageSize = pageSizes[exportSettings.pageSize];
      const orientation = exportSettings.orientation;
      
      const pdfWidth = orientation === "portrait" ? pageSize.width : pageSize.height;
      const pdfHeight = orientation === "portrait" ? pageSize.height : pageSize.width;

      const pdf = new jsPDF({
        orientation: orientation,
        unit: "px",
        format: [pdfWidth, pdfHeight],
        hotfixes: ["px_scaling"],
      });

      // Add the canvas image to PDF
      const imgData = canvas.toDataURL("image/png", exportSettings.quality);
      pdf.addImage(
        imgData,
        "PNG",
        exportSettings.margin,
        exportSettings.margin,
        pdfWidth - exportSettings.margin * 2,
        pdfHeight - exportSettings.margin * 2
      );

      setProgress(90);

      // Download the PDF
      const timestamp = new Date().toISOString().slice(0, 10);
      pdf.save(`specsheet-${timestamp}.pdf`);

      // Clean up
      document.body.removeChild(tempDiv);

      setProgress(100);
      setExportStatus("success");

      toast({
        title: "PDF exported successfully",
        description: "Your spec sheet has been downloaded.",
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
      const pageSize = pageSizes[exportSettings.pageSize];
      const orientation = exportSettings.orientation;
      const pdfWidth = orientation === "portrait" ? pageSize.width : pageSize.height;
      const pdfHeight = orientation === "portrait" ? pageSize.height : pageSize.width;

      const pdf = new jsPDF({
        orientation: orientation,
        unit: "px",
        format: [pdfWidth, pdfHeight],
        hotfixes: ["px_scaling"],
      });

      for (let rowIndex = 0; rowIndex < excelData.rows.length; rowIndex++) {
        if (rowIndex > 0) {
          pdf.addPage();
        }

        const rowData = excelData.rows[rowIndex];
        setProgress(Math.round((rowIndex / excelData.rows.length) * 80));

        // Create temporary div for this row
        const tempDiv = document.createElement("div");
        tempDiv.style.position = "absolute";
        tempDiv.style.left = "-9999px";
        tempDiv.style.top = "-9999px";
        tempDiv.style.width = `${canvasWidth}px`;
        tempDiv.style.height = `${canvasHeight}px`;
        tempDiv.style.backgroundColor = backgroundColor;
        document.body.appendChild(tempDiv);

        // Render elements with data bindings resolved
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
            elementDiv.style.textAlign = textStyle.textAlign || "left";
            elementDiv.style.lineHeight = String(textStyle.lineHeight || 1.5);
            elementDiv.style.display = "flex";
            elementDiv.style.alignItems = "center";
            elementDiv.style.padding = "4px";
            elementDiv.style.overflow = "hidden";

            let content = element.content || "";
            if (element.dataBinding && rowData[element.dataBinding]) {
              content = rowData[element.dataBinding];
            }
            elementDiv.textContent = content;
          } else if (element.type === "shape") {
            const shapeStyle = element.shapeStyle || {};
            elementDiv.style.backgroundColor = shapeStyle.fill || "#e5e7eb";
            elementDiv.style.border = `${shapeStyle.strokeWidth || 1}px solid ${shapeStyle.stroke || "#9ca3af"}`;
            elementDiv.style.borderRadius = element.shapeType === "circle" ? "50%" : `${shapeStyle.borderRadius || 0}px`;
          } else if (element.type === "image" && element.imageSrc) {
            const img = document.createElement("img");
            img.src = element.imageSrc;
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "cover";
            elementDiv.appendChild(img);
          }

          tempDiv.appendChild(elementDiv);
        }

        await new Promise((resolve) => setTimeout(resolve, 50));

        const canvas = await html2canvas(tempDiv, {
          scale: 2 * exportSettings.quality,
          backgroundColor: backgroundColor,
          useCORS: true,
          logging: false,
        });

        const imgData = canvas.toDataURL("image/png", exportSettings.quality);
        pdf.addImage(
          imgData,
          "PNG",
          exportSettings.margin,
          exportSettings.margin,
          pdfWidth - exportSettings.margin * 2,
          pdfHeight - exportSettings.margin * 2
        );

        document.body.removeChild(tempDiv);
      }

      setProgress(95);

      const timestamp = new Date().toISOString().slice(0, 10);
      pdf.save(`specsheet-bulk-${timestamp}.pdf`);

      setProgress(100);
      setExportStatus("success");

      toast({
        title: "Bulk export complete",
        description: `Generated ${excelData.rows.length} pages in the PDF.`,
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
              <span>Generating PDF...</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {!isExporting && exportStatus === "success" && (
          <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 dark:bg-green-950/50 p-3 rounded-lg">
            <CheckCircle2 className="h-4 w-4" />
            <span>PDF exported successfully!</span>
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
                <FileText className="h-4 w-4" />
              )}
              Bulk Export ({excelData.rows.length} pages)
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded-lg">
          <p className="font-medium">Tips:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Single export uses the current preview row</li>
            <li>Bulk export creates one page per data row</li>
            <li>Higher quality = larger file size</li>
          </ul>
        </div>
      </div>
    </ScrollArea>
  );
}
