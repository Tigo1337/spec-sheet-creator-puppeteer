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
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Loader2,
  Wand2,
  Save 
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

  // Check store to see if this is an AI field
  const aiFieldNames = useCanvasStore(state => state.aiFieldNames);
  const isAI = aiFieldNames.has(header);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm cursor-grab active:cursor-grabbing transition-all max-w-full ${
        isDragging ? "opacity-50 scale-95" : "hover:bg-accent"
      } ${isAI ? "bg-purple-100 text-purple-900 border border-purple-200" : "bg-primary/10 text-primary"}`}
      data-testid={`draggable-header-${header}`}
    >
      <GripVertical className="h-3 w-3 opacity-60 flex-shrink-0" />
      {isAI ? <Sparkles className="h-3 w-3 flex-shrink-0" /> : <Database className="h-3 w-3 flex-shrink-0" />}
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

  // --- ENRICHMENT STATE ---
  const [enrichDialogOpen, setEnrichDialogOpen] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichType, setEnrichType] = useState("marketing");
  const [enrichTone, setEnrichTone] = useState("Professional");
  const [enrichColumnName, setEnrichColumnName] = useState("Marketing Copy");
  const [enrichAnchor, setEnrichAnchor] = useState<string>("none"); 

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
    elements,
    markAiField,    
    aiFieldNames
  } = useCanvasStore();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsLoading(true);
      try {
        const result = await parseDataFile(file);

        if (result.success && result.data) {

          let finalHeaders = [...result.data.headers];
          let finalRows = [...result.data.rows];
          let mappedCount = 0;

          // --- 1. AI KNOWLEDGE CHECK (SMART IMPORT) ---
          // This block checks your DB for saved content (e.g. "Marketing Copy") matching the uploaded SKUs
          if (useAI) {
             const potentialIdColumns = finalHeaders.filter(h => 
                /sku|id|code|product_no|part_no/i.test(h)
             );

             if (potentialIdColumns.length > 0) {
                 const idColumn = potentialIdColumns[0];
                 const keysToCheck = finalRows.map(r => r[idColumn]).filter(Boolean);

                 if (keysToCheck.length > 0) {
                     try {
                        const knResponse = await fetch("/api/ai/knowledge/check", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ keys: keysToCheck })
                        });

                        if (knResponse.ok) {
                            const { matches } = await knResponse.json();
                            // matches = { "SKU-123": { "Marketing Copy": "..." } }

                            const foundFields = new Set<string>();
                            Object.values(matches).forEach((fields: any) => {
                                Object.keys(fields).forEach(f => foundFields.add(f));
                            });

                            // Filter out fields that already exist in the CSV to prevent duplicates
                            const newFields = Array.from(foundFields).filter(f => !finalHeaders.includes(f));

                            if (newFields.length > 0) {
                                // Add new headers
                                finalHeaders = [...finalHeaders, ...newFields];

                                // Merge data into rows
                                finalRows = finalRows.map(row => {
                                    const key = row[idColumn];
                                    const knownData = matches[key] || {};
                                    return { ...row, ...knownData };
                                });

                                // Mark them as AI fields (Purple UI)
                                newFields.forEach(f => markAiField(f));

                                toast({
                                    title: "AI Knowledge Retrieved",
                                    description: `Found saved data for ${newFields.length} columns (linked to ${idColumn}).`
                                });
                            }
                        }
                     } catch (err) {
                         console.warn("Failed to check knowledge base", err);
                     }
                 }
             }
          }

          // --- 2. AI AUTO-MAPPING LOGIC (Variable Matching) ---
          if (useAI) {
            const activeElements = elements.filter(el => el.visible !== false);
            const rawTargets = activeElements.flatMap((el) => {
              if (el.type === "text") {
                if (!el.content || typeof el.content !== "string") return [];
                const matches = el.content.match(/{{([\w\s]+)}}/g);
                return matches ? matches.map((m) => m.replace(/{{|}}/g, "").trim()) : [];
              }
              if (el.type === "dataField") {
                return el.dataBinding ? [el.dataBinding] : [];
              }
              if (el.type === "image") {
                const targets = [];
                if (el.dataBinding) targets.push(el.dataBinding);
                if (el.imageSrc && typeof el.imageSrc === "string") {
                   const matches = el.imageSrc.match(/{{([\w\s]+)}}/g);
                   if (matches) targets.push(...matches.map((m) => m.replace(/{{|}}/g, "").trim()));
                }
                return targets;
              }
              if (el.type === "toc-list" && el.dataBinding) {
                 return [el.dataBinding];
              }
              return [];
            });

            const targetVariables = Array.from(new Set(rawTargets)).filter(t => t && t.trim().length > 0);

            if (targetVariables.length > 0 && finalHeaders.length > 0) {
              try {
                const response = await fetch("/api/ai/map-fields", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sourceHeaders: finalHeaders,
                    targetVariables: targetVariables,
                  }),
                });

                if (response.ok) {
                  const suggestions = await response.json();
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

                  const mapLookup: Record<string, string> = {};
                  bestMatches.forEach((match) => {
                     if (match.source !== match.target) {
                        mapLookup[match.source] = match.target;
                        mappedCount++;
                     }
                  });

                  if (mappedCount > 0) {
                    finalHeaders = finalHeaders.map(h => mapLookup[h] || h);
                    finalRows = finalRows.map(row => {
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

          setExcelData({
            ...result.data,
            headers: finalHeaders,
            rows: finalRows
          });

          if (mappedCount === 0) {
             toast({
              title: "Data imported",
              description: useAI 
                ? `Loaded ${finalHeaders.length} columns.`
                : `Loaded ${finalHeaders.length} columns (AI disabled).`,
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
    [setExcelData, toast, elements, useAI, markAiField] 
  );

  const handleEnrichData = async () => {
    if (!excelData) return;
    setIsEnriching(true);

    try {
        const response = await fetch("/api/ai/enrich-data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                rows: excelData.rows,
                type: enrichType,
                tone: enrichTone,
                anchorColumn: enrichAnchor === "none" ? undefined : enrichAnchor, // Send Anchor
                customFieldName: enrichColumnName // Send Custom Name
            })
        });

        if (!response.ok) throw new Error("Generation failed");

        const { generatedContent } = await response.json();

        const newHeader = enrichColumnName;

        const newRows = excelData.rows.map((row, index) => ({
            ...row,
            [newHeader]: generatedContent[index] || ""
        }));

        setExcelData({
            ...excelData,
            headers: [...excelData.headers, newHeader],
            rows: newRows
        });

        markAiField(newHeader);

        const successMsg = enrichAnchor !== "none" 
            ? `Added "${newHeader}" and saved to Memory.`
            : `Added "${newHeader}" column.`;

        toast({ title: "Data Enriched", description: successMsg });
        setEnrichDialogOpen(false);

    } catch (error) {
        toast({ title: "Error", description: "Failed to generate content.", variant: "destructive" });
    } finally {
        setIsEnriching(false);
    }
  };

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

              <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    data-testid="btn-replace-data"
                  >
                    <Upload className="h-4 w-4" />
                    Replace
                  </Button>

                  {/* --- ENRICH BUTTON --- */}
                  <Dialog open={enrichDialogOpen} onOpenChange={setEnrichDialogOpen}>
                    <DialogTrigger asChild>
                       <Button size="sm" className="flex-1 gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white border-0">
                          <Wand2 className="h-4 w-4" />
                          Enrich
                       </Button>
                    </DialogTrigger>
                    {/* Note: Z-Index removed from DialogContent to fix Dropdown */}
                    <DialogContent>
                       <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                             <Sparkles className="h-5 w-5 text-purple-500" />
                             Generate Content
                          </DialogTitle>
                          <DialogDescription>
                             Use AI to create new data fields based on your product info.
                          </DialogDescription>
                       </DialogHeader>

                       <div className="space-y-4 py-2">
                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                 <Label>Type</Label>
                                 <Select value={enrichType} onValueChange={setEnrichType}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent className="z-[100]">
                                       <SelectItem value="marketing">Marketing Desc</SelectItem>
                                       <SelectItem value="seo">SEO Title</SelectItem>
                                       <SelectItem value="features">Feature List</SelectItem>
                                       <SelectItem value="email">Sales Email</SelectItem>
                                       <SelectItem value="social">Social Post</SelectItem>
                                    </SelectContent>
                                 </Select>
                              </div>

                              <div className="space-y-2">
                                 <Label>Tone</Label>
                                 <Select value={enrichTone} onValueChange={setEnrichTone}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent className="z-[100]">
                                       <SelectItem value="Professional">Professional</SelectItem>
                                       <SelectItem value="Luxury">Luxury</SelectItem>
                                       <SelectItem value="Technical">Technical</SelectItem>
                                       <SelectItem value="Friendly">Friendly</SelectItem>
                                       <SelectItem value="Urgent">Urgent</SelectItem>
                                    </SelectContent>
                                 </Select>
                              </div>
                          </div>

                          <div className="space-y-2 p-3 bg-muted/30 rounded-md border">
                             <Label className="flex items-center gap-2">
                                <Save className="h-3 w-3 text-muted-foreground" />
                                Product ID <span className="text-[10px] text-muted-foreground font-normal">(Optional: Save to Memory)</span>
                             </Label>
                             <Select value={enrichAnchor} onValueChange={setEnrichAnchor}>
                                <SelectTrigger className="bg-background"><SelectValue placeholder="Select ID Column..." /></SelectTrigger>
                                <SelectContent className="z-[100]">
                                   <SelectItem value="none" className="text-muted-foreground italic">Don't save to memory</SelectItem>
                                   {excelData.headers.map(h => (
                                      <SelectItem key={h} value={h}>{h}</SelectItem>
                                   ))}
                                </SelectContent>
                             </Select>
                             <p className="text-[10px] text-muted-foreground">
                                If you select a unique ID (like SKU), we will save this generated text so you can auto-fill it next time.
                             </p>
                          </div>

                          <div className="space-y-2">
                             <Label>New Column Name</Label>
                             <Input value={enrichColumnName} onChange={(e) => setEnrichColumnName(e.target.value)} />
                          </div>
                       </div>

                       <DialogFooter>
                          <Button onClick={handleEnrichData} disabled={isEnriching} className="bg-purple-600 hover:bg-purple-700">
                             {isEnriching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
                             Generate
                          </Button>
                       </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  {/* --------------------- */}
              </div>

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
                          {aiFieldNames.has(header) ? (
                             <span className="text-purple-600 font-bold">{header}</span>
                          ) : (
                             header
                          )}
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