import { useCanvasStore } from "@/stores/canvas-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertiesTab } from "./PropertiesTab";
import { DataTab } from "./DataTab";
import { ExportTab } from "./ExportTab";
import { SavedDesignsTab } from "./SavedDesignsTab";
import { Settings2, Database, Download, FolderOpen } from "lucide-react";

export function RightPanel() {
  const { rightPanelTab, setRightPanelTab } = useCanvasStore();

  return (
    <div className="w-[400px] border-l bg-sidebar flex flex-col h-full">
      <Tabs
        value={rightPanelTab}
        onValueChange={(v) => setRightPanelTab(v as typeof rightPanelTab)}
        className="flex-1 flex flex-col h-full min-h-0"
      >
        <div className="border-b flex-shrink-0">
          <TabsList className="w-full h-12 rounded-none bg-transparent justify-start px-2 gap-1">
            <TabsTrigger
              value="properties"
              className="flex items-center gap-1.5 data-[state=active]:bg-sidebar-accent px-3"
              data-testid="tab-properties"
            >
              <Settings2 className="h-4 w-4" />
              <span className="text-sm">Properties</span>
            </TabsTrigger>
            <TabsTrigger
              value="data"
              className="flex items-center gap-1.5 data-[state=active]:bg-sidebar-accent px-3"
              data-testid="tab-data"
            >
              <Database className="h-4 w-4" />
              <span className="text-sm">Data</span>
            </TabsTrigger>
            <TabsTrigger
              value="export"
              className="flex items-center gap-1.5 data-[state=active]:bg-sidebar-accent px-3"
              data-testid="tab-export"
            >
              <Download className="h-4 w-4" />
              <span className="text-sm">Export</span>
            </TabsTrigger>
            <TabsTrigger
              value="designs"
              className="flex items-center gap-1.5 data-[state=active]:bg-sidebar-accent px-3"
              data-testid="tab-designs"
            >
              <FolderOpen className="h-4 w-4" />
              <span className="text-sm">Designs</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* UPDATED: Changed overflow-y-auto to overflow-hidden so the internal ScrollArea works */}
        <TabsContent value="properties" className="flex-1 m-0 h-full overflow-hidden">
          <PropertiesTab />
        </TabsContent>

        <TabsContent value="data" className="flex-1 m-0 h-full overflow-hidden">
          <DataTab />
        </TabsContent>

        {/* UPDATED: Changed overflow-y-auto to overflow-hidden here too */}
        <TabsContent value="export" className="flex-1 m-0 h-full overflow-hidden">
          <ExportTab />
        </TabsContent>

        <TabsContent value="designs" className="flex-1 m-0 h-full overflow-hidden">
          <SavedDesignsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}