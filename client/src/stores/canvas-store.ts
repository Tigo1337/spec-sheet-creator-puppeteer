import { create } from "zustand";
import type { CanvasElement, ExcelData, Template, ExportSettings } from "@shared/schema";
import { nanoid } from "nanoid";

interface CanvasState {
  // Canvas settings
  canvasWidth: number;
  canvasHeight: number;
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
  
  // Export
  exportSettings: ExportSettings;
  
  // UI State
  activeTool: "select" | "text" | "shape" | "image";
  rightPanelTab: "properties" | "data" | "export";
  
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
  
  setExcelData: (data: ExcelData | null) => void;
  setSelectedRowIndex: (index: number) => void;
  
  setCurrentTemplate: (template: Template | null) => void;
  saveAsTemplate: (name: string, description?: string) => Template;
  loadTemplate: (template: Template) => void;
  
  setExportSettings: (settings: Partial<ExportSettings>) => void;
  
  setActiveTool: (tool: "select" | "text" | "shape" | "image") => void;
  setRightPanelTab: (tab: "properties" | "data" | "export") => void;
  
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

export const useCanvasStore = create<CanvasState>((set, get) => ({
  // Initial state
  canvasWidth: 816,
  canvasHeight: 1056,
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
  
  exportSettings: {
    pageSize: "letter",
    orientation: "portrait",
    quality: 0.92,
    margin: 0,
  },
  
  activeTool: "select",
  rightPanelTab: "properties",
  
  // Actions
  setCanvasSize: (width, height) =>
    set({ canvasWidth: width, canvasHeight: height, hasUnsavedChanges: true }),
  
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
    const { snapToGrid: shouldSnap } = get();
    const finalX = shouldSnap ? Math.round(x / 10) * 10 : x;
    const finalY = shouldSnap ? Math.round(y / 10) * 10 : y;
    
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
  
  setExcelData: (data) => set({ excelData: data, selectedRowIndex: 0 }),
  
  setSelectedRowIndex: (index) => set({ selectedRowIndex: index }),
  
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
      backgroundColor: template.backgroundColor,
      currentTemplate: template,
      selectedElementIds: [],
      hasUnsavedChanges: false,
    });
    saveToHistory(template.elements);
  },
  
  setExportSettings: (settings) =>
    set((state) => ({
      exportSettings: { ...state.exportSettings, ...settings },
    })),
  
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
      canvasWidth: 816,
      canvasHeight: 1056,
      backgroundColor: "#ffffff",
      zoom: 1,
    });
  },
}));
