import { useState } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea"; 
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { getImageDimensions } from "@/lib/canvas-utils";
import { Switch } from "@/components/ui/switch"; 
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Type,
  Hash,
  Calendar,
  CheckSquare,
  Check,
  List
} from "lucide-react";
import { availableFonts, openSourceFontMap, type CanvasElement } from "@shared/schema";

export function PropertiesTab() {
  const [imageLoadingId, setImageLoadingId] = useState<string | null>(null);

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
    backgroundColor,
    setBackgroundColor,
    excelData,
  } = useCanvasStore();

  const handleImageUrlChange = async (elementId: string, url: string) => {
    updateElement(elementId, { imageSrc: url });

    if (url) {
      setImageLoadingId(elementId);
      const dimensions = await getImageDimensions(url);
      if (dimensions) {
        const maxWidth = 300;
        let width = maxWidth;
        let height = Math.round((maxWidth / dimensions.width) * dimensions.height);

        const maxHeight = 300;
        if (height > maxHeight) {
          height = maxHeight;
          width = Math.round((maxHeight / dimensions.height) * dimensions.width);
        }

        updateElement(elementId, {
          dimension: { width, height }
        });
      }
      setImageLoadingId(null);
    }
  };

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

  const handleFormatChange = (key: string, value: any) => {
    updateElement(selectedElement.id, {
      format: {
        ...selectedElement.format,
        [key]: value,
      },
    });
  };

  // Helper to determine used fields for visual feedback
  const getUsedFields = (content: string | undefined) => {
    if (!content) return new Set<string>();
    // Matches {{FieldName}}
    const matches = content.matchAll(/{{(.*?)}}/g);
    const fields = new Set<string>();
    for (const match of matches) {
      fields.add(match[1]);
    }
    // Also include direct dataBinding if present
    if (selectedElement.dataBinding) {
      fields.add(selectedElement.dataBinding);
    }
    return fields;
  };

  const usedFields = getUsedFields(selectedElement.content);

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

        {/* Alignment Controls */}
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
                      <AlignVerticalJustifyStart className="h-4 w-4" />
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
                      <AlignVerticalJustifyCenter className="h-4 w-4" />
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
                      <AlignVerticalJustifyEnd className="h-4 w-4" />
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
                onChange={(e) => {
                  const newWidth = Number(e.target.value);
                  let newDimension = {
                    width: newWidth,
                    height: selectedElement.dimension.height,
                  };

                  if (selectedElement.type === "image") {
                    const ratio = selectedElement.dimension.width / selectedElement.dimension.height;
                    newDimension.height = Math.round(newWidth / ratio);
                  }

                  updateElement(selectedElement.id, {
                    dimension: newDimension,
                  });
                }}
                data-testid="input-width"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Height</Label>
              <Input
                type="number"
                value={Math.round(selectedElement.dimension.height)}
                onChange={(e) => {
                  const newHeight = Number(e.target.value);
                  let newDimension = {
                    width: selectedElement.dimension.width,
                    height: newHeight,
                  };

                  if (selectedElement.type === "image") {
                    const ratio = selectedElement.dimension.width / selectedElement.dimension.height;
                    newDimension.width = Math.round(newHeight * ratio);
                  }

                  updateElement(selectedElement.id, {
                    dimension: newDimension,
                  });
                }}
                data-testid="input-height"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Text Properties & Data Formatting */}
        {(selectedElement.type === "text" ||
          selectedElement.type === "dataField") && (
          <div>
            <h3 className="font-medium text-sm mb-3">Text Style</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-muted-foreground">Content</Label>

                  {/* MULTI-SELECT DROPDOWN LOGIC */}
                  {excelData && excelData.headers.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          className="h-auto py-1 px-2 text-xs w-auto border-none shadow-none bg-muted/50 hover:bg-muted text-primary whitespace-nowrap"
                        >
                           <span className="flex items-center gap-1">Insert Field</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="max-h-[300px] overflow-y-auto">
                        {excelData.headers.map(header => (
                          <DropdownMenuItem 
                            key={header} 
                            onSelect={(e) => {
                              e.preventDefault(); // Keep menu open for multiple selections

                              const currentContent = selectedElement.content || "";
                              const fieldTag = `{{${header}}}`;

                              if (currentContent.includes(fieldTag)) {
                                 // TOGGLE OFF: Remove all instances of this field
                                 // Using split/join is a safe way to remove all occurrences without regex escaping issues
                                 const newContent = currentContent.split(fieldTag).join("");
                                 updateElement(selectedElement.id, { content: newContent });
                              } else {
                                 // TOGGLE ON: Add field
                                 const prefix = currentContent && !currentContent.match(/\s$/) ? "\n" : ""; 
                                 updateElement(selectedElement.id, { 
                                   content: currentContent + prefix + fieldTag 
                                 });
                              }
                            }}
                          >
                            <div className="flex items-center justify-between w-full gap-2">
                              <span>{header}</span>
                              {usedFields.has(header) && <Check className="h-3 w-3 text-primary opacity-100" />}
                            </div>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <Textarea
                  value={selectedElement.content || ""}
                  onChange={(e) =>
                    updateElement(selectedElement.id, { content: e.target.value })
                  }
                  placeholder="Enter text or {{FieldName}}..."
                  data-testid="input-content"
                  className="font-mono text-sm min-h-[100px]"
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
                  <SelectContent className="max-h-[300px]">
                    {availableFonts.map((font) => {
                      const replacement = openSourceFontMap[font];
                      return (
                        <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                           <span className="flex items-center gap-2">
                             {font}
                             {replacement && (
                               <span className="text-xs text-muted-foreground font-normal ml-1">
                                 ({replacement})
                               </span>
                             )}
                           </span>
                        </SelectItem>
                      );
                    })}
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
                    <AlignVerticalJustifyStart className="h-4 w-4" />
                  </Button>

                  <Button
                    size="icon"
                    variant={
                      selectedElement.textStyle?.verticalAlign === "middle" ? "default" : "outline"
                    }
                    onClick={() => handleTextStyleChange("verticalAlign", "middle")}
                    data-testid="btn-text-vertical-middle"
                  >
                    <AlignVerticalJustifyCenter className="h-4 w-4" />
                  </Button>

                  <Button
                    size="icon"
                    variant={
                      selectedElement.textStyle?.verticalAlign === "bottom" ? "default" : "outline"
                    }
                    onClick={() => handleTextStyleChange("verticalAlign", "bottom")}
                    data-testid="btn-text-vertical-bottom"
                  >
                    <AlignVerticalJustifyEnd className="h-4 w-4" />
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

            <Separator className="my-4" />

            <div>
              <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
                Data Formatting
                <Tooltip>
                  <TooltipTrigger><div className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full border">?</div></TooltipTrigger>
                  <TooltipContent>Apply logic to transform your data automatically</TooltipContent>
                </Tooltip>
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Treat Data As</Label>
                  <Select
                    value={selectedElement.format?.dataType || "text"}
                    onValueChange={(value) => handleFormatChange("dataType", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text"><div className="flex items-center gap-2"><Type className="w-3 h-3"/> Text</div></SelectItem>
                      <SelectItem value="number"><div className="flex items-center gap-2"><Hash className="w-3 h-3"/> Number</div></SelectItem>
                      <SelectItem value="date"><div className="flex items-center gap-2"><Calendar className="w-3 h-3"/> Date</div></SelectItem>
                      <SelectItem value="boolean"><div className="flex items-center gap-2"><CheckSquare className="w-3 h-3"/> Boolean (True/False)</div></SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(selectedElement.format?.dataType === "text" || !selectedElement.format?.dataType) && (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-md border">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Casing</Label>
                      <Select
                        value={selectedElement.format?.casing || "none"}
                        onValueChange={(value) => handleFormatChange("casing", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Original (No Change)</SelectItem>
                          <SelectItem value="title">Title Case (Aa)</SelectItem>
                          <SelectItem value="upper">UPPER CASE (AA)</SelectItem>
                          <SelectItem value="lower">lower case (aa)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* LIST STYLE SELECTOR */}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">List Style</Label>
                      <Select
                        value={selectedElement.format?.listStyle || "none"}
                        onValueChange={(value) => handleFormatChange("listStyle", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No List</SelectItem>
                          <SelectItem value="disc"> Bullets (•)</SelectItem>
                          <SelectItem value="circle">Hollow Bullets (○)</SelectItem>
                          <SelectItem value="square">Square Bullets (■)</SelectItem>
                          <SelectItem value="decimal">Numbered List (1, 2, 3)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {selectedElement.format?.dataType === "number" && (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-md border">

                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">Display as Fraction</Label>
                      <Switch 
                        checked={selectedElement.format?.useFractions || false}
                        onCheckedChange={(checked) => handleFormatChange("useFractions", checked)}
                      />
                    </div>

                    {selectedElement.format?.useFractions ? (
                      <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                        <Label className="text-xs text-muted-foreground">Precision (Rounding)</Label>
                        <Select
                          value={String(selectedElement.format?.fractionPrecision || 16)}
                          onValueChange={(value) => handleFormatChange("fractionPrecision", Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2">Halves (1/2)</SelectItem>
                            <SelectItem value="4">Quarters (1/4)</SelectItem>
                            <SelectItem value="8">Eighths (1/8)</SelectItem>
                            <SelectItem value="16">Sixteenths (1/16)</SelectItem>
                            <SelectItem value="32">32nds (1/32)</SelectItem>
                            <SelectItem value="64">64ths (1/64)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                          <Label className="text-xs text-muted-foreground">Decimal Places</Label>
                          <Input 
                            type="number" 
                            min={0} 
                            max={10}
                            value={selectedElement.format?.decimalPlaces ?? 2}
                            onChange={(e) => handleFormatChange("decimalPlaces", Number(e.target.value))}
                          />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Append Unit</Label>
                      <Select
                        value={selectedElement.format?.unit || "none"}
                        onValueChange={(value) => handleFormatChange("unit", value === "none" ? undefined : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="mm">Millimeters (mm)</SelectItem>
                          <SelectItem value="cm">Centimeters (cm)</SelectItem>
                          <SelectItem value="m">Meters (m)</SelectItem>
                          <SelectItem value="in">Inches (in)</SelectItem>
                          <SelectItem value="ft">Feet (ft)</SelectItem>
                          <SelectItem value="kg">Kilograms (kg)</SelectItem>
                          <SelectItem value="lbs">Pounds (lbs)</SelectItem>
                          <SelectItem value="$">Dollars ($)</SelectItem>
                          <SelectItem value="%">Percentage (%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {selectedElement.format?.dataType === "date" && (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-md border">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Output Format</Label>
                      <Select
                        value={selectedElement.format?.dateFormat || "MM/DD/YYYY"}
                        onValueChange={(value) => handleFormatChange("dateFormat", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MM/DD/YYYY">12/25/2025</SelectItem>
                          <SelectItem value="DD/MM/YYYY">25/12/2025</SelectItem>
                          <SelectItem value="YYYY-MM-DD">2025-12-25</SelectItem>
                          <SelectItem value="MMM D, YYYY">Dec 25, 2025</SelectItem>
                          <SelectItem value="MMMM D, YYYY">December 25, 2025</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {selectedElement.format?.dataType === "boolean" && (
                   <div className="space-y-3 p-3 bg-muted/30 rounded-md border">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground text-green-600">If TRUE (1)</Label>
                          <Input 
                            placeholder="Included"
                            value={selectedElement.format?.trueLabel || ""}
                            onChange={(e) => handleFormatChange("trueLabel", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground text-red-500">If FALSE (0)</Label>
                          <Input 
                            placeholder="-"
                            value={selectedElement.format?.falseLabel || ""}
                            onChange={(e) => handleFormatChange("falseLabel", e.target.value)}
                          />
                        </div>
                    </div>
                   </div>
                )}

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

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Layer</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const minZIndex = Math.min(...elements.map(el => el.zIndex || 0));
                      updateElement(selectedElement.id, { zIndex: minZIndex - 1 });
                    }}
                    data-testid="btn-send-to-back"
                  >
                    Send to Back
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      const maxZIndex = Math.max(...elements.map(el => el.zIndex || 0));
                      updateElement(selectedElement.id, { zIndex: maxZIndex + 1 });
                    }}
                    data-testid="btn-bring-to-front"
                  >
                    Bring to Front
                  </Button>
                </div>
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
                    handleImageUrlChange(selectedElement.id, e.target.value)
                  }
                  placeholder="https://..."
                  disabled={imageLoadingId === selectedElement.id}
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