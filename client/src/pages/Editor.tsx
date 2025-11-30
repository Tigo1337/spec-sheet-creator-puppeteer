import { Header } from "@/components/layout/Header";
import { LeftPanel } from "@/components/panels/LeftPanel";
import { RightPanel } from "@/components/panels/RightPanel";
import { DesignCanvas } from "@/components/canvas/DesignCanvas";

export default function Editor() {
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <LeftPanel />
        <DesignCanvas />
        <RightPanel />
      </div>
    </div>
  );
}
