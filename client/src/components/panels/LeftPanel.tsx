import { useCanvasStore } from "@/stores/canvas-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Type,
  Square,
  Circle,
  Minus,
  Image,
  MousePointer2,
  Shapes,
} from "lucide-react";
import {
  createTextElement,
  createShapeElement,
  createImageElement,
} from "@/lib/canvas-utils";

export function LeftPanel() {
  const {
    activeTool,
    setActiveTool,
    addElement,
    canvasWidth,
    canvasHeight,
  } = useCanvasStore();

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
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 h-10"
                  onClick={handleAddTextElement}
                  data-testid="add-text-heading"
                >
                  <span className="font-semibold text-base">Heading</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 h-10"
                  onClick={handleAddTextElement}
                  data-testid="add-text-body"
                >
                  <span className="text-sm">Body Text</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 h-10"
                  onClick={handleAddTextElement}
                  data-testid="add-text-caption"
                >
                  <span className="text-xs text-muted-foreground">Caption</span>
                </Button>
              </div>
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
