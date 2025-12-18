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

  // Calculate Position (Above the element)
  const top = element.position.y * zoom - 45; 
  const left = element.position.x * zoom;

  const isText = element.type === "text" || element.type === "dataField";

  return (
    <div 
      // FIX: Use semantic colors (bg-popover) instead of hardcoded bg-white
      className="absolute h-9 bg-popover text-popover-foreground shadow-md border rounded-md flex items-center p-1 gap-1 z-50 animate-in fade-in zoom-in-95 duration-100"
      style={{ 
        top: Math.max(10, top), // Don't go off screen top
        left: Math.max(10, left)
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