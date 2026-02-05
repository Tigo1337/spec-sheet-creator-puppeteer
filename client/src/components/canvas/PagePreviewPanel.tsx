import { useCallback, useMemo } from "react";
import { useCanvasStore } from "@/stores/canvas-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus, Check } from "lucide-react";
import type { CanvasElement as CanvasElementType } from "@shared/schema";
import { formatContent } from "@/lib/formatter";

interface PagePreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PageThumbnailProps {
  pageIndex: number;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

/**
 * Renders a single element in the thumbnail preview
 */
function ThumbnailElement({
  element,
  scale,
  excelData,
  selectedRowIndex
}: {
  element: CanvasElementType;
  scale: number;
  excelData: { rows: Record<string, string>[] } | null;
  selectedRowIndex: number;
}) {
  const left = element.position.x * scale;
  const top = element.position.y * scale;
  const width = element.dimension.width * scale;
  const height = element.dimension.height * scale;

  // Helper to substitute variables with Excel data
  const substituteVariables = (content: string): string => {
    if (!content) return "";
    if (excelData && excelData.rows[selectedRowIndex]) {
      const row = excelData.rows[selectedRowIndex];
      return content.replace(/{{(.*?)}}/g, (match, p1) => {
        const fieldName = p1.trim();
        return row[fieldName] !== undefined ? row[fieldName] : match;
      });
    }
    return content;
  };

  // Get image URL with variable substitution
  const getImageUrl = (): string | null => {
    if (element.dataBinding && excelData && excelData.rows[selectedRowIndex]) {
      return excelData.rows[selectedRowIndex][element.dataBinding] || element.imageSrc || null;
    }
    if (element.imageSrc && excelData && excelData.rows[selectedRowIndex]) {
      return substituteVariables(element.imageSrc);
    }
    return element.imageSrc || null;
  };

  // Common positioning styles
  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    left,
    top,
    width,
    height,
    overflow: 'hidden',
  };

