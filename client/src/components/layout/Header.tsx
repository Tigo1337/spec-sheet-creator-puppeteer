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
import { isHtmlContent } from "@/lib/canvas-utils";
import { formatContent } from "@/lib/formatter";

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
    elements,
    canvasWidth,
    canvasHeight,
    backgroundColor,
    pageCount,
    excelData,
    selectedRowIndex,
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
      toast({ title: "Error", description: "Failed to save template.", variant: "destructive" });
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
    const scale = 0.2; // Small scale for thumbnails

    for (let i = 0; i < pageCount; i++) {
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

      const pageElements = elements
        .filter((el) => (el.pageIndex ?? 0) === i)
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

          content = formatContent(content, element.format);

          if (isHtmlContent(content)) {
            elementDiv.innerHTML = content;
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

      // Small delay for rendering
      await new Promise((resolve) => setTimeout(resolve, 50));

      const canvas = await html2canvas(tempDiv, {
        scale: scale,
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

      previews.push(canvas.toDataURL("image/jpeg", 0.7));
      document.body.removeChild(tempDiv);
    }

    return previews;
  };

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast({ title: "Name Required", description: "Please name your template", variant: "destructive" });
      return;
    }

    setIsGeneratingPreviews(true);
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
  };

  const handleExport = () => {
    setRightPanelTab("export");
  };

  const zoomOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <header className="h-14 border-b bg-sidebar flex items-center justify-between px-4 gap-4 flex-shrink-0">
      {/* Left Section - Logo & Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg hidden sm:block">SpecSheet</span>
        </div>

        <Separator orientation="vertical" className="h-6 hidden sm:block" />

        <div className="flex items-center gap-1 min-w-0">
          <span className="text-sm truncate max-w-40 sm:max-w-60" data-testid="text-template-name">
            {currentTemplate?.name || "Untitled Design"}
          </span>
          {hasUnsavedChanges && (
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" title="Unsaved changes" />
          )}
        </div>
      </div>

      {/* Center Section - Canvas Controls */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={undo} data-testid="btn-undo">
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={redo} data-testid="btn-redo">
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(zoom - 0.25)} disabled={zoom <= 0.25} data-testid="btn-zoom-out">
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 min-w-14 text-xs font-mono" data-testid="btn-zoom-level">
              {Math.round(zoom * 100)}%
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {zoomOptions.map((z) => (
              <DropdownMenuItem key={z} onClick={() => setZoom(z)}>
                {Math.round(z * 100)}%
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(zoom + 0.25)} disabled={zoom >= 2} data-testid="btn-zoom-in">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant={showGrid ? "default" : "ghost"} className="h-8 w-8" onClick={toggleGrid} data-testid="btn-toggle-grid">
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Grid</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant={snapToGrid ? "default" : "ghost"} className="h-8 w-8" onClick={toggleSnapToGrid} data-testid="btn-toggle-snap">
              <Magnet className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Snap to Grid</TooltipContent>
        </Tooltip>
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={toggleTheme} data-testid="btn-toggle-theme">
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Theme</TooltipContent>
        </Tooltip>

        <Button size="sm" className="gap-1.5" onClick={handleExport} data-testid="btn-header-export">
          <FileDown className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" data-testid="btn-more-options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsNewDesignModalOpen(true)} data-testid="menu-new-design">
              <FilePlus className="h-4 w-4 mr-2" />
              New Design
            </DropdownMenuItem>

            {/* ADMIN ONLY: Save as Template */}
            {isAdmin && (
              <DropdownMenuItem onClick={() => setIsSaveTemplateModalOpen(true)} data-testid="menu-save-template">
                <LayoutTemplate className="h-4 w-4 mr-2" />
                Save as Template
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleExport}>
              <FileDown className="h-4 w-4 mr-2" />
              Export as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* New Design Modal - Tabs for Blank & Templates */}
      <Dialog open={isNewDesignModalOpen} onOpenChange={setIsNewDesignModalOpen}>
        <DialogContent className="max-w-5xl h-[80vh] flex flex-col" style={{ zIndex: 2147483647 }}>
          <DialogHeader>
            <DialogTitle className="text-xl">Create New Design</DialogTitle>
            <DialogDescription>
              Start from a blank canvas or choose a pre-made template.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="blank" className="flex-1 flex flex-col mt-4 min-h-0">
            <TabsList>
              <TabsTrigger value="blank">Blank Canvas</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>

            <TabsContent value="blank" className="flex-1 mt-4 overflow-y-auto">
              <div className="grid md:grid-cols-3 gap-6 pb-2">
                {/* TIER 1: Basic Spec Sheet (Active) */}
                <Card 
                  className="p-6 cursor-pointer border-2 hover:border-primary/50 hover:bg-muted/30 transition-all flex flex-col gap-4 group relative"
                  onClick={() => handleCreateDesign("basic")}
                >
                  <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="font-semibold text-lg">Basic Spec Sheet</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Best for data-driven documents like spec sheets, price lists, or invoices.
                    </p>
                    <ul className="text-xs text-muted-foreground list-disc list-inside mt-4 space-y-1">
                      <li>Data-only content</li>
                      <li>1-10 pages</li>
                      <li>Fast generation</li>
                    </ul>
                  </div>
                  <Button className="w-full mt-2" variant="outline">Select Basic</Button>
                </Card>

                {/* TIER 2: Composite Report (Coming Soon) */}
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
                  </div>
                  <Button className="w-full mt-2" variant="ghost" disabled>Unavailable</Button>
                </Card>

                {/* TIER 3: Full Catalog (Coming Soon) */}
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
                  </div>
                  <Button className="w-full mt-2" variant="ghost" disabled>Unavailable</Button>
                </Card>
              </div>
            </TabsContent>

            {/* TEMPLATES TAB */}
            <TabsContent value="templates" className="flex-1 mt-4 overflow-y-auto">
              {isLoadingTemplates ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p>Loading templates...</p>
                </div>
              ) : !templates || templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border-2 border-dashed rounded-lg">
                  <LayoutTemplate className="h-8 w-8 mb-2 opacity-50" />
                  <p>No templates found.</p>
                  {isAdmin && <p className="text-xs text-primary mt-1">You are admin. Save a design as a template to populate this list.</p>}
                </div>
              ) : (
                <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
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

      {/* Save Template Modal (Only accessible if isAdmin is true via the menu) */}
      <Dialog open={isSaveTemplateModalOpen} onOpenChange={setIsSaveTemplateModalOpen}>
        <DialogContent style={{ zIndex: 2147483647 }}>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>
              Save your current design as a reusable template for future projects.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input 
                id="template-name" 
                value={newTemplateName} 
                onChange={(e) => setNewTemplateName(e.target.value)} 
                placeholder="e.g. Modern Product Sheet" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-desc">Description (Optional)</Label>
              <Input 
                id="template-desc" 
                value={newTemplateDesc} 
                onChange={(e) => setNewTemplateDesc(e.target.value)} 
                placeholder="Brief description of this layout" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveTemplateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAsTemplate} disabled={createTemplateMutation.isPending || isGeneratingPreviews}>
              {(createTemplateMutation.isPending || isGeneratingPreviews) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isGeneratingPreviews ? "Generating Previews..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}

// Sub-component for Template Card with Preview Navigation
function TemplateCard({ template, onSelect }: { template: Template; onSelect: () => void }) {
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const previews = template.previewImages || [];
  const hasMultiplePages = previews.length > 1;

  const nextPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPreviewIndex((prev) => (prev + 1) % previews.length);
  };

  const prevPreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentPreviewIndex((prev) => (prev - 1 + previews.length) % previews.length);
  };

  return (
    <Card 
      className="p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all flex flex-col group relative"
      onClick={onSelect}
    >
      <div className="aspect-[3/4] bg-muted rounded mb-3 flex items-center justify-center overflow-hidden relative border border-border">
        {previews.length > 0 ? (
          <img 
            src={previews[currentPreviewIndex]} 
            alt={`Page ${currentPreviewIndex + 1}`} 
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-xs text-muted-foreground">No Preview</div>
        )}

        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />

        {/* Navigation Controls */}
        {hasMultiplePages && (
          <>
            <button 
              onClick={prevPreview}
              className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button 
              onClick={nextPreview}
              className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              {currentPreviewIndex + 1} / {previews.length}
            </div>
          </>
        )}
      </div>
      <h4 className="font-medium truncate">{template.name}</h4>
      {template.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
          {template.description}
        </p>
      )}
    </Card>
  );
}