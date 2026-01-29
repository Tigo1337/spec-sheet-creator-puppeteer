import { useCanvasStore } from "@/stores/canvas-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Lock, Unlock, GripVertical, Type, Image as ImageIcon, Box } from "lucide-react";

export function LayersTab() {
  const {
    elements,
    selectedElementIds,
    selectElement,
    updateElement,
    activePageIndex,
    setHoveredElement
  } = useCanvasStore();

  // Filter elements by active page and sort by z-index (reverse for UI list: Top is Front)
  const pageElements = elements
    .filter(el => (el.pageIndex || 0) === activePageIndex)
    .sort((a, b) => b.zIndex - a.zIndex);

  const getIcon = (type: string) => {
    switch (type) {
      case "text": return <Type className="h-3 w-3" />;
      case "image": return <ImageIcon className="h-3 w-3" />;
      default: return <Box className="h-3 w-3" />;
    }
  };

  const getLabel = (el: any) => {
    if (el.name) return el.name;
    if (el.content) return el.content.slice(0, 20) + (el.content.length > 20 ? "..." : "");
    return `${el.type} ${el.id.slice(0,4)}`;
  };

  return (
    <ScrollArea className="flex-1 h-full">
      <div className="p-4 space-y-2">
        {pageElements.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No elements on this page</p>
        )}

        {pageElements.map(element => (
          <div
            key={element.id}
            className={`flex items-center gap-2 p-2 rounded-md border ${
              selectedElementIds.includes(element.id)
                ? "bg-accent border-primary/20"
                : "bg-card border-transparent hover:bg-accent/50"
            }`}
            onClick={() => selectElement(element.id)}
            onMouseEnter={() => setHoveredElement(element.id)}
            onMouseLeave={() => setHoveredElement(null)}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground cursor-move opacity-50" />

            <div className="flex-1 flex items-center gap-2 overflow-hidden">
               <span className="p-1 rounded-sm bg-muted">{getIcon(element.type)}</span>
               <span className="text-sm truncate">{getLabel(element)}</span>
            </div>

            <div className="flex items-center gap-0.5">
               <Button 
                 variant="ghost" size="icon" className="h-6 w-6" 
                 onClick={(e) => { e.stopPropagation(); updateElement(element.id, { visible: !element.visible }); }}
               >
                 {element.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-muted-foreground" />}
               </Button>
               <Button 
                 variant="ghost" size="icon" className="h-6 w-6" 
                 onClick={(e) => { e.stopPropagation(); updateElement(element.id, { locked: !element.locked }); }}
               >
                 {element.locked ? <Lock className="h-3 w-3 text-orange-500" /> : <Unlock className="h-3 w-3 text-muted-foreground" />}
               </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}