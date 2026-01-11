import { useRef, useCallback, useState, useEffect } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  Languages,
  ArrowRight
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

      {/* Wand Button - Now opens the Unified Dialog in "Existing" mode */}
      <div 
        role="button"
        onPointerDown={(e) => e.stopPropagation()} 
        onClick={(e) => {
          e.stopPropagation(); 
          onStandardize(header);
        }}
        className="ml-1 p-1 hover:bg-purple-200 dark:hover:bg-purple-800 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-purple-600 dark:text-purple-300"
        title="Standardize / Translate"
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

  // --- UNIFIED DIALOG STATE ---
  const [genDialogOpen, setGenDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [genMode, setGenMode] = useState<"new" | "existing">("new");

  // Common Settings
  const [targetColumnName, setTargetColumnName] = useState("");
  const [anchorColumn, setAnchorColumn] = useState<string>("none"); 

  // Mode: NEW (Enrich)
  const [enrichType, setEnrichType] = useState("marketing");
  const [enrichTone, setEnrichTone] = useState("Professional");
  const [enrichFields, setEnrichFields] = useState<string[]>([]); // Context fields

  // Mode: EXISTING (Standardize)
  const [stdSourceColumn, setStdSourceColumn] = useState<string>("");
  const [stdType, setStdType] = useState("translation"); // default to translation
  const [stdLanguage, setStdLanguage] = useState("French Canadian");
  const [stdCustom, setStdCustom] = useState("");
  const [stdPreview, setStdPreview] = useState<{original: string, new: string}[]>([]); // New: Preview State

  // Advanced Formatting (Currency/Measurement)
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [currencyPlacement, setCurrencyPlacement] = useState("before");
  const [currencySpacing, setCurrencySpacing] = useState(false); 
  const [currencyDecimals, setCurrencyDecimals] = useState("default"); 
  const [currencyThousandSeparator, setCurrencyThousandSeparator] = useState(true); 
  const [measurementUnit, setMeasurementUnit] = useState("in");
  const [measurementFormat, setMeasurementFormat] = useState("abbr");
  const [measurementSpacing, setMeasurementSpacing] = useState(true); 

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

  // Open dialog from Header Button (Defaults to "Existing" mode)
  const openStandardize = (header: string) => {
    setGenMode("existing");
    setStdSourceColumn(header);
    setTargetColumnName(`${header} - ${stdType === 'translation' ? 'Translated' : 'Std'}`);
    setStdPreview([]); // Reset preview on open
    setGenDialogOpen(true);
  };

  // Open dialog from Main Button (Defaults to "New" mode)
  const openGenerate = () => {
    setGenMode("new");
    setTargetColumnName("Marketing Copy");
    setGenDialogOpen(true);
  };

  // Auto-update target name when settings change
  useEffect(() => {
    if (!genDialogOpen) return;
    if (genMode === "existing" && stdSourceColumn) {
        if (stdType === "translation") setTargetColumnName(`${stdSourceColumn} - ${stdLanguage}`);
        else if (stdType === "currency") setTargetColumnName(`${stdSourceColumn} - Currency`);
        else if (stdType === "measurements") setTargetColumnName(`${stdSourceColumn} - ${measurementUnit}`);
        else if (stdType === "clean_text") setTargetColumnName(`${stdSourceColumn} - Clean`);
    } else if (genMode === "new") {
        // Keep user input or default
        if (targetColumnName === "") setTargetColumnName("AI Generated Content");
    }
  }, [stdType, stdLanguage, measurementUnit, stdSourceColumn, genMode]);

  // --- PREVIEW GENERATION ---
  const handleGeneratePreview = async () => {
    if (!excelData || !stdSourceColumn) return;
    setIsProcessing(true);

    // Grab first 3 rows
    const samples = excelData.rows.slice(0, 3).map(r => r[stdSourceColumn] || "");

    const config = {
        type: stdType === "custom" ? "custom" : stdType,
        customInstructions: stdCustom,
        targetLanguage: stdLanguage,
        currencySymbol, currencyPlacement: currencyPlacement as any, currencySpacing, currencyDecimals, currencyThousandSeparator,
        measurementUnit, measurementFormat, measurementSpacing
    };

    try {
        const res = await fetch("/api/ai/standardize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                values: samples, 
                config 
            })
        });

        if (!res.ok) throw new Error("Preview failed");
        const data = await res.json();

        setStdPreview(samples.map((original, i) => ({
            original,
            new: data.standardized[i] || ""
        })));
    } catch (e) {
        toast({ title: "Error", description: "Could not generate preview.", variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleUnifiedGenerate = async () => {
    if (!excelData) return;
    setIsProcessing(true);

    try {
        let response;
        let generatedData: string[] = [];

        // --- MODE 1: NEW FIELD (Enrichment) ---
        if (genMode === "new") {
            // Context Filtering Logic
            const contextRows = excelData.rows.map(row => {
                if (enrichFields.length === 0) return row; 
                const filtered: Record<string, string> = {};
                enrichFields.forEach(field => { if (row.hasOwnProperty(field)) filtered[field] = row[field]; });
                // Force include anchor for memory
                if (anchorColumn && anchorColumn !== "none" && row.hasOwnProperty(anchorColumn)) {
                    filtered[anchorColumn] = row[anchorColumn];
                }
                return filtered;
            });

            response = await fetch("/api/ai/enrich-data", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rows: contextRows,
                    config: { type: enrichType, tone: enrichTone },
                    anchorColumn: anchorColumn === "none" ? undefined : anchorColumn, 
                    customFieldName: targetColumnName 
                })
            });

            if (!response.ok) throw new Error("Generation failed");
            const data = await response.json();
            generatedData = data.generatedContent;
        } 

        // --- MODE 2: EXISTING FIELD (Standardization) ---
        else {
            if (!stdSourceColumn) {
                toast({ title: "Error", description: "Please select a source column.", variant: "destructive" });
                setIsProcessing(false);
                return;
            }

            const valuesToSend = excelData.rows.map(r => r[stdSourceColumn] || "");

            // Gather keys for memory saving if anchor is selected
            let keysToSend: string[] | undefined = undefined;
            if (anchorColumn && anchorColumn !== "none") {
                keysToSend = excelData.rows.map(r => r[anchorColumn] || "");
            }

            const config = {
                type: stdType === "custom" ? "custom" : stdType,
                customInstructions: stdCustom,
                targetLanguage: stdLanguage,
                currencySymbol, currencyPlacement, currencySpacing, currencyDecimals, currencyThousandSeparator,
                measurementUnit, measurementFormat, measurementSpacing
            };

            response = await fetch("/api/ai/standardize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    values: valuesToSend, 
                    config,
                    // New: Send memory data to backend
                    keys: keysToSend,
                    keyName: anchorColumn !== "none" ? anchorColumn : undefined,
                    fieldName: targetColumnName
                })
            });

            if (!response.ok) throw new Error("Standardization failed");
            const data = await response.json();
            generatedData = data.standardized;
        }

        // --- MERGE RESULTS ---
        const newRows = excelData.rows.map((row, index) => ({
            ...row,
            [targetColumnName]: generatedData[index] || ""
        }));

        markAiField(targetColumnName);

        updateExcelData({
            ...excelData,
            headers: [...excelData.headers, targetColumnName],
            rows: newRows
        });

        const successMsg = anchorColumn !== "none" 
            ? `Created "${targetColumnName}" and saved to Memory.`
            : `Created "${targetColumnName}".`;

        toast({ title: "Success", description: successMsg });
        setGenDialogOpen(false);

    } catch (error) {
        console.error(error);
        toast({ title: "Error", description: "AI operation failed.", variant: "destructive" });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleUniqueIdChange = async (columnName: string) => {
    if (!excelData) return;
    setUniqueIdColumn(columnName);
    const keysToCheck = excelData.rows.map(r => r[columnName]).filter(Boolean);
    if (keysToCheck.length === 0) return;

    try {
        const knResponse = await fetch("/api/ai/knowledge/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ keys: keysToCheck, keyName: columnName })
        });

        if (knResponse.ok) {
            const { matches } = await knResponse.json();
            let finalHeaders = [...excelData.headers];
            let finalRows = [...excelData.rows];
            const foundFields = new Set<string>();

            Object.values(matches).forEach((fields: any) => { Object.keys(fields).forEach(f => foundFields.add(f)); });
            const newFields = Array.from(foundFields).filter(f => !finalHeaders.includes(f));

            if (newFields.length > 0) {
                finalHeaders = [...finalHeaders, ...newFields];
                finalRows = finalRows.map(row => {
                    const key = row[columnName];
                    const knownData = matches[key] || {};
                    return { ...row, ...knownData };
                });
                newFields.forEach(f => markAiField(f));
                updateExcelData({ ...excelData, headers: finalHeaders, rows: finalRows });

                const warnings: string[] = [];
                foundFields.forEach(field => {
                    const missingCount = finalRows.filter(r => !r[field] || String(r[field]).trim() === "").length;
                    if (missingCount > 0) {
                        const hasValueCount = finalRows.length - missingCount;
                        warnings.push(`AI Generated "${field}" has a value in ${hasValueCount} rows but ${missingCount} are missing.`);
                    }
                });

                if (warnings.length > 0) {
                    toast({ title: "Partial Data Sync", description: warnings.join(" "), variant: "destructive", duration: 7000 });
                } else {
                    toast({ title: "Data Retrieved", description: `Found saved content for ${foundFields.size} fields.` });
                }
            } else { toast({ description: "No saved AI data found for this column." }); }
        }
    } catch (err) { console.error(err); }
  };

  const handleToggleEnrichField = (header: string) => {
    setEnrichFields(prev => prev.includes(header) ? prev.filter(f => f !== header) : [...prev, header]);
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]; if (!file) return;
      setIsLoading(true);
      try {
        const result = await parseDataFile(file);
        if (result.success && result.data) {
          setExcelData(result.data);
          toast({ title: "Data imported", description: `Loaded ${result.data.headers.length} columns.` });
        } else { toast({ title: "Import failed", description: result.error || "Could not parse file.", variant: "destructive" }); }
      } catch (error) { toast({ title: "Import error", description: "An unexpected error occurred.", variant: "destructive" }); }
      finally { setIsLoading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
    }, [setExcelData, toast]
  );

  const handleClearData = () => setExcelData(null);
  const handlePrevRow = () => selectedRowIndex > 0 && setSelectedRowIndex(selectedRowIndex - 1);
  const handleNextRow = () => excelData && selectedRowIndex < excelData.rows.length - 1 && setSelectedRowIndex(selectedRowIndex + 1);

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Import Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
             <h3 className="font-medium text-sm">Import Data</h3>
             {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>

          {/* HIDDEN FOR PRODUCTION: AI Auto-Mapping toggle is hidden but code is preserved below */}
          <div className="hidden flex-items-center space-x-2 mb-4 p-2 bg-muted/40 rounded-md border">
             <Switch id="ai-mode" checked={useAI} onCheckedChange={setUseAI} />
             <Label htmlFor="ai-mode" className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <Sparkles className={`h-3 w-3 ${useAI ? "text-purple-500" : "text-muted-foreground"}`} />
                Enable AI Auto-Mapping
             </Label>
          </div>

          {!excelData ? (
            <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => !isLoading && fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.ods" className="hidden" onChange={handleFileChange} disabled={isLoading} />
              {isLoading ? (
                 <div className="py-2"><Sparkles className="h-8 w-8 mx-auto mb-3 text-purple-500 animate-pulse" /><p className="text-sm font-medium animate-pulse">{useAI ? "Analyzing..." : "Importing..."}</p></div>
              ) : (
                <><FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-muted-foreground group-hover:text-primary transition-colors" /><p className="text-sm font-medium mb-1">Upload Excel or CSV</p><p className="text-xs text-muted-foreground">Drop file to {useAI ? "auto-map" : "import"} fields</p></>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 min-w-0"><FileSpreadsheet className="h-5 w-5 text-primary flex-shrink-0" /><div className="min-w-0"><p className="text-sm font-medium truncate">{excelData.fileName}</p><p className="text-xs text-muted-foreground">{excelData.headers.length} columns, {excelData.rows.length} rows</p></div></div>
                <Button size="icon" variant="ghost" onClick={handleClearData}><X className="h-4 w-4" /></Button>
              </div>
              <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => fileInputRef.current?.click()} disabled={isLoading}><Upload className="h-4 w-4" />Replace</Button>

                  {/* --- UNIFIED GENERATE BUTTON --- */}
                  <Dialog open={genDialogOpen} onOpenChange={setGenDialogOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" className="flex-1 gap-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white border-0" onClick={openGenerate}>
                           <Sparkles className="h-4 w-4" />
                           Generate / Standardize
                        </Button>
                    </DialogTrigger>

                    <DialogContent className="bg-white dark:bg-zinc-950 text-black dark:text-white sm:max-w-[500px]">
                       <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-black dark:text-white">
                             <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                             Generate Content
                          </DialogTitle>
                          <DialogDescription>Create new fields or standardize existing ones.</DialogDescription>
                       </DialogHeader>

                       <Tabs value={genMode} onValueChange={(v: any) => setGenMode(v)} className="w-full">
                          <TabsList className="grid w-full grid-cols-2">
                             <TabsTrigger value="new">New Field (Enrich)</TabsTrigger>
                             <TabsTrigger value="existing">Existing Field (Fix)</TabsTrigger>
                          </TabsList>

                          {/* --- TAB: NEW FIELD --- */}
                          <TabsContent value="new" className="space-y-4 py-2">
                              <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2"><Label>Type</Label><Select value={enrichType} onValueChange={setEnrichType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="marketing">Marketing Desc</SelectItem><SelectItem value="seo">SEO Title</SelectItem><SelectItem value="features">Feature List</SelectItem><SelectItem value="email">Sales Email</SelectItem><SelectItem value="social">Social Post</SelectItem></SelectContent></Select></div>
                                  <div className="space-y-2"><Label>Tone</Label><Select value={enrichTone} onValueChange={setEnrichTone}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Professional">Professional</SelectItem><SelectItem value="Luxury">Luxury</SelectItem><SelectItem value="Technical">Technical</SelectItem><SelectItem value="Friendly">Friendly</SelectItem><SelectItem value="Urgent">Urgent</SelectItem></SelectContent></Select></div>
                              </div>
                              <div className="space-y-2"><Label className="text-xs">Context Columns</Label><ScrollArea className="h-[100px] border rounded-md p-2 bg-muted/20"><div className="space-y-1.5">{excelData.headers.map(h => (<div key={h} className="flex items-center gap-2"><Checkbox id={`context-${h}`} checked={enrichFields.includes(h)} onCheckedChange={() => handleToggleEnrichField(h)} /><label htmlFor={`context-${h}`} className="text-xs cursor-pointer select-none flex-1 truncate">{h}</label></div>))}</div></ScrollArea><p className="text-[10px] text-muted-foreground italic">If none selected, all columns will be used as context.</p></div>
                          </TabsContent>

                          {/* --- TAB: EXISTING FIELD --- */}
                          <TabsContent value="existing" className="space-y-4 py-2">
                              <div className="space-y-2">
                                <Label>Source Column</Label>
                                <Select value={stdSourceColumn} onValueChange={setStdSourceColumn}>
                                    <SelectTrigger><SelectValue placeholder="Select column to fix..." /></SelectTrigger>
                                    <SelectContent className="max-h-[200px]">{excelData.headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2"><Label>Action</Label><Select value={stdType} onValueChange={setStdType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="translation">Translate</SelectItem><SelectItem value="currency">Format Currency</SelectItem><SelectItem value="measurements">Format Measurements</SelectItem><SelectItem value="title_case">Title Case</SelectItem><SelectItem value="uppercase">UPPERCASE</SelectItem><SelectItem value="clean_text">Clean Text</SelectItem><SelectItem value="custom">Custom Instruction</SelectItem></SelectContent></Select></div>

                              {/* DYNAMIC SETTINGS */}
                              {stdType === 'translation' && (
                                <div className="space-y-2 p-3 bg-slate-100 dark:bg-muted/30 rounded-md border"><Label className="text-xs flex items-center gap-1.5"><Languages className="h-3 w-3" /> Target Language</Label><Select value={stdLanguage} onValueChange={setStdLanguage}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="French Canadian">French Canadian</SelectItem><SelectItem value="French">French (France)</SelectItem><SelectItem value="Italian">Italian</SelectItem><SelectItem value="Spanish">Spanish</SelectItem><SelectItem value="German">German</SelectItem></SelectContent></Select></div>
                              )}
                              {stdType === 'currency' && (
                                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-100 dark:bg-muted/30 rounded-md border"><div className="space-y-1"><Label className="text-xs">Symbol</Label><Select value={currencySymbol} onValueChange={setCurrencySymbol}><SelectTrigger className="h-7"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="$">$</SelectItem><SelectItem value="€">€</SelectItem><SelectItem value="£">£</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label className="text-xs">Format</Label><Select value={currencyDecimals} onValueChange={setCurrencyDecimals}><SelectTrigger className="h-7"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Default</SelectItem><SelectItem value="whole">Whole #</SelectItem><SelectItem value="two">.00</SelectItem></SelectContent></Select></div></div>
                              )}
                              {stdType === 'measurements' && (
                                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-100 dark:bg-muted/30 rounded-md border"><div className="space-y-1"><Label className="text-xs">Unit</Label><Select value={measurementUnit} onValueChange={setMeasurementUnit}><SelectTrigger className="h-7"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="in">Inches</SelectItem><SelectItem value="cm">cm</SelectItem><SelectItem value="kg">kg</SelectItem><SelectItem value="lb">lbs</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label className="text-xs">Format</Label><Select value={measurementFormat} onValueChange={setMeasurementFormat}><SelectTrigger className="h-7"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="abbr">Abbr (cm)</SelectItem><SelectItem value="full">Full (cm)</SelectItem></SelectContent></Select></div></div>
                              )}
                              {stdType === 'custom' && (<Input placeholder="e.g. Remove HTML tags" value={stdCustom} onChange={e => setStdCustom(e.target.value)} />)}

                              {/* PREVIEW BOX */}
                              <div className="bg-slate-100 dark:bg-muted/40 border rounded-md p-3 space-y-2 mt-4">
                                <div className="flex justify-between items-center">
                                    <Label className="text-xs text-gray-500 uppercase">Preview (3 Rows)</Label>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 text-xs text-purple-600 p-0 hover:bg-transparent" 
                                        onClick={handleGeneratePreview} 
                                        disabled={isProcessing || !stdSourceColumn}
                                    >
                                        {isProcessing ? "..." : "Refresh Preview"}
                                    </Button>
                                </div>
                                <div className="space-y-1">
                                    {stdPreview.length === 0 ? (
                                        <p className="text-[10px] text-muted-foreground italic">Select a column and click refresh to see preview</p>
                                    ) : (
                                        stdPreview.map((row, i) => (
                                        <div key={i} className="grid grid-cols-2 gap-2 text-xs items-center">
                                            <div className="truncate opacity-60" title={row.original}>{row.original || <span className="italic">Empty</span>}</div>
                                            <div className="font-medium text-purple-900 truncate bg-purple-100/50 px-2 py-0.5 rounded" title={row.new}>{row.new}</div>
                                        </div>
                                        ))
                                    )}
                                </div>
                              </div>
                          </TabsContent>
                       </Tabs>

                       {/* COMMON FOOTER */}
                       <div className="space-y-4 pt-2">
                           <div className="space-y-2 p-3 bg-slate-100 dark:bg-muted/30 rounded-md border border-slate-200 dark:border-border">
                                <Label className="flex items-center gap-2 text-black dark:text-white">
                                <Save className="h-3 w-3 text-gray-500" />
                                Product ID <span className="text-[10px] text-gray-500 font-normal">(For AI Memory)</span>
                                </Label>
                                <Select value={anchorColumn} onValueChange={setAnchorColumn}>
                                <SelectTrigger className="bg-white dark:bg-zinc-900 border-input text-black dark:text-white"><SelectValue placeholder="Select ID Column..." /></SelectTrigger>
                                <SelectContent className="bg-white dark:bg-zinc-900 z-[6000]">
                                    <SelectItem value="none" className="text-muted-foreground italic">Don't save to memory</SelectItem>
                                    {excelData.headers.map(h => (<SelectItem key={h} value={h}>{h}</SelectItem>))}
                                </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-black dark:text-white">Output Column Name</Label>
                                <Input value={targetColumnName} onChange={(e) => setTargetColumnName(e.target.value)} className="bg-white dark:bg-zinc-900 border-input text-black dark:text-white" />
                            </div>
                       </div>

                       <DialogFooter>
                          <Button onClick={handleUnifiedGenerate} disabled={isProcessing} className="bg-purple-600 hover:bg-purple-700 text-white w-full">
                             {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                             {genMode === 'new' ? 'Generate Content' : 'Standardize & Create Column'}
                          </Button>
                       </DialogFooter>
                    </DialogContent>
                  </Dialog>
              </div>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.ods" className="hidden" onChange={handleFileChange} />
            </div>
          )}
        </div>

        {excelData && (
          <>
            <Separator />
            <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-100 p-3 rounded-md space-y-2">
                <Label className="text-purple-900 dark:text-purple-100 flex items-center gap-2"><Sparkles className="h-4 w-4 text-purple-600" />Sync AI Generated Fields</Label>
                <div className="flex gap-2 items-center"><Select value={uniqueIdColumn || ""} onValueChange={handleUniqueIdChange}><SelectTrigger className="bg-white dark:bg-zinc-900"><SelectValue placeholder="Select Unique ID Column..." /></SelectTrigger><SelectContent className="bg-white dark:bg-zinc-900 z-[6000]">{excelData.headers.map(h => (<SelectItem key={h} value={h}>{h}</SelectItem>))}</SelectContent></Select></div>
            </div>
            <Separator />
            <div>
              <h3 className="font-medium text-sm mb-2">Data Fields</h3>
              <div className="flex flex-wrap gap-1.5 mb-4">{excelData.headers.map((header) => (<DraggableHeader key={header} header={header} onStandardize={openStandardize} />))}</div>
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <p className="text-xs font-medium">Mark as Image Fields</p>
                {excelData.headers.map((header) => { 
                  // 1. Header Name Match
                  const headerMatch = header.toLowerCase().includes("image") || 
                                      header.toLowerCase().includes("picture") || 
                                      header.toLowerCase().includes("logo");

                  // 2. Data Content Match
                  const dataMatch = excelData.rows.find(r => r[header])?.[header]?.toString().toLowerCase().match(/^http.*(\.jpg|\.jpeg|\.png|\.webp|\.gif)$/);

                  const isAuto = headerMatch || !!dataMatch;

                  return (
                    <div key={header} className="flex items-center gap-2">
                      <Checkbox id={`img-${header}`} checked={imageFieldNames.has(header) || isAuto} onCheckedChange={() => toggleImageField(header)} disabled={isAuto} />
                      <Label htmlFor={`img-${header}`} className="text-xs">{header} {isAuto && "(Automatically Detected)"}</Label>
                    </div>
                  ); 
                })}
              </div>
            </div>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2"><h3 className="font-medium text-sm">Preview Row</h3><div className="flex items-center gap-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={handlePrevRow} disabled={selectedRowIndex === 0}><ChevronLeft className="h-4 w-4" /></Button><Select value={String(selectedRowIndex)} onValueChange={(v) => setSelectedRowIndex(Number(v))}><SelectTrigger className="w-28 h-7"><SelectValue /></SelectTrigger><SelectContent>{excelData.rows.map((_, i) => (<SelectItem key={i} value={String(i)}>Row {i + 1}</SelectItem>))}</SelectContent></Select><Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleNextRow} disabled={selectedRowIndex >= excelData.rows.length - 1}><ChevronRight className="h-4 w-4" /></Button></div></div>
              <div className="border rounded-lg overflow-hidden"><Table className="table-fixed w-full"><TableHeader><TableRow><TableHead className="text-xs w-[35%]">Field</TableHead><TableHead className="text-xs w-[65%]">Value</TableHead></TableRow></TableHeader><TableBody>{excelData.headers.map((header) => (<TableRow key={header}><TableCell className={`py-2 text-xs truncate ${aiFieldNames.has(header) ? 'text-purple-600 font-bold' : ''}`}>{header}</TableCell><TableCell className="py-2 text-sm break-all"><div dangerouslySetInnerHTML={{ __html: excelData.rows[selectedRowIndex]?.[header] || "-" }} /></TableCell></TableRow>))}</TableBody></Table></div>
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  );
}