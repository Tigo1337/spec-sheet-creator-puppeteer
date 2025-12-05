import { useCanvasStore } from "@/stores/canvas-store";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Magnet,
  FileDown,
  Sun,
  Moon,
  FileText,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-react";

export function Header() {
  const { user } = useUser();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const {
    zoom,
    setZoom,
    showGrid,
    toggleGrid,
    snapToGrid,
    toggleSnapToGrid,
    undo,
    redo,
    hasUnsavedChanges,
    currentTemplate,
    setRightPanelTab,
  } = useCanvasStore();

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = savedTheme || (systemPrefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  const handleExport = () => {
    setRightPanelTab("export");
  };

  return (
    <header className="h-14 border-b bg-sidebar flex items-center justify-between px-4 gap-4 flex-shrink-0">
      {/* Left Section */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg hidden sm:block">SpecSheet</span>
        </div>
        <Separator orientation="vertical" className="h-6 hidden sm:block" />
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-sm truncate max-w-40 sm:max-w-60">
            {currentTemplate?.name || "Untitled Design"}
          </span>
          {hasUnsavedChanges && (
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" title="Unsaved changes" />
          )}
        </div>
      </div>

      {/* Center Section */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={undo}>
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={redo}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-5 mx-1" />
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(zoom - 0.25)} disabled={zoom <= 0.25}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="text-xs font-mono min-w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setZoom(zoom + 0.25)} disabled={zoom >= 2}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Separator orientation="vertical" className="h-5 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="icon" 
              variant={showGrid ? "default" : "ghost"} 
              className="h-8 w-8" 
              onClick={toggleGrid}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Grid</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="icon" 
              variant={snapToGrid ? "default" : "ghost"} 
              className="h-8 w-8" 
              onClick={toggleSnapToGrid}
            >
              <Magnet className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Snap</TooltipContent>
        </Tooltip>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={toggleTheme}>
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
        <Button size="sm" className="gap-1.5" onClick={handleExport}>
          <FileDown className="h-4 w-4" />
          Export
        </Button>
      </div>
    </header>
  );
}