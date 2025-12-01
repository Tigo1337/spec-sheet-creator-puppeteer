import { useCanvasStore } from "@/stores/canvas-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
} from "lucide-react";
import { availableFonts, type CanvasElement, pageSizes } from "@shared/schema";

export function PropertiesTab() {
  const {
    elements,
    selectedElementIds,
    updateElement,
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
    canvasWidth,
    canvasHeight,
    backgroundColor,
    setCanvasSize,
    setBackgroundColor,
  } = useCanvasStore();

  const selectedElement =
    selectedElementIds.length === 1
      ? elements.find((el) => el.id === selectedElementIds[0])
      : null;

  if (!selectedElement) {
    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <div>
            <h3 className="font-medium text-sm mb-3">Canvas Settings</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Background Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-12 h-9 p-1 cursor-pointer"
                    data-testid="input-canvas-bg-color"
                  />
                  <Input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Select an element to edit its properties</p>
          </div>
        </div>
      </ScrollArea>
    );
  }

  const handleTextStyleChange = (
    key: keyof NonNullable<CanvasElement["textStyle"]>,
    value: string | number
  ) => {
    updateElement(selectedElement.id, {
      textStyle: {
        ...selectedElement.textStyle,
        [key]: value,
      },
    });
  };

  const handleShapeStyleChange = (
    key: keyof NonNullable<CanvasElement["shapeStyle"]>,
    value: string | number
  ) => {
    updateElement(selectedElement.id, {
      shapeStyle: {
        ...selectedElement.shapeStyle,
        [key]: value,
      },
    });
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Quick Actions */}
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
                  updateElement(selectedElement.id, {
                    locked: !selectedElement.locked,
                  })
                }
                data-testid="btn-lock"
              >
                {selectedElement.locked ? (
                  <Lock className="h-4 w-4" />
                ) : (
                  <Unlock className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {selectedElement.locked ? "Unlock" : "Lock"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={!selectedElement.visible ? "default" : "ghost"}
                onClick={() =>
                  updateElement(selectedElement.id, {
                    visible: !selectedElement.visible,
                  })
                }
                data-testid="btn-visibility"
              >
                {selectedElement.visible ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {selectedElement.visible ? "Hide" : "Show"}
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator />

        {/* Alignment Controls - shown when multiple elements selected */}
        {selectedElementIds.length > 1 && (
          <div>
            <h3 className="font-medium text-sm mb-3">Alignment</h3>
            <div className="space-y-2">
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => alignLeft()}
                      data-testid="btn-align-left"
                    >
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Align Left</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => alignCenter()}
                      data-testid="btn-align-center-h"
                    >
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Align Center (Horizontal)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => alignRight()}
                      data-testid="btn-align-right"
                    >
                      <AlignRight className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Align Right</TooltipContent>
                </Tooltip>
              </div>

              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => alignTop()}
                      data-testid="btn-align-top"
                    >
                      <AlignStartVertical className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Align Top</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => alignMiddle()}
                      data-testid="btn-align-center-v"
                    >
                      <AlignCenterVertical className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Align Middle (Vertical)</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => alignBottom()}
                      data-testid="btn-align-bottom"
                    >
                      <AlignEndVertical className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Align Bottom</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Position & Size */}
        <div>
          <h3 className="font-medium text-sm mb-3">Position & Size</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">X</Label>
              <Input
                type="number"
                value={Math.round(selectedElement.position.x)}
                onChange={(e) =>
                  updateElement(selectedElement.id, {
                    position: {
                      ...selectedElement.position,
                      x: Number(e.target.value),
                    },
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
                    position: {
                      ...selectedElement.position,
                      y: Number(e.target.value),
                    },
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
                  updateElement(selectedElement.id, {
                    dimension: {
                      ...selectedElement.dimension,
                      width: Number(e.target.value),
                    },
                  })
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
                  updateElement(selectedElement.id, {
                    dimension: {
                      ...selectedElement.dimension,
                      height: Number(e.target.value),
                    },
                  })
                }
                data-testid="input-height"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Text Properties */}
        {(selectedElement.type === "text" ||
          selectedElement.type === "dataField") && (
          <div>
            <h3 className="font-medium text-sm mb-3">Text Style</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Content</Label>
                <Input
                  value={selectedElement.content || ""}
                  onChange={(e) =>
                    updateElement(selectedElement.id, { content: e.target.value })
                  }
                  placeholder="Enter text..."
                  data-testid="input-content"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Font Family</Label>
                <Select
                  value={selectedElement.textStyle?.fontFamily || "Inter"}
                  onValueChange={(value) => handleTextStyleChange("fontFamily", value)}
                >
                  <SelectTrigger data-testid="select-font">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFonts.map((font) => (
                      <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Size</Label>
                  <Input
                    type="number"
                    value={selectedElement.textStyle?.fontSize || 16}
                    onChange={(e) =>
                      handleTextStyleChange("fontSize", Number(e.target.value))
                    }
                    min={8}
                    max={200}
                    data-testid="input-font-size"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Weight</Label>
                  <Select
                    value={String(selectedElement.textStyle?.fontWeight || 400)}
                    onValueChange={(value) =>
                      handleTextStyleChange("fontWeight", Number(value))
                    }
                  >
                    <SelectTrigger data-testid="select-weight">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="300">Light</SelectItem>
                      <SelectItem value="400">Regular</SelectItem>
                      <SelectItem value="500">Medium</SelectItem>
                      <SelectItem value="600">Semibold</SelectItem>
                      <SelectItem value="700">Bold</SelectItem>
                      <SelectItem value="800">Extra Bold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={selectedElement.textStyle?.color || "#000000"}
                    onChange={(e) => handleTextStyleChange("color", e.target.value)}
                    className="w-12 h-9 p-1 cursor-pointer"
                    data-testid="input-text-color"
                  />
                  <Input
                    type="text"
                    value={selectedElement.textStyle?.color || "#000000"}
                    onChange={(e) => handleTextStyleChange("color", e.target.value)}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Horizontal Alignment</Label>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant={
                      selectedElement.textStyle?.textAlign === "left" ? "default" : "outline"
                    }
                    onClick={() => handleTextStyleChange("textAlign", "left")}
                    data-testid="btn-text-align-left"
                  >
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={
                      selectedElement.textStyle?.textAlign === "center" ? "default" : "outline"
                    }
                    onClick={() => handleTextStyleChange("textAlign", "center")}
                    data-testid="btn-text-align-center"
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={
                      selectedElement.textStyle?.textAlign === "right" ? "default" : "outline"
                    }
                    onClick={() => handleTextStyleChange("textAlign", "right")}
                    data-testid="btn-text-align-right"
                  >
                    <AlignRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Vertical Alignment</Label>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant={
                      selectedElement.textStyle?.verticalAlign === "top" ? "default" : "outline"
                    }
                    onClick={() => handleTextStyleChange("verticalAlign", "top")}
                    data-testid="btn-text-vertical-top"
                  >
                    <AlignStartVertical className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={
                      selectedElement.textStyle?.verticalAlign === "middle" ? "default" : "outline"
                    }
                    onClick={() => handleTextStyleChange("verticalAlign", "middle")}
                    data-testid="btn-text-vertical-middle"
                  >
                    <AlignCenterVertical className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={
                      selectedElement.textStyle?.verticalAlign === "bottom" ? "default" : "outline"
                    }
                    onClick={() => handleTextStyleChange("verticalAlign", "bottom")}
                    data-testid="btn-text-vertical-bottom"
                  >
                    <AlignEndVertical className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Line Height: {selectedElement.textStyle?.lineHeight || 1.5}
                </Label>
                <Slider
                  value={[selectedElement.textStyle?.lineHeight || 1.5]}
                  onValueChange={([value]) => handleTextStyleChange("lineHeight", value)}
                  min={1}
                  max={3}
                  step={0.1}
                  data-testid="slider-line-height"
                />
              </div>
            </div>
          </div>
        )}

        {/* Shape Properties */}
        {selectedElement.type === "shape" && (
          <div>
            <h3 className="font-medium text-sm mb-3">Shape Style</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Fill Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={selectedElement.shapeStyle?.fill || "#e5e7eb"}
                    onChange={(e) => handleShapeStyleChange("fill", e.target.value)}
                    className="w-12 h-9 p-1 cursor-pointer"
                    data-testid="input-fill-color"
                  />
                  <Input
                    type="text"
                    value={selectedElement.shapeStyle?.fill || "#e5e7eb"}
                    onChange={(e) => handleShapeStyleChange("fill", e.target.value)}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Stroke Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={selectedElement.shapeStyle?.stroke || "#9ca3af"}
                    onChange={(e) => handleShapeStyleChange("stroke", e.target.value)}
                    className="w-12 h-9 p-1 cursor-pointer"
                    data-testid="input-stroke-color"
                  />
                  <Input
                    type="text"
                    value={selectedElement.shapeStyle?.stroke || "#9ca3af"}
                    onChange={(e) => handleShapeStyleChange("stroke", e.target.value)}
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Stroke Width: {selectedElement.shapeStyle?.strokeWidth || 1}px
                </Label>
                <Slider
                  value={[selectedElement.shapeStyle?.strokeWidth || 1]}
                  onValueChange={([value]) => handleShapeStyleChange("strokeWidth", value)}
                  min={0}
                  max={10}
                  step={1}
                  data-testid="slider-stroke-width"
                />
              </div>

              {selectedElement.shapeType !== "circle" &&
                selectedElement.shapeType !== "line" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Border Radius: {selectedElement.shapeStyle?.borderRadius || 0}px
                    </Label>
                    <Slider
                      value={[selectedElement.shapeStyle?.borderRadius || 0]}
                      onValueChange={([value]) =>
                        handleShapeStyleChange("borderRadius", value)
                      }
                      min={0}
                      max={50}
                      step={1}
                      data-testid="slider-border-radius"
                    />
                  </div>
                )}

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Opacity: {Math.round((selectedElement.shapeStyle?.opacity || 1) * 100)}%
                </Label>
                <Slider
                  value={[(selectedElement.shapeStyle?.opacity || 1) * 100]}
                  onValueChange={([value]) =>
                    handleShapeStyleChange("opacity", value / 100)
                  }
                  min={0}
                  max={100}
                  step={5}
                  data-testid="slider-opacity"
                />
              </div>
            </div>
          </div>
        )}

        {/* Image Properties */}
        {selectedElement.type === "image" && (
          <div>
            <h3 className="font-medium text-sm mb-3">Image Settings</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Image URL</Label>
                <Input
                  value={selectedElement.imageSrc || ""}
                  onChange={(e) =>
                    updateElement(selectedElement.id, { imageSrc: e.target.value })
                  }
                  placeholder="https://..."
                  data-testid="input-image-url"
                />
              </div>
              {selectedElement.imageSrc && (
                <div className="aspect-video bg-muted rounded-md overflow-hidden">
                  <img
                    src={selectedElement.imageSrc}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
