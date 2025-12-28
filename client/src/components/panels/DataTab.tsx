import { useRef, useCallback, useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { parseDataFile } from "@/lib/excel-parser";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Save,
  CheckCircle2,
} from "lucide-react";
import { useDraggable } from "@dnd-kit/core";

// --- DraggableHeader ---
function DraggableHeader({ header, onStandardize }: { header: string, onStandardize: (h: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `header-${header}`,
    data: { header },
  });

  const aiFieldNames = useCanvasStore(state => state.aiFieldNames);
  const isAI = aiFieldNames.has(header);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm cursor-grab active:cursor-grabbing transition-all max-w-full ${
        isDragging ? "opacity-50 scale-95" : "hover:bg-accent hover:border-primary/50"
      } ${isAI ? "bg-purple-100 text-purple-900 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-100 dark:border-purple-800" : "bg-primary/10 text-primary border border-transparent"}`}
      data-testid={`draggable-header-${header}`}
    >
      <GripVertical className="h-3 w-3 opacity-60 flex-shrink-0" />
      {isAI ? <Sparkles className="h-3 w-3 flex-shrink-0" /> : <Database className="h-3 w-3 flex-shrink-0" />}
      <span className="truncate font-medium">{header}</span>

      {/* Wand Button */}
      <div 
        role="button"
        onPointerDown={(e) => e.stopPropagation()} 
        onClick={(e) => {
          e.stopPropagation(); 
          onStandardize(header);
        }}
        className="ml-1 p-1 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-purple-600 dark:text-purple-300"
        title="Standardize Format with AI"
      >
        <Wand2 className="h-3 w-3" />
      </div>
    </div>
  );
}

export function DataTab() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [useAI, setUseAI] = useState(true); 
  const { toast } = useToast();

  const [enrichDialogOpen, setEnrichDialogOpen] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichType, setEnrichType] = useState("marketing");
  const [enrichTone, setEnrichTone] = useState("Professional");
  const [enrichColumnName, setEnrichColumnName] = useState("Marketing Copy");
  const [enrichAnchor, setEnrichAnchor] = useState<string>("none"); 

  // --- CONFIG SETTINGS ---
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [currencyPlacement, setCurrencyPlacement] = useState("before");
  const [currencySpacing, setCurrencySpacing] = useState(false); 
  const [currencyDecimals, setCurrencyDecimals] = useState("default"); 
  const [currencyThousandSeparator, setCurrencyThousandSeparator] = useState(true); 

  // --- MEASUREMENT SETTINGS ---
  const [measurementUnit, setMeasurementUnit] = useState("in");
  const [measurementFormat, setMeasurementFormat] = useState("abbr");
  const [measurementSpacing, setMeasurementSpacing] = useState(true); 

  // --- Standardization State ---
  const [stdOpen, setStdOpen] = useState(false);
  const [stdColumn, setStdColumn] = useState<string | null>(null);
  const [stdType, setStdType] = useState("title_case");
  const [stdCustom, setStdCustom] = useState("");
  const [stdMode, setStdMode] = useState<"preset" | "custom">("preset");
  const [stdPreview, setStdPreview] = useState<{original: string, new: string}[]>([]);
  const [isStdProcessing, setIsStdProcessing] = useState(false);

  const {
    excelData,
    setExcelData,
    updateExcelData, 
    selectedRowIndex,
    setSelectedRowIndex,
    imageFieldNames,
    toggleImageField,
    elements,
    markAiField,    
    aiFieldNames,
    uniqueIdColumn, 
    setUniqueIdColumn 
  } = useCanvasStore();

  const handleUniqueIdChange = async (columnName: string) => {
    if (!excelData) return;
    setUniqueIdColumn(columnName);

    const keysToCheck = excelData.rows.map(r => r[columnName]).filter(Boolean);
    if (keysToCheck.length === 0) return;

    try {
        const knResponse = await fetch("/api/ai/knowledge/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                keys: keysToCheck,
                keyName: columnName 
            })
        });

        if (knResponse.ok) {
            const { matches } = await knResponse.json();
            let finalHeaders = [...excelData.headers];
            let finalRows = [...excelData.rows];
            const foundFields = new Set<string>();

            Object.values(matches).forEach((fields: any) => {
                Object.keys(fields).forEach(f => foundFields.add(f));
            });

            const newFields = Array.from(foundFields).filter(f => !finalHeaders.includes(f));

            if (newFields.length > 0) {
                finalHeaders = [...finalHeaders, ...newFields];
                finalRows = finalRows.map(row => {
                    const key = row[columnName];
                    const knownData = matches[key] || {};
                    return { ...row, ...knownData };
                });

                newFields.forEach(f => markAiField(f));

                updateExcelData({
                    ...excelData,
                    headers: finalHeaders,
                    rows: finalRows
                });

                toast({
                    title: "Data Retrieved",
                    description: `Found saved content for ${newFields.length} fields.`
                });
            } else {
                 toast({ description: "No saved AI data found for this column." });
            }
        }
    } catch (err) {
        console.error(err);
    }
  };

  const openStandardize = (header: string) => {
    setStdColumn(header);
    setStdOpen(true);
    setStdPreview([]); 

    if (excelData) {
        const samples = excelData.rows.slice(0, 3).map(r => ({
            original: r[header] || "",
            new: "..." 
        }));
        setStdPreview(samples);
    }
  };

  const handleRunStandardize = async (applyToAll = false) => {
    if (!excelData || !stdColumn) return;
    setIsStdProcessing(true);

    const config = {
        type: stdMode === "preset" ? stdType : "custom",
        customInstructions: stdCustom,
        currencySymbol,
        currencyPlacement: currencyPlacement as any,
        currencySpacing, 
        currencyDecimals, 
        currencyThousandSeparator, 
        measurementUnit,
        measurementFormat, 
        measurementSpacing
    };

    const valuesToSend = applyToAll 
        ? excelData.rows.map(r => r[stdColumn])
        : stdPreview.map(p => p.original);

    try {
        const res = await fetch("/api/ai/standardize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                values: valuesToSend, 
                config 
            })
        });

        const data = await res.json();

        if (applyToAll) {
            const newRows = excelData.rows.map((row, i) => ({
                ...row,
                [stdColumn]: data.standardized[i] || row[stdColumn]
            }));

            markAiField(stdColumn); 
            updateExcelData({ ...excelData, rows: newRows });
            toast({ title: "Success", description: `Updated ${excelData.rows.length} rows in "${stdColumn}".` });
            setStdOpen(false);
        } else {
            setStdPreview(stdPreview.map((p, i) => ({
                ...p,
                new: data.standardized[i] || ""
            })));
        }
    } catch (e) {
        toast({ title: "Error", description: "Standardization failed.", variant: "destructive" });
    } finally {
        setIsStdProcessing(false);
    }
  };

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
                anchorColumn: enrichAnchor === "none" ? undefined : enrichAnchor, 
                customFieldName: enrichColumnName 
            })
        });

        if (!response.ok) throw new Error("Generation failed");

        const { generatedContent } = await response.json();
        const newHeader = enrichColumnName;

        const newRows = excelData.rows.map((row, index) => ({
            ...row,
            [newHeader]: generatedContent[index] || ""
        }));

        markAiField(newHeader);

        updateExcelData({
            ...excelData,
            headers: [...excelData.headers, newHeader],
            rows: newRows
        });

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
        {/* Import UI */}
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

                  {/* GENERATE BUTTON */}
                  <Dialog open={enrichDialogOpen} onOpenChange={setEnrichDialogOpen}>
                    <DialogTrigger asChild>
                       <Button size="sm" className="flex-1 gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white border-0">
                          <Wand2 className="h-4 w-4" />
                          Generate with AI
                       </Button>
                    </DialogTrigger>

                    <DialogContent className="bg-white dark:bg-zinc-950 text-black dark:text-white">
                       <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-black dark:text-white">
                             <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                             Generate Content
                          </DialogTitle>
                          <DialogDescription className="text-gray-600 dark:text-gray-400">
                             Use AI to create new data fields based on your product info.
                          </DialogDescription>
                       </DialogHeader>

                       <div className="space-y-4 py-2">
                          <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                 <Label className="text-black dark:text-white">Type</Label>
                                 <Select value={enrichType} onValueChange={setEnrichType}>
                                    <SelectTrigger className="bg-white dark:bg-zinc-900 border-input text-black dark:text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-zinc-900 z-[100]">
                                       <SelectItem value="marketing">Marketing Desc</SelectItem>
                                       <SelectItem value="seo">SEO Title</SelectItem>
                                       <SelectItem value="features">Feature List</SelectItem>
                                       <SelectItem value="email">Sales Email</SelectItem>
                                       <SelectItem value="social">Social Post</SelectItem>
                                    </SelectContent>
                                 </Select>
                              </div>

                              <div className="space-y-2">
                                 <Label className="text-black dark:text-white">Tone</Label>
                                 <Select value={enrichTone} onValueChange={setEnrichTone}>
                                    <SelectTrigger className="bg-white dark:bg-zinc-900 border-input text-black dark:text-white"><SelectValue /></SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-zinc-900 z-[100]">
                                       <SelectItem value="Professional">Professional</SelectItem>
                                       <SelectItem value="Luxury">Luxury</SelectItem>
                                       <SelectItem value="Technical">Technical</SelectItem>
                                       <SelectItem value="Friendly">Friendly</SelectItem>
                                       <SelectItem value="Urgent">Urgent</SelectItem>
                                    </SelectContent>
                                 </Select>
                              </div>
                          </div>

                          <div className="space-y-2 p-3 bg-slate-100 dark:bg-muted/30 rounded-md border border-slate-200 dark:border-border">
                             <Label className="flex items-center gap-2 text-black dark:text-white">
                                <Save className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                Product ID <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">(Optional: Save to Memory)</span>
                             </Label>
                             <Select value={enrichAnchor} onValueChange={setEnrichAnchor}>
                                <SelectTrigger className="bg-white dark:bg-zinc-900 border-input text-black dark:text-white"><SelectValue placeholder="Select ID Column..." /></SelectTrigger>
                                <SelectContent className="bg-white dark:bg-zinc-900 z-[100]">
                                   <SelectItem value="none" className="text-muted-foreground italic">Don't save to memory</SelectItem>
                                   {excelData.headers.map(h => (
                                      <SelectItem key={h} value={h}>{h}</SelectItem>
                                   ))}
                                </SelectContent>
                             </Select>
                             <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                If you select a unique ID (like SKU), we will save this generated text so you can auto-fill it next time.
                             </p>
                          </div>

                          <div className="space-y-2">
                             <Label className="text-black dark:text-white">New Column Name</Label>
                             <Input value={enrichColumnName} onChange={(e) => setEnrichColumnName(e.target.value)} className="bg-white dark:bg-zinc-900 border-input text-black dark:text-white" />
                          </div>
                       </div>

                       <DialogFooter>
                          <Button onClick={handleEnrichData} disabled={isEnriching} className="bg-purple-600 hover:bg-purple-700 text-white">
                             {isEnriching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
                             Generate
                          </Button>
                       </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {/* STANDARDIZATION DIALOG */}
                  <Dialog open={stdOpen} onOpenChange={setStdOpen}>
                    <DialogContent className="sm:max-w-[500px] bg-white dark:bg-zinc-950 text-black dark:text-white">
                        <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-black dark:text-white">
                            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            Standardize "{stdColumn}"
                        </DialogTitle>
                        <DialogDescription className="text-gray-600 dark:text-gray-400">
                            Clean up inconsistent formatting in this column.
                        </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-4 py-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-black dark:text-white">Desired Format</Label>
                                <RadioGroup 
                                    value={stdMode} 
                                    onValueChange={(v) => setStdMode(v as "preset" | "custom")}
                                    className="flex gap-2"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem 
                                            value="preset" 
                                            id="mode-preset" 
                                            className="border-black text-black dark:border-white dark:text-white"
                                        />
                                        <Label htmlFor="mode-preset" className="font-normal text-xs cursor-pointer text-black dark:text-white">
                                            Preset
                                        </Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem 
                                            value="custom" 
                                            id="mode-custom" 
                                            className="border-black text-black dark:border-white dark:text-white"
                                        />
                                        <Label htmlFor="mode-custom" className="font-normal text-xs cursor-pointer text-black dark:text-white">
                                            Custom
                                        </Label>
                                    </div>
                                </RadioGroup>
                            </div>

                            {stdMode === "preset" ? (
                                <div className="space-y-4">
                                    <Select value={stdType} onValueChange={setStdType}>
                                        <SelectTrigger className="bg-white dark:bg-zinc-900 border-input text-black dark:text-white"><SelectValue /></SelectTrigger>
                                        <SelectContent className="bg-white dark:bg-zinc-900 z-[100]">
                                            <SelectItem value="title_case">Title Case (e.g. Blue Widget)</SelectItem>
                                            <SelectItem value="uppercase">UPPERCASE (e.g. BLUE WIDGET)</SelectItem>
                                            <SelectItem value="currency">Currency Formatting</SelectItem>
                                            <SelectItem value="measurements">Measurements</SelectItem>
                                            <SelectItem value="clean_text">Clean Text (Remove symbols/HTML)</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {/* CURRENCY SETTINGS */}
                                    {stdType === 'currency' && (
                                        <div className="grid grid-cols-2 gap-4 p-3 bg-slate-100 dark:bg-muted/40 rounded-md animate-in fade-in slide-in-from-top-1 border border-slate-200 dark:border-border">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-black dark:text-white">Symbol</Label>
                                                <Select value={currencySymbol} onValueChange={setCurrencySymbol}>
                                                    <SelectTrigger className="h-8 bg-white dark:bg-zinc-900 border-input text-black dark:text-white"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="bg-white dark:bg-zinc-900 z-[100]">
                                                        <SelectItem value="$">USD ($)</SelectItem>
                                                        <SelectItem value="€">EUR (€)</SelectItem>
                                                        <SelectItem value="£">GBP (£)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-black dark:text-white">Placement</Label>
                                                <Select value={currencyPlacement} onValueChange={setCurrencyPlacement}>
                                                    <SelectTrigger className="h-8 bg-white dark:bg-zinc-900 border-input text-black dark:text-white"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="bg-white dark:bg-zinc-900 z-[100]">
                                                        <SelectItem value="before">Before ($10)</SelectItem>
                                                        <SelectItem value="after">After (10$)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="col-span-2 space-y-2">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id="curr-spacing" 
                                                        checked={currencySpacing} 
                                                        onCheckedChange={(c) => setCurrencySpacing(!!c)} 
                                                        className="border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                                                    />
                                                    <Label htmlFor="curr-spacing" className="text-xs font-normal cursor-pointer text-black dark:text-white">Add space (e.g. $ 10)</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id="curr-separator" 
                                                        checked={currencyThousandSeparator} 
                                                        onCheckedChange={(c) => setCurrencyThousandSeparator(!!c)} 
                                                        className="border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                                                    />
                                                    <Label htmlFor="curr-separator" className="text-xs font-normal cursor-pointer text-black dark:text-white">Thousand separator (1,000)</Label>
                                                </div>
                                            </div>
                                            <div className="col-span-2 space-y-1 mt-1">
                                                <Label className="text-xs text-black dark:text-white">Decimals</Label>
                                                <Select value={currencyDecimals} onValueChange={setCurrencyDecimals}>
                                                    <SelectTrigger className="h-8 bg-white dark:bg-zinc-900 border-input text-black dark:text-white"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="bg-white dark:bg-zinc-900 z-[100]">
                                                        <SelectItem value="default">No Change</SelectItem>
                                                        <SelectItem value="whole">Round to Whole Number</SelectItem>
                                                        <SelectItem value="two">Force 2 Decimal Places</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    )}

                                    {/* MEASUREMENT SETTINGS */}
                                    {stdType === 'measurements' && (
                                        <div className="grid grid-cols-2 gap-4 p-3 bg-slate-100 dark:bg-muted/40 rounded-md animate-in fade-in slide-in-from-top-1 border border-slate-200 dark:border-border">
                                            <div className="space-y-2">
                                                <Label className="text-xs text-black dark:text-white">Unit</Label>
                                                <Select value={measurementUnit} onValueChange={setMeasurementUnit}>
                                                    <SelectTrigger className="h-8 bg-white dark:bg-zinc-900 border-input text-black dark:text-white"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="bg-white dark:bg-zinc-900 z-[100]">
                                                        <SelectItem value="in">Inches</SelectItem>
                                                        <SelectItem value="cm">Centimeters</SelectItem>
                                                        <SelectItem value="mm">Millimeters</SelectItem>
                                                        <SelectItem value="lb">Pounds (lbs)</SelectItem>
                                                        <SelectItem value="kg">Kilograms (kg)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs text-black dark:text-white">Format</Label>
                                                <Select value={measurementFormat} onValueChange={setMeasurementFormat}>
                                                    <SelectTrigger className="h-8 bg-white dark:bg-zinc-900 border-input text-black dark:text-white"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="bg-white dark:bg-zinc-900 z-[100]">
                                                        <SelectItem value="abbr">Abbreviated (in)</SelectItem>
                                                        <SelectItem value="full">Full Word (inches)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="col-span-2 flex items-center space-x-2">
                                                <Checkbox 
                                                    id="meas-spacing" 
                                                    checked={measurementSpacing} 
                                                    onCheckedChange={(c) => setMeasurementSpacing(!!c)} 
                                                    className="border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:text-white"
                                                />
                                                <Label htmlFor="meas-spacing" className="text-xs font-normal cursor-pointer text-black dark:text-white">Add space (e.g. 50 cm)</Label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <Input 
                                        placeholder="e.g. 'Convert lbs to kg' or 'Format as (XXX) XXX-XXXX'"
                                        value={stdCustom}
                                        onChange={e => setStdCustom(e.target.value)}
                                        className="bg-white dark:bg-zinc-900 border-input text-black dark:text-white"
                                    />
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Be specific. Example: "Extract only the number"</p>
                                </div>
                            )}
                        </div>

                        {/* Preview Box */}
                        <div className="bg-slate-100 dark:bg-muted/40 border border-slate-200 dark:border-border rounded-md p-3 space-y-2">
                            <div className="flex justify-between items-center">
                                <Label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Preview (3 Samples)</Label>
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 text-xs text-purple-600 dark:text-purple-300 hover:text-purple-700 dark:hover:text-purple-100 p-0 hover:bg-transparent"
                                    onClick={() => handleRunStandardize(false)} 
                                    disabled={isStdProcessing}
                                >
                                    {isStdProcessing ? "Generating..." : "Refresh Preview"}
                                </Button>
                            </div>

                            <div className="space-y-1">
                                {stdPreview.map((row, i) => (
                                    <div key={i} className="grid grid-cols-2 gap-4 text-sm items-center">
                                        <div className="text-gray-600 dark:text-gray-400 truncate text-xs" title={row.original}>
                                            {row.original || <span className="italic opacity-50">Empty</span>}
                                        </div>
                                        <div className="font-medium text-purple-900 dark:text-purple-100 truncate bg-purple-100/50 dark:bg-purple-900/40 px-2 py-0.5 rounded text-xs" title={row.new}>
                                            {row.new === "..." ? "..." : row.new}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        </div>

                        <DialogFooter>
                        <Button variant="outline" onClick={() => setStdOpen(false)} className="text-black dark:text-white border-input bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800">Cancel</Button>
                        <Button 
                            onClick={() => handleRunStandardize(true)} // Apply to All
                            disabled={isStdProcessing}
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                            {isStdProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <CheckCircle2 className="mr-2 h-4 w-4"/>}
                            Apply to All Rows
                        </Button>
                        </DialogFooter>
                    </DialogContent>
                  </Dialog>
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

            {/* Unique Identifier Selector */}
            <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-800 p-3 rounded-md space-y-2">
                <Label className="text-purple-900 dark:text-purple-100 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    Sync AI Generated Fields
                </Label>
                <div className="flex gap-2 items-center">
                    <Select value={uniqueIdColumn || ""} onValueChange={handleUniqueIdChange}>
                        <SelectTrigger className="bg-white dark:bg-zinc-900 border-input text-black dark:text-white">
                            <SelectValue placeholder="Select Unique ID Column..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-zinc-900 z-[100]">
                            {excelData.headers.map(h => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <p className="text-[12px] text-purple-700 dark:text-purple-300">
                    Select the column that uniquely identifies your products (e.g., SKU) to retrieve saved AI Generated Content.
                </p>
            </div>

            <Separator />

            <div>
              <h3 className="font-medium text-sm mb-2">Data Fields</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Drag fields onto the canvas to bind them to your design. Hover over a field to see AI tools.
              </p>

              {/* REMOVED DndContext from here to allow bubble up to Editor.tsx */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {excelData.headers.map((header) => (
                  <DraggableHeader 
                      key={header} 
                      header={header} 
                      onStandardize={openStandardize} 
                  />
                ))}
              </div>

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