/**
 * QR Code element properties panel
 * Handles QR code content/URL, color, and dynamic URL conversion
 */

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, Link } from "lucide-react";
import type { CanvasElement } from "@shared/schema";

interface QrPropertiesProps {
  element: CanvasElement;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  excelData: { headers: string[]; rows: Record<string, string>[] } | null;
  isGeneratingLink: boolean;
  onGenerateShortLink: () => Promise<void>;
}

export function QrProperties({
  element,
  updateElement,
  excelData,
  isGeneratingLink,
  onGenerateShortLink,
}: QrPropertiesProps) {
  const handleColorChange = (color: string) => {
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
        color,
      },
    });
  };

  return (
    <div>
      <h3 className="font-medium text-sm mb-3">QR Code Settings</h3>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label className="text-xs text-muted-foreground">Content / URL</Label>
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
                  {excelData.headers.map((header) => (
                    <DropdownMenuItem
                      key={header}
                      onSelect={() => {
                        const currentContent = element.content || "";
                        const fieldTag = `{{${header}}}`;
                        updateElement(element.id, {
                          content: currentContent + fieldTag,
                        });
                      }}
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <span>{header}</span>
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
            placeholder="https://example.com"
            className="font-mono text-sm min-h-[80px]"
          />
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-xs border-dashed border-primary/40 hover:border-primary bg-primary/5 hover:bg-primary/10"
              onClick={onGenerateShortLink}
              disabled={isGeneratingLink || !element.content}
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
            <strong>Dynamic URL:</strong> Allows you to edit the destination link later.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Color</Label>
          <div className="flex gap-2">
            <Input
              type="color"
              value={element.textStyle?.color || "#000000"}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-12 h-9 p-1 cursor-pointer"
            />
            <Input
              type="text"
              value={element.textStyle?.color || "#000000"}
              onChange={(e) => handleColorChange(e.target.value)}
              className="flex-1 font-mono text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
