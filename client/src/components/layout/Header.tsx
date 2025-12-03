import { useCanvasStore } from "@/stores/canvas-store";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Magnet,
  FileDown,
  MoreHorizontal,
  FilePlus,
  Sun,
  Moon,
  FileText,
  BookOpen,
  Layers,
} from "lucide-react";
import { useState, useEffect } from "react";

export function Header() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isNewDesignModalOpen, setIsNewDesignModalOpen] = useState(false);

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
    resetCanvas,
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

  const handleCreateDesign = (tier: "basic" | "composite" | "catalog") => {
    // Only Tier 1 (Basic) is implemented for now
    if (tier !== "basic") return;

    if (hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Create a new design anyway?")) {
        return;
      }
    }

    // Future: Switch routing or editor state based on 'tier'
    resetCanvas();
    setIsNewDesignModalOpen(false);
  };

  const handleExport = () => {
    setRightPanelTab("export");
  };

  const zoomOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <header className="h-14 border-b bg-sidebar flex items-center justify-between px-4 gap-4 flex-shrink-0">
      {/* Left Section - Logo & Title */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg hidden sm:block">SpecSheet</span>
        </div>

        <Separator orientation="vertical" className="h-6 hidden sm:block" />

        <div className="flex items-center gap-1 min-w-0">
          <span className="text-sm truncate max-w-40 sm:max-w-60" data-testid="text-template-name">
            {currentTemplate?.name || "Untitled Design"}
          </span>
          {hasUnsavedChanges && (
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" title="Unsaved changes" />
          )}
        </div>
      </div>

      {/* Center Section - Canvas Controls */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={undo}
              data-testid="btn-undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={redo}
              data-testid="btn-redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setZoom(zoom - 0.25)}
              disabled={zoom <= 0.25}
              data-testid="btn-zoom-out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 min-w-14 text-xs font-mono" data-testid="btn-zoom-level">
              {Math.round(zoom * 100)}%
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {zoomOptions.map((z) => (
              <DropdownMenuItem key={z} onClick={() => setZoom(z)}>
                {Math.round(z * 100)}%
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setZoom(zoom + 0.25)}
              disabled={zoom >= 2}
              data-testid="btn-zoom-in"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-5 mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={showGrid ? "default" : "ghost"}
              className="h-8 w-8"
              onClick={toggleGrid}
              data-testid="btn-toggle-grid"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Grid</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={snapToGrid ? "default" : "ghost"}
              className="h-8 w-8"
              onClick={toggleSnapToGrid}
              data-testid="btn-toggle-snap"
            >
              <Magnet className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Snap to Grid</TooltipContent>
        </Tooltip>
      </div>

      {/* Right Section - Actions */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleTheme}
              data-testid="btn-toggle-theme"
            >
              {theme === "light" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Theme</TooltipContent>
        </Tooltip>

        <Button size="sm" className="gap-1.5" onClick={handleExport} data-testid="btn-header-export">
          <FileDown className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" data-testid="btn-more-options">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={() => setIsNewDesignModalOpen(true)} 
              data-testid="menu-new-design"
            >
              <FilePlus className="h-4 w-4 mr-2" />
              New Design
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleExport}>
              <FileDown className="h-4 w-4 mr-2" />
              Export as PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* New Design Modal - 3 Tiers */}
      <Dialog open={isNewDesignModalOpen} onOpenChange={setIsNewDesignModalOpen}>
        <DialogContent className="max-w-5xl" style={{ zIndex: 2147483647 }}>
          <DialogHeader>
            <DialogTitle className="text-xl">Create New Design</DialogTitle>
            <DialogDescription>
              Select the design tier that matches your project requirements.
            </DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-3 gap-6 mt-6 pb-2">

            {/* TIER 1: Basic Spec Sheet (Active) */}
            <Card 
              className="p-6 cursor-pointer border-2 hover:border-primary/50 hover:bg-muted/30 transition-all flex flex-col gap-4 group relative"
              onClick={() => handleCreateDesign("basic")}
            >
              <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <FileText className="h-6 w-6" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-semibold text-lg">Basic Spec Sheet</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Best for data-driven documents like spec sheets, price lists, or invoices.
                </p>
                <ul className="text-xs text-muted-foreground list-disc list-inside mt-4 space-y-1">
                  <li>Data-only content</li>
                  <li>1-10 pages</li>
                  <li>Fast generation</li>
                </ul>
              </div>
              <Button className="w-full mt-2" variant="outline">Select Basic</Button>
            </Card>

            {/* TIER 2: Composite Report (Coming Soon) */}
            <Card className="p-6 border flex flex-col gap-4 relative overflow-hidden bg-muted/10 opacity-75">
              <div className="absolute top-3 right-3">
                <Badge variant="secondary" className="text-[10px] font-normal tracking-wide">COMING SOON</Badge>
              </div>
              <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                <Layers className="h-6 w-6" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-semibold text-lg text-muted-foreground">Composite Report</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  For documents requiring external PDF covers, inserts, or mixed media.
                </p>
                <ul className="text-xs text-muted-foreground list-disc list-inside mt-4 space-y-1">
                  <li>Data + External PDFs</li>
                  <li>Cover pages & inserts</li>
                  <li>Medium complexity</li>
                </ul>
              </div>
              <Button className="w-full mt-2" variant="ghost" disabled>Unavailable</Button>
            </Card>

            {/* TIER 3: Full Catalog (Coming Soon) */}
            <Card className="p-6 border flex flex-col gap-4 relative overflow-hidden bg-muted/10 opacity-75">
              <div className="absolute top-3 right-3">
                <Badge variant="secondary" className="text-[10px] font-normal tracking-wide">COMING SOON</Badge>
              </div>
              <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500">
                <BookOpen className="h-6 w-6" />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-semibold text-lg text-muted-foreground">Full Catalog</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Advanced publishing for large catalogs with navigation structures.
                </p>
                <ul className="text-xs text-muted-foreground list-disc list-inside mt-4 space-y-1">
                  <li>Table of Contents</li>
                  <li>Chapter separation</li>
                  <li>Advanced indexing</li>
                </ul>
              </div>
              <Button className="w-full mt-2" variant="ghost" disabled>Unavailable</Button>
            </Card>

          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}