import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCanvasStore } from "@/stores/canvas-store";
import { queryClient } from "@/lib/queryClient";
import type { SavedDesign, Template } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area"; // Import ScrollArea
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
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
  Layers, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { isHtmlContent } from "@/lib/canvas-utils";
import { formatContent } from "@/lib/formatter";
import QRCode from "qrcode";

export function SavedDesignsTab() {
  const { user } = useUser();
  const { toast } = useToast();
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
  const [isGeneratingPreviews, setIsGeneratingPreviews] = useState(false);

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
    selectedRowIndex
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
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          canvasWidth,
          canvasHeight,
          pageCount,
          backgroundColor,
          elements,
        }),
      });
      if (!response.ok) throw new Error("Failed to save design");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/designs"] });
      toast({ title: "Design saved", description: "Your design has been saved successfully." });
      setSaveDialogOpen(false);
      setDesignName("");
      setDesignDescription("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save design.", variant: "destructive" });
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
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save template.", variant: "destructive" });
    },
  });

  // --- ACTIONS ---

  const handleCreateDesign = (tier: "basic" | "composite" | "catalog") => {
    if (tier !== "basic") return;
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Create a new design anyway?")) {
      return;
    }
    resetCanvas();
    setNewDesignDialogOpen(false);
  };

  const handleLoadTemplate = (template: Template) => {
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Load template anyway?")) {
      return;
    }
    loadTemplate(template);
    setNewDesignDialogOpen(false);
    toast({ title: "Template Loaded", description: `Loaded "${template.name}"` });
  };

  const handleLoadDesign = (design: SavedDesign) => {
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Load design anyway?")) {
      return;
    }
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
    });

    // Restore image field bindings
    const imageFields = new Set(
      design.elements
        .filter((el) => el.isImageField && el.dataBinding)
        .map((el) => el.dataBinding as string)
    );
    imageFields.forEach((field) => useCanvasStore.getState().toggleImageField(field));

    toast({ title: "Design loaded", description: `"${design.name}" has been loaded.` });
  };

  const handleSaveDesign = () => {
    if (!designName.trim()) {
      toast({ title: "Name required", description: "Please enter a name.", variant: "destructive" });
      return;
    }
    saveDesignMutation.mutate({
      name: designName.trim(),
      description: designDescription.trim() || undefined,
    });
  };

  // --- PREVIEW GENERATION ---
  // (generateHTMLForPage and generatePagePreviews omitted for brevity as they are unchanged)
  // Re-include them when saving the file to ensure functionality persists.

  // NOTE: Copying existing helper functions from the original file to ensure it works
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
         elementDiv.style.fontFamily = `"${textStyle.fontFamily}", sans-serif`;
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
            const styles = `
              <style>
                ul, ol { margin: 0; padding-left: 1.2em; }
                li { position: relative; margin: 0.2em 0; }
                p { margin: 0.2em 0; }
              </style>
            `;
            elementDiv.innerHTML = styles + content;
            elementDiv.style.display = "flex"; 
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
                 const svgString = await QRCode.toString(content, {
                    type: 'svg',
                    errorCorrectionLevel: 'M',
                    margin: 0, 
                    color: {
                        dark: element.textStyle?.color || '#000000',
                        light: '#00000000' 
                    }
                 });
                 elementDiv.innerHTML = svgString;
                 const svgEl = elementDiv.querySelector("svg");
                 if (svgEl) {
                     svgEl.style.width = "100%";
                     svgEl.style.height = "100%";
                 }
             } catch (e) {
                 console.error("Error generating QR for Preview", e);
             }
         }
      }
      container.appendChild(elementDiv);
    }
    return container.outerHTML;
  };

  const generatePagePreviews = async (): Promise<string[]> => {
    const previews: string[] = [];
    try {
      for (let i = 0; i < pageCount; i++) {
        const pageHtml = await generateHTMLForPage(i);
        const fullHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
              <style>
                body { margin: 0; padding: 0; box-sizing: border-box; overflow: hidden; }
                * { box-sizing: inherit; }
              </style>
            </head>
            <body>${pageHtml}</body>
          </html>
        `;
        const response = await fetch("/api/export/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html: fullHtml,
            width: canvasWidth,
            height: canvasHeight,
          }),
        });
        if (!response.ok) throw new Error("Server preview failed");
        const data = await response.json();
        if (data.image && data.image.startsWith("data:image")) {
          previews.push(data.image);
        }
      }
    } catch (e) {
      console.error("Preview generation error:", e);
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

              {/* UPDATED: Added ScrollArea and removed overflow-y-auto */}
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

                    <Card className="p-6 border flex flex-col gap-4 relative overflow-hidden bg-muted/10 opacity-75">
                      <div className="absolute top-3 right-3">
                        <Badge variant="secondary" className="text-[10px] font-normal tracking-wide">COMING SOON</Badge>
                      </div>
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                        <Layers className="h-6 w-6" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <h3 className="font-semibold text-lg text-muted-foreground">Composite Report</h3>
                        <p className="text-sm text-muted-foreground">For documents requiring external PDF covers or inserts.</p>
                      </div>
                      <Button className="w-full mt-2" variant="ghost" disabled>Unavailable</Button>
                    </Card>

                    <Card className="p-6 border flex flex-col gap-4 relative overflow-hidden bg-muted/10 opacity-75">
                      <div className="absolute top-3 right-3">
                        <Badge variant="secondary" className="text-[10px] font-normal tracking-wide">COMING SOON</Badge>
                      </div>
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                        <BookOpen className="h-6 w-6" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <h3 className="font-semibold text-lg text-muted-foreground">Full Catalog</h3>
                        <p className="text-sm text-muted-foreground">Advanced publishing for large catalogs.</p>
                      </div>
                      <Button className="w-full mt-2" variant="ghost" disabled>Unavailable</Button>
                    </Card>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* UPDATED: Added ScrollArea and removed overflow-y-auto */}
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveTemplateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveAsTemplate} disabled={createTemplateMutation.isPending || isGeneratingPreviews}>
                {(createTemplateMutation.isPending || isGeneratingPreviews) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="w-full" 
              disabled={elements.length === 0}
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
                    {design.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {design.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(design.updatedAt), {
                        addSuffix: true,
                      })}
                    </p>
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