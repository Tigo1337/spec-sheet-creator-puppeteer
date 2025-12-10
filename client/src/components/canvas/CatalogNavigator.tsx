import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useCanvasStore, type CatalogSectionType } from "@/stores/canvas-store";
import { cn } from "@/lib/utils";
import { 
  BookTemplate, 
  LayoutList, 
  Files, 
  FileText, 
  Book,
  ChevronDown
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const sections: { id: CatalogSectionType; label: string; icon: any }[] = [
  { id: "cover", label: "Cover Page", icon: BookTemplate },
  { id: "toc", label: "Table of Contents", icon: LayoutList },
  { id: "chapter", label: "Chapter Divider", icon: Files },
  { id: "product", label: "Product Page", icon: FileText },
  { id: "back", label: "Back Cover", icon: Book },
];

export function CatalogNavigator() {
  const { 
    activeSectionType, 
    setActiveSection, 
    catalogSections, 
    elements,
    excelData,
    setSelectedRowIndex,
    selectedRowIndex,
    setActiveChapterGroup
  } = useCanvasStore();

  // 1. Determine ToC Settings (Live or Saved) to check toggles
  let tocElement;
  if (activeSectionType === 'toc') {
    tocElement = elements.find(el => el.type === "toc-list");
  } else {
    tocElement = catalogSections.toc.elements.find(el => el.type === "toc-list");
  }

  const groupBy = tocElement?.tocSettings?.groupByField;
  const showChapterDivider = !!(groupBy && tocElement?.tocSettings?.chapterCoversEnabled);

  // 2. Extract Unique Groups from Excel Data
  let groups: string[] = [];
  if (showChapterDivider && excelData && groupBy) {
      const unique = new Set<string>();
      excelData.rows.forEach(row => {
          const val = row[groupBy];
          if (val) unique.add(String(val));
      });
      groups = Array.from(unique).sort();
  }

  // 3. Helper to switch context to a specific chapter
  const selectGroup = (groupName: string) => {
      if (!excelData) return;
      // Find the first row that belongs to this group so data preview is correct
      const rowIndex = excelData.rows.findIndex(r => String(r[groupBy!]) === groupName);
      if (rowIndex !== -1) {
          setSelectedRowIndex(rowIndex); 
          setActiveChapterGroup(groupName); // Load specific design
      }
  };

  // Get current active group name for display label
  const currentGroupName = (activeSectionType === 'chapter' && excelData && groupBy) 
      ? excelData.rows[selectedRowIndex]?.[groupBy] 
      : null;

  return (
    <div className="w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex w-max space-x-1 p-2">
          {sections.map((section) => {
            // Special Logic for Chapter Divider
            if (section.id === "chapter") {
                if (!showChapterDivider) return null;

                const isActive = activeSectionType === "chapter";

                return (
                    <DropdownMenu key={section.id}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant={isActive ? "secondary" : "ghost"}
                                size="sm"
                                className={cn(
                                "gap-2 h-8 text-xs font-medium transition-all",
                                isActive && "bg-secondary text-secondary-foreground shadow-sm"
                                )}
                            >
                                <section.icon className="h-3.5 w-3.5" />
                                {isActive && currentGroupName ? `Chapter: ${currentGroupName}` : section.label}
                                <ChevronDown className="h-3 w-3 opacity-50 ml-1" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-h-[300px] overflow-y-auto">
                            {groups.length > 0 ? (
                                groups.map(group => (
                                    <DropdownMenuItem 
                                        key={group} 
                                        onClick={() => selectGroup(group)}
                                        className={cn(currentGroupName === group && "bg-muted")}
                                    >
                                        <span className="truncate max-w-[200px]">{group}</span>
                                    </DropdownMenuItem>
                                ))
                            ) : (
                                <DropdownMenuItem disabled>No groups found</DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            }

            // Standard Logic for other sections
            const isActive = activeSectionType === section.id;
            return (
              <Button
                key={section.id}
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "gap-2 h-8 text-xs font-medium transition-all",
                  isActive && "bg-secondary text-secondary-foreground shadow-sm"
                )}
                onClick={() => setActiveSection(section.id)}
              >
                <section.icon className="h-3.5 w-3.5" />
                {section.label}
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="h-2" />
      </ScrollArea>
    </div>
  );
}