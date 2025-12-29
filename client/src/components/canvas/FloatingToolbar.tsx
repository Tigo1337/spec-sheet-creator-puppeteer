import { useCanvasStore } from "@/stores/canvas-store";
import { Button } from "@/components/ui/button";
import { 
  Bold, Italic, Trash2, Copy, BringToFront, SendToBack,
  AlignLeft, AlignCenter, AlignRight
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface FloatingToolbarProps {
  zoom: number;
}

export function FloatingToolbar({ zoom }: FloatingToolbarProps) {
  const { 
    selectedElementIds, 
    elements, 
    updateElement, 
    deleteSelectedElements, 
    duplicateElement,
    bringToFront,
    sendToBack
  } = useCanvasStore();

  if (selectedElementIds.length !== 1) return null;

  const id = selectedElementIds[0];
  const element = elements.find(el => el.id === id);
  if (!element) return null;

  // --- POSITIONING LOGIC ---
  const TOOLBAR_HEIGHT = 45; // Approximate height of the toolbar including spacing
  const GAP = 5; // Small gap between element and toolbar

  const elementTopCanvas = element.position.y * zoom;
  const elementBottomCanvas = (element.position.y + element.dimension.height) * zoom;
  const left = element.position.x * zoom;

  // Default to showing ABOVE
  let top = elementTopCanvas - TOOLBAR_HEIGHT;

  // Check if there is enough space above (e.g., at least 50px from top of page)
  // If not, flip it to show BELOW the element
  if (elementTopCanvas < (TOOLBAR_HEIGHT + GAP)) {
      top = elementBottomCanvas + GAP;
  }

  const isText = element.type === "text" || element.type === "dataField";

  return (
    <div 
      // Z-Index: 2147483647 (Max Safe Integer) ensures it is ALWAYS on top of everything
      className="absolute h-9 bg-popover text-popover-foreground shadow-md border border-border rounded-md flex items-center p-1 gap-1 animate-in fade-in zoom-in-95 duration-100"
      style={{ 
        top: top, 
        left: Math.max(10, left),
        zIndex: 2147483647 
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {isText && (
        <>
          <Button 
             variant={element.textStyle?.fontWeight === 700 ? "secondary" : "ghost"} 
             size="icon" 
             className="h-7 w-7"
             onClick={() => updateElement(id, { textStyle: { ...element.textStyle, fontWeight: element.textStyle?.fontWeight === 700 ? 400 : 700 } })}
          >
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button 
             variant={element.textStyle?.fontStyle === "italic" ? "secondary" : "ghost"} 
             size="icon" 
             className="h-7 w-7"
             onClick={() => updateElement(id, { textStyle: { ...element.textStyle, fontStyle: element.textStyle?.fontStyle === "italic" ? "normal" : "italic" } })}
          >
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Separator orientation="vertical" className="h-5" />
           <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateElement(id, { textStyle: { ...element.textStyle, textAlign: 'left' } })}><AlignLeft className="h-3.5 w-3.5" /></Button>
           <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateElement(id, { textStyle: { ...element.textStyle, textAlign: 'center' } })}><AlignCenter className="h-3.5 w-3.5" /></Button>
           <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateElement(id, { textStyle: { ...element.textStyle, textAlign: 'right' } })}><AlignRight className="h-3.5 w-3.5" /></Button>
           <Separator orientation="vertical" className="h-5" />
        </>
      )}

      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => bringToFront(id)} title="Bring to Front">
        <BringToFront className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => sendToBack(id)} title="Send to Back">
        <SendToBack className="h-3.5 w-3.5" />
      </Button>

      <Separator orientation="vertical" className="h-5" />

      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateElement(id)}>
        <Copy className="h-3.5 w-3.5" />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteSelectedElements()}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}