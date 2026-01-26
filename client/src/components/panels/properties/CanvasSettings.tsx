/**
 * Canvas settings panel shown when no element is selected
 * Allows editing of background color and other canvas-level properties
 */

import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { CanvasSettingsProps } from "./types";

export function CanvasSettings({ backgroundColor, setBackgroundColor }: CanvasSettingsProps) {
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
