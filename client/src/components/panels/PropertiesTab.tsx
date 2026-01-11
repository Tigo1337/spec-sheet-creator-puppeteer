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
import { loadFont } from "@/lib/font-loader";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@clerk/clerk-react";
import { nanoid } from "nanoid";
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
  Link,
  Unlink,
  Columns,
  Loader2,
  Activity,
  Database,
  Image as ImageIcon,
  ExternalLink,
  Table as TableIcon,
} from "lucide-react";
import {
  availableFonts,
  openSourceFontMap,
  type CanvasElement,
  type TextStyle,
} from "@shared/schema";

export function PropertiesTab() {
  const [imageLoadingId, setImageLoadingId] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [applyFontToAll, setApplyFontToAll] = useState(false); // NEW LOCAL STATE
  const { toast } = useToast();
  const { getToken } = useAuth();

  const {
    elements,
    selectedElementIds,
    updateElement,
    updateAllTextFonts, // NEW STORE ACTION
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

  const handleImageUrlChange = async (elementId: string, url: string) => {
    updateElement(elementId, { imageSrc: url });

    // Only try to load dimensions if it looks like a real URL (not a variable)
    if (
      url &&
      !url.includes("{{") &&
      (url.startsWith("http") || url.startsWith("data:"))
    ) {
      setImageLoadingId(elementId);
      const dimensions = await getImageDimensions(url);
      if (dimensions) {
        const maxWidth = 300;
        let width = maxWidth;
        let height = Math.round(
          (maxWidth / dimensions.width) * dimensions.height,
        );

        const maxHeight = 300;
        if (height > maxHeight) {
          height = maxHeight;
          width = Math.round(
            (maxHeight / dimensions.height) * dimensions.width,
          );
        }

        updateElement(elementId, {
          dimension: { width, height },
          aspectRatio: width / height,
          aspectRatioLocked: true,
        });
      }
      setImageLoadingId(null);
    }
  };

  const selectedElement =
    selectedElementIds.length === 1
      ? elements.find((el) => el.id === selectedElementIds[0])
      : null;

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
        body: JSON.stringify({
          destinationUrl: selectedElement.content,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create link");
      }

      const data = await response.json();

      const baseUrl =
        import.meta.env.VITE_APP_BASE_URL || window.location.origin;
      const shortUrl = `${baseUrl}/q/${data.id}`;

      updateElement(selectedElement.id, { content: shortUrl });
      toast({ title: "Success", description: "QR Code is now trackable!" });
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Could not generate link",
      });
    } finally {
      setIsGeneratingLink(false);
    }
  };

  // --- Helper to Calculate Autofit Widths for Display ---
  const getAutofitWidth = (colId: string): number | null => {
    if (
      !selectedElement ||
      selectedElement.type !== "table" ||
      !selectedElement.tableSettings?.autoFitColumns
    ) {
      return null;
    }

    const tableSettings = selectedElement.tableSettings;
    const previewRows = [
      { Name: "Product A", Description: "Sample Item", Price: "$10.00" },
      { Name: "Product B", Description: "Sample Item", Price: "$20.00" },
      { Name: "Product C", Description: "Sample Item", Price: "$30.00" },
    ];

    let displayRows = previewRows;

    if (excelData && excelData.rows.length > 0) {
      if (tableSettings.groupByField && selectedRowIndex !== undefined) {
        // Grouping Logic
        const currentRow = excelData.rows[selectedRowIndex];
        const groupValue = currentRow[tableSettings.groupByField];

        if (groupValue) {
          displayRows = excelData.rows.filter(
            (r) => r[tableSettings.groupByField!] === groupValue,
          );
        } else {
          displayRows = [currentRow];
        }
      } else {
        displayRows = excelData.rows.slice(0, 5);
      }
    }

    // Calculate weights
    const colWeights = tableSettings.columns.map((col) => {
      const headerLen = (col.header || "").length;
      const maxContentLen = displayRows.reduce((max, row) => {
        const cellValue = row[col.dataField || ""] || "";
        return Math.max(max, String(cellValue).length);
      }, 0);
      return {
        id: col.id,
        weight: Math.max(headerLen, maxContentLen, 3),
      };
    });

    const totalWeight = colWeights.reduce((sum, c) => sum + c.weight, 0);
    const targetCol = colWeights.find((c) => c.id === colId);

    if (!targetCol || totalWeight === 0) return 0;

    return Math.round(
      (targetCol.weight / totalWeight) * selectedElement.dimension.width,
    );
  };

  if (!selectedElement) {
    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <div>
            <h3 className="font-medium text-sm mb-3">Canvas Settings</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Background Color
                </Label>
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

  // --- Handlers for Text ---
  const handleTextStyleChange = async (
    key: keyof NonNullable<CanvasElement["textStyle"]>,
    value: string | number,
  ) => {
    if (key === "fontFamily" && typeof value === "string") {
      await loadFont(value);

      // CHECK IF BULK APPLY IS ACTIVE
      if (applyFontToAll) {
        updateAllTextFonts(value);
        return;
      }
    }

    updateElement(selectedElement.id, {
      textStyle: {
        ...selectedElement.textStyle,
        [key]: value,
      },
    });
  };

  // --- NEW: Handlers for Table Styles ---
  const handleTableStyleChange = async (
    section: "headerStyle" | "rowStyle",
    key: keyof TextStyle,
    value: any,
  ) => {
    if (!selectedElement.tableSettings) return;

    if (key === "fontFamily" && typeof value === "string") {
      await loadFont(value);
    }

    updateElement(selectedElement.id, {
      tableSettings: {
        ...selectedElement.tableSettings,
        [section]: {
          ...selectedElement.tableSettings[section],
          [key]: value,
        },
      },
    });
  };

  const handleTocSettingChange = async (
    section: "titleStyle" | "chapterStyle",
    key: keyof NonNullable<CanvasElement["textStyle"]>,
    value: string | number,
  ) => {
    if (!selectedElement.tocSettings) return;

    if (key === "fontFamily" && typeof value === "string") {
      await loadFont(value);
    }

    updateElement(selectedElement.id, {
      tocSettings: {
        ...selectedElement.tocSettings,
        [section]: {
          ...selectedElement.tocSettings[section],
          [key]: value,
        },
      },
    });
  };

  const handleShapeStyleChange = (
    key: keyof NonNullable<CanvasElement["shapeStyle"]>,
    value: string | number,
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

  const getUsedFields = (content: string | undefined) => {
    if (!content) return new Set<string>();
    const matches = content.matchAll(/{{(.*?)}}/g);
    const fields = new Set<string>();
    for (const match of matches) {
      fields.add(match[1]);
    }
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

          {/* Layer Controls */}
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
          <h3 className="font-medium text-sm mb-3 flex items-center justify-between">
            Position & Size
            {selectedElement.type === "image" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={
                      selectedElement.aspectRatioLocked ? "default" : "ghost"
                    }
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
                  {selectedElement.aspectRatioLocked
                    ? "Unlock Aspect Ratio"
                    : "Lock Aspect Ratio"}
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
                  resizeElement(
                    selectedElement.id,
                    Number(e.target.value),
                    selectedElement.dimension.height,
                  );
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
                  resizeElement(
                    selectedElement.id,
                    selectedElement.dimension.width,
                    Number(e.target.value),
                  );
                }}
                data-testid="input-height"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* --- TABLE CONFIGURATION --- */}
        {selectedElement.type === "table" && selectedElement.tableSettings && (
          <div className="space-y-6">
            {/* 1. Grouping Configuration */}
            <div>
              <h3 className="font-medium text-sm mb-3 flex items-center gap-2 text-primary">
                <Database className="h-4 w-4" />
                Data Grouping
              </h3>
              <div className="space-y-4 p-3 bg-primary/5 rounded-md border border-primary/20">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Group Products By
                  </Label>
                  <Select
                    value={selectedElement.tableSettings.groupByField || "none"}
                    onValueChange={(val) =>
                      updateElement(selectedElement.id, {
                        tableSettings: {
                          ...selectedElement.tableSettings!,
                          groupByField: val === "none" ? undefined : val,
                        },
                      })
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="None (Show all)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Single/All)</SelectItem>
                      {excelData?.headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* BLOCK START: DYNAMIC HEIGHT ADAPTATION TOGGLE */}
                <div className="flex items-center justify-between border-t pt-3">
                  <div className="space-y-0.5">
                    <Label className="text-[10px] text-primary font-bold uppercase tracking-wider">
                      Dynamic Height Adaptation
                    </Label>
                    <p className="text-[9px] text-muted-foreground">
                      Auto-adjust height & push content
                    </p>
                  </div>
                  <Switch
                    checked={
                      selectedElement.tableSettings.autoHeightAdaptation ||
                      false
                    }
                    onCheckedChange={(checked) =>
                      updateElement(selectedElement.id, {
                        tableSettings: {
                          ...selectedElement.tableSettings!,
                          autoHeightAdaptation: checked,
                        },
                      })
                    }
                    className="scale-75"
                  />
                </div>
                {/* BLOCK END: DYNAMIC HEIGHT ADAPTATION TOGGLE */}
              </div>
            </div>

            <Separator />

            {/* 2. Column Manager */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <TableIcon className="h-4 w-4" /> Columns
                </h3>
                {/* Autofit Toggle */}
                <div className="flex items-center gap-2">
                  <Label className="text-[10px] text-muted-foreground">
                    Autofit
                  </Label>
                  <Switch
                    checked={
                      selectedElement.tableSettings.autoFitColumns || false
                    }
                    onCheckedChange={(checked) =>
                      updateElement(selectedElement.id, {
                        tableSettings: {
                          ...selectedElement.tableSettings!,
                          autoFitColumns: checked,
                        },
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-3">
                {selectedElement.tableSettings.columns.map((col: any, idx) => (
                  <div
                    key={col.id}
                    className="flex flex-col gap-2 p-3 bg-muted/20 rounded border"
                  >
                    <div className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Input
                          value={col.header}
                          onChange={(e) => {
                            const newCols = [
                              ...selectedElement.tableSettings!.columns,
                            ];
                            newCols[idx].header = e.target.value;
                            updateElement(selectedElement.id, {
                              tableSettings: {
                                ...selectedElement.tableSettings!,
                                columns: newCols,
                              },
                            });
                          }}
                          className="h-7 text-xs"
                          placeholder="Header"
                        />
                        <Select
                          value={col.dataField}
                          onValueChange={(val) => {
                            const newCols = [
                              ...selectedElement.tableSettings!.columns,
                            ];
                            newCols[idx].dataField = val;
                            updateElement(selectedElement.id, {
                              tableSettings: {
                                ...selectedElement.tableSettings!,
                                columns: newCols,
                              },
                            });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs bg-white">
                            <SelectValue placeholder="Bind Field" />
                          </SelectTrigger>
                          <SelectContent>
                            {excelData?.headers.map((h) => (
                              <SelectItem key={h} value={h}>
                                {h}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="w-20 flex-none space-y-1">
                        <Label className="text-[10px] text-muted-foreground block text-center">
                          Width
                        </Label>
                        <Input
                          type="number"
                          value={
                            selectedElement.tableSettings?.autoFitColumns
                              ? getAutofitWidth(col.id) || col.width
                              : col.width
                          }
                          onChange={(e) => {
                            const newCols = [
                              ...selectedElement.tableSettings!.columns,
                            ];
                            newCols[idx].width = Number(e.target.value);
                            updateElement(selectedElement.id, {
                              tableSettings: {
                                ...selectedElement.tableSettings!,
                                columns: newCols,
                              },
                            });
                          }}
                          className="h-7 text-xs text-center"
                          disabled={
                            selectedElement.tableSettings.autoFitColumns
                          }
                        />
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10 flex-none"
                        onClick={() => {
                          const newCols =
                            selectedElement.tableSettings!.columns.filter(
                              (_, i) => i !== idx,
                            );
                          updateElement(selectedElement.id, {
                            tableSettings: {
                              ...selectedElement.tableSettings!,
                              columns: newCols,
                            },
                          });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          Header Align
                        </Label>
                        <div className="flex gap-0.5">
                          {["left", "center", "right"].map((alignValue) => (
                            <Button
                              key={alignValue}
                              size="sm"
                              variant={
                                (col.headerAlign || "left") === alignValue
                                  ? "default"
                                  : "outline"
                              }
                              className="flex-1 h-6 px-0"
                              onClick={() => {
                                const newCols = [
                                  ...selectedElement.tableSettings!.columns,
                                ];
                                newCols[idx].headerAlign = alignValue as any;
                                updateElement(selectedElement.id, {
                                  tableSettings: {
                                    ...selectedElement.tableSettings!,
                                    columns: newCols,
                                  },
                                });
                              }}
                            >
                              {alignValue === "left" && (
                                <AlignLeft className="h-3 w-3" />
                              )}
                              {alignValue === "center" && (
                                <AlignCenter className="h-3 w-3" />
                              )}
                              {alignValue === "right" && (
                                <AlignRight className="h-3 w-3" />
                              )}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">
                          Row Align
                        </Label>
                        <div className="flex gap-0.5">
                          {["left", "center", "right"].map((alignValue) => (
                            <Button
                              key={alignValue}
                              size="sm"
                              variant={
                                (col.rowAlign || "left") === alignValue
                                  ? "default"
                                  : "outline"
                              }
                              className="flex-1 h-6 px-0"
                              onClick={() => {
                                const newCols = [
                                  ...selectedElement.tableSettings!.columns,
                                ];
                                newCols[idx].rowAlign = alignValue as any;
                                updateElement(selectedElement.id, {
                                  tableSettings: {
                                    ...selectedElement.tableSettings!,
                                    columns: newCols,
                                  },
                                });
                              }}
                            >
                              {alignValue === "left" && (
                                <AlignLeft className="h-3 w-3" />
                              )}
                              {alignValue === "center" && (
                                <AlignCenter className="h-3 w-3" />
                              )}
                              {alignValue === "right" && (
                                <AlignRight className="h-3 w-3" />
                              )}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs gap-2"
                  onClick={() => {
                    const newCols = [
                      ...selectedElement.tableSettings!.columns,
                      {
                        id: nanoid(),
                        header: "New Col",
                        width: 100,
                        headerAlign: "left",
                        rowAlign: "left",
                      },
                    ];
                    updateElement(selectedElement.id, {
                      tableSettings: {
                        ...selectedElement.tableSettings!,
                        columns: newCols,
                      },
                    });
                  }}
                >
                  + Add Column
                </Button>
              </div>
            </div>

            <Separator />

            {/* 3. Style Configuration */}
            <div>
              <h3 className="font-medium text-sm mb-3">Table Design</h3>
              <div className="space-y-4">
                <div className="space-y-2 p-3 bg-muted/20 rounded border">
                  <Label className="text-xs font-semibold">Header Row</Label>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Font
                    </Label>
                    <Select
                      value={
                        selectedElement.tableSettings.headerStyle?.fontFamily ||
                        "Inter"
                      }
                      onValueChange={(val) =>
                        handleTableStyleChange("headerStyle", "fontFamily", val)
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFonts.map((font) => (
                          <SelectItem
                            key={font}
                            value={font}
                            style={{ fontFamily: font }}
                          >
                            {font}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Size
                      </Label>
                      <Input
                        type="number"
                        className="h-7 text-xs"
                        value={
                          selectedElement.tableSettings.headerStyle?.fontSize
                        }
                        onChange={(e) =>
                          handleTableStyleChange(
                            "headerStyle",
                            "fontSize",
                            Number(e.target.value),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Weight
                      </Label>
                      <Select
                        value={String(
                          selectedElement.tableSettings.headerStyle
                            ?.fontWeight || 700,
                        )}
                        onValueChange={(val) =>
                          handleTableStyleChange(
                            "headerStyle",
                            "fontWeight",
                            Number(val),
                          )
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
                    <Label className="text-xs text-muted-foreground">
                      Default Alignment
                    </Label>
                    <div className="flex gap-1">
                      {["left", "center", "right"].map((align) => (
                        <Button
                          key={align}
                          size="sm"
                          variant={
                            selectedElement.tableSettings?.headerStyle
                              ?.textAlign === align
                              ? "default"
                              : "outline"
                          }
                          onClick={() =>
                            handleTableStyleChange(
                              "headerStyle",
                              "textAlign",
                              align,
                            )
                          }
                          className="flex-1 h-6 text-xs capitalize"
                        >
                          {align === "left" && (
                            <AlignLeft className="h-3 w-3" />
                          )}
                          {align === "center" && (
                            <AlignCenter className="h-3 w-3" />
                          )}
                          {align === "right" && (
                            <AlignRight className="h-3 w-3" />
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Separator className="my-2" />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Bg Color
                      </Label>
                      <div className="flex gap-1">
                        <Input
                          type="color"
                          className="w-6 h-6 p-0"
                          value={
                            selectedElement.tableSettings.headerBackgroundColor
                          }
                          onChange={(e) =>
                            updateElement(selectedElement.id, {
                              tableSettings: {
                                ...selectedElement.tableSettings!,
                                headerBackgroundColor: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Text Color
                      </Label>
                      <div className="flex gap-1">
                        <Input
                          type="color"
                          className="w-6 h-6 p-0"
                          value={
                            selectedElement.tableSettings.headerStyle?.color
                          }
                          onChange={(e) =>
                            handleTableStyleChange(
                              "headerStyle",
                              "color",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 p-3 bg-muted/20 rounded border">
                  <Label className="text-xs font-semibold">Body Rows</Label>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Font
                    </Label>
                    <Select
                      value={
                        selectedElement.tableSettings.rowStyle?.fontFamily ||
                        "Inter"
                      }
                      onValueChange={(val) =>
                        handleTableStyleChange("rowStyle", "fontFamily", val)
                      }
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFonts.map((font) => (
                          <SelectItem
                            key={font}
                            value={font}
                            style={{ fontFamily: font }}
                          >
                            {font}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Size
                      </Label>
                      <Input
                        type="number"
                        className="h-7 text-xs"
                        value={selectedElement.tableSettings.rowStyle?.fontSize}
                        onChange={(e) =>
                          handleTableStyleChange(
                            "rowStyle",
                            "fontSize",
                            Number(e.target.value),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Weight
                      </Label>
                      <Select
                        value={String(
                          selectedElement.tableSettings.rowStyle?.fontWeight ||
                            400,
                        )}
                        onValueChange={(val) =>
                          handleTableStyleChange(
                            "rowStyle",
                            "fontWeight",
                            Number(val),
                          )
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="400">Regular</SelectItem>
                          <SelectItem value="500">Medium</SelectItem>
                          <SelectItem value="700">Bold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Default Alignment
                    </Label>
                    <div className="flex gap-1">
                      {["left", "center", "right"].map((align) => (
                        <Button
                          key={align}
                          size="sm"
                          variant={
                            selectedElement.tableSettings?.rowStyle
                              ?.textAlign === align
                              ? "default"
                              : "outline"
                          }
                          onClick={() =>
                            handleTableStyleChange(
                              "rowStyle",
                              "textAlign",
                              align,
                            )
                          }
                          className="flex-1 h-6 text-xs capitalize"
                        >
                          {align === "left" && (
                            <AlignLeft className="h-3 w-3" />
                          )}
                          {align === "center" && (
                            <AlignCenter className="h-3 w-3" />
                          )}
                          {align === "right" && (
                            <AlignRight className="h-3 w-3" />
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Separator className="my-2" />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Bg Color
                      </Label>
                      <div className="flex gap-1">
                        <Input
                          type="color"
                          className="w-6 h-6 p-0"
                          value={
                            selectedElement.tableSettings.rowBackgroundColor
                          }
                          onChange={(e) =>
                            updateElement(selectedElement.id, {
                              tableSettings: {
                                ...selectedElement.tableSettings!,
                                rowBackgroundColor: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Alt. Bg Color
                      </Label>
                      <div className="flex gap-1">
                        <Input
                          type="color"
                          className="w-6 h-6 p-0"
                          value={
                            selectedElement.tableSettings.alternateRowColor ||
                            "#ffffff"
                          }
                          onChange={(e) =>
                            updateElement(selectedElement.id, {
                              tableSettings: {
                                ...selectedElement.tableSettings!,
                                alternateRowColor: e.target.value,
                              },
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-2">
                    <Label className="text-[10px] text-muted-foreground">
                      Text Color
                    </Label>
                    <div className="flex gap-1">
                      <Input
                        type="color"
                        className="w-6 h-6 p-0"
                        value={selectedElement.tableSettings.rowStyle?.color}
                        onChange={(e) =>
                          handleTableStyleChange(
                            "rowStyle",
                            "color",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 p-3 bg-muted/20 rounded border">
                  <Label className="text-xs font-semibold">Borders</Label>
                  <div className="grid grid-cols-2 gap-2 items-center">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Color
                      </Label>
                      <Input
                        type="color"
                        className="w-6 h-6 p-0"
                        value={selectedElement.tableSettings.borderColor}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            tableSettings: {
                              ...selectedElement.tableSettings!,
                              borderColor: e.target.value,
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">
                        Width
                      </Label>
                      <Input
                        type="number"
                        className="h-6 text-xs"
                        value={selectedElement.tableSettings.borderWidth}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            tableSettings: {
                              ...selectedElement.tableSettings!,
                              borderWidth: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TOC ADVANCED SETTINGS --- */}
        {selectedElement.type === "toc-list" && selectedElement.tocSettings && (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-sm mb-3 text-primary">
                Data Configuration
              </h3>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Product Label Field
                  </Label>
                  <Select
                    value={selectedElement.dataBinding || ""}
                    onValueChange={(value) =>
                      updateElement(selectedElement.id, { dataBinding: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Data Field" />
                    </SelectTrigger>
                    <SelectContent>
                      {excelData?.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Group by Chapter (Optional)
                  </Label>
                  <Select
                    value={selectedElement.tocSettings.groupByField || "none"}
                    onValueChange={(value) =>
                      updateElement(selectedElement.id, {
                        tocSettings: {
                          ...selectedElement.tocSettings!,
                          groupByField: value === "none" ? undefined : value,
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No Grouping" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Grouping</SelectItem>
                      {excelData?.headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-sm text-primary">
                  Layout Settings
                </h3>
                <Switch
                  checked={selectedElement.tocSettings.showTitle}
                  onCheckedChange={(c) =>
                    updateElement(selectedElement.id, {
                      tocSettings: {
                        ...selectedElement.tocSettings!,
                        showTitle: c,
                      },
                    })
                  }
                />
              </div>
              <div className="space-y-3 p-3 bg-muted/20 rounded-md border">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-2">
                    <Columns className="h-3 w-3" />
                    Columns
                  </Label>
                  <div className="flex gap-1">
                    <Button
                      variant={
                        selectedElement.tocSettings.columnCount === 1
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={() =>
                        updateElement(selectedElement.id, {
                          tocSettings: {
                            ...selectedElement.tocSettings!,
                            columnCount: 1,
                          },
                        })
                      }
                    >
                      1 Column
                    </Button>
                    <Button
                      variant={
                        selectedElement.tocSettings.columnCount === 2
                          ? "default"
                          : "outline"
                      }
                      size="sm"
                      className="flex-1 h-7 text-xs"
                      onClick={() =>
                        updateElement(selectedElement.id, {
                          tocSettings: {
                            ...selectedElement.tocSettings!,
                            columnCount: 2,
                          },
                        })
                      }
                    >
                      2 Columns
                    </Button>
                  </div>
                </div>

                {selectedElement.tocSettings.showTitle && (
                  <>
                    <Separator className="my-2" />
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Title Text
                      </Label>
                      <Input
                        value={selectedElement.tocSettings.title}
                        onChange={(e) =>
                          updateElement(selectedElement.id, {
                            tocSettings: {
                              ...selectedElement.tocSettings!,
                              title: e.target.value,
                            },
                          })
                        }
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Title Font
                      </Label>
                      <Select
                        value={
                          selectedElement.tocSettings.titleStyle?.fontFamily ||
                          "Inter"
                        }
                        onValueChange={(value) =>
                          handleTocSettingChange(
                            "titleStyle",
                            "fontFamily",
                            value,
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {availableFonts.map((font) => (
                            <SelectItem
                              key={font}
                              value={font}
                              style={{ fontFamily: font }}
                            >
                              {font}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Title Size
                        </Label>
                        <Input
                          type="number"
                          value={
                            selectedElement.tocSettings.titleStyle?.fontSize
                          }
                          onChange={(e) =>
                            handleTocSettingChange(
                              "titleStyle",
                              "fontSize",
                              Number(e.target.value),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Weight
                        </Label>
                        <Select
                          value={String(
                            selectedElement.tocSettings.titleStyle
                              ?.fontWeight || 700,
                          )}
                          onValueChange={(value) =>
                            handleTocSettingChange(
                              "titleStyle",
                              "fontWeight",
                              Number(value),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="400">Regular</SelectItem>
                            <SelectItem value="700">Bold</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Line Height:{" "}
                        {selectedElement.tocSettings.titleStyle?.lineHeight ||
                          1.2}
                      </Label>
                      <Slider
                        value={[
                          selectedElement.tocSettings.titleStyle?.lineHeight ||
                            1.2,
                        ]}
                        onValueChange={([value]) =>
                          handleTocSettingChange(
                            "titleStyle",
                            "lineHeight",
                            value,
                          )
                        }
                        min={0.8}
                        max={2.5}
                        step={0.1}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Alignment
                      </Label>
                      <div className="flex gap-1">
                        {["left", "center", "right"].map((align) => (
                          <Button
                            key={align}
                            size="sm"
                            variant={
                              selectedElement.tocSettings!.titleStyle
                                ?.textAlign === align
                                ? "default"
                                : "outline"
                            }
                            onClick={() =>
                              handleTocSettingChange(
                                "titleStyle",
                                "textAlign",
                                align,
                              )
                            }
                            className="flex-1 h-7 text-xs capitalize"
                          >
                            {align}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Separator />

            {selectedElement.tocSettings.groupByField && (
              <div>
                <h3 className="font-medium text-sm mb-3 text-primary">
                  Chapter Style
                </h3>
                <div className="space-y-3 p-3 bg-muted/20 rounded-md border">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground font-medium text-primary">
                      Enable Chapter Covers
                    </Label>
                    <Switch
                      checked={selectedElement.tocSettings.chapterCoversEnabled}
                      onCheckedChange={(c) =>
                        updateElement(selectedElement.id, {
                          tocSettings: {
                            ...selectedElement.tocSettings!,
                            chapterCoversEnabled: c,
                          },
                        })
                      }
                    />
                  </div>
                  <Separator className="my-2" />

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Font Family
                    </Label>
                    <Select
                      value={
                        selectedElement.tocSettings.chapterStyle?.fontFamily ||
                        "Inter"
                      }
                      onValueChange={(value) =>
                        handleTocSettingChange(
                          "chapterStyle",
                          "fontFamily",
                          value,
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFonts.map((font) => (
                          <SelectItem
                            key={font}
                            value={font}
                            style={{ fontFamily: font }}
                          >
                            {font}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Font Size
                      </Label>
                      <Input
                        type="number"
                        value={
                          selectedElement.tocSettings.chapterStyle?.fontSize
                        }
                        onChange={(e) =>
                          handleTocSettingChange(
                            "chapterStyle",
                            "fontSize",
                            Number(e.target.value),
                          )
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Weight
                      </Label>
                      <Select
                        value={String(
                          selectedElement.tocSettings.chapterStyle
                            ?.fontWeight || 600,
                        )}
                        onValueChange={(value) =>
                          handleTocSettingChange(
                            "chapterStyle",
                            "fontWeight",
                            Number(value),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="400">Regular</SelectItem>
                          <SelectItem value="700">Bold</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Line Height:{" "}
                      {selectedElement.tocSettings.chapterStyle?.lineHeight ||
                        1.1}
                    </Label>
                    <Slider
                      value={[
                        selectedElement.tocSettings.chapterStyle?.lineHeight ||
                          1.1,
                      ]}
                      onValueChange={([value]) =>
                        handleTocSettingChange(
                          "chapterStyle",
                          "lineHeight",
                          value,
                        )
                      }
                      min={0.8}
                      max={2.5}
                      step={0.1}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Color
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        className="w-8 h-8 p-0"
                        value={selectedElement.tocSettings.chapterStyle?.color}
                        onChange={(e) =>
                          handleTocSettingChange(
                            "chapterStyle",
                            "color",
                            e.target.value,
                          )
                        }
                      />
                      <Input
                        type="text"
                        className="h-8"
                        value={selectedElement.tocSettings.chapterStyle?.color}
                        onChange={(e) =>
                          handleTocSettingChange(
                            "chapterStyle",
                            "color",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            <div>
              <h3 className="font-medium text-sm mb-3 text-primary">
                Item Row Style
              </h3>
              <div className="space-y-3 p-3 bg-muted/20 rounded-md border">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Font</Label>
                  <Select
                    value={selectedElement.textStyle?.fontFamily || "Inter"}
                    onValueChange={(value) =>
                      handleTextStyleChange("fontFamily", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFonts.map((font) => (
                        <SelectItem
                          key={font}
                          value={font}
                          style={{ fontFamily: font }}
                        >
                          {font}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Size
                    </Label>
                    <Input
                      type="number"
                      value={selectedElement.textStyle?.fontSize}
                      onChange={(e) =>
                        handleTextStyleChange(
                          "fontSize",
                          Number(e.target.value),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Weight
                    </Label>
                    <Select
                      value={String(
                        selectedElement.textStyle?.fontWeight || 400,
                      )}
                      onValueChange={(value) =>
                        handleTextStyleChange("fontWeight", Number(value))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="400">Regular</SelectItem>
                        <SelectItem value="700">Bold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Line Height: {selectedElement.textStyle?.lineHeight || 1.5}
                  </Label>
                  <Slider
                    value={[selectedElement.textStyle?.lineHeight || 1.5]}
                    onValueChange={([value]) =>
                      handleTextStyleChange("lineHeight", value)
                    }
                    min={0.8}
                    max={2.5}
                    step={0.1}
                    data-testid="slider-line-height"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Color</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      className="w-8 h-8 p-0"
                      value={selectedElement.textStyle?.color}
                      onChange={(e) =>
                        handleTextStyleChange("color", e.target.value)
                      }
                    />
                    <Input
                      type="text"
                      className="h-8"
                      value={selectedElement.textStyle?.color}
                      onChange={(e) =>
                        handleTextStyleChange("color", e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* QR Code Settings */}
        {selectedElement.type === "qrcode" && (
          <div>
            <h3 className="font-medium text-sm mb-3">QR Code Settings</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-muted-foreground">
                    Content / URL
                  </Label>
                  {excelData && excelData.headers.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-auto py-1 px-2 text-xs w-auto border-none shadow-none bg-muted/50 hover:bg-muted text-primary whitespace-nowrap"
                        >
                          <span className="flex items-center gap-1">
                            Insert Field
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="max-h-[300px] overflow-y-auto"
                      >
                        {excelData.headers.map((header) => (
                          <DropdownMenuItem
                            key={header}
                            onSelect={(e) => {
                              const currentContent =
                                selectedElement.content || "";
                              const fieldTag = `{{${header}}}`;
                              updateElement(selectedElement.id, {
                                content: currentContent + fieldTag,
                              });
                            }}
                          >
                            {" "}
                            <div className="flex items-center justify-between w-full gap-2">
                              {" "}
                              <span>{header}</span>{" "}
                            </div>{" "}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <Textarea
                  value={selectedElement.content || ""}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      content: e.target.value,
                    })
                  }
                  placeholder="https://example.com"
                  className="font-mono text-sm min-h-[80px]"
                />
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 text-xs border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10"
                    onClick={handleGenerateShortLink}
                    disabled={isGeneratingLink || !selectedElement.content}
                  >
                    {isGeneratingLink ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Link className="h-3 w-3" />
                    )}
                    Convert to Dynamic URL
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  <strong>Dynamic URL:</strong> Allows you to edit the
                  destination link later.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={selectedElement.textStyle?.color || "#000000"}
                    onChange={(e) =>
                      handleTextStyleChange("color", e.target.value)
                    }
                    className="w-12 h-9 p-1 cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={selectedElement.textStyle?.color || "#000000"}
                    onChange={(e) =>
                      handleTextStyleChange("color", e.target.value)
                    }
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedElement.type === "dataField" && (
          <div className="space-y-4">
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 text-primary" />
                <h3 className="font-medium text-sm text-primary">
                  Data Binding
                </h3>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Connected Column
                </Label>
                <Select
                  value={selectedElement.dataBinding || ""}
                  onValueChange={(value) => {
                    updateElement(selectedElement.id, {
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

        {(selectedElement.type === "text" ||
          selectedElement.type === "dataField") && (
          <div>
            <h3 className="font-medium text-sm mb-3">Text Style</h3>
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
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-muted-foreground">
                    Content
                  </Label>
                  {selectedElement.type === "text" &&
                    excelData &&
                    excelData.headers.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-auto py-1 px-2 text-xs w-auto border-none shadow-none bg-muted/50 hover:bg-muted text-primary whitespace-nowrap"
                          >
                            <span className="flex items-center gap-1">
                              Insert Field
                            </span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="max-h-[300px] overflow-y-auto"
                        >
                          {excelData.headers.map((header) => (
                            <DropdownMenuItem
                              key={header}
                              onSelect={(e) => {
                                e.preventDefault();
                                const currentContent =
                                  selectedElement.content || "";
                                const fieldTag = `{{${header}}}`;
                                if (currentContent.includes(fieldTag)) {
                                  updateElement(selectedElement.id, {
                                    content: currentContent
                                      .split(fieldTag)
                                      .join(""),
                                  });
                                } else {
                                  const prefix =
                                    currentContent &&
                                    !currentContent.match(/\s$/)
                                      ? "\n"
                                      : "";
                                  updateElement(selectedElement.id, {
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
                  value={selectedElement.content || ""}
                  onChange={(e) =>
                    updateElement(selectedElement.id, {
                      content: e.target.value,
                    })
                  }
                  placeholder={
                    selectedElement.type === "dataField"
                      ? "Select a column above..."
                      : "Enter text..."
                  }
                  disabled={selectedElement.type === "dataField"}
                  className={`font-mono text-sm min-h-[100px] ${selectedElement.type === "dataField" ? "opacity-70 bg-muted cursor-not-allowed" : ""}`}
                />
                {selectedElement.type === "dataField" && (
                  <p className="text-[10px] text-muted-foreground italic">
                    Content is locked to the bound column. Use "Text" element
                    for custom mixing.
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Font Family
                </Label>
                <Select
                  value={selectedElement.textStyle?.fontFamily || "Inter"}
                  onValueChange={(value) =>
                    handleTextStyleChange("fontFamily", value)
                  }
                >
                  <SelectTrigger data-testid="select-font">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {availableFonts.map((font) => {
                      const replacement = openSourceFontMap[font];
                      return (
                        <SelectItem
                          key={font}
                          value={font}
                          style={{ fontFamily: font }}
                        >
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
                  <Label className="text-xs text-muted-foreground">
                    Weight
                  </Label>
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
                      <SelectItem value="400">Regular</SelectItem>
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
                    value={selectedElement.textStyle?.color || "#000000"}
                    onChange={(e) =>
                      handleTextStyleChange("color", e.target.value)
                    }
                    className="w-12 h-9 p-1 cursor-pointer"
                    data-testid="input-text-color"
                  />
                  <Input
                    type="text"
                    value={selectedElement.textStyle?.color || "#000000"}
                    onChange={(e) =>
                      handleTextStyleChange("color", e.target.value)
                    }
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Horizontal Alignment
                </Label>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant={
                      selectedElement.textStyle?.textAlign === "left"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => handleTextStyleChange("textAlign", "left")}
                    data-testid="btn-text-align-left"
                  >
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={
                      selectedElement.textStyle?.textAlign === "center"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => handleTextStyleChange("textAlign", "center")}
                    data-testid="btn-text-align-center"
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={
                      selectedElement.textStyle?.textAlign === "right"
                        ? "default"
                        : "outline"
                    }
                    onClick={() => handleTextStyleChange("textAlign", "right")}
                    data-testid="btn-text-align-right"
                  >
                    <AlignRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Vertical Alignment
                </Label>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant={
                      selectedElement.textStyle?.verticalAlign === "top"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      handleTextStyleChange("verticalAlign", "top")
                    }
                    data-testid="btn-text-vertical-top"
                  >
                    <AlignVerticalJustifyStart className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={
                      selectedElement.textStyle?.verticalAlign === "middle"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      handleTextStyleChange("verticalAlign", "middle")
                    }
                    data-testid="btn-text-vertical-middle"
                  >
                    <AlignVerticalJustifyCenter className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={
                      selectedElement.textStyle?.verticalAlign === "bottom"
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      handleTextStyleChange("verticalAlign", "bottom")
                    }
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
                  onValueChange={([value]) =>
                    handleTextStyleChange("lineHeight", value)
                  }
                  min={0.8}
                  max={2.5}
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
                  <TooltipTrigger>
                    <div className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full border">
                      ?
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Apply logic to transform your data automatically
                  </TooltipContent>
                </Tooltip>
              </h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Treat Data As
                  </Label>
                  <Select
                    value={selectedElement.format?.dataType || "text"}
                    onValueChange={(value) =>
                      handleFormatChange("dataType", value)
                    }
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
                          <CheckSquare className="w-3 h-3" /> Boolean
                          (True/False)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(selectedElement.format?.dataType === "text" ||
                  !selectedElement.format?.dataType) && (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-md border">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Casing
                      </Label>
                      <Select
                        value={selectedElement.format?.casing || "none"}
                        onValueChange={(value) =>
                          handleFormatChange("casing", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            Original (No Change)
                          </SelectItem>
                          <SelectItem value="title">Title Case (Aa)</SelectItem>
                          <SelectItem value="upper">UPPER CASE (AA)</SelectItem>
                          <SelectItem value="lower">lower case (aa)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        List Style
                      </Label>
                      <Select
                        value={selectedElement.format?.listStyle || "none"}
                        onValueChange={(value) =>
                          handleFormatChange("listStyle", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No List</SelectItem>
                          <SelectItem value="disc"> Bullets (•)</SelectItem>
                          <SelectItem value="circle">
                            Hollow Bullets (○)
                          </SelectItem>
                          <SelectItem value="square">
                            Square Bullets (■)
                          </SelectItem>
                          <SelectItem value="decimal">
                            Numbered List (1, 2, 3)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {selectedElement.format?.dataType === "number" && (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-md border">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        Display as Fraction
                      </Label>
                      <Switch
                        checked={selectedElement.format?.useFractions || false}
                        onCheckedChange={(checked) =>
                          handleFormatChange("useFractions", checked)
                        }
                      />
                    </div>
                    {selectedElement.format?.useFractions ? (
                      <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                        <Label className="text-xs text-muted-foreground">
                          Precision (Rounding)
                        </Label>
                        <Select
                          value={String(
                            selectedElement.format?.fractionPrecision || 16,
                          )}
                          onValueChange={(value) =>
                            handleFormatChange(
                              "fractionPrecision",
                              Number(value),
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2">Halves (1/2)</SelectItem>
                            <SelectItem value="4">Quarters (1/4)</SelectItem>
                            <SelectItem value="8">Eighths (1/8)</SelectItem>
                            <SelectItem value="16">
                              Sixteenths (1/16)
                            </SelectItem>
                            <SelectItem value="32">32nds (1/32)</SelectItem>
                            <SelectItem value="64">64ths (1/64)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="space-y-1.5 animate-in fade-in zoom-in-95 duration-200">
                        <Label className="text-xs text-muted-foreground">
                          Decimal Places
                        </Label>
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          value={selectedElement.format?.decimalPlaces ?? 2}
                          onChange={(e) =>
                            handleFormatChange(
                              "decimalPlaces",
                              Number(e.target.value),
                            )
                          }
                        />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Append Unit
                      </Label>
                      <Select
                        value={selectedElement.format?.unit || "none"}
                        onValueChange={(value) =>
                          handleFormatChange(
                            "unit",
                            value === "none" ? undefined : value,
                          )
                        }
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
                      <Label className="text-xs text-muted-foreground">
                        Output Format
                      </Label>
                      <Select
                        value={
                          selectedElement.format?.dateFormat || "MM/DD/YYYY"
                        }
                        onValueChange={(value) =>
                          handleFormatChange("dateFormat", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MM/DD/YYYY">12/25/2025</SelectItem>
                          <SelectItem value="DD/MM/YYYY">25/12/2025</SelectItem>
                          <SelectItem value="YYYY-MM-DD">2025-12-25</SelectItem>
                          <SelectItem value="MMM D, YYYY">
                            Dec 25, 2025
                          </SelectItem>
                          <SelectItem value="MMMM D, YYYY">
                            December 25, 2025
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                {selectedElement.format?.dataType === "boolean" && (
                  <div className="space-y-3 p-3 bg-muted/30 rounded-md border">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground text-green-600">
                          If TRUE (1)
                        </Label>
                        <Input
                          placeholder="Included"
                          value={selectedElement.format?.trueLabel || ""}
                          onChange={(e) =>
                            handleFormatChange("trueLabel", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground text-red-500">
                          If FALSE (0)
                        </Label>
                        <Input
                          placeholder="-"
                          value={selectedElement.format?.falseLabel || ""}
                          onChange={(e) =>
                            handleFormatChange("falseLabel", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedElement.type === "shape" && (
          <div>
            <h3 className="font-medium text-sm mb-3">Shape Style</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Fill Color
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={selectedElement.shapeStyle?.fill || "#e5e7eb"}
                    onChange={(e) =>
                      handleShapeStyleChange("fill", e.target.value)
                    }
                    className="w-12 h-9 p-1 cursor-pointer"
                    data-testid="input-fill-color"
                  />
                  <Input
                    type="text"
                    value={selectedElement.shapeStyle?.fill || "#e5e7eb"}
                    onChange={(e) =>
                      handleShapeStyleChange("fill", e.target.value)
                    }
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Stroke Color
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={selectedElement.shapeStyle?.stroke || "#9ca3af"}
                    onChange={(e) =>
                      handleShapeStyleChange("stroke", e.target.value)
                    }
                    className="w-12 h-9 p-1 cursor-pointer"
                    data-testid="input-stroke-color"
                  />
                  <Input
                    type="text"
                    value={selectedElement.shapeStyle?.stroke || "#9ca3af"}
                    onChange={(e) =>
                      handleShapeStyleChange("stroke", e.target.value)
                    }
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
                  onValueChange={([value]) =>
                    handleShapeStyleChange("strokeWidth", value)
                  }
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
                      Border Radius:{" "}
                      {selectedElement.shapeStyle?.borderRadius || 0}px
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
                  Opacity:{" "}
                  {Math.round((selectedElement.shapeStyle?.opacity || 1) * 100)}
                  %
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
                      sendToBack(selectedElement.id);
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
                      const maxZIndex = Math.max(
                        ...elements.map((el) => el.zIndex || 0),
                      );
                      updateElement(selectedElement.id, {
                        zIndex: maxZIndex + 1,
                      });
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

        {selectedElement.type === "image" && (
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
                          <span className="flex items-center gap-1">
                            Insert Field
                          </span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="max-h-[300px] overflow-y-auto"
                      >
                        <DropdownMenuItem
                          onSelect={() =>
                            updateElement(selectedElement.id, { imageSrc: "" })
                          }
                        >
                          <span className="text-muted-foreground italic">
                            Clear
                          </span>
                        </DropdownMenuItem>
                        {excelData.headers.map((header) => (
                          <DropdownMenuItem
                            key={header}
                            onSelect={(e) => {
                              const fieldTag = `{{${header}}}`;
                              updateElement(selectedElement.id, {
                                imageSrc: fieldTag,
                              });
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
                  value={selectedElement.imageSrc || ""}
                  onChange={(e) =>
                    handleImageUrlChange(selectedElement.id, e.target.value)
                  }
                  placeholder="https://... or {{MyVariable}}"
                  disabled={imageLoadingId === selectedElement.id}
                  data-testid="input-image-url"
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Enter a URL or use <code>{"{{Variable}}"}</code> to bind to
                  data.
                </p>
              </div>
              {selectedElement.imageSrc &&
                selectedElement.imageSrc.includes("{{") && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground flex items-center gap-2">
                      <ExternalLink className="h-3 w-3" />
                      URL (Row {selectedRowIndex + 1})
                    </Label>
                    <Input
                      readOnly
                      value={(() => {
                        if (!excelData) return "(No data loaded)";
                        return selectedElement.imageSrc.replace(
                          /{{([\w\s]+)}}/g,
                          (match, p1) => {
                            return (
                              excelData.rows[selectedRowIndex]?.[p1.trim()] ||
                              "(Empty)"
                            );
                          },
                        );
                      })()}
                      className="font-mono text-xs bg-muted text-muted-foreground cursor-default focus-visible:ring-0"
                    />
                  </div>
                )}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Opacity:{" "}
                  {Math.round((selectedElement.shapeStyle?.opacity ?? 1) * 100)}
                  %
                </Label>
                <Slider
                  value={[(selectedElement.shapeStyle?.opacity ?? 1) * 100]}
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
                    onClick={() => sendToBack(selectedElement.id)}
                    data-testid="btn-send-to-back"
                  >
                    Send to Back
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => bringToFront(selectedElement.id)}
                    data-testid="btn-bring-to-front"
                  >
                    Bring to Front
                  </Button>
                </div>
              </div>
              {selectedElement.imageSrc && (
                <div
                  className="aspect-video bg-muted rounded-md overflow-hidden"
                  style={{ opacity: selectedElement.shapeStyle?.opacity ?? 1 }}
                >
                  <img
                    src={
                      selectedElement.imageSrc.includes("{{") && excelData
                        ? (function () {
                            const variableMatch =
                              selectedElement.imageSrc!.match(/{{([\w\s]+)}}/);
                            const variable = variableMatch
                              ? variableMatch[1]
                              : null;
                            return variable
                              ? excelData.rows[selectedRowIndex]?.[variable]
                              : "";
                          })()
                        : selectedElement.imageSrc
                    }
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
        )}
      </div>
    </ScrollArea>
  );
}
