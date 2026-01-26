/**
 * Shape element properties panel
 * Handles fill color, stroke, border radius, and opacity settings
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import type { ShapePropertiesProps } from "./types";

export function ShapeProperties({
  element,
  elements,
  updateElement,
  sendToBack,
}: ShapePropertiesProps) {
  const handleShapeStyleChange = (
    key: keyof NonNullable<typeof element.shapeStyle>,
    value: string | number
  ) => {
    const currentStyle = element.shapeStyle || {
      fill: "#e5e7eb",
      stroke: "#9ca3af",
      strokeWidth: 1,
      borderRadius: 0,
      opacity: 1,
    };
    updateElement(element.id, {
      shapeStyle: {
        ...currentStyle,
        [key]: value,
      },
    });
  };

  return (
    <div>
      <h3 className="font-medium text-sm mb-3">Shape Style</h3>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Fill Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={element.shapeStyle?.fill || "#e5e7eb"}
              onChange={(e) => handleShapeStyleChange("fill", e.target.value)}
              className="w-12 h-9 p-1 cursor-pointer"
              data-testid="input-fill-color"
            />
            <Input
              type="text"
              value={element.shapeStyle?.fill || "#e5e7eb"}
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
              value={element.shapeStyle?.stroke || "#9ca3af"}
              onChange={(e) => handleShapeStyleChange("stroke", e.target.value)}
              className="w-12 h-9 p-1 cursor-pointer"
              data-testid="input-stroke-color"
            />
            <Input
              type="text"
              value={element.shapeStyle?.stroke || "#9ca3af"}
              onChange={(e) => handleShapeStyleChange("stroke", e.target.value)}
              className="flex-1 font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Stroke Width: {element.shapeStyle?.strokeWidth || 1}px
          </Label>
          <Slider
            value={[element.shapeStyle?.strokeWidth || 1]}
            onValueChange={([value]) => handleShapeStyleChange("strokeWidth", value)}
            min={0}
            max={10}
            step={1}
            data-testid="slider-stroke-width"
          />
        </div>

        {element.shapeType !== "circle" && element.shapeType !== "line" && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Border Radius: {element.shapeStyle?.borderRadius || 0}px
            </Label>
            <Slider
              value={[element.shapeStyle?.borderRadius || 0]}
              onValueChange={([value]) => handleShapeStyleChange("borderRadius", value)}
              min={0}
              max={50}
              step={1}
              data-testid="slider-border-radius"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Opacity: {Math.round((element.shapeStyle?.opacity || 1) * 100)}%
          </Label>
          <Slider
            value={[(element.shapeStyle?.opacity || 1) * 100]}
            onValueChange={([value]) => handleShapeStyleChange("opacity", value / 100)}
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
              onClick={() => sendToBack(element.id)}
              data-testid="btn-send-to-back"
            >
              Send to Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                const maxZIndex = Math.max(...elements.map((el) => el.zIndex || 0));
                updateElement(element.id, { zIndex: maxZIndex + 1 });
              }}
              data-testid="btn-bring-to-front"
            >
              Bring to Front
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
