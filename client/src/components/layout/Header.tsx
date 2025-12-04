import { useCanvasStore } from "@/stores/canvas-store";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Magnet,
  FileDown,
  MoreHorizontal,
  FilePlus,
  Sun,
  Moon,
  FileText,
  BookOpen,
  Layers,
  Save,
  LayoutTemplate,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Template } from "@shared/schema";
import { useUser } from "@clerk/clerk-react";
import html2canvas from "html2canvas";

export function Header() {
  const { user } = useUser();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isNewDesignModalOpen, setIsNewDesignModalOpen] = useState(false);
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");
  const [isGeneratingPreviews, setIsGeneratingPreviews] = useState(false);
  const { toast } = useToast();

  const isAdmin = user?.publicMetadata?.role === "admin";

  const {
    zoom,
    setZoom,
    showGrid,
    toggleGrid,
    snapToGrid,
    toggleSnapToGrid,
    undo,
    redo,
    hasUnsavedChanges,
    currentTemplate,
    resetCanvas,
    setRightPanelTab,
    saveAsTemplate,
    loadTemplate,
    pageCount,
    setActivePage,
    clearSelection,
    selectElements,
  } = useCanvasStore();

  const { data: templates, isLoading: isLoadingTemplates } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
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
      setIsSaveTemplateModalOpen(false);
      setNewTemplateName("");
      setNewTemplateDesc("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save template. Check server logs.", variant: "destructive" });
    },
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (systemPrefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handleCreateDesign = (tier: "basic" | "composite" | "catalog") => {
    if (tier !== "basic") return;
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Create a new design anyway?")) {
      return;
    }
    resetCanvas();
    setIsNewDesignModalOpen(false);
  };

  const handleLoadTemplate = (template: Template) => {
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Load template anyway?")) {
      return;
    }
    loadTemplate(template);
    setIsNewDesignModalOpen(false);
    toast({ title: "Template Loaded", description: `Loaded "${template.name}"` });
  };

  const generatePagePreviews = async (): Promise<string[]> => {
    const previews: string[] = [];
    const originalPage = useCanvasStore.getState().activePageIndex;
    const originalSelection = [...useCanvasStore.getState().selectedElementIds];

    // Clear selection to remove blue boxes from DOM
    clearSelection();
    // Add class to hide data field outlines via CSS
    document.body.classList.add("generating-preview");

    try {
      for (let i = 0; i < pageCount; i++) {
        setActivePage(i);

        await new Promise(resolve => setTimeout(resolve, 200));

        const pageElement = document.getElementById(`page-${i}`);
        if (!pageElement) {
          console.warn(`Could not find element #page-${i}`);
          continue;
        }

        const canvas = await html2canvas(pageElement, {
          useCORS: true,
          allowTaint: true,
          logging: false,
          scale: 0.5, 
          backgroundColor: null,
          ignoreElements: (element) => {
            return element.hasAttribute("data-html2canvas-ignore");
          },
          // UPDATED: Modify the cloned DOM before screenshot
          onclone: (clonedDoc) => {
            // 1. Force wrappers to expand height to fit content (prevents clipping)
            const wrappers = clonedDoc.querySelectorAll(".canvas-element-wrapper");
            wrappers.forEach((el) => {
              const htmlEl = el as HTMLElement;
              htmlEl.style.height = "auto"; 
              htmlEl.style.overflow = "visible";
            });

            // 2. Force inner content to be visible
            const contentElements = clonedDoc.querySelectorAll(".canvas-element-content");
            contentElements.forEach((el) => {
              const htmlEl = el as HTMLElement;
              htmlEl.style.overflow = "visible";
              htmlEl.style.height = "auto";
              htmlEl.style.display = "block";
            });

            // 3. Explicitly hide purple borders for data fields
            const dataFields = clonedDoc.querySelectorAll(".canvas-data-field");
            dataFields.forEach((el) => {
              const htmlEl = el as HTMLElement;
              htmlEl.style.borderColor = "transparent";
              htmlEl.style.borderStyle = "none";
              htmlEl.style.boxShadow = "none";
            });
          }
        });

        previews.push(canvas.toDataURL("image/jpeg", 0.8));
      }
    } catch (e) {
      console.error("Preview generation error:", e);
    } finally {
      document.body.classList.remove("generating-preview");
      setActivePage(originalPage);
      setTimeout(() => {
        selectElements(originalSelection);
      }, 50);
    }

    return previews;
  };

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast({ title: "Name Required", description: "Please name your template", variant: "destructive" });
      return;
    }

    setIsGeneratingPreviews(true);

    setTimeout(async () => {
      try {
        const previewImages = await generatePagePreviews();
        const templateData = saveAsTemplate(newTemplateName, newTemplateDesc, previewImages);
        createTemplateMutation.mutate(templateData);
      } catch (error) {
        console.error("Failed to generate previews:", error);
        toast({ title: "Error", description: "Failed to generate template preview", variant: "destructive" });
      } finally {
        setIsGeneratingPreviews(false);
      }
    }, 100);
  };

  const handleExport = () => {
    setRightPanelTab("export");
  };

  const zoomOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <header className="h-14 border-b bg-sidebar flex items-center justify-between px-4 gap-4 flex-shrink-0">
      {/* Left Section */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg hidden sm:block">SpecSheet</span>
        </div>
        <Separator orientation="vertical" className="h-6 hidden sm:block" />
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-sm truncate max-w-40 sm:max-w-60">
            {currentTemplate?.name || "Untitled Design"}
          </span>
          {hasUnsavedChanges && (
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" title="Unsaved changes" />
          )}
        </div>
      </div>

      {/* Center Section */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={undo}>
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={redo}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(zoom - 0.25)} disabled={zoom <= 0.25}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs font-mono min-w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(zoom + 0.25)} disabled={zoom >= 2}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="icon" 
              variant={showGrid ? "default" : "ghost"} 
              className="h-8 w-8" 
              onClick={toggleGrid}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Grid</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="icon" 
              variant={snapToGrid ? "default" : "ghost"} 
              className="h-8 w-8" 
              onClick={toggleSnapToGrid}
            >
              <Magnet className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Snap</TooltipContent>
        </Tooltip>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={toggleTheme}>
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
        <Button size="sm" className="gap-1.5" onClick={handleExport}>
          <FileDown className="h-4 w-4" />
          Export
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsNewDesignModalOpen(true)}>
              <FilePlus className="h-4 w-4 mr-2" /> New Design
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={() => setIsSaveTemplateModalOpen(true)}>
                <LayoutTemplate className="h-4 w-4 mr-2" /> Save as Template
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* New Design Modal */}
      <Dialog open={isNewDesignModalOpen} onOpenChange={setIsNewDesignModalOpen}>
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

            <TabsContent value="blank" className="flex-1 mt-4 overflow-y-auto">
              <div className="grid md:grid-cols-3 gap-6 pb-2">
                {/* TIER 1: Basic Spec Sheet */}
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
                    <ul className="text-xs text-muted-foreground list-disc list-inside mt-4 space-y-1">
                      <li>Data-only content</li>
                      <li>1-10 pages</li>
                      <li>Fast generation</li>
                    </ul>
                  </div>
                  <Button className="w-full mt-2" variant="outline">Select Basic</Button>
                </Card>

                {/* Composite Report Card */}
                <Card className="p-6 border flex flex-col gap-4 relative overflow-hidden bg-muted/10 opacity-75">
                  <div className="absolute top-3 right-3">
                    <Badge variant="secondary" className="text-[10px] font-normal tracking-wide">COMING SOON</Badge>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                    <Layers className="h-6 w-6" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="font-semibold text-lg text-muted-foreground">Composite Report</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      For documents requiring external PDF covers, inserts, or mixed media.
                    </p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside mt-4 space-y-1">
                      <li>Data + External PDFs</li>
                      <li>Cover pages & inserts</li>
                      <li>Medium complexity</li>
                    </ul>
                  </div>
                  <Button className="w-full mt-2" variant="ghost" disabled>Unavailable</Button>
                </Card>

                {/* Full Catalog Card */}
                <Card className="p-6 border flex flex-col gap-4 relative overflow-hidden bg-muted/10 opacity-75">
                  <div className="absolute top-3 right-3">
                    <Badge variant="secondary" className="text-[10px] font-normal tracking-wide">COMING SOON</Badge>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                    <BookOpen className="h-6 w-6" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="font-semibold text-lg text-muted-foreground">Full Catalog</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Advanced publishing for large catalogs with navigation structures.
                    </p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside mt-4 space-y-1">
                      <li>Table of Contents</li>
                      <li>Chapter separation</li>
                      <li>Advanced indexing</li>
                    </ul>
                  </div>
                  <Button className="w-full mt-2" variant="ghost" disabled>Unavailable</Button>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="templates" className="flex-1 mt-4 overflow-y-auto">
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
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <TemplateCard 
                      key={template.id} 
                      template={template} 
                      onSelect={() => handleLoadTemplate(template)} 
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Save Template Modal */}
      <Dialog open={isSaveTemplateModalOpen} onOpenChange={setIsSaveTemplateModalOpen}>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveTemplateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAsTemplate} disabled={createTemplateMutation.isPending || isGeneratingPreviews}>
              {(createTemplateMutation.isPending || isGeneratingPreviews) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
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