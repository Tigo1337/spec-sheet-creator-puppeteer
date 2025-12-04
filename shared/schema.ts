import { z } from "zod";
import { pgTable, varchar, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

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
});

export type ElementFormat = z.infer<typeof formatSchema>;

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
  dataBinding: z.string().optional(), 

  // ✅ Correctly includes pageIndex
  pageIndex: z.number().default(0),

  textStyle: textStyleSchema.optional(),
  shapeStyle: shapeStyleSchema.optional(),
  format: formatSchema.optional(),

  shapeType: z.enum(["rectangle", "circle", "line"]).optional(),
  imageSrc: z.string().optional(),
  isImageField: z.boolean().default(false),
});

export type CanvasElement = z.infer<typeof canvasElementSchema>;

// Template schema
export const templateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  canvasWidth: z.number().default(816),
  canvasHeight: z.number().default(1056),

  // NEW: Added pageCount
  pageCount: z.number().default(1),

  // NEW: Added preview images array
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

  // NEW: Added pageCount
  pageCount: z.number().default(1),

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

export const availableFonts = [
  "Arial",
  "Comic Sans MS",
  "Courier New",
  "Georgia",
  "Impact",
  "Inter",
  "JetBrains Mono",
  "Lato",
  "Lora",
  "Merriweather",
  "Montserrat",
  "Nunito",
  "Open Sans",
  "Oswald",
  "Playfair Display",
  "Poppins",
  "Raleway",
  "Roboto",
  "Roboto Slab",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
] as const;

export const pageSizes = {
  letter: { width: 816, height: 1056 },
  a4: { width: 794, height: 1123 },
  legal: { width: 816, height: 1344 },
} as const;

// ============================================
// Drizzle ORM Table Definitions
// ============================================

export const savedDesignsTable = pgTable("saved_designs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  canvasWidth: integer("canvas_width").notNull().default(816),
  canvasHeight: integer("canvas_height").notNull().default(1056),

  // NEW: Store page count in DB
  pageCount: integer("page_count").notNull().default(1),

  backgroundColor: varchar("background_color", { length: 50 }).notNull().default("#ffffff"),
  elements: jsonb("elements").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const templatesTable = pgTable("templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  canvasWidth: integer("canvas_width").notNull().default(816),
  canvasHeight: integer("canvas_height").notNull().default(1056),

  // NEW: Store page count in DB
  pageCount: integer("page_count").notNull().default(1),

  // NEW: Store preview images
  previewImages: jsonb("preview_images").default([]),

  backgroundColor: varchar("background_color", { length: 50 }).notNull().default("#ffffff"),
  elements: jsonb("elements").notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const usersTable = pgTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  plan: varchar("plan", { length: 50 }).notNull().default("free"),
  planStatus: varchar("plan_status", { length: 50 }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type DbUser = typeof usersTable.$inferSelect;
export type InsertDbUser = typeof usersTable.$inferInsert;

export const dbUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  stripeCustomerId: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
  plan: z.enum(["free", "pro"]).default("free"),
  planStatus: z.enum(["active", "canceled", "past_due"]).default("active"),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const insertDbUserSchema = dbUserSchema.omit({ createdAt: true, updatedAt: true });