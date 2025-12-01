import { create } from "zustand";
import type { CanvasElement, ExcelData, Template, ExportSettings } from "@shared/schema";
import { nanoid } from "nanoid";

// Calculate optimal grid size based on canvas dimensions
function calculateGridSize(width: number, height: number): number {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const g = gcd(width, height);
  
  // Get all divisors of GCD in descending order
  const divisors: number[] = [];
  for (let i = 1; i <= Math.sqrt(g); i++) {
    if (g % i === 0) {
      divisors.push(i);
      if (i !== g / i) divisors.push(g / i);
    }
  }
  divisors.sort((a, b) => b - a);
  
  // Target approximately 80-100 squares per dimension for consistency
  const targetSquares = 90;
  const avgDim = (width + height) / 2;
  const targetGridSize = Math.round(avgDim / targetSquares);
  
  // Find best divisor closest to target that divides both dimensions evenly
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
  
  // Actions
  setCanvasSize: (width: number, height: number) => void;
  setBackgroundColor: (color: string) => void;
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  
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
  saveAsTemplate: (name: string, description?: string) => Template;
  loadTemplate: (template: Template) => void;
  
  setExportSettings: (settings: Partial<ExportSettings>) => void;
  
  setActiveTool: (tool: "select" | "text" | "shape" | "image") => void;
  setRightPanelTab: (tab: "properties" | "data" | "export" | "designs") => void;
  
  undo: () => void;
  redo: () => void;
  
  resetCanvas: () => void;
}

// History for undo/redo
interface HistoryState {
  elements: CanvasElement[];
}

const MAX_HISTORY = 50;
let history: HistoryState[] = [];
let historyIndex = -1;

function saveToHistory(elements: CanvasElement[]) {
  // Remove any forward history
  history = history.slice(0, historyIndex + 1);
  // Add new state
  history.push({ elements: JSON.parse(JSON.stringify(elements)) });
  // Limit history size
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
  
  addElement: (element) => {
    const elements = [...get().elements, element];
    saveToHistory(elements);
    set({ elements, hasUnsavedChanges: true });
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
    
    const newElement: CanvasElement = {
      ...element,
      id: nanoid(),
      position: {
        x: element.position.x + 20,
        y: element.position.y + 20,
      },
      zIndex: Date.now(),
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
    const minZ = Math.min(...get().elements.map((el) => el.zIndex), 0);
    const elements = get().elements.map((el) =>
      el.id === id ? { ...el, zIndex: minZ - 1 } : el
    );
    saveToHistory(elements);
    set({ elements, hasUnsavedChanges: true });
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
      
      // Update elements with matching dataBinding to mark/unmark as image field
      const elements = state.elements.map((el) =>
        el.dataBinding === fieldName
          ? { ...el, isImageField: !newSet.has(fieldName) ? false : true }
          : el
      );
      
      return { imageFieldNames: newSet, elements };
    });
  },
  
  setCurrentTemplate: (template) => set({ currentTemplate: template }),
  
  saveAsTemplate: (name, description) => {
    const { elements, canvasWidth, canvasHeight, backgroundColor } = get();
    const template: Template = {
      id: nanoid(),
      name,
      description,
      canvasWidth,
      canvasHeight,
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
    set({
      elements: JSON.parse(JSON.stringify(template.elements)),
      canvasWidth: template.canvasWidth,
      canvasHeight: template.canvasHeight,
      gridSize: calculateGridSize(template.canvasWidth, template.canvasHeight),
      backgroundColor: template.backgroundColor,
      currentTemplate: template,
      selectedElementIds: [],
      hasUnsavedChanges: false,
    });
    saveToHistory(template.elements);
  },
  
  setExportSettings: (settings) => {
    const state = get();
    const newState: any = {
      exportSettings: { ...state.exportSettings, ...settings },
    };
    
    // If page size changed, update canvas dimensions
    if (settings.pageSize) {
      const pageSizes = { letter: { width: 810, height: 1050 }, a4: { width: 790, height: 1120 }, legal: { width: 810, height: 1340 } };
      const pageSize = pageSizes[settings.pageSize];
      const isLandscape = settings.orientation === "landscape" || (settings.orientation === undefined && state.exportSettings.orientation === "landscape");
      
      newState.canvasWidth = isLandscape ? pageSize.height : pageSize.width;
      newState.canvasHeight = isLandscape ? pageSize.width : pageSize.height;
      newState.gridSize = calculateGridSize(newState.canvasWidth, newState.canvasHeight);
    } else if (settings.orientation && settings.pageSize === undefined) {
      // If only orientation changed, swap dimensions
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
    });
  },
}));
