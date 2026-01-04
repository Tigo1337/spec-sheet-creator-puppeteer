import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCanvasStore } from "@/stores/canvas-store";
import { useSubscription } from "@/hooks/use-subscription";
import type { SavedDesign, Template } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  BookOpen, 
  Lock, 
  Loader2, 
  LayoutTemplate, 
  BookTemplate, 
  ChevronRight,
  Plus,
  FolderOpen,
  ChevronLeft
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function DesignManagerDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [namingDialogOpen, setNamingDialogOpen] = useState(false);
  const [newDesignName, setNewDesignName] = useState("");
  const [pendingTier, setPendingTier] = useState<"basic" | "catalog" | null>(null);

  const { user } = useUser();
  const { toast } = useToast();
  const { isPro } = useSubscription();
  const queryClient = useQueryClient();

  const {
    resetCanvas,
    loadTemplate,
    loadCatalogDesign,
    setCatalogMode,
    hasUnsavedChanges,
    loadDesignState,
    canvasWidth,
    canvasHeight,
    pageCount,
    backgroundColor,
    // NEW: Needed for auto-prompt logic
    currentDesignId,
    elements
  } = useCanvasStore();

  // --- AUTO-OPEN LOGIC ---
  useEffect(() => {
    // If no design is active (null ID) and canvas is empty, prompt the user.
    if (!currentDesignId && elements.length === 0) {
      setOpen(true);
    }
  }, []); // Run once on mount

  const { data: designs = [], isLoading: isLoadingDesigns } = useQuery<SavedDesign[]>({
    queryKey: ["/api/designs"],
    enabled: open && !!user,
  });

  const { data: templates, isLoading: isLoadingTemplates } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    enabled: open,
  });

  // Mutation to create design immediately
  const createDesignMutation = useMutation({
    mutationFn: async (designData: any) => {
      const response = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(designData),
      });
      if (!response.ok) throw new Error("Failed to create design");
      return response.json();
    },
    onSuccess: (newDesign) => {
      queryClient.invalidateQueries({ queryKey: ["/api/designs"] });
      // Set the design ID in store so auto-save can take over
      loadDesignState(newDesign.id, newDesign.name);

      setNamingDialogOpen(false);
      setOpen(false);
      setNewDesignName("");
      toast({ title: "Design Created", description: "Auto-save is now active." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create design.", variant: "destructive" });
    }
  });

  const initiateCreateDesign = (tier: "basic" | "catalog") => {
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

    // Instead of resetting immediately, ask for name first
    setPendingTier(tier);
    setNewDesignName("");
    setNamingDialogOpen(true);
  };

  const handleConfirmCreate = () => {
    if (!newDesignName.trim()) {
        toast({ title: "Name Required", description: "Please name your design.", variant: "destructive" });
        return;
    }

    // 1. Reset Canvas for new session
    resetCanvas();

    // 2. Set Mode
    if (pendingTier === "catalog") {
        setCatalogMode(true);
    } else {
        setCatalogMode(false);
    }

    // 3. Create DB Entry Immediately
    createDesignMutation.mutate({
        name: newDesignName,
        type: pendingTier === "catalog" ? "catalog" : "single",
        canvasWidth,
        canvasHeight,
        pageCount: 1,
        backgroundColor: "#ffffff",
        elements: [],
        // Initialize empty catalog structure if needed
        catalogData: pendingTier === "catalog" ? {
            sections: {
                cover: { type: "cover", name: "Cover Page", elements: [], backgroundColor: "#ffffff" },
                toc: { type: "toc", name: "Table of Contents", elements: [], backgroundColor: "#ffffff" },
                chapter: { type: "chapter", name: "Chapter Divider", elements: [], backgroundColor: "#ffffff" },
                product: { type: "product", name: "Product Page", elements: [], backgroundColor: "#ffffff" },
                back: { type: "back", name: "Back Cover", elements: [], backgroundColor: "#ffffff" },
            },
            chapterDesigns: {}
        } : undefined
    });
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

        if (design.catalogData?.excelData) {
            useCanvasStore.getState().setExcelData(design.catalogData.excelData);
        }

        const imageFields = new Set(
          design.elements
            .filter((el) => el.isImageField && el.dataBinding)
            .map((el) => el.dataBinding as string)
        );
        imageFields.forEach((field) => useCanvasStore.getState().toggleImageField(field));

        toast({ title: "Design loaded", description: `"${design.name}" has been loaded.` });
    }

    // Set the ID so auto-save works for this loaded design
    loadDesignState(design.id, design.name);
    setOpen(false);
  };

  const handleLoadTemplate = (template: Template) => {
    if (hasUnsavedChanges && !confirm("You have unsaved changes. Load template anyway?")) {
      return;
    }
    setCatalogMode(false); 
    loadTemplate(template);
    setOpen(false);
    toast({ title: "Template Loaded", description: `Loaded "${template.name}"` });
  };

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0" style={{ maxWidth: '900px' }}>
        <div className="p-6 pb-2 border-b">
          <DialogHeader>
            <DialogTitle>Design Manager</DialogTitle>
            <DialogDescription>Start a new project or continue where you left off.</DialogDescription>
          </DialogHeader>
        </div>

        <Tabs defaultValue="new" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 pt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new" className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> Create New Design
              </TabsTrigger>
              <TabsTrigger value="open" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" /> Use Existing Design
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="new" className="flex-1 min-h-0 p-0 m-0">
             <Tabs defaultValue="blank" className="h-full flex flex-col">
                <div className="px-6 py-2 border-b bg-muted/20">
                  <TabsList className="w-auto inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
                    <TabsTrigger value="blank" className="px-3 py-1 text-sm">Blank Canvas</TabsTrigger>
                    <TabsTrigger value="templates" className="px-3 py-1 text-sm">Templates</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="blank" className="flex-1 p-6 overflow-hidden m-0">
                   <ScrollArea className="h-full">
                      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                        <Card 
                          className="p-6 cursor-pointer border-2 hover:border-primary/50 transition-all flex flex-col gap-4 hover:shadow-md"
                          onClick={() => initiateCreateDesign("basic")}
                        >
                          <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                            <FileText className="h-6 w-6" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">Basic Spec Sheet</h3>
                            <p className="text-sm text-muted-foreground mt-2">Simple documents, Specification Sheets, Sell Sheets, supports multiple pages.</p>
                          </div>
                          <Button className="w-full mt-2" variant="outline">Create Basic</Button>
                        </Card>

                        <Card 
                          className={`p-6 cursor-pointer border-2 transition-all flex flex-col gap-4 ${
                            !isPro ? "opacity-90 bg-muted/20 border-dashed" : "hover:border-purple-500/50 hover:shadow-md"
                          }`}
                          onClick={() => initiateCreateDesign("catalog")}
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
                            <p className="text-sm text-muted-foreground">Advanced multi-page documents with Front Page, automated Table of Contents, Chapter dividers, Product Pages and Back Page.</p>
                          </div>
                          <Button className="w-full mt-2" variant={isPro ? "outline" : "ghost"}>
                            {isPro ? "Create Catalog" : "Upgrade Required"}
                          </Button>
                        </Card>
                      </div>
                   </ScrollArea>
                </TabsContent>

                <TabsContent value="templates" className="flex-1 p-6 overflow-hidden m-0">
                   <ScrollArea className="h-full">
                      {isLoadingTemplates ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/></div>
                      ) : !templates?.length ? (
                        <div className="text-center text-muted-foreground p-8">No templates found.</div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                           {templates.map(t => (
                             <TemplateCard key={t.id} template={t} onSelect={() => handleLoadTemplate(t)} />
                           ))}
                        </div>
                      )}
                   </ScrollArea>
                </TabsContent>
             </Tabs>
          </TabsContent>

          <TabsContent value="open" className="flex-1 min-h-0 p-6 overflow-hidden m-0">
             <ScrollArea className="h-full">
                {isLoadingDesigns ? (
                   <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/></div>
                ) : !designs.length ? (
                   <div className="text-center text-muted-foreground p-8">
                     <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                     <p>No saved designs found.</p>
                   </div>
                ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {designs.map(design => (
                        <Card key={design.id} className="p-3 hover:border-primary/50 cursor-pointer transition-all hover:shadow-sm" onClick={() => handleLoadDesign(design)}>
                           <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${design.type === 'catalog' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                 {design.type === 'catalog' ? <BookTemplate className="h-5 w-5" /> : <LayoutTemplate className="h-5 w-5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <h4 className="font-medium text-sm truncate">{design.name}</h4>
                                 <p className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(design.updatedAt), { addSuffix: true })}
                                 </p>
                              </div>
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                 <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </Button>
                           </div>
                        </Card>
                      ))}
                   </div>
                )}
             </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* NAMING DIALOG */}
    <Dialog open={namingDialogOpen} onOpenChange={setNamingDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" style={{ zIndex: 2147483648 }}>
            <DialogHeader>
                <DialogTitle>Name your Design</DialogTitle>
                <DialogDescription>Give your new project a name to start auto-saving.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input id="name" value={newDesignName} onChange={(e) => setNewDesignName(e.target.value)} placeholder="e.g. Summer Collection 2025" className="mt-2" autoFocus />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setNamingDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleConfirmCreate} disabled={createDesignMutation.isPending}>
                    {createDesignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create & Open
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
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
      className="p-3 cursor-pointer hover:border-primary/50 group relative overflow-hidden"
      onClick={onSelect}
    >
      <div className="aspect-[3/4] bg-muted rounded mb-2 flex items-center justify-center overflow-hidden relative border border-border/50">
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
    </Card>
  );
}