/**
 * Text and DataField element properties panel
 * Handles font styling, alignment, data binding, and data formatting options
 */

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Type,
  Hash,
  Calendar,
  CheckSquare,
  Check,
  Database,
} from "lucide-react";
import {
  availableFonts,
  openSourceFontMap,
  type CanvasElement,
} from "@shared/schema";

interface TextPropertiesProps {
  element: CanvasElement;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  updateAllTextFonts: (fontFamily: string) => void;
  applyFontToAll: boolean;
  setApplyFontToAll: (value: boolean) => void;
  excelData: { headers: string[]; rows: Record<string, string>[] } | null;
}

export function TextProperties({
  element,
  updateElement,
  updateAllTextFonts,
  applyFontToAll,
  setApplyFontToAll,
  excelData,
}: TextPropertiesProps) {
  const isDataField = element.type === "dataField";

  // Get used fields from content
  const getUsedFields = () => {
    const fields = new Set<string>();
    if (element.content) {
      const matches = Array.from(element.content.matchAll(/{{(.*?)}}/g));
      for (const match of matches) {
        fields.add(match[1]);
      }
    }
    if (element.dataBinding) {
      fields.add(element.dataBinding);
    }
    return fields;
  };

  const usedFields = getUsedFields();

  const handleTextStyleChange = async (
    key: keyof NonNullable<CanvasElement["textStyle"]>,
    value: string | number
  ) => {
    if (key === "fontFamily" && typeof value === "string") {
      await loadFont(value);
      if (applyFontToAll) {
        updateAllTextFonts(value);
        return;
      }
    }

    const currentStyle = element.textStyle || {
      fontFamily: "Inter",
      fontSize: 16,
      fontWeight: 400,
      color: "#000000",
      textAlign: "left" as const,
      verticalAlign: "top" as const,
      lineHeight: 1.5,
      letterSpacing: 0,
    };
    updateElement(element.id, {
      textStyle: {
        ...currentStyle,
        [key]: value,
      },
    });
  };

  const handleFormatChange = (key: string, value: unknown) => {
    const currentFormat = element.format || {
      dataType: "text" as const,
      casing: "none" as const,
      decimalPlaces: 2,
      useFractions: false,
      fractionPrecision: 16,
      dateFormat: "MM/DD/YYYY",
      listStyle: "none" as const,
    };
    updateElement(element.id, {
      format: {
        ...currentFormat,
        [key]: value,
      },
    });
  };

  return (
    <>
      {/* Data Binding Section (only for dataField type) */}
      {isDataField && (
        <div className="space-y-4">
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
            <div className="flex items-center gap-2 mb-2">
              <Database className="h-4 w-4 text-primary" />
              <h3 className="font-medium text-sm text-primary">Data Binding</h3>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Connected Column</Label>
              <Select
                value={element.dataBinding || ""}
                onValueChange={(value) => {
                  updateElement(element.id, {
                    dataBinding: value,
                    content: `{{${value}}}`,
                  });
                }}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select a column..." />
                </SelectTrigger>
                <SelectContent>
                  {excelData?.headers.map((header) => (
                    <SelectItem key={header} value={header}>
                      {header}
                    </SelectItem>
                  )) || (
                    <SelectItem value="none" disabled>
                      No data imported
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
        </div>
      )}

      {/* Text Style Section */}
      <div>
        <h3 className="font-medium text-sm mb-3">Text Style</h3>

        {/* Bulk Apply Font Toggle */}
        <div className="flex items-center justify-between mb-4 px-1 bg-primary/5 p-2 rounded-md border border-primary/10">
          <div className="space-y-0.5">
            <Label className="text-[10px] text-primary font-bold uppercase tracking-wider">
              Bulk Apply Font
            </Label>
            <p className="text-[9px] text-muted-foreground">
              Apply font selection to all elements
            </p>
          </div>
          <Switch
            checked={applyFontToAll}
            onCheckedChange={setApplyFontToAll}
            className="scale-75"
          />
        </div>

        <div className="space-y-3">
          {/* Content */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs text-muted-foreground">Content</Label>
              {!isDataField && excelData && excelData.headers.length > 0 && (
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
                    {excelData.headers.map((header) => (
                      <DropdownMenuItem
                        key={header}
                        onSelect={(e) => {
                          e.preventDefault();
                          const currentContent = element.content || "";
                          const fieldTag = `{{${header}}}`;
                          if (currentContent.includes(fieldTag)) {
                            updateElement(element.id, {
                              content: currentContent.split(fieldTag).join(""),
                            });
                          } else {
                            const prefix = currentContent && !currentContent.match(/\s$/) ? "\n" : "";
                            updateElement(element.id, {
                              content: currentContent + prefix + fieldTag,
                            });
                          }
                        }}
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span>{header}</span>
                          {usedFields.has(header) && (
                            <Check className="h-3 w-3 text-primary opacity-100" />
                          )}
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <Textarea
              value={element.content || ""}
              onChange={(e) => updateElement(element.id, { content: e.target.value })}
              placeholder={isDataField ? "Select a column above..." : "Enter text..."}
              disabled={isDataField}
              className={`font-mono text-sm min-h-[100px] ${isDataField ? "opacity-70 bg-muted cursor-not-allowed" : ""}`}
            />
            {isDataField && (
              <p className="text-[10px] text-muted-foreground italic">
                Content is locked to the bound column. Use "Text" element for custom mixing.
              </p>
            )}
          </div>

          {/* Font Family */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Font Family</Label>
            <Select
              value={element.textStyle?.fontFamily || "Inter"}
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

          {/* Size and Weight */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Size</Label>
              <Input
                type="number"
                value={element.textStyle?.fontSize || 16}
                onChange={(e) => handleTextStyleChange("fontSize", Number(e.target.value))}
                min={8}
                max={200}
                data-testid="input-font-size"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Weight</Label>
              <Select
                value={String(element.textStyle?.fontWeight || 400)}
                onValueChange={(value) => handleTextStyleChange("fontWeight", Number(value))}
              >
                <SelectTrigger data-testid="select-weight">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="400">Regular</SelectItem>
                  <SelectItem value="700">Bold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={element.textStyle?.color || "#000000"}
                onChange={(e) => handleTextStyleChange("color", e.target.value)}
                className="w-12 h-9 p-1 cursor-pointer"
                data-testid="input-text-color"
              />
              <Input
                type="text"
                value={element.textStyle?.color || "#000000"}
                onChange={(e) => handleTextStyleChange("color", e.target.value)}
                className="flex-1 font-mono text-sm"
              />
            </div>
          </div>

          {/* Horizontal Alignment */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Horizontal Alignment</Label>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant={element.textStyle?.textAlign === "left" ? "default" : "outline"}
                onClick={() => handleTextStyleChange("textAlign", "left")}
                data-testid="btn-text-align-left"
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={element.textStyle?.textAlign === "center" ? "default" : "outline"}
                onClick={() => handleTextStyleChange("textAlign", "center")}
                data-testid="btn-text-align-center"
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={element.textStyle?.textAlign === "right" ? "default" : "outline"}
                onClick={() => handleTextStyleChange("textAlign", "right")}
                data-testid="btn-text-align-right"
              >
                <AlignRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Vertical Alignment */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Vertical Alignment</Label>
            <div className="flex gap-1">
              <Button
                size="icon"
                variant={element.textStyle?.verticalAlign === "top" ? "default" : "outline"}
                onClick={() => handleTextStyleChange("verticalAlign", "top")}
                data-testid="btn-text-vertical-top"
              >
                <AlignVerticalJustifyStart className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={element.textStyle?.verticalAlign === "middle" ? "default" : "outline"}
                onClick={() => handleTextStyleChange("verticalAlign", "middle")}
                data-testid="btn-text-vertical-middle"
              >
                <AlignVerticalJustifyCenter className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={element.textStyle?.verticalAlign === "bottom" ? "default" : "outline"}
                onClick={() => handleTextStyleChange("verticalAlign", "bottom")}
                data-testid="btn-text-vertical-bottom"
              >
                <AlignVerticalJustifyEnd className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Line Height */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Line Height: {element.textStyle?.lineHeight || 1.5}
            </Label>
            <Slider
              value={[element.textStyle?.lineHeight || 1.5]}
              onValueChange={([value]) => handleTextStyleChange("lineHeight", value)}
              min={0.8}
              max={2.5}
              step={0.1}
              data-testid="slider-line-height"
            />
          </div>
        </div>

        <Separator className="my-4" />

        {/* Data Formatting Section */}
        <div>
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            Data Formatting
            <Tooltip>
              <TooltipTrigger>
                <div className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full border">?</div>
              </TooltipTrigger>
              <TooltipContent>Apply logic to transform your data automatically</TooltipContent>
            </Tooltip>
          </h3>

          <div className="space-y-4">
            {/* Data Type */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Treat Data As</Label>
              <Select
                value={element.format?.dataType || "text"}
                onValueChange={(value) => handleFormatChange("dataType", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">
                    <div className="flex items-center gap-2">
                      <Type className="w-3 h-3" /> Text
                    </div>
                  </SelectItem>
                  <SelectItem value="number">
                    <div className="flex items-center gap-2">
                      <Hash className="w-3 h-3" /> Number
                    </div>
                  </SelectItem>
                  <SelectItem value="date">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" /> Date
                    </div>
                  </SelectItem>
                  <SelectItem value="boolean">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="w-3 h-3" /> Boolean (True/False)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Text formatting options */}
            {(element.format?.dataType === "text" || !element.format?.dataType) && (
              <div className="space-y-3 p-3 bg-muted/30 rounded-md border">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Casing</Label>
                  <Select
                    value={element.format?.casing || "none"}
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
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">List Style</Label>
                  <Select
                    value={element.format?.listStyle || "none"}
                    onValueChange={(value) => handleFormatChange("listStyle", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No List</SelectItem>
                      <SelectItem value="disc">Bullets (•)</SelectItem>
                      <SelectItem value="circle">Hollow Bullets (○)</SelectItem>
                      <SelectItem value="square">Square Bullets (■)</SelectItem>
                      <SelectItem value="decimal">Numbered List (1, 2, 3)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Number formatting options */}
            {element.format?.dataType === "number" && (
              <div className="space-y-3 p-3 bg-muted/30 rounded-md border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Display as Fraction</Label>
                  <Switch
                    checked={element.format?.useFractions || false}
                    onCheckedChange={(checked) => handleFormatChange("useFractions", checked)}
                  />
                </div>
                {element.format?.useFractions ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Precision (Rounding)</Label>
                    <Select
                      value={String(element.format?.fractionPrecision || 16)}
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
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Decimal Places</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={element.format?.decimalPlaces ?? 2}
                      onChange={(e) => handleFormatChange("decimalPlaces", Number(e.target.value))}
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Append Unit</Label>
                  <Select
                    value={element.format?.unit || "none"}
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

            {/* Date formatting options */}
            {element.format?.dataType === "date" && (
              <div className="space-y-3 p-3 bg-muted/30 rounded-md border">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Output Format</Label>
                  <Select
                    value={element.format?.dateFormat || "MM/DD/YYYY"}
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

            {/* Boolean formatting options */}
            {element.format?.dataType === "boolean" && (
              <div className="space-y-3 p-3 bg-muted/30 rounded-md border">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground text-green-600">If TRUE (1)</Label>
                    <Input
                      placeholder="Included"
                      value={element.format?.trueLabel || ""}
                      onChange={(e) => handleFormatChange("trueLabel", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground text-red-500">If FALSE (0)</Label>
                    <Input
                      placeholder="-"
                      value={element.format?.falseLabel || ""}
                      onChange={(e) => handleFormatChange("falseLabel", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