  switch (element.type) {
    case 'image': {
      const imageUrl = getImageUrl();
      return (
        <div style={{ ...positionStyle, backgroundColor: '#f3f4f6' }}>
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                opacity: element.shapeStyle?.opacity ?? 1,
              }}
              loading="lazy"
            />
          )}
        </div>
      );
    }

    case 'text':
    case 'dataField': {
      const rawContent = element.content || (element.dataBinding ? `{{${element.dataBinding}}}` : "");
      const substitutedContent = substituteVariables(rawContent);
      const displayContent = formatContent(substitutedContent, element.format);
      const isDataField = element.type === 'dataField';
      const fontSize = Math.max(3, (element.textStyle?.fontSize || (isDataField ? 14 : 16)) * scale);

      const verticalAlignMap: Record<string, string> = {
        top: 'flex-start',
        middle: 'center',
        bottom: 'flex-end',
      };

      return (
        <div
          style={{
            ...positionStyle,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: verticalAlignMap[element.textStyle?.verticalAlign || 'middle'],
            fontSize,
            fontFamily: element.textStyle?.fontFamily || 'Inter',
            fontWeight: element.textStyle?.fontWeight || 400,
            color: element.textStyle?.color || '#000000',
            textAlign: element.textStyle?.textAlign || 'left',
            lineHeight: element.textStyle?.lineHeight || 1.5,
            wordBreak: 'break-word',
            ...(isDataField && {
              border: `${Math.max(1, scale)}px dashed #8b5cf6`,
              borderRadius: 2 * scale,
            }),
          }}
        >
          <span style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: Math.max(1, Math.floor(height / fontSize / 1.5)),
            WebkitBoxOrient: 'vertical' as const,
          }}>
            {displayContent}
          </span>
        </div>
      );
    }

    case 'shape': {
      if (element.shapeType === 'line') {
        const isVertical = element.dimension.height > element.dimension.width;
        return (
          <div style={{ ...positionStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                width: isVertical ? Math.max(1, (element.shapeStyle?.strokeWidth || 1) * scale) : '100%',
                height: isVertical ? '100%' : Math.max(1, (element.shapeStyle?.strokeWidth || 1) * scale),
                backgroundColor: element.shapeStyle?.stroke || '#9ca3af',
              }}
            />
          </div>
        );
      }

      return (
        <div
          style={{
            ...positionStyle,
            backgroundColor: element.shapeStyle?.fill || '#e5e7eb',
            border: `${Math.max(1, (element.shapeStyle?.strokeWidth || 1) * scale)}px solid ${element.shapeStyle?.stroke || '#9ca3af'}`,
            borderRadius: element.shapeType === 'circle' ? '50%' : (element.shapeStyle?.borderRadius || 0) * scale,
            opacity: element.shapeStyle?.opacity ?? 1,
          }}
        />
      );
    }

    case 'table': {
      const settings = element.tableSettings;
      if (!settings) {
        return <div style={{ ...positionStyle, backgroundColor: '#f3f4f6', border: '1px solid #d1d5db' }} />;
      }

      // Get display rows
      let displayRows: Record<string, string>[] = [];
      const isPropertiesTable = settings.variant === 'properties';

      if (isPropertiesTable && settings.staticData) {
        const currentRow = excelData?.rows[selectedRowIndex];
        const valueColHeader = settings.columns[1]?.header || 'Value';

        displayRows = settings.staticData
          .map(row => {
            const processedRow: Record<string, string> = {};
            let valueHadVariable = false;
            let resolvedValueIsEmpty = false;

            for (const [key, val] of Object.entries(row)) {
              let processedVal = val || '';
              const hasVariable = /{{.*?}}/.test(processedVal);
              if (key === valueColHeader && hasVariable) valueHadVariable = true;

              if (currentRow && hasVariable) {
                processedVal = processedVal.replace(/{{(.*?)}}/g, (_, p1) => {
                  return currentRow[p1.trim()] !== undefined ? currentRow[p1.trim()] : '';
                });
              }

              if (key === valueColHeader && valueHadVariable) {
                resolvedValueIsEmpty = processedVal.trim() === '';
              }
              processedRow[key] = processedVal;
            }
            return { ...processedRow, _hideRow: valueHadVariable && resolvedValueIsEmpty };
          })
          .filter(row => !row._hideRow)
          .map(({ _hideRow, ...rest }) => rest);
      } else if (excelData && excelData.rows.length > 0) {
        if (settings.groupByField && selectedRowIndex !== undefined) {
          const currentRow = excelData.rows[selectedRowIndex];
          const groupValue = currentRow[settings.groupByField];
          displayRows = groupValue
            ? excelData.rows.filter(r => r[settings.groupByField!] === groupValue)
            : [currentRow];
        } else {
          displayRows = excelData.rows.slice(0, 3);
        }
      }

      const headerHeight = Math.max(8, 16 * scale);
      const rowHeight = Math.max(6, 14 * scale);
      const borderWidth = Math.max(0.5, settings.borderWidth * scale);

      return (
        <div
          style={{
            ...positionStyle,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#fff',
            border: `${borderWidth}px solid ${settings.borderColor || '#e5e7eb'}`,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              backgroundColor: settings.headerBackgroundColor || '#f3f4f6',
              height: headerHeight,
              borderBottom: `${borderWidth}px solid ${settings.borderColor || '#e5e7eb'}`,
              flexShrink: 0,
            }}
          >
            {settings.columns.map((col, idx) => (
              <div
                key={col.id}
                style={{
                  flex: 1,
                  fontSize: Math.max(3, (settings.headerStyle?.fontSize || 12) * scale),
                  fontWeight: 600,
                  padding: `0 ${scale}px`,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  borderRight: idx < settings.columns.length - 1 ? `${borderWidth}px solid ${settings.borderColor || '#e5e7eb'}` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {col.header}
              </div>
            ))}
          </div>
          {/* Rows */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {displayRows.slice(0, Math.floor((height - headerHeight) / rowHeight)).map((row, rIdx) => (
              <div
                key={rIdx}
                style={{
                  display: 'flex',
                  height: rowHeight,
                  backgroundColor: settings.alternateRowColors && rIdx % 2 === 1
                    ? (settings.alternateRowColor || '#f9fafb')
                    : (settings.rowBackgroundColor || '#fff'),
                  borderTop: rIdx > 0 ? `${borderWidth}px solid ${settings.borderColor || '#e5e7eb'}` : 'none',
                }}
              >
                {settings.columns.map((col, cIdx) => (
                  <div
                    key={col.id}
                    style={{
                      flex: 1,
                      fontSize: Math.max(2, (settings.rowStyle?.fontSize || 10) * scale),
                      padding: `0 ${scale}px`,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      borderRight: cIdx < settings.columns.length - 1 ? `${borderWidth}px solid ${settings.borderColor || '#e5e7eb'}` : 'none',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {isPropertiesTable ? (row[col.header] || '-') : (row[col.dataField || ''] || '-')}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }

    case 'qrcode': {
      // Render a simple QR code representation
      const qrSize = Math.min(width, height);
      const cellSize = qrSize / 7;

      return (
        <div
          style={{
            ...positionStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: qrSize,
              height: qrSize,
              display: 'grid',
              gridTemplateColumns: `repeat(7, ${cellSize}px)`,
              gridTemplateRows: `repeat(7, ${cellSize}px)`,
              backgroundColor: '#fff',
            }}
          >
            {/* Simple QR pattern */}
            {[
              1,1,1,0,1,1,1,
              1,0,1,0,1,0,1,
              1,1,1,0,1,1,1,
              0,0,0,0,0,0,0,
              1,1,1,0,1,0,1,
              1,0,1,0,0,1,0,
              1,1,1,0,1,0,1,
            ].map((filled, i) => (
              <div
                key={i}
                style={{
                  backgroundColor: filled ? (element.textStyle?.color || '#000') : '#fff',
                }}
              />
            ))}
          </div>
        </div>
      );
    }

    case 'toc-list': {
      const settings = element.tocSettings || { title: 'Table of Contents', showTitle: true };
      const titleFontSize = Math.max(4, (settings.titleStyle?.fontSize || 24) * scale);
      const itemFontSize = Math.max(3, (element.textStyle?.fontSize || 14) * scale);

      return (
        <div
          style={{
            ...positionStyle,
            backgroundColor: '#fff',
            border: `${Math.max(0.5, scale)}px dashed #d1d5db`,
            padding: 4 * scale,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {settings.showTitle && (
            <div
              style={{
                fontSize: titleFontSize,
                fontWeight: settings.titleStyle?.fontWeight || 700,
                color: settings.titleStyle?.color || '#000',
                marginBottom: 4 * scale,
              }}
            >
              {settings.title}
            </div>
          )}
          {/* Sample TOC items */}
          {[1, 2, 3].slice(0, Math.floor((height - (settings.showTitle ? titleFontSize + 8 * scale : 0)) / (itemFontSize * 1.5))).map((i) => (
            <div
              key={i}
              style={{
                fontSize: itemFontSize,
                color: element.textStyle?.color || '#000',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Item {i}</span>
              <span>{i + 1}</span>
            </div>
          ))}
        </div>
      );
    }

    default:
      return (
        <div
          style={{
            ...positionStyle,
            backgroundColor: '#e5e7eb',
            border: '1px dashed #9ca3af',
          }}
        />
      );
  }
}

function PageThumbnail({ pageIndex, isActive, onSelect, onDelete, canDelete }: PageThumbnailProps) {
  const {
    canvasWidth,
    canvasHeight,
    backgroundColor,
    elements,
    excelData,
    selectedRowIndex,
  } = useCanvasStore();

  // Calculate thumbnail dimensions (maintain aspect ratio, max 150px width)
  const maxWidth = 150;
  const scale = maxWidth / canvasWidth;
  const thumbnailWidth = canvasWidth * scale;
  const thumbnailHeight = canvasHeight * scale;

  // Filter and sort elements for this page by zIndex
  const pageElements = useMemo(() => {
    return elements
      .filter(el => (el.pageIndex ?? 0) === pageIndex)
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  }, [elements, pageIndex]);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onSelect}
        className={`relative group transition-all duration-200 rounded-lg overflow-hidden ${
          isActive
            ? 'ring-2 ring-primary ring-offset-2 shadow-lg scale-105'
            : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-2 hover:shadow-md'
        }`}
      >
        {/* Thumbnail Canvas */}
        <div
          style={{
            width: thumbnailWidth,
            height: thumbnailHeight,
            backgroundColor,
            position: 'relative',
          }}
          className="shadow-sm border border-gray-200"
        >
          {/* Render element previews */}
          {pageElements.map((element) => (
            <ThumbnailElement
              key={element.id}
              element={element}
              scale={scale}
              excelData={excelData}
              selectedRowIndex={selectedRowIndex}
            />
          ))}

          {/* Active indicator */}
          {isActive && (
            <div className="absolute top-1 right-1 bg-primary text-white rounded-full p-0.5 z-10">
              <Check className="h-3 w-3" />
            </div>
          )}
        </div>

        {/* Delete button (visible on hover) */}
        {canDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute top-1 left-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-10"
            title="Delete page"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </button>

      {/* Page number label */}
      <span className={`text-sm font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
        Page {pageIndex + 1}
      </span>
    </div>
  );
}

export function PagePreviewPanel({ isOpen, onClose }: PagePreviewPanelProps) {
  const {
    pageCount,
    activePageIndex,
    setActivePage,
    addPage,
    removePage,
  } = useCanvasStore();

  const handlePageSelect = useCallback((pageIndex: number) => {
    setActivePage(pageIndex);
    onClose();
  }, [setActivePage, onClose]);

  const handleAddPage = useCallback(() => {
    addPage();
  }, [addPage]);

  const handleDeletePage = useCallback((pageIndex: number) => {
    removePage(pageIndex);
  }, [removePage]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Page Overview</DialogTitle>
          <DialogDescription>
            Click on a page to navigate to it. You can also add or remove pages from here.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 pr-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 p-4">
            {Array.from({ length: pageCount }).map((_, pageIndex) => (
              <PageThumbnail
                key={pageIndex}
                pageIndex={pageIndex}
                isActive={pageIndex === activePageIndex}
                onSelect={() => handlePageSelect(pageIndex)}
                onDelete={() => handleDeletePage(pageIndex)}
                canDelete={pageCount > 1}
              />
            ))}

            {/* Add Page Card */}
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleAddPage}
                className="flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg hover:border-primary hover:bg-primary/5 transition-all"
                style={{
                  width: 150,
                  height: 150 * (1050 / 810), // Use default aspect ratio
                }}
              >
                <div className="flex flex-col items-center gap-2 text-muted-foreground hover:text-primary transition-colors">
                  <Plus className="h-8 w-8" />
                  <span className="text-sm font-medium">Add Page</span>
                </div>
              </button>
              <span className="text-sm font-medium text-transparent">New</span>
            </div>
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t">
          <span className="text-sm text-muted-foreground">
            {pageCount} page{pageCount !== 1 ? 's' : ''} total
          </span>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
