import { create } from "zustand";
import type { CanvasElement, ExcelData, Template, ExportSettings } from "@shared/schema";
import { nanoid } from "nanoid";

// --- NEW CATALOG TYPES ---
export type CatalogSectionType = "cover" | "toc" | "chapter" | "product" | "back";

export interface CatalogSection {
  type: CatalogSectionType;
  name: string;
  elements: CanvasElement[];
  backgroundColor: string;
}

// Calculate optimal grid size based on canvas dimensions
function calculateGridSize(width: number, height: number): number {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const g = gcd(width, height);

  const divisors: number[] = [];
  for (let i = 1; i <= Math.sqrt(g); i++) {
    if (g % i === 0) {
      divisors.push(i);
      if (i !== g / i) divisors.push(g / i);
    }
  }
  divisors.sort((a, b) => b - a);

  const targetSquares = 90;
  const avgDim = (width + height) / 2;
  const targetGridSize = Math.round(avgDim / targetSquares);

  let bestDiv = divisors[0];
  let bestDiff = Math.abs(targetGridSize - bestDiv);

  for (const div of divisors) {
    const diff = Math.abs(targetGridSize - div);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestDiv = div;
    }
  }

  return bestDiv || 10;
}

interface CanvasState {
  // Canvas settings
  canvasWidth: number;
  canvasHeight: number;
  gridSize: number;
  backgroundColor: string;
  zoom: number;
  showGrid: boolean;
  snapToGrid: boolean;

  // Multi-page state
  pageCount: number;
  activePageIndex: number;

  // Elements
  elements: CanvasElement[];
  selectedElementIds: string[];

  // Template
  currentTemplate: Template | null;
  hasUnsavedChanges: boolean;

  // Data
  excelData: ExcelData | null;
  selectedRowIndex: number;
  imageFieldNames: Set<string>;

  // Export
  exportSettings: ExportSettings;

  // UI State
  activeTool: "select" | "text" | "shape" | "image";
  rightPanelTab: "properties" | "data" | "export" | "designs";

  // --- CATALOG STATE ---
  isCatalogMode: boolean;
  activeSectionType: CatalogSectionType;
  catalogSections: Record<CatalogSectionType, CatalogSection>;

  // Actions
  setCanvasSize: (width: number, height: number) => void;
  setBackgroundColor: (color: string) => void;
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;

  addPage: () => void;
  removePage: (index: number) => void;
  setActivePage: (index: number) => void;

  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;
  deleteSelectedElements: () => void;
  duplicateElement: (id: string) => void;

  selectElement: (id: string, addToSelection?: boolean) => void;
  selectElements: (ids: string[]) => void;
  clearSelection: () => void;
  selectAll: () => void;

  moveElement: (id: string, x: number, y: number) => void;
  resizeElement: (id: string, width: number, height: number) => void;

  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;

  alignLeft: () => void;
  alignCenter: () => void;
  alignRight: () => void;
  alignTop: () => void;
  alignMiddle: () => void;
  alignBottom: () => void;
  distributeHorizontal: () => void;
  distributeVertical: () => void;

  setExcelData: (data: ExcelData | null) => void;
  setSelectedRowIndex: (index: number) => void;
  toggleImageField: (fieldName: string) => void;

  setCurrentTemplate: (template: Template | null) => void;
  saveAsTemplate: (name: string, description?: string, previewImages?: string[]) => Template;
  loadTemplate: (template: Template) => void;

  setExportSettings: (settings: Partial<ExportSettings>) => void;

  setActiveTool: (tool: "select" | "text" | "shape" | "image") => void;
  setRightPanelTab: (tab: "properties" | "data" | "export" | "designs") => void;

  // --- CATALOG ACTIONS ---
  setCatalogMode: (enabled: boolean) => void;
  setActiveSection: (type: CatalogSectionType) => void;

  undo: () => void;
  redo: () => void;

  resetCanvas: () => void;
}

interface HistoryState {
  elements: CanvasElement[];
}

const MAX_HISTORY = 50;
let history: HistoryState[] = [];
let historyIndex = -1;

function saveToHistory(elements: CanvasElement[]) {
  history = history.slice(0, historyIndex + 1);
  history.push({ elements: JSON.parse(JSON.stringify(elements)) });
  if (history.length > MAX_HISTORY) {
    history = history.slice(history.length - MAX_HISTORY);
  }
  historyIndex = history.length - 1;
}

