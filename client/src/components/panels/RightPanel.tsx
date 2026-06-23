import { useCanvasStore } from "@/stores/canvas-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PropertiesTab } from "./PropertiesTab";
import { DataTab } from "./DataTab";
import { ExportTab } from "./ExportTab";
import { SavedDesignsTab } from "./SavedDesignsTab";
import { LayersTab } from "./LayersTab";
import { Settings2, Database, Download, FolderOpen, Layers } from "lucide-react";

export function RightPanel() {
  const { rightPanelTab, setRightPanelTab } = useCanvasStore();

  return (
    // UPDATED: Increased width from w-[400px] to w-[500px] to fit all tabs
    <div className="w-[500px] border-l bg-sidebar flex flex-col h-full transition-all duration-300 ease-in-out">
      <Tabs
        value={rightPanelTab}
        onValueChange={(v) => setRightPanelTab(v as typeof rightPanelTab)}
        className="flex-1 flex flex-col h-full min-h-0"
      >
        <div className="border-b flex-shrink-0">
          <TabsList className="w-full h-12 rounded-none bg-transparent justify-start px-2 gap-1">
            <TabsTrigger value="properties" className="px-3 flex-1"><Settings2 className="h-4 w-4 mr-1.5" /> Properties</TabsTrigger>
            <TabsTrigger value="data" className="px-3 flex-1"><Database className="h-4 w-4 mr-1.5" /> Data</TabsTrigger>
            <TabsTrigger value="layers" className="px-3 flex-1"><Layers className="h-4 w-4 mr-1.5" /> Layers</TabsTrigger>
            <TabsTrigger value="export" className="px-3 flex-1"><Download className="h-4 w-4 mr-1.5" /> Export</TabsTrigger>
            <TabsTrigger value="designs" className="px-3 flex-1"><FolderOpen className="h-4 w-4 mr-1.5" /> Designs</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="properties" className="flex-1 m-0 h-full overflow-hidden">
          <PropertiesTab />
        </TabsContent>

        <TabsContent value="data" className="flex-1 m-0 h-full overflow-hidden">
          <DataTab />
        </TabsContent>

        <TabsContent value="layers" className="flex-1 m-0 h-full overflow-hidden">
           <LayersTab />
        </TabsContent>

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