import { Header } from "@/components/layout/Header";
import { LeftPanel } from "@/components/panels/LeftPanel";
import { RightPanel } from "@/components/panels/RightPanel";
import { DesignCanvas } from "@/components/canvas/DesignCanvas";
import { CatalogNavigator } from "@/components/canvas/CatalogNavigator";
import { useCanvasStore } from "@/stores/canvas-store";

export default function Editor() {
  const { isCatalogMode } = useCanvasStore();

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />
      {/* Only show the Catalog Navigator if we are in Catalog Mode */}
      {isCatalogMode && <CatalogNavigator />}
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel />
        <DesignCanvas />
        <RightPanel />
      </div>
    </div>
  );
}