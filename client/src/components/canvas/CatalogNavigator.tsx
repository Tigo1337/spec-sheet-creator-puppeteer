import { useCanvasStore, type CatalogSectionType } from "@/stores/canvas-store";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  List, 
  Layers, 
  FileText, 
  LayoutTemplate 
} from "lucide-react";
import { cn } from "@/lib/utils";

export function CatalogNavigator() {
  const { isCatalogMode, activeSectionType, setActiveSection } = useCanvasStore();

  if (!isCatalogMode) return null;

  const sections: { id: CatalogSectionType; label: string; icon: React.ElementType }[] = [
    { id: "cover", label: "Cover", icon: BookOpen },
    { id: "toc", label: "Contents", icon: List },
    { id: "chapter", label: "Chapter", icon: Layers },
    { id: "product", label: "Product", icon: FileText },
    { id: "back", label: "Back", icon: LayoutTemplate },
  ];

  return (
    <div className="flex items-center justify-center p-2 bg-muted/30 border-b gap-2 overflow-x-auto">
      {sections.map((section) => (
        <Button
          key={section.id}
          variant={activeSectionType === section.id ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveSection(section.id)}
          className={cn(
            "gap-2 min-w-[100px]",
            activeSectionType === section.id && "shadow-md ring-1 ring-primary"
          )}
        >
          <section.icon className="h-4 w-4" />
          {section.label}
        </Button>
      ))}
    </div>
  );
}