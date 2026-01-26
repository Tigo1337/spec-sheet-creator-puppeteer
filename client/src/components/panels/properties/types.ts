/**
 * Shared types and interfaces for property panel components
 */

import type { CanvasElement, TextStyle } from "@shared/schema";

/**
 * Props passed to all element-specific property components
 */
export interface ElementPropertiesProps {
  element: CanvasElement;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
}

/**
 * Extended props for components that need additional store actions
 */
export interface ExtendedElementPropertiesProps extends ElementPropertiesProps {
  elements: CanvasElement[];
  sendToBack: (id: string) => void;
  bringToFront: (id: string) => void;
}

/**
 * Props for text-based components (text, dataField)
 */
export interface TextPropertiesProps extends ExtendedElementPropertiesProps {
  applyFontToAll: boolean;
  setApplyFontToAll: (value: boolean) => void;
  updateAllTextFonts: (fontFamily: string) => void;
  excelData: { headers: string[]; rows: Record<string, string>[] } | null;
  selectedRowIndex: number;
}

/**
 * Props for table properties component
 */
export interface TablePropertiesProps extends ElementPropertiesProps {
  excelData: { headers: string[]; rows: Record<string, string>[] } | null;
  selectedRowIndex: number;
}

/**
 * Props for image properties component
 */
export interface ImagePropertiesProps extends ExtendedElementPropertiesProps {
  excelData: { headers: string[]; rows: Record<string, string>[] } | null;
  selectedRowIndex: number;
  imageLoadingId: string | null;
  setImageLoadingId: (id: string | null) => void;
}

/**
 * Props for QR code properties component
 */
export interface QrPropertiesProps extends ElementPropertiesProps {
  isGeneratingLink: boolean;
  onGenerateShortLink: () => Promise<void>;
}

/**
 * Props for TOC properties component
 */
export interface TocPropertiesProps extends ElementPropertiesProps {}

/**
 * Props for shape properties component
 */
export interface ShapePropertiesProps extends ExtendedElementPropertiesProps {}

/**
 * Props for canvas settings (no element selected)
 */
export interface CanvasSettingsProps {
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
}

/**
 * Handler type for text style changes
 */
export type TextStyleChangeHandler = (
  key: keyof TextStyle,
  value: string | number
) => Promise<void>;

/**
 * Handler type for shape style changes
 */
export type ShapeStyleChangeHandler = (
  key: keyof NonNullable<CanvasElement["shapeStyle"]>,
  value: string | number
) => void;

/**
 * Handler type for format changes
 */
export type FormatChangeHandler = (key: string, value: unknown) => void;
