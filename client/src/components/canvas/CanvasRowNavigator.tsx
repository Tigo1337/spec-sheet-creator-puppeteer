import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/stores/canvas-store";

export function CanvasRowNavigator() {
  const { excelData, selectedRowIndex, setSelectedRowIndex } = useCanvasStore();

  // Don't render if no data is loaded
  if (!excelData || excelData.rows.length === 0) {
    return null;
  }

  const totalRows = excelData.rows.length;
  const currentRow = selectedRowIndex + 1; // 1-based display

  const handlePrevRow = () => {
    if (selectedRowIndex > 0) {
      setSelectedRowIndex(selectedRowIndex - 1);
    }
  };

  const handleNextRow = () => {
    if (selectedRowIndex < totalRows - 1) {
      setSelectedRowIndex(selectedRowIndex + 1);
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-white/80 backdrop-blur-md shadow-lg rounded-full border border-white/20">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-full hover:bg-black/5"
          onClick={handlePrevRow}
          disabled={selectedRowIndex === 0}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="px-3 text-sm font-medium text-gray-700 select-none whitespace-nowrap">
          Row {currentRow} / {totalRows}
        </span>

        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-full hover:bg-black/5"
          onClick={handleNextRow}
          disabled={selectedRowIndex >= totalRows - 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
