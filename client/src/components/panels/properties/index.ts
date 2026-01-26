/**
 * Barrel export for property panel components
 * Each component handles properties for a specific element type
 */

export { CanvasSettings } from "./CanvasSettings";
export { TextProperties } from "./TextProperties";
export { TableProperties } from "./TableProperties";
export { ImageProperties } from "./ImageProperties";
export { ShapeProperties } from "./ShapeProperties";
export { QrProperties } from "./QrProperties";
export { TocProperties } from "./TocProperties";

// Re-export types
export type * from "./types";
