import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Keyboard } from "lucide-react";

export function ShortcutsDialog() {
  const shortcuts = [
    { key: "V", desc: "Select Tool" },
    { key: "T", desc: "Text Tool" },
    { key: "S", desc: "Shape Tool" },
    { key: "I", desc: "Image Tool" },
    { key: "Delete", desc: "Delete Selection" },
    { key: "Ctrl + D", desc: "Duplicate" },
    { key: "Ctrl + Z", desc: "Undo" },
    { key: "Ctrl + Shift + Z", desc: "Redo" },
    { key: "Ctrl + A", desc: "Select All" },
    { key: "Arrows", desc: "Nudge Position" },
    { key: "Shift + Click", desc: "Multi-select" },
    { key: "Space", desc: "Hold to Pan" },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        {/* FIX: Changed bg-white to bg-background or bg-card to support dark mode */}
        <Button variant="ghost" size="icon" className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg bg-card border hover:bg-accent text-foreground">
            <Keyboard className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
            {shortcuts.map(s => (
                <div key={s.key} className="flex justify-between border-b pb-2">
                    <span className="font-semibold text-sm bg-muted px-2 py-0.5 rounded">{s.key}</span>
                    <span className="text-sm text-muted-foreground">{s.desc}</span>
                </div>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}