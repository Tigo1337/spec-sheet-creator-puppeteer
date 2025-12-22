import { useRef, useCallback, useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { parseDataFile } from "@/lib/excel-parser";
import { createDataFieldElement, createImageFieldElement } from "@/lib/canvas-utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  Sparkles,
  Loader2
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
      className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 text-primary rounded-md text-sm cursor-grab active:cursor-grabbing transition-all max-w-full ${
        isDragging ? "opacity-50 scale-95" : "hover:bg-primary/15"
      }`}
      data-testid={`draggable-header-${header}`}
    >
      <GripVertical className="h-3 w-3 opacity-60 flex-shrink-0" />
      <Database className="h-3 w-3 flex-shrink-0" />
      <span className="truncate font-medium">{header}</span>
    </div>
  );
}

export function DataTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeHeader, setActiveHeader] = useState<string | null>(null);
  const [useAI, setUseAI] = useState(true); 
  const { toast } = useToast();

  const {
    excelData,
    setExcelData,
    selectedRowIndex,
    setSelectedRowIndex,
    addElement,
    canvasWidth,
    canvasHeight,
    imageFieldNames,
    toggleImageField,
    elements 
  } = useCanvasStore();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsLoading(true);
      try {
        const result = await parseDataFile(file);

        if (result.success && result.data) {

          let finalHeaders = result.data.headers;
          let finalRows = result.data.rows;
          let mappedCount = 0;

          // --- AI AUTO-MAPPING LOGIC START ---
          if (useAI) {

            // 1. Filter out hidden elements
            const activeElements = elements.filter(el => el.visible !== false);

            // 2. Strict Extraction Strategy (Updated for Images)
            const rawTargets = activeElements.flatMap((el) => {
              // A. Text Elements: Scan content for {{brackets}}
              if (el.type === "text") {
                if (!el.content || typeof el.content !== "string") return [];
                const matches = el.content.match(/{{([\w\s]+)}}/g);
                return matches ? matches.map((m) => m.replace(/{{|}}/g, "").trim()) : [];
              }

              // B. Data Fields: Trust binding
              if (el.type === "dataField") {
                return el.dataBinding ? [el.dataBinding] : [];
              }

              // C. Images: Check strict binding OR scan URL
              if (el.type === "image") {
                const targets = [];
                // 1. Explicit Binding (Priority)
                if (el.dataBinding) {
                    targets.push(el.dataBinding);
                }
                // 2. Fallback: Scan URL for {{Variable}} pattern
                if (el.imageSrc && typeof el.imageSrc === "string") {
                   const matches = el.imageSrc.match(/{{([\w\s]+)}}/g);
                   if (matches) {
                       targets.push(...matches.map((m) => m.replace(/{{|}}/g, "").trim()));
                   }
                }
                return targets;
              }

              // D. Tables/Lists
              if (el.type === "toc-list" && el.dataBinding) {
                 return [el.dataBinding];
              }

              return [];
            });

            // 3. Deduplicate
            const targetVariables = Array.from(new Set(rawTargets)).filter(t => t && t.trim().length > 0);

            console.log("Auto-Mapper Targets:", targetVariables); 

            if (targetVariables.length > 0 && result.data.headers.length > 0) {
              try {
                const response = await fetch("/api/ai/map-fields", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sourceHeaders: result.data.headers,
                    targetVariables: targetVariables,
                  }),
                });

                if (response.ok) {
                  const suggestions = await response.json();

                  // Sort by Priority: Exact Matches First, then High Confidence
                  const bestMatches = new Map();

                  suggestions.forEach((s: any) => {
                    const existing = bestMatches.get(s.target);

                    const isExact = s.source === s.target;
                    const currentIsExact = existing && existing.source === existing.target;

                    if (!existing) {
                      bestMatches.set(s.target, s);
                    } else if (isExact && !currentIsExact) {
                      bestMatches.set(s.target, s);
                    } else if (!currentIsExact && s.confidence > existing.confidence) {
                      bestMatches.set(s.target, s);
                    }
                  });

                  // Apply the "Winning" Matches
                  const mapLookup: Record<string, string> = {};
                  bestMatches.forEach((match) => {
                     if (match.source !== match.target) {
                        mapLookup[match.source] = match.target;
                        mappedCount++;
                     }
                  });

                  if (mappedCount > 0) {
                    finalHeaders = result.data.headers.map(h => mapLookup[h] || h);
                    finalRows = result.data.rows.map(row => {
                      const newRow: Record<string, string> = {};
                      Object.keys(row).forEach(key => {
                        const newKey = mapLookup[key] || key;
                        newRow[newKey] = row[key];
                      });
                      return newRow;
                    });

                    toast({
                      title: "Auto-Mapping Applied",
                      description: `Mapped ${mappedCount} fields using AI.`,
                      duration: 4000,
                    });
                  }
                }
              } catch (aiError) {
                console.warn("AI Mapping failed, using raw import.", aiError);
              }
            }
          }
          // --- AI AUTO-MAPPING LOGIC END ---

          setExcelData({
            ...result.data,
            headers: finalHeaders,
            rows: finalRows
          });

          if (mappedCount === 0) {
             toast({
              title: "Data imported",
              description: useAI 
                ? `Loaded ${result.data.headers.length} columns (No AI matches found).`
                : `Loaded ${result.data.headers.length} columns (AI disabled).`,
            });
          }

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
    [setExcelData, toast, elements, useAI] 
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
    if (header && excelData) {
      const x = canvasWidth / 2 - 75;
      const y = canvasHeight / 2 - 16;

      const isManuallyMarked = imageFieldNames.has(header);
      const isAutoDetected = header.toLowerCase().includes("image") || 
                             header.toLowerCase().includes("photo") ||
                             header.toLowerCase().includes("picture") ||
                             header.toLowerCase().includes("url") ||
                             header.toLowerCase().includes("thumbnail") ||
                             header.toLowerCase().includes("img") ||
                             header.toLowerCase().includes("avatar") ||
                             header.toLowerCase().includes("logo");
      const isImageColumn = isManuallyMarked || isAutoDetected;

      if (isImageColumn) {
        addElement(createImageFieldElement(x, y, header));
        toast({
          title: "Image field added",
          description: `Added "${header}" image field to the canvas.`,
        });
      } else {
        addElement(createDataFieldElement(x, y, header));
        toast({
          title: "Data field added",
          description: `Added "${header}" field to the canvas.`,
        });
      }
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
          <div className="flex items-center justify-between mb-3">
             <h3 className="font-medium text-sm">Import Data</h3>
             {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>

          {/* --- AI TOGGLE SWITCH --- */}
          <div className="flex items-center space-x-2 mb-4 p-2 bg-muted/40 rounded-md border">
             <Switch 
               id="ai-mode" 
               checked={useAI}
               onCheckedChange={setUseAI}
             />
             <Label htmlFor="ai-mode" className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <Sparkles className={`h-3 w-3 ${useAI ? "text-purple-500" : "text-muted-foreground"}`} />
                Enable AI Auto-Mapping
             </Label>
          </div>

          {!excelData ? (
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => !isLoading && fileInputRef.current?.click()}
              data-testid="dropzone-upload"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.ods"
                className="hidden"
                onChange={handleFileChange}
                disabled={isLoading}
                data-testid="input-file-upload"
              />
              {isLoading ? (
                 <div className="py-2">
                    <Sparkles className="h-8 w-8 mx-auto mb-3 text-purple-500 animate-pulse" />
                    <p className="text-sm font-medium animate-pulse">
                        {useAI ? "Analyzing & Mapping..." : "Importing Data..."}
                    </p>
                 </div>
              ) : (
                <>
                  <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors" />
                  <p className="text-sm font-medium mb-1">
                    Upload Excel or CSV
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Drop file to {useAI ? "auto-map" : "import"} fields
                  </p>
                </>
              )}
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
                disabled={isLoading}
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
                <div className="flex flex-wrap gap-1.5 mb-4">
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

              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium text-foreground">Mark as Image Fields</p>
                {excelData.headers.map((header) => {
                  const isAutoDetected = header.toLowerCase().includes("image") || 
                                        header.toLowerCase().includes("photo") ||
                                        header.toLowerCase().includes("picture") ||
                                        header.toLowerCase().includes("url") ||
                                        header.toLowerCase().includes("thumbnail") ||
                                        header.toLowerCase().includes("img") ||
                                        header.toLowerCase().includes("avatar") ||
                                        header.toLowerCase().includes("logo");
                  const isMarked = imageFieldNames.has(header);

                  return (
                    <div key={header} className="flex items-center gap-2">
                      <Checkbox
                        id={`image-field-${header}`}
                        checked={isMarked || isAutoDetected}
                        onCheckedChange={() => toggleImageField(header)}
                        disabled={isAutoDetected}
                        data-testid={`checkbox-image-field-${header}`}
                      />
                      <Label 
                        htmlFor={`image-field-${header}`}
                        className={`text-xs cursor-pointer flex-1 ${isAutoDetected ? 'text-muted-foreground' : ''}`}
                      >
                        {header}
                        {isAutoDetected && <span className="text-muted-foreground ml-1">(auto-detected)</span>}
                      </Label>
                    </div>
                  );
                })}
              </div>
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
                    <SelectTrigger className="w-28 h-7" data-testid="select-row">
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
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium w-[35%]">Field</TableHead>
                      <TableHead className="text-xs font-medium w-[65%]">Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {excelData.headers.map((header) => (
                      <TableRow key={header}>
                        <TableCell className="py-2 font-mono text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                          {header}
                        </TableCell>
                        <TableCell className="py-2 text-sm break-all">
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