import { z } from "zod";
import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

// Canvas Element Types
export type ElementType = "text" | "shape" | "image" | "table" | "dataField" | "qrcode" | "toc-list";

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

// Data Formatting Schema
export const formatSchema = z.object({
  dataType: z.enum(["text", "number", "date", "boolean"]).default("text"),
  casing: z.enum(["none", "title", "upper", "lower"]).default("none"),
  decimalPlaces: z.number().default(2),
  useFractions: z.boolean().default(false),
  fractionPrecision: z.number().default(16),
  unit: z.string().optional(),
  dateFormat: z.string().default("MM/DD/YYYY"),
  trueLabel: z.string().optional(),
  falseLabel: z.string().optional(),
  listStyle: z.enum(["none", "disc", "circle", "square", "decimal"]).default("none"),
});

export type ElementFormat = z.infer<typeof formatSchema>;

// --- Table Column Schema ---
export const tableColumnSchema = z.object({
  id: z.string(),
  header: z.string(),
  dataField: z.string().optional(),
  width: z.number().default(100),
  headerAlign: z.enum(["left", "center", "right"]).default("left"),
  rowAlign: z.enum(["left", "center", "right"]).default("left"),
});

export type TableColumn = z.infer<typeof tableColumnSchema>;

// --- Table Settings Schema ---
export const tableSettingsSchema = z.object({
  columns: z.array(tableColumnSchema).default([]),
  groupByField: z.string().optional(),
  autoFitColumns: z.boolean().default(false),
  autoHeightAdaptation: z.boolean().default(false), // NEW: Toggle for dynamic flow
  minColumnWidth: z.number().default(50), 
  equalRowHeights: z.boolean().default(true), 
  minRowHeight: z.number().default(24), 

  // Styles
  headerStyle: textStyleSchema.default({
    fontFamily: "Inter",
    fontSize: 14,
    fontWeight: 700,
    color: "#000000",
    textAlign: "left",
    verticalAlign: "middle",
    lineHeight: 1.2,
    letterSpacing: 0,
  }),
  rowStyle: textStyleSchema.default({
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: 400,
    color: "#000000",
    textAlign: "left",
    verticalAlign: "middle",
    lineHeight: 1.2,
    letterSpacing: 0,
  }),

  // Visuals
  headerBackgroundColor: z.string().default("#f3f4f6"),
  rowBackgroundColor: z.string().default("#ffffff"),
  alternateRowColor: z.string().optional(),
  borderColor: z.string().default("#e5e7eb"),
  borderWidth: z.number().default(1),
  cellPadding: z.number().default(8),
});

export type TableSettings = z.infer<typeof tableSettingsSchema>;

// --- TOC Settings Schema ---
export const tocSettingsSchema = z.object({
  title: z.string().default("Table of Contents"),
  showTitle: z.boolean().default(true),
  titleStyle: textStyleSchema.default({
    fontFamily: "Inter",
    fontSize: 24,
    fontWeight: 700,
    color: "#000000",
    textAlign: "left",
    verticalAlign: "top",
    lineHeight: 1.2,
    letterSpacing: 0
  }),

  columnCount: z.number().min(1).max(2).default(1),
  groupByField: z.string().optional(),
  chapterCoversEnabled: z.boolean().default(false),
  chapterStyle: textStyleSchema.default({
    fontFamily: "Inter",
    fontSize: 18,
    fontWeight: 600,
    color: "#333333",
    textAlign: "left",
    verticalAlign: "middle",
    lineHeight: 1.5,
    letterSpacing: 0
  }),
  showPageNumbers: z.boolean().default(true),
  leaderStyle: z.enum(["dotted", "solid", "none"]).default("dotted"),
});

export type TocSettings = z.infer<typeof tocSettingsSchema>;

