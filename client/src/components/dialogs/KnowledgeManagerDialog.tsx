import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { BrainCircuit, Search, Trash2, Loader2, Pencil, Check, X } from "lucide-react";
import { format } from "date-fns";
import type { ProductKnowledge } from "@shared/schema";

export function KnowledgeManagerDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery<ProductKnowledge[]>({
    queryKey: ["/api/ai/knowledge"],
    enabled: open, 
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/ai/knowledge/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/knowledge"] });
      toast({ title: "Item deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not delete item", variant: "destructive" });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const res = await fetch(`/api/ai/knowledge/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/knowledge"] });
      toast({ title: "Item updated" });
      setEditingId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update item", variant: "destructive" });
    }
  });

  const startEditing = (item: ProductKnowledge) => {
    setEditingId(item.id);
    setEditContent(item.content);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent("");
  };

  const saveEditing = (id: string) => {
    updateMutation.mutate({ id, content: editContent });
  };

  const filteredItems = items?.filter(item => {
    const term = searchTerm.toLowerCase();
    return (
      item.productKey.toLowerCase().includes(term) ||
      item.fieldType.toLowerCase().includes(term) ||
      item.content.toLowerCase().includes(term) ||
      (item.keyName || "").toLowerCase().includes(term)
    );
  }) || [];

  // Style object for columns
  const colStyles = {
    anchor: { width: '120px' },
    key: { width: '150px' },
    field: { width: '150px' },
    updated: { width: '120px' },
    actions: { width: '100px' },
    content: {} 
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>

      <DialogContent className="max-w-6xl flex flex-col h-[85vh] p-0 gap-0">
        {/* Fixed Header Section */}
        <div className="p-6 pb-4 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-purple-600" />
              AI Knowledge Base
            </DialogTitle>
            <DialogDescription>
              View, search, and edit the AI-generated content saved for your products.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 mt-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by SKU, Field Name, or Content..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        {/* 1. TABLE HEADER (Static) */}
        <div className="bg-muted/50 border-b">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead style={colStyles.anchor} className="text-center">Anchor</TableHead>
                <TableHead style={colStyles.key} className="text-center">Key Value</TableHead>
                <TableHead style={colStyles.field} className="text-center">Field Name</TableHead>
                <TableHead style={colStyles.content} className="text-center">Content</TableHead>
                <TableHead style={colStyles.updated} className="text-center">Updated</TableHead>
                <TableHead style={colStyles.actions} className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
        </div>

        {/* 2. TABLE BODY (Scrollable - Scrollbar starts below header) */}
        <ScrollArea className="flex-1">
          <Table className="w-full table-fixed">
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex justify-center items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    {searchTerm ? "No matching records found." : "Memory is empty."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id} className="group/row border-b hover:bg-muted/50">
                    <TableCell style={colStyles.anchor} className="align-middle py-4 font-mono text-xs text-muted-foreground truncate text-center">
                      {item.keyName || "id"}
                    </TableCell>

                    <TableCell style={colStyles.key} className="align-middle py-4 font-medium truncate text-center">
                      {item.productKey}
                    </TableCell>

                    {/* UPDATED: Field Name Column (Wrapped) */}
                    <TableCell style={colStyles.field} className="align-middle py-4 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 whitespace-normal text-center h-auto">
                        {item.fieldType}
                      </span>
                    </TableCell>

                    {/* EDITABLE CONTENT CELL */}
                    <TableCell style={colStyles.content} className="align-middle py-2 pr-4 text-center">
                      {(() => {
                        const typographyStyle = {
                            fontSize: "0.875rem",
                            lineHeight: "1.625",
                            fontFamily: "inherit",
                            textAlign: "center" as const
                        };

                        return editingId === item.id ? (
                          <AutoResizeTextarea 
                            value={editContent} 
                            onChange={(e: any) => setEditContent(e.target.value)}
                            style={typographyStyle}
                            className="min-h-[4.5rem] w-full resize-none overflow-hidden p-3 bg-background text-center"
                            autoFocus
                          />
                        ) : (
                          <div 
                            style={typographyStyle} 
                            className="min-h-[4.5rem] p-3 whitespace-pre-wrap border border-transparent text-foreground flex items-center justify-center"
                            dangerouslySetInnerHTML={{ __html: item.content }}
                          />
                        );
                      })()}
                    </TableCell>

                    <TableCell style={colStyles.updated} className="align-middle py-4 text-xs text-muted-foreground whitespace-nowrap text-center">
                      {format(new Date(item.updatedAt), "MMM d, yyyy")}
                    </TableCell>

                    {/* ACTIONS CELL */}
                    <TableCell style={colStyles.actions} className="align-middle py-3 text-center pr-4">
                      {editingId === item.id ? (
                        <div className="flex justify-center gap-1">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => saveEditing(item.id)} 
                            disabled={updateMutation.isPending}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 w-8"
                            title="Save"
                          >
                            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={cancelEditing}
                            className="text-muted-foreground hover:text-foreground h-8 w-8"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-muted"
                            onClick={() => startEditing(item)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-red-50"
                            onClick={() => deleteMutation.mutate(item.id)}
                            disabled={deleteMutation.isPending}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Footer Status */}
        <div className="p-2 text-xs text-muted-foreground text-center border-t bg-background">
           Showing {filteredItems.length} records.
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- Helper Component for Auto-Resizing Textarea ---
function AutoResizeTextarea({ value, onChange, className, style, ...props }: any) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  return (
    <Textarea
      {...props}
      ref={textareaRef}
      value={value}
      onChange={onChange}
      className={className}
      style={style}
    />
  );
}