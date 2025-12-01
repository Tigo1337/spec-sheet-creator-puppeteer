import { z } from "zod";

// Canvas Element Types
export type ElementType = "text" | "shape" | "image" | "table" | "dataField";

// Position and dimension types
export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const dimensionSchema = z.object({
  width: z.number(),
  height: z.number(),
});

// Text styling
export const textStyleSchema = z.object({
  fontFamily: z.string().default("Inter"),
  fontSize: z.number().default(16),
  fontWeight: z.number().default(400),
  color: z.string().default("#000000"),
  textAlign: z.enum(["left", "center", "right"]).default("left"),
  verticalAlign: z.enum(["top", "middle", "bottom"]).default("middle"),
  lineHeight: z.number().default(1.5),
  letterSpacing: z.number().default(0),
});

export type TextStyle = z.infer<typeof textStyleSchema>;

// Shape styling
export const shapeStyleSchema = z.object({
  fill: z.string().default("#e5e7eb"),
  stroke: z.string().default("#9ca3af"),
  strokeWidth: z.number().default(1),
  borderRadius: z.number().default(0),
  opacity: z.number().default(1),
});

export type ShapeStyle = z.infer<typeof shapeStyleSchema>;

// Canvas element schema
export const canvasElementSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "shape", "image", "table", "dataField"]),
  position: positionSchema,
  dimension: dimensionSchema,
  rotation: z.number().default(0),
  locked: z.boolean().default(false),
  visible: z.boolean().default(true),
  zIndex: z.number().default(0),
  content: z.string().optional(),
  dataBinding: z.string().optional(), // Column name from Excel
  textStyle: textStyleSchema.optional(),
  shapeStyle: shapeStyleSchema.optional(),
  shapeType: z.enum(["rectangle", "circle", "line"]).optional(),
  imageSrc: z.string().optional(),
  isImageField: z.boolean().default(false), // Marks data fields that should load images
});

export type CanvasElement = z.infer<typeof canvasElementSchema>;

// Template schema
export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  canvasWidth: z.number().default(816), // 8.5in at 96dpi
  canvasHeight: z.number().default(1056), // 11in at 96dpi
  backgroundColor: z.string().default("#ffffff"),
  elements: z.array(canvasElementSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Template = z.infer<typeof templateSchema>;

export const insertTemplateSchema = templateSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;

// Excel Data schema
export const excelDataSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  headers: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.string())),
  uploadedAt: z.string(),
});

export type ExcelData = z.infer<typeof excelDataSchema>;

// Export settings
export const exportSettingsSchema = z.object({
  pageSize: z.enum(["letter", "a4", "legal"]).default("letter"),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  quality: z.number().min(0.1).max(1).default(0.92),
  margin: z.number().default(0),
});

export type ExportSettings = z.infer<typeof exportSettingsSchema>;

// API Response types
export const uploadResponseSchema = z.object({
  uploadURL: z.string(),
});

export type UploadResponse = z.infer<typeof uploadResponseSchema>;

// User schema (from base template)
export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
});

export type User = z.infer<typeof userSchema>;
export const insertUserSchema = userSchema.omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;

// Saved Design schema - for user-specific saved designs
export const savedDesignSchema = z.object({
  id: z.string(),
  userId: z.string(), // Clerk user ID for access control
  name: z.string(),
  description: z.string().optional(),
  canvasWidth: z.number().default(816),
  canvasHeight: z.number().default(1056),
  backgroundColor: z.string().default("#ffffff"),
  elements: z.array(canvasElementSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SavedDesign = z.infer<typeof savedDesignSchema>;

export const insertSavedDesignSchema = savedDesignSchema.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertSavedDesign = z.infer<typeof insertSavedDesignSchema>;

// Available fonts for the editor (Free Google Fonts + System fonts)
export const availableFonts = [
  "Inter",
  "JetBrains Mono",
  "Roboto",
  "Open Sans",
  "Lato",
  "Poppins",
  "Montserrat",
  "Playfair Display",
  "Georgia",
  "Arial",
  "Verdana",
  "Times New Roman",
  "Courier New",
  "Trebuchet MS",
  "Impact",
  "Comic Sans MS",
] as const;

// Page sizes for export
export const pageSizes = {
  letter: { width: 816, height: 1056 }, // 8.5 x 11 inches at 96dpi
  a4: { width: 794, height: 1123 }, // 210 x 297mm at 96dpi
  legal: { width: 816, height: 1344 }, // 8.5 x 14 inches at 96dpi
} as const;