// Canvas element schema
export const canvasElementSchema = z.object({
  id: z.string(),
  type: z.enum(["text", "shape", "image", "table", "dataField", "qrcode", "toc-list"]),
  position: positionSchema,
  dimension: dimensionSchema,
  rotation: z.number().default(0),
  locked: z.boolean().default(false),
  visible: z.boolean().default(true),
  zIndex: z.number().default(0),

  aspectRatio: z.number().optional(),
  aspectRatioLocked: z.boolean().default(false),

  content: z.string().optional(),
  dataBinding: z.string().optional(), 

  pageIndex: z.number().default(0),

  textStyle: textStyleSchema.optional(),
  shapeStyle: shapeStyleSchema.optional(),
  format: formatSchema.optional(),

  // Specialized Settings
  tocSettings: tocSettingsSchema.optional(),
  tableSettings: tableSettingsSchema.optional(),

  shapeType: z.enum(["rectangle", "circle", "line"]).optional(),
  imageSrc: z.string().optional(),
  isImageField: z.boolean().default(false),

  qrCodeId: z.string().optional(),
});

export type CanvasElement = z.infer<typeof canvasElementSchema>;

// Template schema
export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  canvasWidth: z.number().default(816),
  canvasHeight: z.number().default(1056),

  pageCount: z.number().default(1),
  previewImages: z.array(z.string()).default([]),

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

export const uploadResponseSchema = z.object({
  uploadURL: z.string(),
});

export type UploadResponse = z.infer<typeof uploadResponseSchema>;

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
});

export type User = z.infer<typeof userSchema>;
export const insertUserSchema = userSchema.omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;

// Saved Design schema
export const savedDesignSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  canvasWidth: z.number().default(816),
  canvasHeight: z.number().default(1056),

  pageCount: z.number().default(1),

  backgroundColor: z.string().default("#ffffff"),
  elements: z.array(canvasElementSchema),

  // New Fields for Catalog Support
  type: z.enum(["single", "catalog"]).default("single"),
  catalogData: z.any().optional(),

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

// UPDATED: Expanded Google Fonts List
export const availableFonts = [
  "Inter",
  "Arial", 
  "Roboto", 
  "Open Sans",
  "Lato", 
  "Montserrat", 
  "Oswald", 
  "Raleway", 
  "Merriweather", 
  "Poppins", 
  "Nunito", 
  "Playfair Display", 
  "Rubik",
  "Lora", 
  "Ubuntu", 
  "Kanit", 
  "Fira Sans", 
  "Quicksand",
  "Barlow",
  "Inconsolata",
  "Titillium Web",
  "PT Sans",
  "PT Serif",
  "Work Sans",
  "Crimson Text",
  "Libre Baskerville",
  "Anton",
  "Bitter",
  "Cabin",
  "Dancing Script",
  "Pacifico",
  "Exo 2",
  "Josefin Sans",
  "Karla",
  "Varela Round",
] as const;

export const openSourceFontMap: Record<string, string> = {
  "Arial": "Arimo",
  "Verdana": "DejaVu Sans",
  "Times New Roman": "Tinos",
  "Georgia": "Gelasio",
  "Courier New": "Cousine",
  "Trebuchet MS": "Fira Sans",
  "Calibri": "Carlito",
  "Cambria": "Caladea",
  "Comic Sans MS": "Comic Neue",
  "Impact": "Oswald",
};

export const pageSizes = {
  letter: { width: 816, height: 1056 },
  a4: { width: 794, height: 1123 },
  legal: { width: 816, height: 1344 },
} as const;

