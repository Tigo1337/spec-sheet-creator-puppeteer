import { useCanvasStore } from "@/stores/canvas-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Type,
  Square,
  Circle,
  Minus,
  Image,
  MousePointer2,
  Shapes,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
} from "lucide-react";
import {
  createTextElement,
  createShapeElement,
  createImageElement,
} from "@/lib/canvas-utils";
import { availableFonts } from "@shared/schema";

export function LeftPanel() {
  const {
    activeTool,
    setActiveTool,
    addElement,
    canvasWidth,
    canvasHeight,
    elements,
    selectedElementIds,
    updateElement,
  } = useCanvasStore();

  const selectedElement =
    selectedElementIds.length === 1
      ? elements.find((el) => el.id === selectedElementIds[0])
      : null;

  const isTextElement =
    selectedElement &&
    (selectedElement.type === "text" || selectedElement.type === "dataField") &&
    selectedElement.textStyle;

  const handleAddTextElement = () => {
    const x = canvasWidth / 2 - 100;
    const y = canvasHeight / 2 - 20;
    addElement(createTextElement(x, y, "New Text"));
  };

  const handleAddShape = (shapeType: "rectangle" | "circle" | "line") => {
    const x = canvasWidth / 2 - 50;
    const y = canvasHeight / 2 - 50;
    addElement(createShapeElement(x, y, shapeType));
  };

  const handleAddImage = () => {
    const x = canvasWidth / 2 - 100;
    const y = canvasHeight / 2 - 75;
    addElement(createImageElement(x, y));
  };

  const toolButtons = [
    { id: "select" as const, icon: MousePointer2, label: "Select (V)" },
    { id: "text" as const, icon: Type, label: "Text (T)" },
    { id: "shape" as const, icon: Shapes, label: "Shape (S)" },
    { id: "image" as const, icon: Image, label: "Image (I)" },
  ];

  return (
    <div className="w-64 border-r bg-sidebar flex flex-col h-full">
      <div className="p-3 border-b">
        <h2 className="font-semibold text-sm text-sidebar-foreground">Tools</h2>
      </div>

      <div className="p-2 border-b">
        <div className="flex gap-1 flex-wrap">
          {toolButtons.map((tool) => (
            <Tooltip key={tool.id}>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={activeTool === tool.id ? "default" : "ghost"}
                  onClick={() => setActiveTool(tool.id)}
                  data-testid={`tool-${tool.id}`}
                >
                  <tool.icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{tool.label}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {isTextElement && selectedElement && (
        <>
          <div className="p-3 border-b bg-muted/50">
            <h3 className="font-semibold text-sm text-sidebar-foreground mb-3">
              Text Formatting
            </h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Font</Label>
                <Select
                  value={selectedElement.textStyle?.fontFamily || "Inter"}
                  onValueChange={(value) => {
                    if (selectedElement.textStyle) {
                      updateElement(selectedElement.id, {
                        textStyle: {
                          ...selectedElement.textStyle,
                          fontFamily: value,
                        },
                      });
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-font" className="text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableFonts.map((font) => (
                      <SelectItem key={font} value={font}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Size (px)</Label>
                <Input
                  type="number"
                  min={8}
                  max={72}
                  value={selectedElement.textStyle?.fontSize || 16}
                  onChange={(e) => {
                    updateElement(selectedElement.id, {
                      textStyle: {
                        ...selectedElement.textStyle,
                        fontSize: Number(e.target.value),
                      },
                    });
                  }}
                  data-testid="input-font-size"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Weight</Label>
                <Select
                  value={String(selectedElement.textStyle?.fontWeight || 400)}
                  onValueChange={(value) => {
                    updateElement(selectedElement.id, {
                      textStyle: {
                        ...selectedElement.textStyle,
                        fontWeight: Number(value),
                      },
                    });
                  }}
                >
                  <SelectTrigger data-testid="select-weight" className="text-sm h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="400">Normal</SelectItem>
                    <SelectItem value="500">Medium</SelectItem>
                    <SelectItem value="600">Semibold</SelectItem>
                    <SelectItem value="700">Bold</SelectItem>
                    <SelectItem value="800">Extra Bold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Alignment</Label>
                <div className="flex gap-1">
                  {[
                    { value: "left" as const, icon: AlignLeft, label: "Left" },
                    {
                      value: "center" as const,
                      icon: AlignCenter,
                      label: "Center",
                    },
                    { value: "right" as const, icon: AlignRight, label: "Right" },
                  ].map(({ value, icon: Icon, label }) => (
                    <Tooltip key={value}>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant={
                            selectedElement.textStyle?.textAlign === value
                              ? "default"
                              : "ghost"
                          }
                          onClick={() => {
                            updateElement(selectedElement.id, {
                              textStyle: {
                                ...selectedElement.textStyle,
                                textAlign: value,
                              },
                            });
                          }}
                          data-testid={`btn-align-${value}`}
                          className="h-9 w-9"
                        >
                          <Icon className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{label}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Color</Label>
                <Input
                  type="color"
                  value={selectedElement.textStyle?.color || "#000000"}
                  onChange={(e) => {
                    updateElement(selectedElement.id, {
                      textStyle: {
                        ...selectedElement.textStyle,
                        color: e.target.value,
                      },
                    });
                  }}
                  data-testid="input-text-color"
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Letter Spacing
                </Label>
                <Input
                  type="number"
                  step={0.5}
                  value={selectedElement.textStyle?.letterSpacing || 0}
                  onChange={(e) => {
                    updateElement(selectedElement.id, {
                      textStyle: {
                        ...selectedElement.textStyle,
                        letterSpacing: Number(e.target.value),
                      },
                    });
                  }}
                  data-testid="input-letter-spacing"
                />
              </div>
            </div>
          </div>
        </>
      )}

      <ScrollArea className="flex-1">
        <Accordion type="multiple" defaultValue={["text", "shapes", "images"]} className="px-2">
          <AccordionItem value="text" className="border-b-0">
            <AccordionTrigger className="py-2 text-sm hover:no-underline">
              <div className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                <span>Text Elements</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={handleAddTextElement}
                data-testid="add-text-box"
              >
                <Type className="h-4 w-4" />
                <span>Text Box</span>
              </Button>
            </AccordionContent>
          </AccordionItem>

          <Separator className="my-1" />

          <AccordionItem value="shapes" className="border-b-0">
            <AccordionTrigger className="py-2 text-sm hover:no-underline">
              <div className="flex items-center gap-2">
                <Shapes className="h-4 w-4" />
                <span>Shapes</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-3">
              <div className="grid grid-cols-3 gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-12 w-full"
                      onClick={() => handleAddShape("rectangle")}
                      data-testid="add-shape-rectangle"
                    >
                      <Square className="h-6 w-6" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Rectangle</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-12 w-full"
                      onClick={() => handleAddShape("circle")}
                      data-testid="add-shape-circle"
                    >
                      <Circle className="h-6 w-6" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Circle</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-12 w-full"
                      onClick={() => handleAddShape("line")}
                      data-testid="add-shape-line"
                    >
                      <Minus className="h-6 w-6" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Line</TooltipContent>
                </Tooltip>
              </div>
            </AccordionContent>
          </AccordionItem>

          <Separator className="my-1" />

          <AccordionItem value="images" className="border-b-0">
            <AccordionTrigger className="py-2 text-sm hover:no-underline">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4" />
                <span>Images</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={handleAddImage}
                data-testid="add-image"
              >
                <Image className="h-4 w-4" />
                <span>Add Image Placeholder</span>
              </Button>
              <p className="text-xs text-muted-foreground mt-2 px-1">
                Add an image placeholder, then set the image URL in the properties panel.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </ScrollArea>

      <div className="p-3 border-t bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          Click on canvas or drag elements
        </p>
      </div>
    </div>
  );
}
