import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCanvasStore } from "@/stores/canvas-store";
import type { SavedDesign, Template } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/use-subscription";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Save,
  Pencil,
  Trash2,
  Loader2,
  FileText,
  FilePlus,
  LayoutTemplate,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  BookTemplate,
  Lock
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { isHtmlContent } from "@/lib/canvas-utils";
import { formatContent } from "@/lib/formatter";
import QRCode from "qrcode";
import { availableFonts, openSourceFontMap } from "@shared/schema";

// --- PDF.JS IMPORTS ---
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

// --- NEW COMPONENT FOR REAL-TIME RELATIVE TIME ---
function LiveTimestamp({ date }: { date: string | Date }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Re-render every 30 seconds to update the "time ago" string
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-[10px] text-muted-foreground">
      {formatDistanceToNow(new Date(date), { addSuffix: true })}
    </span>
  );
}

export function SavedDesignsTab() {
  const { user } = useUser();
  const { toast } = useToast();
  const { isPro } = useSubscription();
  const queryClient = useQueryClient();
  const isAdmin = user?.publicMetadata?.role === "admin";

  // Dialog States
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newDesignDialogOpen, setNewDesignDialogOpen] = useState(false);
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);

  // Form States
  const [designName, setDesignName] = useState("");
  const [designDescription, setDesignDescription] = useState("");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");
  const [newTemplatePreviewUrl, setNewTemplatePreviewUrl] = useState("");

  // Status State
  const [isGeneratingPreviews, setIsGeneratingPreviews] = useState(false);
  const [previewStatus, setPreviewStatus] = useState("");

  const {
    elements,
    canvasWidth,
    canvasHeight,
    backgroundColor,
    pageCount,
    activePageIndex,
    selectedElementIds,
    resetCanvas,
    loadTemplate,
    saveAsTemplate,
    setActivePage,
    clearSelection,
    selectElements,
    hasUnsavedChanges,
    excelData,
    selectedRowIndex,
    // Catalog State & Actions
    setCatalogMode,
    isCatalogMode,
    catalogSections,
    chapterDesigns,
    activeSectionType,
    activeChapterGroup,
    loadCatalogDesign,
    loadDesignState 
  } = useCanvasStore();

  // --- QUERIES ---

  const { data: designs = [], isLoading: isLoadingDesigns } = useQuery<SavedDesign[]>({
    queryKey: ["/api/designs"],
    enabled: !!user,
    queryFn: async () => {
      const response = await fetch("/api/designs", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch designs");
      return response.json();
    },
  });

  const { data: templates, isLoading: isLoadingTemplates } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  // --- MUTATIONS ---

  const saveDesignMutation = useMutation({
    mutationFn: async (designData: any) => {
      const response = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(designData),
      });
      if (!response.ok) throw new Error("Failed to save design");
      return response.json();
    },
    onSuccess: (savedDesign) => {
      queryClient.invalidateQueries({ queryKey: ["/api/designs"] });
      toast({ title: "Design saved", description: "Your design has been saved successfully." });
      setSaveDialogOpen(false);

      loadDesignState(savedDesign.id, savedDesign.name);

      setDesignName("");
      setDesignDescription("");
    },
    onError: (error) => {
      toast({ title: "Error", description: `Failed to save design: ${error.message}`, variant: "destructive" });
    },
  });

  const deleteDesignMutation = useMutation({
    mutationFn: async (designId: string) => {
      const response = await fetch(`/api/designs/${designId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete design");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/designs"] });
      toast({ title: "Design deleted", description: "Your design has been deleted." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete design.", variant: "destructive" });
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template Saved", description: "Your design has been saved as a template." });
      setSaveTemplateDialogOpen(false);
      setNewTemplateName("");
      setNewTemplateDesc("");
      setNewTemplatePreviewUrl("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save template.", variant: "destructive" });
    },
  });

  // --- ACTIONS ---

  const handleCreateDesign = (tier: "basic" | "catalog") => {
    if (tier === "catalog" && !isPro) {
      toast({
        title: "Pro Feature Locked",
        description: "Full Catalog Assembly is available on the Pro plan.",
        variant: "destructive"
      });
      return;
    }

    if (hasUnsavedChanges && !confirm("You have unsaved changes. Create a new design anyway?")) {
      return;
    }

    resetCanvas();

    if (tier === "catalog") {
      setCatalogMode(true);
      toast({ title: "Catalog Mode", description: "Full Catalog designer activated." });
    } else {
      setCatalogMode(false);
      toast({ title: "Basic Mode", description: "Standard Spec Sheet designer activated." });
    }

    setNewDesignDialogOpen(false);
  };

  const handleLoadTemplate = (template: Template) => {
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Load template anyway?")) {
      return;
    }
    setCatalogMode(false);
    loadTemplate(template);
    setNewDesignDialogOpen(false);
    toast({ title: "Template Loaded", description: `Loaded "${template.name}"` });
  };

  const handleLoadDesign = (design: SavedDesign) => {
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Load design anyway?")) {
      return;
    }

    if (design.type === 'catalog' && design.catalogData) {
      loadCatalogDesign({
        sections: design.catalogData.sections,
        chapterDesigns: design.catalogData.chapterDesigns,
        canvasWidth: design.canvasWidth,
        canvasHeight: design.canvasHeight
        // UPDATED: Removed restoring excelData from layout object
      });
      toast({ title: "Catalog Loaded", description: `"${design.name}" loaded in Catalog Mode.` });
    } else {
      setCatalogMode(false);
      loadTemplate({
        id: design.id,
        name: design.name,
        description: design.description,
        canvasWidth: design.canvasWidth,
        canvasHeight: design.canvasHeight,
        pageCount: design.pageCount,
        backgroundColor: design.backgroundColor,
        elements: design.elements,
        createdAt: design.createdAt,
        updatedAt: design.updatedAt,
        previewImages: []
      });

      // UPDATED: Do not restore excelData from the saved design

      const imageFields = new Set(
        design.elements
          .filter((el) => el.isImageField && el.dataBinding)
          .map((el) => el.dataBinding as string)
      );
      imageFields.forEach((field) => useCanvasStore.getState().toggleImageField(field));

      toast({ title: "Design loaded", description: `"${design.name}" has been loaded.` });
    }

    loadDesignState(design.id, design.name);
  };

  const handleSaveDesign = () => {
    if (!designName.trim()) {
      toast({ title: "Name required", description: "Please enter a name.", variant: "destructive" });
      return;
    }

    if (isCatalogMode) {
      const finalSections = { ...catalogSections };
      const finalChapterDesigns = { ...chapterDesigns };

      if (activeSectionType === 'chapter' && activeChapterGroup) {
        finalChapterDesigns[activeChapterGroup] = { elements, backgroundColor };
      } else {
        finalSections[activeSectionType] = {
          ...finalSections[activeSectionType],
          elements,
          backgroundColor
        };
      }

      saveDesignMutation.mutate({
        name: designName.trim(),
        description: designDescription.trim() || undefined,
        type: "catalog",
        canvasWidth,
        canvasHeight,
        pageCount,
        backgroundColor,
        elements: [],
        catalogData: {
          sections: finalSections,
          chapterDesigns: finalChapterDesigns,
          // UPDATED: Removed excelData from save payload
        }
      });
    } else {
      saveDesignMutation.mutate({
        name: designName.trim(),
        description: designDescription.trim() || undefined,
        type: "single",
        canvasWidth,
        canvasHeight,
        pageCount,
        backgroundColor,
        elements,
        // UPDATED: Removed excelData from save payload
        catalogData: {} 
      });
    }
  };

  // ... (HTML Generation Logic remains unchanged) ...
  const generateHTMLForPage = async (pageIndex: number) => {
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

        let content = element.content || "";
        if (element.dataBinding && excelData && excelData.rows[selectedRowIndex]) {
          content = excelData.rows[selectedRowIndex][element.dataBinding] || content;
        }

        content = formatContent(content, element.format);

        if (isHtmlContent(content)) {
          const styles = `<style> ul, ol { margin: 0; padding-left: 1.2em; } li { position: relative; margin: 0.2em 0; } p { margin: 0.2em 0; } </style>`;
          elementDiv.innerHTML = styles + content;
        } else {
          elementDiv.textContent = content;
        }
      } else if (element.type === "shape") {
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
          elementDiv.appendChild(img);
        }
      } else if (element.type === "qrcode") {
        let content = element.content || "https://doculoom.io";
        if (element.content && excelData && excelData.rows[selectedRowIndex]) {
          content = element.content.replace(/{{(.*?)}}/g, (match, p1) => {
            const fieldName = p1.trim();
            return excelData.rows[selectedRowIndex][fieldName] || match;
          });
        }
        if (content) {
          try {
            const svgString = await QRCode.toString(content, { type: 'svg', margin: 0 });
            elementDiv.innerHTML = svgString;
            const svgEl = elementDiv.querySelector("svg");
            if (svgEl) { svgEl.style.width = "100%"; svgEl.style.height = "100%"; }
          } catch (e) { console.error("Error generating QR", e); }
        }
      } else if (element.type === "table") {
        let tableContent = element.content || "";
        if (excelData && excelData.rows[selectedRowIndex]) {
          const row = excelData.rows[selectedRowIndex];
          tableContent = tableContent.replace(/{{(.*?)}}/g, (match, p1) => {
            const fieldName = p1.trim();
            return row[fieldName] !== undefined ? row[fieldName] : match;
          });
        }
        elementDiv.innerHTML = tableContent;
        const table = elementDiv.querySelector('table');
        if (table) {
          table.style.width = "100%";
          table.style.borderCollapse = "collapse";
          const cells = table.querySelectorAll('td, th');
          cells.forEach((cell) => {
            const el = cell as HTMLElement;
            if (!el.style.border) el.style.border = "1px solid #000";
            if (!el.style.padding) el.style.padding = "4px";
          });
        }
      }
      container.appendChild(elementDiv);
    }
    return container.outerHTML;
  };

  const wrapHtmlWithStyles = (innerHtml: string) => {
    const fontFamilies = availableFonts.map(font => {
      const googleFont = openSourceFontMap[font] || font;
      return `family=${googleFont.replace(/\s+/g, '+')}:wght@400;700`;
    }).join('&');

    return `<!DOCTYPE html><html><head>
          <link href="https://fonts.googleapis.com/css2?${fontFamilies}&display=swap" rel="stylesheet">
          <style>@page { size: ${canvasWidth}px ${canvasHeight}px; margin: 0; } body { margin: 0; }</style>
        </head><body>${innerHtml}</body></html>`;
  };

  const pollJobStatus = async (jobId: string) => {
    return new Promise<{ resultUrl: string }>((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}`);
          if (!res.ok) throw new Error("Failed to check status");
          const job = await res.json();
          if (job.status === "completed") {
            clearInterval(interval);
            resolve({ resultUrl: job.downloadUrl || job.resultUrl });
          } else if (job.status === "failed") {
            clearInterval(interval);
            reject(new Error(job.error || "Generation failed"));
          }
        } catch (e) {
          clearInterval(interval);
          reject(e);
        }
      }, 2000);
    });
  };

  const generatePreviewFromPDF = async (): Promise<string[]> => {
    try {
      setPreviewStatus("Generating PDF...");
      let combinedHtml = "";
      const pageHtml = await generateHTMLForPage(0);
      combinedHtml += `<div class="page-container">${pageHtml}</div>`;
      const fullHtml = wrapHtmlWithStyles(combinedHtml);

      const res = await fetch("/api/export/async/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: fullHtml,
          width: canvasWidth,
          height: canvasHeight,
          scale: 1,
          colorModel: 'rgb',
          projectName: "Template Preview",
          fileName: "preview.pdf"
        }),
      });

      if (!res.ok) throw new Error("Failed to start preview job");
      const { jobId } = await res.json();

      setPreviewStatus("Waiting for worker...");
      await pollJobStatus(jobId);

      setPreviewStatus("Rendering image...");
      const proxyUrl = `/api/export/proxy/${jobId}`;
      const pdfData = await fetch(proxyUrl).then(r => {
        if (!r.ok) throw new Error(`Proxy error: ${r.statusText}`);
        return r.arrayBuffer();
      });

      const loadingTask = pdfjsLib.getDocument({ data: pdfData });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (context) {
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        return [canvas.toDataURL('image/jpeg', 0.8)];
      }
      return [];
    } catch (e) {
      console.error("PDF Preview Generation Failed", e);
      throw e;
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast({ title: "Name Required", description: "Please name your template", variant: "destructive" });
      return;
    }
    if (newTemplatePreviewUrl.trim()) {
      try {
        const templateData = saveAsTemplate(newTemplateName, newTemplateDesc, [newTemplatePreviewUrl.trim()]);
        createTemplateMutation.mutate(templateData);
        return;
      } catch (error) {
        toast({ title: "Error", description: "Failed to save template.", variant: "destructive" });
        return;
      }
    }
    setIsGeneratingPreviews(true);
    setPreviewStatus("Starting...");
    setTimeout(async () => {
      try {
        const previewImages = await generatePreviewFromPDF();
        const templateData = saveAsTemplate(newTemplateName, newTemplateDesc, previewImages);
        createTemplateMutation.mutate(templateData);
      } catch (error) {
        console.error("Failed to generate previews:", error);
        toast({ title: "Error", description: "Failed to generate template preview. Try again.", variant: "destructive" });
      } finally {
        setIsGeneratingPreviews(false);
        setPreviewStatus("");
      }
    }, 100);
  };

  if (!user) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Sign in to save and load designs.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b space-y-3">
        <div className="flex gap-2">
          <Button
            className="flex-1"
            variant="outline"
            onClick={() => setNewDesignDialogOpen(true)}
            data-testid="btn-new-design"
          >
            <FilePlus className="h-4 w-4 mr-2" /> New
          </Button>
          {isAdmin && (
            <Button
              className="flex-1"
              variant="outline"
              onClick={() => setSaveTemplateDialogOpen(true)}
              data-testid="btn-save-template"
            >
              <LayoutTemplate className="h-4 w-4 mr-2" /> Template
            </Button>
          )}
        </div>

        {/* NEW DESIGN DIALOG */}
        <Dialog open={newDesignDialogOpen} onOpenChange={setNewDesignDialogOpen}>
          <DialogContent className="max-w-5xl h-[80vh] flex flex-col" style={{ zIndex: 2147483647 }}>
            <DialogHeader>
              <DialogTitle>Create New Design</DialogTitle>
              <DialogDescription>Start from a blank canvas or choose a template.</DialogDescription>
            </DialogHeader>
            <Tabs defaultValue="blank" className="flex-1 flex flex-col mt-4 min-h-0">
              <TabsList>
                <TabsTrigger value="blank">Blank Canvas</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
              </TabsList>

              <TabsContent value="blank" className="flex-1 mt-4 min-h-0">
                <ScrollArea className="h-full">
                  <div className="grid md:grid-cols-3 gap-6 pb-2 pr-4">
                    <Card
                      className="p-6 cursor-pointer border-2 hover:border-primary/50 transition-all flex flex-col gap-4"
                      onClick={() => handleCreateDesign("basic")}
                    >
                      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">Basic Spec Sheet</h3>
                        <p className="text-sm text-muted-foreground mt-2">Best for data-driven documents like spec sheets, price lists, or invoices.</p>
                      </div>
                      <Button className="w-full mt-2" variant="outline">Select Basic</Button>
                    </Card>

                    <Card
                      className={`p-6 cursor-pointer border-2 transition-all flex flex-col gap-4 ${!isPro ? "opacity-90 bg-muted/20 border-dashed" : "hover:border-purple-500/50"
                        }`}
                      onClick={() => handleCreateDesign("catalog")}
                    >
                      <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 relative">
                        <BookOpen className="h-6 w-6" />
                        {!isPro && (
                          <div className="absolute -top-2 -right-2 bg-slate-900 text-white rounded-full p-1 shadow-md">
                            <Lock className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-lg">Full Catalog</h3>
                          {!isPro && <Badge variant="secondary" className="text-[10px]">PRO</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">Advanced publishing for large catalogs with covers and TOCs.</p>
                      </div>
                      <Button className="w-full mt-2" variant={isPro ? "outline" : "ghost"}>
                        {isPro ? "Select Catalog" : "Upgrade to Unlock"}
                      </Button>
                    </Card>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="templates" className="flex-1 mt-4 min-h-0">
                <ScrollArea className="h-full">
                  {isLoadingTemplates ? (
                    <div className="flex flex-col items-center justify-center h-48">
                      <Loader2 className="h-8 w-8 animate-spin mb-2" />
                      <p>Loading...</p>
                    </div>
                  ) : !templates?.length ? (
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border-2 border-dashed rounded-lg">
                      <p>No templates found.</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
                      {templates.map((template) => (
                        <TemplateCard
                          key={template.id}
                          template={template}
                          onSelect={() => handleLoadTemplate(template)}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* SAVE TEMPLATE DIALOG */}
        <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
          <DialogContent style={{ zIndex: 2147483647 }}>
            <DialogHeader>
              <DialogTitle>Save as Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="e.g. Standard Layout" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={newTemplateDesc} onChange={(e) => setNewTemplateDesc(e.target.value)} placeholder="Description" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Preview Image URL (Optional)
                  <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-tight">DAM</span>
                </Label>
                <Input
                  value={newTemplatePreviewUrl}
                  onChange={(e) => setNewTemplatePreviewUrl(e.target.value)}
                  placeholder="https://res.cloudinary.com/..."
                />
                <p className="text-[10px] text-muted-foreground italic">
                  Paste a Cloudinary or external URL here to skip automated thumbnail generation.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveTemplateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveAsTemplate} disabled={createTemplateMutation.isPending || isGeneratingPreviews}>
                {(createTemplateMutation.isPending || isGeneratingPreviews) && (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {previewStatus || "Saving..."}
                  </>
                )}
                {!isGeneratingPreviews && !createTemplateMutation.isPending && "Save Template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* SAVE DESIGN DIALOG */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="w-full"
              disabled={elements.length === 0 && !isCatalogMode}
              data-testid="button-save-design"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Current Design
            </Button>
          </DialogTrigger>
          <DialogContent style={{ zIndex: 2147483647 }}>
            <DialogHeader>
              <DialogTitle>Save Design</DialogTitle>
              <DialogDescription>
                Save your current canvas design to use it later.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="design-name">Name</Label>
                <Input
                  id="design-name"
                  value={designName}
                  onChange={(e) => setDesignName(e.target.value)}
                  placeholder="My Design"
                  data-testid="input-design-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="design-description">Description (optional)</Label>
                <Input
                  id="design-description"
                  value={designDescription}
                  onChange={(e) => setDesignDescription(e.target.value)}
                  placeholder="A brief description..."
                  data-testid="input-design-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSaveDialogOpen(false)}
                data-testid="button-cancel-save"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveDesign}
                disabled={saveDesignMutation.isPending}
                data-testid="button-confirm-save"
              >
                {saveDesignMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="text-sm text-muted-foreground">
          {designs.length} saved design{designs.length !== 1 ? "s" : ""}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {isLoadingDesigns ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : designs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No saved designs yet.</p>
              <p className="text-xs mt-1">Save your first design to see it here.</p>
            </div>
          ) : (
            designs.map((design) => (
              <Card
                key={design.id}
                className="p-3 hover-elevate"
                data-testid={`card-design-${design.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm break-words leading-tight">{design.name}</h4>

                    <div className="flex items-center gap-2 mt-1">
                      {design.type === 'catalog' ? (
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <BookTemplate className="h-3 w-3" /> Catalog
                        </span>
                      ) : (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                          <LayoutTemplate className="h-3 w-3" /> Single
                        </span>
                      )}

                      {/* UPDATED: REAL-TIME TIMESTAMP COMPONENT */}
                      <LiveTimestamp date={design.updatedAt} />
                    </div>

                    {design.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {design.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleLoadDesign(design)}
                      title="Load design"
                      data-testid={`button-load-design-${design.id}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Delete design"
                          data-testid={`button-delete-design-${design.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent style={{ zIndex: 2147483647 }}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Design?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{design.name}"? This action
                            cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid="button-cancel-delete">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteDesignMutation.mutate(design.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            data-testid="button-confirm-delete"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function TemplateCard({ template, onSelect }: { template: Template; onSelect: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const images = template.previewImages || [];
  const hasMulti = images.length > 1;

  const nextPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <Card
      className="p-4 cursor-pointer hover:border-primary/50 transition-all flex flex-col group relative overflow-hidden"
      onClick={onSelect}
    >
      <div className="aspect-[3/4] bg-muted rounded mb-3 flex items-center justify-center overflow-hidden relative border border-border">
        {images.length > 0 ? (
          <img
            src={images[currentIndex]}
            alt={`Preview ${currentIndex}`}
            className="w-full h-full object-contain bg-white"
          />
        ) : (
          <div className="text-xs text-muted-foreground">No Preview</div>
        )}

        {hasMulti && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              onClick={prevPreview}
              className="bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>

            <span className="bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full">
              {currentIndex + 1} / {images.length}
            </span>

            <button
              onClick={nextPreview}
              className="bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
      <h4 className="font-medium truncate text-sm">{template.name}</h4>
      {template.description && <p className="text-xs text-muted-foreground truncate">{template.description}</p>}
    </Card>
  );
}