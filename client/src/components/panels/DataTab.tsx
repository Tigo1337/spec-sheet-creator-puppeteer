import { useRef, useCallback, useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { parseDataFile } from "@/lib/excel-parser";
import { createDataFieldElement } from "@/lib/canvas-utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  FileSpreadsheet,
  Upload,
  X,
  Database,
  GripVertical,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
} from "@dnd-kit/core";

function DraggableHeader({ header }: { header: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `header-${header}`,
    data: { header },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 text-primary rounded-md text-sm cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? "opacity-50 scale-95" : "hover:bg-primary/15"
      }`}
      data-testid={`draggable-header-${header}`}
    >
      <GripVertical className="h-3 w-3 opacity-60" />
      <Database className="h-3 w-3" />
      <span className="truncate font-medium">{header}</span>
    </div>
  );
}

export function DataTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeHeader, setActiveHeader] = useState<string | null>(null);
  const { toast } = useToast();

  const {
    excelData,
    setExcelData,
    selectedRowIndex,
    setSelectedRowIndex,
    addElement,
    canvasWidth,
    canvasHeight,
  } = useCanvasStore();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsLoading(true);
      try {
        const result = await parseDataFile(file);
        if (result.success && result.data) {
          setExcelData(result.data);
          toast({
            title: "Data imported successfully",
            description: `Loaded ${result.data.headers.length} columns and ${result.data.rows.length} rows.`,
          });
        } else {
          toast({
            title: "Import failed",
            description: result.error || "Could not parse the file.",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Import error",
          description: "An unexpected error occurred while importing.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [setExcelData, toast]
  );

  const handleClearData = () => {
    setExcelData(null);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const header = event.active.data.current?.header;
    if (header) {
      setActiveHeader(header);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const header = event.active.data.current?.header;
    if (header) {
      // Add data field element to canvas
      const x = canvasWidth / 2 - 75;
      const y = canvasHeight / 2 - 16;
      addElement(createDataFieldElement(x, y, header));
      toast({
        title: "Data field added",
        description: `Added "${header}" field to the canvas.`,
      });
    }
    setActiveHeader(null);
  };

  const handlePrevRow = () => {
    if (selectedRowIndex > 0) {
      setSelectedRowIndex(selectedRowIndex - 1);
    }
  };

  const handleNextRow = () => {
    if (excelData && selectedRowIndex < excelData.rows.length - 1) {
      setSelectedRowIndex(selectedRowIndex + 1);
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div>
          <h3 className="font-medium text-sm mb-3">Import Data</h3>
          
          {!excelData ? (
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              data-testid="dropzone-upload"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.ods"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-file-upload"
              />
              <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">
                {isLoading ? "Processing..." : "Upload Excel or CSV"}
              </p>
              <p className="text-xs text-muted-foreground">
                Drop your file here or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Supports: .xlsx, .xls, .csv
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <FileSpreadsheet className="h-5 w-5 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{excelData.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {excelData.headers.length} columns, {excelData.rows.length} rows
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleClearData}
                  data-testid="btn-clear-data"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={() => fileInputRef.current?.click()}
                data-testid="btn-replace-data"
              >
                <Upload className="h-4 w-4" />
                Replace Data
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.ods"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          )}
        </div>

        {excelData && (
          <>
            <Separator />

            <div>
              <h3 className="font-medium text-sm mb-2">Data Fields</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Drag fields onto the canvas to bind them to your design
              </p>

              <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="flex flex-wrap gap-1.5">
                  {excelData.headers.map((header) => (
                    <DraggableHeader key={header} header={header} />
                  ))}
                </div>

                <DragOverlay>
                  {activeHeader && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary text-primary-foreground rounded-md text-sm shadow-lg">
                      <Database className="h-3 w-3" />
                      <span className="font-medium">{activeHeader}</span>
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-sm">Preview Row</h3>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handlePrevRow}
                    disabled={selectedRowIndex === 0}
                    data-testid="btn-prev-row"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Select
                    value={String(selectedRowIndex)}
                    onValueChange={(value) => setSelectedRowIndex(Number(value))}
                  >
                    <SelectTrigger className="w-20 h-7" data-testid="select-row">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {excelData.rows.map((_, index) => (
                        <SelectItem key={index} value={String(index)}>
                          Row {index + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleNextRow}
                    disabled={selectedRowIndex >= excelData.rows.length - 1}
                    data-testid="btn-next-row"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                Select a row to preview how data will appear in your design
              </p>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium">Field</TableHead>
                      <TableHead className="text-xs font-medium">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {excelData.headers.map((header) => (
                      <TableRow key={header}>
                        <TableCell className="py-2 font-mono text-xs text-muted-foreground">
                          {header}
                        </TableCell>
                        <TableCell className="py-2 text-sm">
                          {excelData.rows[selectedRowIndex]?.[header] || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}
