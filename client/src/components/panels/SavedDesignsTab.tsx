import { useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useCanvasStore } from "@/stores/canvas-store";
import { queryClient } from "@/lib/queryClient";
import type { SavedDesign } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
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
import { Save, FolderOpen, Trash2, Loader2, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export function SavedDesignsTab() {
  const { user } = useUser();
  const { toast } = useToast();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [designName, setDesignName] = useState("");
  const [designDescription, setDesignDescription] = useState("");

  const {
    elements,
    canvasWidth,
    canvasHeight,
    backgroundColor,
    loadTemplate,
    hasUnsavedChanges,
  } = useCanvasStore();

  const { data: designs = [], isLoading } = useQuery<SavedDesign[]>({
    queryKey: ["/api/designs"],
    enabled: !!user,
    queryFn: async () => {
      const response = await fetch("/api/designs", {
        headers: {
          "x-user-id": user?.id || "",
        },
      });
      if (!response.ok) throw new Error("Failed to fetch designs");
      return response.json();
    },
  });

  const saveDesignMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await fetch("/api/designs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id || "",
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          canvasWidth,
          canvasHeight,
          backgroundColor,
          elements,
        }),
      });
      if (!response.ok) throw new Error("Failed to save design");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/designs"] });
      toast({
        title: "Design saved",
        description: "Your design has been saved successfully.",
      });
      setSaveDialogOpen(false);
      setDesignName("");
      setDesignDescription("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save design. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteDesignMutation = useMutation({
    mutationFn: async (designId: string) => {
      const response = await fetch(`/api/designs/${designId}`, {
        method: "DELETE",
        headers: {
          "x-user-id": user?.id || "",
        },
      });
      if (!response.ok) throw new Error("Failed to delete design");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/designs"] });
      toast({
        title: "Design deleted",
        description: "Your design has been deleted.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete design. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLoadDesign = (design: SavedDesign) => {
    loadTemplate({
      id: design.id,
      name: design.name,
      description: design.description,
      canvasWidth: design.canvasWidth,
      canvasHeight: design.canvasHeight,
      backgroundColor: design.backgroundColor,
      elements: design.elements,
      createdAt: design.createdAt,
      updatedAt: design.updatedAt,
    });
    toast({
      title: "Design loaded",
      description: `"${design.name}" has been loaded.`,
    });
  };

  const handleSaveDesign = () => {
    if (!designName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for your design.",
        variant: "destructive",
      });
      return;
    }
    saveDesignMutation.mutate({
      name: designName.trim(),
      description: designDescription.trim() || undefined,
    });
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
          <DialogContent>
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
          {isLoading ? (
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
                    <h4 className="font-medium text-sm truncate">{design.name}</h4>
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
                      <FolderOpen className="h-4 w-4" />
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
                      <AlertDialogContent>
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
