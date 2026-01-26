/**
 * Properties Tab - Main property panel component
 * Acts as a switch that renders the appropriate property component
 * based on the selected element type
 */

import { useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/clerk-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Link,
  Unlink,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
} from "lucide-react";

// Import extracted property components
import {
  CanvasSettings,
  TextProperties,
  TableProperties,
  ImageProperties,
  ShapeProperties,
  QrProperties,
  TocProperties,
} from "./properties";

export function PropertiesTab() {
  const [imageLoadingId, setImageLoadingId] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [applyFontToAll, setApplyFontToAll] = useState(false);
  const { toast } = useToast();
  const { getToken } = useAuth();

  const {
    elements,
    selectedElementIds,
    updateElement,
    updateAllTextFonts,
    deleteElement,
    duplicateElement,
    bringToFront,
    sendToBack,
    alignLeft,
    alignCenter,
    alignRight,
    alignTop,
    alignMiddle,
    alignBottom,
    backgroundColor,
    setBackgroundColor,
    excelData,
    selectedRowIndex,
    resizeElement,
    toggleAspectRatioLock,
  } = useCanvasStore();

  const selectedElement =
    selectedElementIds.length === 1
      ? elements.find((el) => el.id === selectedElementIds[0])
      : null;

  // Handler for generating trackable QR code URLs
  const handleGenerateShortLink = async () => {
    if (!selectedElement || !selectedElement.content) {
      toast({
        title: "Error",
        description: "Please enter a URL first.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingLink(true);
    try {
      const token = await getToken();
      const response = await fetch("/api/qrcodes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ destinationUrl: selectedElement.content }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create link");
      }

      const data = await response.json();
      const baseUrl = import.meta.env.VITE_APP_BASE_URL || window.location.origin;
      const shortUrl = `${baseUrl}/q/${data.id}`;

      updateElement(selectedElement.id, { content: shortUrl });
      toast({ title: "Success", description: "QR Code is now trackable!" });
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Could not generate link",
      });
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // Show canvas settings when no element is selected
  if (!selectedElement) {
    return (
      <CanvasSettings
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
      />
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Quick Actions - common to all elements */}
        <div className="flex items-center gap-1 flex-wrap">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => duplicateElement(selectedElement.id)}
                data-testid="btn-duplicate"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Duplicate</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => deleteElement(selectedElement.id)}
                data-testid="btn-delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => bringToFront(selectedElement.id)}
                data-testid="btn-bring-front"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bring to Front</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => sendToBack(selectedElement.id)}
                data-testid="btn-send-back"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Send to Back</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6 mx-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={selectedElement.locked ? "default" : "ghost"}
                onClick={() =>
                  updateElement(selectedElement.id, { locked: !selectedElement.locked })
                }
                data-testid="btn-lock"
              >
                {selectedElement.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{selectedElement.locked ? "Unlock" : "Lock"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={!selectedElement.visible ? "default" : "ghost"}
                onClick={() =>
                  updateElement(selectedElement.id, { visible: !selectedElement.visible })
                }
                data-testid="btn-visibility"
              >
                {selectedElement.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{selectedElement.visible ? "Hide" : "Show"}</TooltipContent>
          </Tooltip>
        </div>

        <Separator />

        {/* Multi-selection Alignment Controls */}
        {selectedElementIds.length > 1 && (
          <>
            <div>
              <h3 className="font-medium text-sm mb-3">Alignment</h3>
              <div className="space-y-2">
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="outline" onClick={() => alignLeft()}>
                        <AlignLeft className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Align Left</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="outline" onClick={() => alignCenter()}>
                        <AlignCenter className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Align Center (Horizontal)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="outline" onClick={() => alignRight()}>
                        <AlignRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Align Right</TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="outline" onClick={() => alignTop()}>
                        <AlignVerticalJustifyStart className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Align Top</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="outline" onClick={() => alignMiddle()}>
                        <AlignVerticalJustifyCenter className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Align Middle (Vertical)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="outline" onClick={() => alignBottom()}>
                        <AlignVerticalJustifyEnd className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Align Bottom</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
            <Separator />
          </>
        )}

        {/* Position & Size - common to all elements */}
        <div>
          <h3 className="font-medium text-sm mb-3 flex items-center justify-between">
            Position & Size
            {selectedElement.type === "image" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={selectedElement.aspectRatioLocked ? "default" : "ghost"}
                    className="h-6 w-6"
                    onClick={() => toggleAspectRatioLock(selectedElement.id)}
                  >
                    {selectedElement.aspectRatioLocked ? (
                      <Link className="h-3 w-3" />
                    ) : (
                      <Unlink className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {selectedElement.aspectRatioLocked ? "Unlock Aspect Ratio" : "Lock Aspect Ratio"}
                </TooltipContent>
              </Tooltip>
            )}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">X</Label>
              <Input
                type="number"
                value={Math.round(selectedElement.position.x)}
                onChange={(e) =>
                  updateElement(selectedElement.id, {
                    position: { ...selectedElement.position, x: Number(e.target.value) },
                  })
                }
                data-testid="input-pos-x"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Y</Label>
              <Input
                type="number"
                value={Math.round(selectedElement.position.y)}
                onChange={(e) =>
                  updateElement(selectedElement.id, {
                    position: { ...selectedElement.position, y: Number(e.target.value) },
                  })
                }
                data-testid="input-pos-y"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Width</Label>
              <Input
                type="number"
                value={Math.round(selectedElement.dimension.width)}
                onChange={(e) =>
                  resizeElement(selectedElement.id, Number(e.target.value), selectedElement.dimension.height)
                }
                data-testid="input-width"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Height</Label>
              <Input
                type="number"
                value={Math.round(selectedElement.dimension.height)}
                onChange={(e) =>
                  resizeElement(selectedElement.id, selectedElement.dimension.width, Number(e.target.value))
                }
                data-testid="input-height"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Element-specific properties - switch based on type */}
        {selectedElement.type === "table" && selectedElement.tableSettings && (
          <TableProperties
            element={selectedElement}
            updateElement={updateElement}
            excelData={excelData}
            selectedRowIndex={selectedRowIndex}
          />
        )}

        {selectedElement.type === "toc-list" && selectedElement.tocSettings && (
          <TocProperties
            element={selectedElement}
            updateElement={updateElement}
          />
        )}

        {selectedElement.type === "qrcode" && (
          <QrProperties
            element={selectedElement}
            updateElement={updateElement}
            excelData={excelData}
            isGeneratingLink={isGeneratingLink}
            onGenerateShortLink={handleGenerateShortLink}
          />
        )}

        {(selectedElement.type === "text" || selectedElement.type === "dataField") && (
          <TextProperties
            element={selectedElement}
            updateElement={updateElement}
            updateAllTextFonts={updateAllTextFonts}
            applyFontToAll={applyFontToAll}
            setApplyFontToAll={setApplyFontToAll}
            excelData={excelData}
          />
        )}

        {selectedElement.type === "shape" && (
          <ShapeProperties
            element={selectedElement}
            elements={elements}
            updateElement={updateElement}
            sendToBack={sendToBack}
            bringToFront={bringToFront}
          />
        )}

        {selectedElement.type === "image" && (
          <ImageProperties
            element={selectedElement}
            elements={elements}
            updateElement={updateElement}
            sendToBack={sendToBack}
            bringToFront={bringToFront}
            excelData={excelData}
            selectedRowIndex={selectedRowIndex}
            imageLoadingId={imageLoadingId}
            setImageLoadingId={setImageLoadingId}
          />
        )}
      </div>
    </ScrollArea>
  );
}