export const savedDesignsTable = pgTable("saved_designs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  canvasWidth: integer("canvas_width").notNull().default(816),
  canvasHeight: integer("canvas_height").notNull().default(1056),
  pageCount: integer("page_count").notNull().default(1),
  backgroundColor: varchar("background_color", { length: 50 }).notNull().default("#ffffff"),
  elements: jsonb("elements").notNull().default([]),

  type: varchar("type", { length: 20 }).notNull().default("single"),
  catalogData: jsonb("catalog_data"), 

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const templatesTable = pgTable("templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  canvasWidth: integer("canvas_width").notNull().default(816),
  canvasHeight: integer("canvas_height").notNull().default(1056),
  pageCount: integer("page_count").notNull().default(1),
  previewImages: jsonb("preview_images").default([]),
  backgroundColor: varchar("background_color", { length: 50 }).notNull().default("#ffffff"),
  elements: jsonb("elements").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// --- USERS TABLE ---
export const usersTable = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),

  // Anti-Abuse Fields
  normalizedEmail: varchar("normalized_email", { length: 255 }), 
  deviceFingerprint: varchar("device_fingerprint", { length: 255 }),

  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),

  plan: varchar("plan", { length: 50 }).notNull().default("free"), 
  planStatus: varchar("plan_status", { length: 50 }).notNull().default("active"),

  // PDF Usage
  pdfUsageCount: integer("pdf_usage_count").default(0),
  pdfUsageResetDate: timestamp("pdf_usage_reset_date").defaultNow(),

  // AI Credits System
  aiCredits: integer("ai_credits").default(0),
  aiCreditsLimit: integer("ai_credits_limit").default(5000), 
  aiCreditsResetDate: timestamp("ai_credits_reset_date").defaultNow(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type DbUser = typeof usersTable.$inferSelect;
export type InsertDbUser = typeof usersTable.$inferInsert;

export const dbUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  normalizedEmail: z.string().nullable(),
  deviceFingerprint: z.string().nullable(),
  stripeCustomerId: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
  plan: z.string().default("free"), 
  planStatus: z.enum(["active", "canceled", "past_due"]).default("active"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const insertDbUserSchema = dbUserSchema.omit({ createdAt: true, updatedAt: true });

export const qrCodesTable = pgTable("qr_codes", {
  id: varchar("id", { length: 12 }).primaryKey(), 
  userId: varchar("user_id", { length: 255 }).notNull(),
  designId: varchar("design_id", { length: 36 }),
  destinationUrl: text("destination_url").notNull(),
  scanCount: integer("scan_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type QrCode = typeof qrCodesTable.$inferSelect;
export type InsertQrCode = typeof qrCodesTable.$inferInsert;

export const insertQrCodeSchema = z.object({
  destinationUrl: z.string().url(),
  designId: z.string().optional(),
});

export const productKnowledgeTable = pgTable("product_knowledge", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  keyName: varchar("key_name", { length: 255 }).notNull().default("id"), 
  productKey: varchar("product_key", { length: 255 }).notNull(), 
  fieldType: varchar("field_type", { length: 50 }).notNull(),   
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  // NEW: Added unique constraint to support overwriting existing entries per SKU
  uniqueProductField: uniqueIndex("unique_product_field").on(t.userId, t.productKey, t.fieldType)
}));

export type ProductKnowledge = typeof productKnowledgeTable.$inferSelect;
export const insertProductKnowledgeSchema = z.object({
  keyName: z.string(), 
  productKey: z.string(),
  fieldType: z.string(),
  content: z.string(),
});
export type InsertProductKnowledge = z.infer<typeof insertProductKnowledgeSchema>;

// EXPORT JOBS TABLE
export const exportJobsTable = pgTable("export_jobs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  projectName: text("project_name"),
  displayFilename: text("display_filename"),
  type: varchar("type", { length: 50 }).notNull(), // 'pdf_single', 'pdf_bulk', 'pdf_catalog'
  status: varchar("status", { length: 20 }).notNull().default("pending"), 
  progress: integer("progress").default(0),
  resultUrl: text("result_url"),
  error: text("error"),
  fileName: text("file_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type ExportJob = typeof exportJobsTable.$inferSelect;
export type InsertExportJob = typeof exportJobsTable.$inferInsert;

export const insertExportJobSchema = z.object({
  type: z.enum(["pdf_single", "pdf_bulk", "pdf_catalog"]),
  fileName: z.string().optional(),
  projectName: z.string().optional(),
  displayFilename: z.string().optional(), 
});

// --- AI Logs Table with Token Counts ---
export const aiLogsTable = pgTable("ai_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  requestType: varchar("request_type", { length: 50 }).notNull(), // e.g., 'enrich', 'standardize', 'map'
  promptContent: text("prompt_content").notNull(),
  generatedResponse: text("generated_response"), 

  // Credits charged to user (Internal SaaS Currency)
  tokenCost: integer("token_cost").default(0),

  // Actual LLM Token Usage (From API)
  promptTokens: integer("prompt_tokens").default(0),
  completionTokens: integer("completion_tokens").default(0),

  createdAt: timestamp("created_at").defaultNow(),
});

export type AiLog = typeof aiLogsTable.$inferSelect;
export type InsertAiLog = typeof aiLogsTable.$inferInsert;