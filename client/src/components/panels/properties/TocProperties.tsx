/**
 * Table of Contents (TOC) element properties panel
 * Handles TOC title, chapter styling, and column count configuration
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { loadFont } from "@/lib/font-loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Columns,
} from "lucide-react";
import { availableFonts, type CanvasElement, type TextStyle } from "@shared/schema";

interface TocPropertiesProps {
  element: CanvasElement;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
}

export function TocProperties({ element, updateElement }: TocPropertiesProps) {
  const tocSettings = element.tocSettings;
  if (!tocSettings) return null;

  const handleTocSettingChange = async (
    section: "titleStyle" | "chapterStyle",
    key: keyof TextStyle,
    value: string | number
  ) => {
    if (key === "fontFamily" && typeof value === "string") {
      await loadFont(value);
    }

    updateElement(element.id, {
      tocSettings: {
        ...tocSettings,
        [section]: {
          ...tocSettings[section],
          [key]: value,
        },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
          <Columns className="h-4 w-4" />
          Table of Contents
        </h3>
      </div>

      {/* Title Settings */}
      <div className="space-y-3 p-3 bg-muted/20 rounded border">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Title</Label>
          <Switch
            checked={tocSettings.showTitle || false}
            onCheckedChange={(checked) =>
              updateElement(element.id, {
                tocSettings: { ...tocSettings, showTitle: checked },
              })
            }
            className="scale-75"
          />
        </div>

        {tocSettings.showTitle && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title Text</Label>
              <Input
                value={tocSettings.title || "Table of Contents"}
                onChange={(e) =>
                  updateElement(element.id, {
                    tocSettings: { ...tocSettings, title: e.target.value },
                  })
                }
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Font</Label>
              <Select
                value={tocSettings.titleStyle?.fontFamily || "Inter"}
                onValueChange={(val) => handleTocSettingChange("titleStyle", "fontFamily", val)}
              >
                <SelectTrigger className="h-7 text-xs">
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
                  className="h-7 text-xs"
                  value={tocSettings.titleStyle?.fontSize || 18}
                  onChange={(e) =>
                    handleTocSettingChange("titleStyle", "fontSize", Number(e.target.value))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Weight</Label>
                <Select
                  value={String(tocSettings.titleStyle?.fontWeight || 700)}
                  onValueChange={(val) =>
                    handleTocSettingChange("titleStyle", "fontWeight", Number(val))
                  }
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="400">Regular</SelectItem>
                    <SelectItem value="600">Semibold</SelectItem>
                    <SelectItem value="700">Bold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Color</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={tocSettings.titleStyle?.color || "#000000"}
                  onChange={(e) => handleTocSettingChange("titleStyle", "color", e.target.value)}
                  className="w-8 h-7 p-0"
                />
                <Input
                  type="text"
                  value={tocSettings.titleStyle?.color || "#000000"}
                  onChange={(e) => handleTocSettingChange("titleStyle", "color", e.target.value)}
                  className="flex-1 font-mono text-xs h-7"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Alignment</Label>
              <div className="flex gap-1">
                {(["left", "center", "right"] as const).map((align) => (
                  <Button
                    key={align}
                    size="sm"
                    variant={tocSettings.titleStyle?.textAlign === align ? "default" : "outline"}
                    onClick={() => handleTocSettingChange("titleStyle", "textAlign", align)}
                    className="flex-1 h-6"
                  >
                    {align === "left" && <AlignLeft className="h-3 w-3" />}
                    {align === "center" && <AlignCenter className="h-3 w-3" />}
                    {align === "right" && <AlignRight className="h-3 w-3" />}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <Separator />

      {/* Chapter Settings */}
      <div className="space-y-3 p-3 bg-muted/20 rounded border">
        <Label className="text-xs font-semibold">Chapter Entries</Label>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Font</Label>
          <Select
            value={tocSettings.chapterStyle?.fontFamily || "Inter"}
            onValueChange={(val) => handleTocSettingChange("chapterStyle", "fontFamily", val)}
          >
            <SelectTrigger className="h-7 text-xs">
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
              className="h-7 text-xs"
              value={tocSettings.chapterStyle?.fontSize || 12}
              onChange={(e) =>
                handleTocSettingChange("chapterStyle", "fontSize", Number(e.target.value))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Weight</Label>
            <Select
              value={String(tocSettings.chapterStyle?.fontWeight || 400)}
              onValueChange={(val) =>
                handleTocSettingChange("chapterStyle", "fontWeight", Number(val))
              }
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="400">Regular</SelectItem>
                <SelectItem value="600">Semibold</SelectItem>
                <SelectItem value="700">Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={tocSettings.chapterStyle?.color || "#374151"}
              onChange={(e) => handleTocSettingChange("chapterStyle", "color", e.target.value)}
              className="w-8 h-7 p-0"
            />
            <Input
              type="text"
              value={tocSettings.chapterStyle?.color || "#374151"}
              onChange={(e) => handleTocSettingChange("chapterStyle", "color", e.target.value)}
              className="flex-1 font-mono text-xs h-7"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Line Height</Label>
          <Input
            type="number"
            className="h-7 text-xs"
            step={0.1}
            min={1}
            max={3}
            value={tocSettings.chapterStyle?.lineHeight || 1.5}
            onChange={(e) =>
              handleTocSettingChange("chapterStyle", "lineHeight", Number(e.target.value))
            }
          />
        </div>
      </div>

      <Separator />

      {/* Layout Settings */}
      <div className="space-y-3 p-3 bg-muted/20 rounded border">
        <Label className="text-xs font-semibold">Layout</Label>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Columns</Label>
          <Select
            value={String(tocSettings.columnCount || 1)}
            onValueChange={(val) =>
              updateElement(element.id, {
                tocSettings: { ...tocSettings, columnCount: Number(val) },
              })
            }
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Column</SelectItem>
              <SelectItem value="2">2 Columns</SelectItem>
              <SelectItem value="3">3 Columns</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