const initialWidth = 810;
const initialHeight = 1050;

export const useCanvasStore = create<CanvasState>((set, get) => ({
  // Initial state
  canvasWidth: initialWidth,
  canvasHeight: initialHeight,
  gridSize: calculateGridSize(initialWidth, initialHeight),
  backgroundColor: "#ffffff",
  zoom: 1,
  showGrid: true,
  snapToGrid: true,

  pageCount: 1,
  activePageIndex: 0,

  elements: [],
  selectedElementIds: [],

  currentTemplate: null,
  hasUnsavedChanges: false,

  excelData: null,
  selectedRowIndex: 0,
  imageFieldNames: new Set(),

  exportSettings: {
    pageSize: "letter",
    orientation: "portrait",
    quality: 0.92,
    margin: 0,
  },

  activeTool: "select",
  rightPanelTab: "properties",

  // Catalog Initial State
  isCatalogMode: false,
  activeSectionType: "product",
  catalogSections: {
    cover: { type: "cover", name: "Cover Page", elements: [], backgroundColor: "#ffffff" },
    toc: { type: "toc", name: "Table of Contents", elements: [], backgroundColor: "#ffffff" },
    chapter: { type: "chapter", name: "Chapter Divider", elements: [], backgroundColor: "#ffffff" },
    product: { type: "product", name: "Product Page", elements: [], backgroundColor: "#ffffff" },
    back: { type: "back", name: "Back Cover", elements: [], backgroundColor: "#ffffff" },
  },

  // Actions
  setCanvasSize: (width, height) => {
    set({ 
      canvasWidth: width, 
      canvasHeight: height, 
      gridSize: calculateGridSize(width, height),
      hasUnsavedChanges: true 
    });
  },

  setBackgroundColor: (color) =>
    set({ backgroundColor: color, hasUnsavedChanges: true }),

  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(2, zoom)) }),

  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),

  toggleSnapToGrid: () => set((state) => ({ snapToGrid: !state.snapToGrid })),

  addPage: () => {
    set((state) => ({ 
      pageCount: state.pageCount + 1,
      activePageIndex: state.pageCount 
    }));
  },

  removePage: (index) => {
    const { pageCount, elements } = get();
    if (pageCount <= 1) return;

    const newElements = elements.filter(el => el.pageIndex !== index);

    const shiftedElements = newElements.map(el => {
      if (el.pageIndex !== undefined && el.pageIndex > index) {
        return { ...el, pageIndex: el.pageIndex - 1 };
      }
      return el;
    });

    set({
      pageCount: pageCount - 1,
      elements: shiftedElements,
      activePageIndex: Math.max(0, index - 1),
      hasUnsavedChanges: true
    });
  },

  setActivePage: (index) => set({ activePageIndex: index }),

  addElement: (element) => {
    const { elements, activePageIndex } = get();
    // Default new elements to maxZ + 1 so they appear on top
    const maxZ = Math.max(...elements.map(el => el.zIndex), 0);
    const newElement = { ...element, pageIndex: activePageIndex, zIndex: maxZ + 1 };

    const newElements = [...elements, newElement];
    saveToHistory(newElements);
    set({ elements: newElements, hasUnsavedChanges: true });
  },

  updateElement: (id, updates) => {
    const elements = get().elements.map((el) =>
      el.id === id ? { ...el, ...updates } : el
    );
    saveToHistory(elements);
    set({ elements, hasUnsavedChanges: true });
  },

  deleteElement: (id) => {
    const elements = get().elements.filter((el) => el.id !== id);
    saveToHistory(elements);
    set({
      elements,
      selectedElementIds: get().selectedElementIds.filter((eid) => eid !== id),
      hasUnsavedChanges: true,
    });
  },

  deleteSelectedElements: () => {
    const selectedIds = get().selectedElementIds;
    if (selectedIds.length === 0) return;

    const elements = get().elements.filter((el) => !selectedIds.includes(el.id));
    saveToHistory(elements);
    set({ elements, selectedElementIds: [], hasUnsavedChanges: true });
  },

  duplicateElement: (id) => {
    const element = get().elements.find((el) => el.id === id);
    if (!element) return;

    const maxZ = Math.max(...get().elements.map((el) => el.zIndex), 0);

    const newElement: CanvasElement = {
      ...element,
      id: nanoid(),
      position: {
        x: element.position.x + 20,
        y: element.position.y + 20,
      },
      pageIndex: element.pageIndex,
      zIndex: maxZ + 1, // Ensure new items are on top
    };

    const elements = [...get().elements, newElement];
    saveToHistory(elements);
    set({ elements, selectedElementIds: [newElement.id], hasUnsavedChanges: true });
  },

  selectElement: (id, addToSelection = false) => {
    if (addToSelection) {
      const currentIds = get().selectedElementIds;
      if (currentIds.includes(id)) {
        set({ selectedElementIds: currentIds.filter((eid) => eid !== id) });
      } else {
        set({ selectedElementIds: [...currentIds, id] });
      }
    } else {
      set({ selectedElementIds: [id] });
    }
  },

  selectElements: (ids) => set({ selectedElementIds: ids }),

  clearSelection: () => set({ selectedElementIds: [] }),

  selectAll: () =>
    set({ selectedElementIds: get().elements.map((el) => el.id) }),

  moveElement: (id, x, y) => {
    const { snapToGrid: shouldSnap, gridSize } = get();
    const finalX = shouldSnap ? Math.round(x / gridSize) * gridSize : x;
    const finalY = shouldSnap ? Math.round(y / gridSize) * gridSize : y;

    const elements = get().elements.map((el) =>
      el.id === id
        ? { ...el, position: { x: finalX, y: finalY } }
        : el
    );
    set({ elements, hasUnsavedChanges: true });
  },

  resizeElement: (id, width, height) => {
    const elements = get().elements.map((el) =>
      el.id === id
        ? { ...el, dimension: { width: Math.max(10, width), height: Math.max(10, height) } }
        : el
    );
    set({ elements, hasUnsavedChanges: true });
  },

  bringToFront: (id) => {
    const maxZ = Math.max(...get().elements.map((el) => el.zIndex), 0);
    const elements = get().elements.map((el) =>
      el.id === id ? { ...el, zIndex: maxZ + 1 } : el
    );
    saveToHistory(elements);
    set({ elements, hasUnsavedChanges: true });
  },

  sendToBack: (id) => {
    const allElements = get().elements;
    const currentMin = Math.min(...allElements.map((el) => el.zIndex), 0);

    let updatedElements;

    if (currentMin > 0) {
        updatedElements = allElements.map((el) =>
            el.id === id ? { ...el, zIndex: currentMin - 1 } : el
        );
    } else {
        updatedElements = allElements.map((el) => {
            if (el.id === id) {
                return { ...el, zIndex: 0 };
            } else {
                return { ...el, zIndex: el.zIndex + 1 };
            }
        });
    }

    saveToHistory(updatedElements);
    set({ elements: updatedElements, hasUnsavedChanges: true });
  },

  alignLeft: () => {
    const { selectedElementIds, elements } = get();
    if (selectedElementIds.length < 2) return;
    const selected = elements.filter((el) => selectedElementIds.includes(el.id));
    const minX = Math.min(...selected.map((el) => el.position.x));
    const updated = elements.map((el) =>
      selectedElementIds.includes(el.id) ? { ...el, position: { ...el.position, x: minX } } : el
    );
    saveToHistory(updated);
    set({ elements: updated, hasUnsavedChanges: true });
  },

  alignCenter: () => {
    const { selectedElementIds, elements } = get();
    if (selectedElementIds.length < 2) return;
    const selected = elements.filter((el) => selectedElementIds.includes(el.id));
    const avgX = selected.reduce((sum, el) => sum + el.position.x + el.dimension.width / 2, 0) / selected.length;
    const updated = elements.map((el) =>
      selectedElementIds.includes(el.id) ? { ...el, position: { ...el.position, x: avgX - el.dimension.width / 2 } } : el
    );
    saveToHistory(updated);
    set({ elements: updated, hasUnsavedChanges: true });
  },

  alignRight: () => {
    const { selectedElementIds, elements } = get();
    if (selectedElementIds.length < 2) return;
    const selected = elements.filter((el) => selectedElementIds.includes(el.id));
    const maxX = Math.max(...selected.map((el) => el.position.x + el.dimension.width));
    const updated = elements.map((el) =>
      selectedElementIds.includes(el.id) ? { ...el, position: { ...el.position, x: maxX - el.dimension.width } } : el
    );
    saveToHistory(updated);
    set({ elements: updated, hasUnsavedChanges: true });
  },

  alignTop: () => {
    const { selectedElementIds, elements } = get();
    if (selectedElementIds.length < 2) return;
    const selected = elements.filter((el) => selectedElementIds.includes(el.id));
    const minY = Math.min(...selected.map((el) => el.position.y));
    const updated = elements.map((el) =>
      selectedElementIds.includes(el.id) ? { ...el, position: { ...el.position, y: minY } } : el
    );
    saveToHistory(updated);
    set({ elements: updated, hasUnsavedChanges: true });
  },

  alignMiddle: () => {
    const { selectedElementIds, elements } = get();
    if (selectedElementIds.length < 2) return;
    const selected = elements.filter((el) => selectedElementIds.includes(el.id));
    const avgY = selected.reduce((sum, el) => sum + el.position.y + el.dimension.height / 2, 0) / selected.length;
    const updated = elements.map((el) =>
      selectedElementIds.includes(el.id) ? { ...el, position: { ...el.position, y: avgY - el.dimension.height / 2 } } : el
    );
    saveToHistory(updated);
    set({ elements: updated, hasUnsavedChanges: true });
  },

  alignBottom: () => {
    const { selectedElementIds, elements } = get();
    if (selectedElementIds.length < 2) return;
    const selected = elements.filter((el) => selectedElementIds.includes(el.id));
    const maxY = Math.max(...selected.map((el) => el.position.y + el.dimension.height));
    const updated = elements.map((el) =>
      selectedElementIds.includes(el.id) ? { ...el, position: { ...el.position, y: maxY - el.dimension.height } } : el
    );
    saveToHistory(updated);
    set({ elements: updated, hasUnsavedChanges: true });
  },

  distributeHorizontal: () => {
    const { selectedElementIds, elements } = get();
    if (selectedElementIds.length < 3) return;
    const selected = elements.filter((el) => selectedElementIds.includes(el.id)).sort((a, b) => a.position.x - b.position.x);
    const minX = selected[0].position.x;
    const maxX = selected[selected.length - 1].position.x + selected[selected.length - 1].dimension.width;
    const totalGap = maxX - minX - selected.reduce((sum, el) => sum + el.dimension.width, 0);
    const gap = totalGap / (selected.length - 1);
    let currentX = minX;
    const updated = elements.map((el) => {
      if (!selectedElementIds.includes(el.id)) return el;
      const idx = selected.findIndex((s) => s.id === el.id);
      const newX = currentX;
      currentX += el.dimension.width + gap;
      return { ...el, position: { ...el.position, x: newX } };
    });
    saveToHistory(updated);
    set({ elements: updated, hasUnsavedChanges: true });
  },

  distributeVertical: () => {
    const { selectedElementIds, elements } = get();
    if (selectedElementIds.length < 3) return;
    const selected = elements.filter((el) => selectedElementIds.includes(el.id)).sort((a, b) => a.position.y - b.position.y);
    const minY = selected[0].position.y;
    const maxY = selected[selected.length - 1].position.y + selected[selected.length - 1].dimension.height;
    const totalGap = maxY - minY - selected.reduce((sum, el) => sum + el.dimension.height, 0);
    const gap = totalGap / (selected.length - 1);
    let currentY = minY;
    const updated = elements.map((el) => {
      if (!selectedElementIds.includes(el.id)) return el;
      const idx = selected.findIndex((s) => s.id === el.id);
      const newY = currentY;
      currentY += el.dimension.height + gap;
      return { ...el, position: { ...el.position, y: newY } };
    });
    saveToHistory(updated);
    set({ elements: updated, hasUnsavedChanges: true });
  },

  setExcelData: (data) => set({ excelData: data, selectedRowIndex: 0, imageFieldNames: new Set() }),

  setSelectedRowIndex: (index) => set({ selectedRowIndex: index }),

  toggleImageField: (fieldName) => {
    set((state) => {
      const newSet = new Set(state.imageFieldNames);
      if (newSet.has(fieldName)) {
        newSet.delete(fieldName);
      } else {
        newSet.add(fieldName);
      }

      const elements = state.elements.map((el) =>
        el.dataBinding === fieldName
          ? { ...el, isImageField: !newSet.has(fieldName) ? false : true }
          : el
      );

      return { imageFieldNames: newSet, elements };
    });
  },

  setCurrentTemplate: (template) => set({ currentTemplate: template }),

  saveAsTemplate: (name, description, previewImages = []) => {
    const { elements, canvasWidth, canvasHeight, backgroundColor, pageCount } = get();
    const template: Template = {
      id: nanoid(),
      name,
      description,
      canvasWidth,
      canvasHeight,
      pageCount,
      previewImages, 
      backgroundColor,
      elements: JSON.parse(JSON.stringify(elements)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set({ currentTemplate: template, hasUnsavedChanges: false });
    return template;
  },

  loadTemplate: (template) => {
    history = [];
    historyIndex = -1;

    const maxPageIndex = template.elements.reduce((max, el) => {
      return Math.max(max, el.pageIndex ?? 0);
    }, 0);

    set({
      elements: JSON.parse(JSON.stringify(template.elements)),
      canvasWidth: template.canvasWidth,
      canvasHeight: template.canvasHeight,
      gridSize: calculateGridSize(template.canvasWidth, template.canvasHeight),
      backgroundColor: template.backgroundColor,
      currentTemplate: template,
      selectedElementIds: [],
      hasUnsavedChanges: false,
      pageCount: maxPageIndex + 1, 
      activePageIndex: 0, 
    });
    saveToHistory(template.elements);
  },

  setExportSettings: (settings) => {
    const state = get();
    const newState: any = {
      exportSettings: { ...state.exportSettings, ...settings },
    };

    if (settings.pageSize) {
      const pageSizes = { letter: { width: 810, height: 1050 }, a4: { width: 790, height: 1120 }, legal: { width: 810, height: 1340 } };
      const pageSize = pageSizes[settings.pageSize];
      const isLandscape = settings.orientation === "landscape" || (settings.orientation === undefined && state.exportSettings.orientation === "landscape");

      newState.canvasWidth = isLandscape ? pageSize.height : pageSize.width;
      newState.canvasHeight = isLandscape ? pageSize.width : pageSize.height;
      newState.gridSize = calculateGridSize(newState.canvasWidth, newState.canvasHeight);
    } else if (settings.orientation && settings.pageSize === undefined) {
      const pageSizes = { letter: { width: 810, height: 1050 }, a4: { width: 790, height: 1120 }, legal: { width: 810, height: 1340 } };
      const pageSize = pageSizes[state.exportSettings.pageSize];
      const isLandscape = settings.orientation === "landscape";

      newState.canvasWidth = isLandscape ? pageSize.height : pageSize.width;
      newState.canvasHeight = isLandscape ? pageSize.width : pageSize.height;
      newState.gridSize = calculateGridSize(newState.canvasWidth, newState.canvasHeight);
    }

    set(newState);
  },

  setActiveTool: (tool) => set({ activeTool: tool }),

  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),

  // --- CATALOG ACTIONS IMPLEMENTATION ---
  setCatalogMode: (enabled) => set({ isCatalogMode: enabled }),

  setActiveSection: (type) => {
    const { activeSectionType, elements, backgroundColor, catalogSections } = get();

    // 1. Save current canvas state into the PREVIOUS section slot
    const updatedSections = {
      ...catalogSections,
      [activeSectionType]: {
        ...catalogSections[activeSectionType],
        elements: elements,
        backgroundColor: backgroundColor
      }
    };

    // 2. Load the NEW section state onto the canvas
    const targetSection = updatedSections[type];

    // Clear history when switching contexts to avoid undo-ing into a different section
    history = [];
    historyIndex = -1;

    set({
      activeSectionType: type,
      catalogSections: updatedSections,
      elements: targetSection.elements,
      backgroundColor: targetSection.backgroundColor,
      selectedElementIds: [],
    });
  },

  undo: () => {
    if (historyIndex > 0) {
      historyIndex--;
      const state = history[historyIndex];
      set({ elements: JSON.parse(JSON.stringify(state.elements)) });
    }
  },

  redo: () => {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      const state = history[historyIndex];
      set({ elements: JSON.parse(JSON.stringify(state.elements)) });
    }
  },

  resetCanvas: () => {
    history = [];
    historyIndex = -1;
    set({
      elements: [],
      selectedElementIds: [],
      currentTemplate: null,
      hasUnsavedChanges: false,
      excelData: null,
      selectedRowIndex: 0,
      canvasWidth: initialWidth,
      canvasHeight: initialHeight,
      gridSize: calculateGridSize(initialWidth, initialHeight),
      backgroundColor: "#ffffff",
      zoom: 1,
      pageCount: 1,
      activePageIndex: 0,
    });
  },
}));