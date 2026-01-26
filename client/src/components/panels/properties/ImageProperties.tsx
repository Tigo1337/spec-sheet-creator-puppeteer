/**
 * Image element properties panel
 * Handles image source/URL, opacity, layer controls, and data binding
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Image as ImageIcon, ExternalLink } from "lucide-react";
import { getImageDimensions } from "@/lib/canvas-utils";
import type { CanvasElement } from "@shared/schema";

interface ImagePropertiesProps {
  element: CanvasElement;
  elements: CanvasElement[];
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  sendToBack: (id: string) => void;
  bringToFront: (id: string) => void;
  excelData: { headers: string[]; rows: Record<string, string>[] } | null;
  selectedRowIndex: number;
  imageLoadingId: string | null;
  setImageLoadingId: (id: string | null) => void;
}

export function ImageProperties({
  element,
  updateElement,
  sendToBack,
  bringToFront,
  excelData,
  selectedRowIndex,
  imageLoadingId,
  setImageLoadingId,
}: ImagePropertiesProps) {
  const handleImageUrlChange = async (url: string) => {
    updateElement(element.id, { imageSrc: url });

    // Only try to load dimensions if it looks like a real URL (not a variable)
    if (
      url &&
      !url.includes("{{") &&
      (url.startsWith("http") || url.startsWith("data:"))
    ) {
      setImageLoadingId(element.id);
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

        updateElement(element.id, {
          dimension: { width, height },
          aspectRatio: width / height,
          aspectRatioLocked: true,
        });
      }
      setImageLoadingId(null);
    }
  };

  const handleOpacityChange = (value: number) => {
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
        opacity: value / 100,
      },
    });
  };

  // Resolve image source for preview when using data binding
  const getResolvedImageSrc = () => {
    if (!element.imageSrc) return null;
    if (!element.imageSrc.includes("{{") || !excelData) return element.imageSrc;

    const variableMatch = element.imageSrc.match(/{{([\w\s]+)}}/);
    const variable = variableMatch ? variableMatch[1] : null;
    return variable ? excelData.rows[selectedRowIndex]?.[variable] : "";
  };

  return (
    <div>
      <h3 className="font-medium text-sm mb-3">Image Settings</h3>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <ImageIcon className="h-3 w-3" />
              Image Source / URL
            </Label>
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
                  <DropdownMenuItem
                    onSelect={() => updateElement(element.id, { imageSrc: "" })}
                  >
                    <span className="text-muted-foreground italic">Clear</span>
                  </DropdownMenuItem>
                  {excelData.headers.map((header) => (
                    <DropdownMenuItem
                      key={header}
                      onSelect={() => {
                        const fieldTag = `{{${header}}}`;
                        updateElement(element.id, { imageSrc: fieldTag });
                      }}
                    >
                      {header}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <Input
            value={element.imageSrc || ""}
            onChange={(e) => handleImageUrlChange(e.target.value)}
            placeholder="https://... or {{MyVariable}}"
            disabled={imageLoadingId === element.id}
            data-testid="input-image-url"
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Enter a URL or use <code>{"{{Variable}}"}</code> to bind to data.
          </p>
        </div>

        {element.imageSrc && element.imageSrc.includes("{{") && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-2">
              <ExternalLink className="h-3 w-3" />
              URL (Row {selectedRowIndex + 1})
            </Label>
            <Input
              readOnly
              value={(() => {
                if (!excelData) return "(No data loaded)";
                return element.imageSrc!.replace(/{{([\w\s]+)}}/g, (match, p1) => {
                  return excelData.rows[selectedRowIndex]?.[p1.trim()] || "(Empty)";
                });
              })()}
              className="font-mono text-xs bg-muted text-muted-foreground cursor-default focus-visible:ring-0"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Opacity: {Math.round((element.shapeStyle?.opacity ?? 1) * 100)}%
          </Label>
          <Slider
            value={[(element.shapeStyle?.opacity ?? 1) * 100]}
            onValueChange={([value]) => handleOpacityChange(value)}
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
              onClick={() => bringToFront(element.id)}
              data-testid="btn-bring-to-front"
            >
              Bring to Front
            </Button>
          </div>
        </div>

        {element.imageSrc && (
          <div
            className="aspect-video bg-muted rounded-md overflow-hidden"
            style={{ opacity: element.shapeStyle?.opacity ?? 1 }}
          >
            <img
              src={getResolvedImageSrc() || ""}
              alt="Preview"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
