/**
 * Table element properties panel
 * Handles data grouping, column configuration, and header/row styling
 * This is a complex component managing table structure and appearance
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { loadFont } from "@/lib/font-loader";
import { nanoid } from "nanoid";
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
  Trash2,
  Database,
  Table as TableIcon,
} from "lucide-react";
import { availableFonts, type CanvasElement, type TextStyle, type TableColumn } from "@shared/schema";

interface TablePropertiesProps {
  element: CanvasElement;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  excelData: { headers: string[]; rows: Record<string, string>[] } | null;
  selectedRowIndex: number;
}

export function TableProperties({
  element,
  updateElement,
  excelData,
  selectedRowIndex,
}: TablePropertiesProps) {
  const tableSettings = element.tableSettings;
  if (!tableSettings) return null;

  const handleTableStyleChange = async (
    section: "headerStyle" | "rowStyle",
    key: keyof TextStyle,
    value: string | number
  ) => {
    if (key === "fontFamily" && typeof value === "string") {
      await loadFont(value);
    }

    updateElement(element.id, {
      tableSettings: {
        ...tableSettings,
        [section]: {
          ...tableSettings[section],
          [key]: value,
        },
      },
    });
  };

  const updateColumns = (newColumns: TableColumn[]) => {
    updateElement(element.id, {
      tableSettings: {
        ...tableSettings,
        columns: newColumns,
      },
    });
  };

  const getAutofitWidth = (colId: string): number | null => {
    if (!tableSettings.autoFitColumns) return null;

    const previewRows = [
      { Name: "Product A", Description: "Sample Item", Price: "$10.00" },
      { Name: "Product B", Description: "Sample Item", Price: "$20.00" },
      { Name: "Product C", Description: "Sample Item", Price: "$30.00" },
    ];

    let displayRows: Record<string, string>[] = previewRows;

    if (excelData && excelData.rows.length > 0) {
      if (tableSettings.groupByField && selectedRowIndex !== undefined) {
        const currentRow = excelData.rows[selectedRowIndex];
        const groupValue = currentRow[tableSettings.groupByField];
        if (groupValue) {
          displayRows = excelData.rows.filter(
            (r) => r[tableSettings.groupByField!] === groupValue
          );
        } else {
          displayRows = [currentRow];
        }
      } else {
        displayRows = excelData.rows.slice(0, 5);
      }
    }

    const colWeights = tableSettings.columns.map((col) => {
      const headerLen = (col.header || "").length;
      const maxContentLen = displayRows.reduce((max, row) => {
        const cellValue = row[col.dataField || ""] || "";
        return Math.max(max, String(cellValue).length);
      }, 0);
      return { id: col.id, weight: Math.max(headerLen, maxContentLen, 3) };
    });

    const totalWeight = colWeights.reduce((sum, c) => sum + c.weight, 0);
    const targetCol = colWeights.find((c) => c.id === colId);

    if (!targetCol || totalWeight === 0) return 0;
    return Math.round((targetCol.weight / totalWeight) * element.dimension.width);
  };

  return (
    <div className="space-y-6">
      {/* 1. Grouping Configuration */}
      <div>
        <h3 className="font-medium text-sm mb-3 flex items-center gap-2 text-primary">
          <Database className="h-4 w-4" />
          Data Grouping
        </h3>
        <div className="space-y-4 p-3 bg-primary/5 rounded-md border border-primary/20">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Group Products By</Label>
            <Select
              value={tableSettings.groupByField || "none"}
              onValueChange={(val) =>
                updateElement(element.id, {
                  tableSettings: {
                    ...tableSettings,
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
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
              checked={tableSettings.autoHeightAdaptation || false}
              onCheckedChange={(checked) =>
                updateElement(element.id, {
                  tableSettings: { ...tableSettings, autoHeightAdaptation: checked },
                })
              }
              className="scale-75"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* 2. Column Manager */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <TableIcon className="h-4 w-4" /> Columns
          </h3>
          <div className="flex items-center gap-2">
            <Label className="text-[10px] text-muted-foreground">Autofit</Label>
            <Switch
              checked={tableSettings.autoFitColumns || false}
              onCheckedChange={(checked) =>
                updateElement(element.id, {
                  tableSettings: { ...tableSettings, autoFitColumns: checked },
                })
              }
            />
          </div>
        </div>

        <div className="space-y-3">
          {tableSettings.columns.map((col: TableColumn, idx: number) => (
            <div key={col.id} className="flex flex-col gap-2 p-3 bg-muted/20 rounded border">
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Input
                    value={col.header}
                    onChange={(e) => {
                      const newCols = [...tableSettings.columns];
                      newCols[idx].header = e.target.value;
                      updateColumns(newCols);
                    }}
                    className="h-7 text-xs"
                    placeholder="Header"
                  />
                  <Select
                    value={col.dataField || ""}
                    onValueChange={(val) => {
                      const newCols = [...tableSettings.columns];
                      newCols[idx].dataField = val;
                      updateColumns(newCols);
                    }}
                  >
                    <SelectTrigger className="h-7 text-xs bg-white">
                      <SelectValue placeholder="Bind Field" />
                    </SelectTrigger>
                    <SelectContent>
                      {excelData?.headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-20 flex-none space-y-1">
                  <Label className="text-[10px] text-muted-foreground block text-center">Width</Label>
                  <Input
                    type="number"
                    value={tableSettings.autoFitColumns ? getAutofitWidth(col.id) || col.width : col.width}
                    onChange={(e) => {
                      const newCols = [...tableSettings.columns];
                      newCols[idx].width = Number(e.target.value);
                      updateColumns(newCols);
                    }}
                    className="h-7 text-xs text-center"
                    disabled={tableSettings.autoFitColumns}
                  />
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:bg-destructive/10 flex-none"
                  onClick={() => {
                    const newCols = tableSettings.columns.filter((_: TableColumn, i: number) => i !== idx);
                    updateColumns(newCols);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Header Align</Label>
                  <div className="flex gap-0.5">
                    {(["left", "center", "right"] as const).map((alignValue) => (
                      <Button
                        key={alignValue}
                        size="sm"
                        variant={(col.headerAlign || "left") === alignValue ? "default" : "outline"}
                        className="flex-1 h-6 px-0"
                        onClick={() => {
                          const newCols = [...tableSettings.columns];
                          newCols[idx].headerAlign = alignValue;
                          updateColumns(newCols);
                        }}
                      >
                        {alignValue === "left" && <AlignLeft className="h-3 w-3" />}
                        {alignValue === "center" && <AlignCenter className="h-3 w-3" />}
                        {alignValue === "right" && <AlignRight className="h-3 w-3" />}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Row Align</Label>
                  <div className="flex gap-0.5">
                    {(["left", "center", "right"] as const).map((alignValue) => (
                      <Button
                        key={alignValue}
                        size="sm"
                        variant={(col.rowAlign || "left") === alignValue ? "default" : "outline"}
                        className="flex-1 h-6 px-0"
                        onClick={() => {
                          const newCols = [...tableSettings.columns];
                          newCols[idx].rowAlign = alignValue;
                          updateColumns(newCols);
                        }}
                      >
                        {alignValue === "left" && <AlignLeft className="h-3 w-3" />}
                        {alignValue === "center" && <AlignCenter className="h-3 w-3" />}
                        {alignValue === "right" && <AlignRight className="h-3 w-3" />}
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
              const newCol: TableColumn = {
                id: nanoid(),
                header: "New Col",
                width: 100,
                headerAlign: "left" as const,
                rowAlign: "left" as const,
              };
              const newCols = [...tableSettings.columns, newCol];
              updateColumns(newCols);
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
          {/* Header Row Styling */}
          <div className="space-y-2 p-3 bg-muted/20 rounded border">
            <Label className="text-xs font-semibold">Header Row</Label>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Font</Label>
              <Select
                value={tableSettings.headerStyle?.fontFamily || "Inter"}
                onValueChange={(val) => handleTableStyleChange("headerStyle", "fontFamily", val)}
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
                  value={tableSettings.headerStyle?.fontSize || 12}
                  onChange={(e) => handleTableStyleChange("headerStyle", "fontSize", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Weight</Label>
                <Select
                  value={String(tableSettings.headerStyle?.fontWeight || 700)}
                  onValueChange={(val) => handleTableStyleChange("headerStyle", "fontWeight", Number(val))}
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
              <Label className="text-xs text-muted-foreground">Default Alignment</Label>
              <div className="flex gap-1">
                {(["left", "center", "right"] as const).map((align) => (
                  <Button
                    key={align}
                    size="sm"
                    variant={tableSettings.headerStyle?.textAlign === align ? "default" : "outline"}
                    onClick={() => handleTableStyleChange("headerStyle", "textAlign", align)}
                    className="flex-1 h-6 text-xs capitalize"
                  >
                    {align === "left" && <AlignLeft className="h-3 w-3" />}
                    {align === "center" && <AlignCenter className="h-3 w-3" />}
                    {align === "right" && <AlignRight className="h-3 w-3" />}
                  </Button>
                ))}
              </div>
            </div>

            <Separator className="my-2" />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Bg Color</Label>
                <Input
                  type="color"
                  className="w-6 h-6 p-0"
                  value={tableSettings.headerBackgroundColor || "#f3f4f6"}
                  onChange={(e) =>
                    updateElement(element.id, {
                      tableSettings: { ...tableSettings, headerBackgroundColor: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Text Color</Label>
                <Input
                  type="color"
                  className="w-6 h-6 p-0"
                  value={tableSettings.headerStyle?.color || "#000000"}
                  onChange={(e) => handleTableStyleChange("headerStyle", "color", e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Data Row Styling */}
          <div className="space-y-2 p-3 bg-muted/20 rounded border">
            <Label className="text-xs font-semibold">Data Rows</Label>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Font</Label>
              <Select
                value={tableSettings.rowStyle?.fontFamily || "Inter"}
                onValueChange={(val) => handleTableStyleChange("rowStyle", "fontFamily", val)}
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
                  value={tableSettings.rowStyle?.fontSize || 11}
                  onChange={(e) => handleTableStyleChange("rowStyle", "fontSize", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Weight</Label>
                <Select
                  value={String(tableSettings.rowStyle?.fontWeight || 400)}
                  onValueChange={(val) => handleTableStyleChange("rowStyle", "fontWeight", Number(val))}
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

            <Separator className="my-2" />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Bg Color</Label>
                <Input
                  type="color"
                  className="w-6 h-6 p-0"
                  value={tableSettings.rowBackgroundColor || "#ffffff"}
                  onChange={(e) =>
                    updateElement(element.id, {
                      tableSettings: { ...tableSettings, rowBackgroundColor: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Text Color</Label>
                <Input
                  type="color"
                  className="w-6 h-6 p-0"
                  value={tableSettings.rowStyle?.color || "#000000"}
                  onChange={(e) => handleTableStyleChange("rowStyle", "color", e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Label className="text-[10px] text-muted-foreground">Alternate Row Colors</Label>
              <Switch
                checked={tableSettings.alternateRowColors || false}
                onCheckedChange={(checked) =>
                  updateElement(element.id, {
                    tableSettings: { ...tableSettings, alternateRowColors: checked },
                  })
                }
                className="scale-75"
              />
            </div>

            {tableSettings.alternateRowColors && (
              <div>
                <Label className="text-[10px] text-muted-foreground">Alt Row Color</Label>
                <Input
                  type="color"
                  className="w-6 h-6 p-0"
                  value={tableSettings.alternateRowColor || "#f9fafb"}
                  onChange={(e) =>
                    updateElement(element.id, {
                      tableSettings: { ...tableSettings, alternateRowColor: e.target.value },
                    })
                  }
                />
              </div>
            )}
          </div>

          {/* Border Settings */}
          <div className="space-y-2 p-3 bg-muted/20 rounded border">
            <Label className="text-xs font-semibold">Borders</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Border Color</Label>
                <Input
                  type="color"
                  className="w-6 h-6 p-0"
                  value={tableSettings.borderColor || "#e5e7eb"}
                  onChange={(e) =>
                    updateElement(element.id, {
                      tableSettings: { ...tableSettings, borderColor: e.target.value },
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Border Width</Label>
                <Input
                  type="number"
                  className="h-7 text-xs"
                  min={0}
                  max={5}
                  value={tableSettings.borderWidth || 1}
                  onChange={(e) =>
                    updateElement(element.id, {
                      tableSettings: { ...tableSettings, borderWidth: Number(e.target.value) },
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Cell Padding</Label>
              <Input
                type="number"
                className="h-7 text-xs"
                min={0}
                max={20}
                value={tableSettings.cellPadding || 8}
                onChange={(e) =>
                  updateElement(element.id, {
                    tableSettings: { ...tableSettings, cellPadding: Number(e.target.value) },
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
