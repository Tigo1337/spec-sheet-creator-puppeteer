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
  Crown, 
  Sparkles,
  ChevronDown,
  CheckCircle2,
  Cloud
} from "lucide-react";
import { useState, useEffect } from "react";
import { useUser, UserButton } from "@clerk/clerk-react";
import { QRManagerDialog } from "@/components/dialogs/QRManagerDialog";
import { useSubscription } from "@/hooks/use-subscription";
import { UpgradeDialog } from "@/components/dialogs/UpgradeDialog";
import { KnowledgeManagerDialog } from "@/components/dialogs/KnowledgeManagerDialog";
import { AccountDialog } from "@/components/dialogs/AccountDialog";
import { DesignManagerDialog } from "@/components/dialogs/DesignManagerDialog";
import { format } from "date-fns";

export function Header() {
  const { user } = useUser();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const { isPro } = useSubscription();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const {
    zoom,
    setZoom,
    showGrid,
    toggleGrid,
    gridSize, // 
    setGridSize, // 
    snapToGrid,
    toggleSnapToGrid,
    undo,
    redo,
    hasUnsavedChanges,
    currentTemplate,
    setRightPanelTab,
    saveStatus, 
    lastSavedAt 
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
      <UpgradeDialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog} />

      {/* Left Section */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <img 
            src="https://res.cloudinary.com/olilepage/image/upload/t_transparent_background/v1767054291/doculoom/logos/doculoom-io-wordmark-logo-cropped.png" 
            alt="Doculoom" 
            className="h-8 hidden sm:block"
          />
          <img 
            src="https://res.cloudinary.com/olilepage/image/upload/t_transparent_background/v1767054291/doculoom/logos/doculoom-io-wordmark-logo-cropped.png" 
            alt="Doculoom" 
            className="h-6 sm:hidden"
          />
        </div>

        <Separator orientation="vertical" className="h-6 hidden sm:block" />

        {/* Design Manager Button */}
        <DesignManagerDialog>
          <Button 
            variant="ghost" 
            className="flex items-center gap-2 h-auto py-1 px-2 -ml-2 text-left font-normal hover:bg-muted/50 rounded-md group"
          >
            <div className="flex flex-col items-start min-w-0">
               <span className="text-sm font-medium truncate max-w-[140px] sm:max-w-[200px] flex items-center gap-1">
                  {currentTemplate?.name || "Untitled Design"}
                  <ChevronDown className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
               </span>
               <span className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  {saveStatus === 'saving' && <span className="text-blue-500 flex items-center gap-1"><Cloud className="h-3 w-3 animate-pulse" /> Saving...</span>}
                  {saveStatus === 'saved' && <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Saved {lastSavedAt ? format(lastSavedAt, 'h:mm a') : ''}</span>}
                  {saveStatus === 'unsaved' && <span className="text-orange-500">Unsaved changes</span>}
                  {saveStatus === 'error' && <span className="text-red-500">Save failed</span>}
               </span>
            </div>
          </Button>
        </DesignManagerDialog>
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

        {/* BLOCK START: GRID UI WITH SQUARES SIZE SELECTION */}
        <div className="flex items-center gap-0.5 border rounded-md px-1 bg-background/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  variant={showGrid ? "default" : "ghost"} 
                  className="h-7 w-7" 
                  onClick={toggleGrid}
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Show Grid</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-4 mx-0.5" />

            <div className="flex items-center">
                <Button 
                    variant={gridSize === 10 ? "secondary" : "ghost"} 
                    className="h-6 px-1.5 text-[10px] font-bold"
                    onClick={() => setGridSize(10)}
                    disabled={!showGrid}
                >
                    10px
                </Button>
                <Button 
                    variant={gridSize === 5 ? "secondary" : "ghost"} 
                    className="h-6 px-1.5 text-[10px] font-bold"
                    onClick={() => setGridSize(5)}
                    disabled={!showGrid}
                >
                    5px
                </Button>
            </div>
        </div>
        {/* BLOCK END: GRID UI WITH SQUARES SIZE SELECTION */}

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
        {!isPro && (
          <Button 
            size="sm" 
            className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-sm"
            onClick={() => setShowUpgradeDialog(true)}
          >
            <Crown className="h-4 w-4 fill-current" />
            Upgrade
          </Button>
        )}

        <QRManagerDialog />

        <KnowledgeManagerDialog>
           <Button variant="ghost" size="sm" className="gap-1.5 px-2 text-muted-foreground hover:text-purple-600 hover:bg-purple-50">
             <Sparkles className="h-4 w-4" />
             AI Memory
           </Button>
        </KnowledgeManagerDialog>

        <Separator orientation="vertical" className="h-6" />

        <Button size="icon" variant="ghost" onClick={toggleTheme}>
          {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>
        <Button size="sm" className="gap-1.5" onClick={handleExport}>
          <FileDown className="h-4 w-4" />
          Export
        </Button>

        <AccountDialog />

        <div className="ml-2 flex items-center">
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    </header>
  );
}