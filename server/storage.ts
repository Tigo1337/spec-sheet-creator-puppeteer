import type { Template, InsertTemplate, SavedDesign, InsertSavedDesign, CanvasElement, DbUser, InsertDbUser } from "@shared/schema";
import { savedDesignsTable, templatesTable, usersTable } from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Templates (legacy)
  getTemplates(): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, template: Partial<InsertTemplate>): Promise<Template | undefined>;
  deleteTemplate(id: string): Promise<boolean>;
  
  // Saved Designs (user-specific)
  getDesignsByUser(userId: string): Promise<SavedDesign[]>;
  getDesign(id: string, userId: string): Promise<SavedDesign | undefined>;
  createDesign(design: InsertSavedDesign): Promise<SavedDesign>;
  updateDesign(id: string, userId: string, design: Partial<InsertSavedDesign>): Promise<SavedDesign | undefined>;
  deleteDesign(id: string, userId: string): Promise<boolean>;
  
  // Users (with Stripe info)
  getUser(id: string): Promise<DbUser | undefined>;
  getUserByEmail(email: string): Promise<DbUser | undefined>;
  createUser(user: InsertDbUser): Promise<DbUser>;
  updateUser(id: string, updates: Partial<InsertDbUser>): Promise<DbUser | undefined>;
  updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    plan?: string;
    planStatus?: string;
  }): Promise<DbUser | undefined>;
}

// Database Storage implementation using Drizzle ORM with Neon PostgreSQL
export class DatabaseStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required for database storage");
    }
    const sql = neon(process.env.DATABASE_URL);
    this.db = drizzle(sql);
  }

  // Helper to convert database row to SavedDesign type
  // Note: Neon HTTP driver may return timestamps as strings, so we normalize to ISO format
  private toSavedDesign(row: typeof savedDesignsTable.$inferSelect): SavedDesign {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description ?? undefined,
      canvasWidth: row.canvasWidth,
      canvasHeight: row.canvasHeight,
      backgroundColor: row.backgroundColor,
      elements: row.elements as CanvasElement[],
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  // Helper to convert database row to Template type
  // Note: Neon HTTP driver may return timestamps as strings, so we normalize to ISO format
  private toTemplate(row: typeof templatesTable.$inferSelect): Template {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      canvasWidth: row.canvasWidth,
      canvasHeight: row.canvasHeight,
      backgroundColor: row.backgroundColor,
      elements: row.elements as CanvasElement[],
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  // Templates methods
  async getTemplates(): Promise<Template[]> {
    const rows = await this.db
      .select()
      .from(templatesTable)
      .orderBy(desc(templatesTable.updatedAt));
    return rows.map(this.toTemplate);
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const rows = await this.db
      .select()
      .from(templatesTable)
      .where(eq(templatesTable.id, id))
      .limit(1);
    return rows[0] ? this.toTemplate(rows[0]) : undefined;
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const id = randomUUID();
    const now = new Date();
    const rows = await this.db
      .insert(templatesTable)
      .values({
        id,
        name: insertTemplate.name,
        description: insertTemplate.description,
        canvasWidth: insertTemplate.canvasWidth,
        canvasHeight: insertTemplate.canvasHeight,
        backgroundColor: insertTemplate.backgroundColor,
        elements: insertTemplate.elements,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return this.toTemplate(rows[0]);
  }

  async updateTemplate(id: string, updates: Partial<InsertTemplate>): Promise<Template | undefined> {
    const rows = await this.db
      .update(templatesTable)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(templatesTable.id, id))
      .returning();
    return rows[0] ? this.toTemplate(rows[0]) : undefined;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const result = await this.db
      .delete(templatesTable)
      .where(eq(templatesTable.id, id))
      .returning();
    return result.length > 0;
  }

  // Saved Designs methods
  async getDesignsByUser(userId: string): Promise<SavedDesign[]> {
    const rows = await this.db
      .select()
      .from(savedDesignsTable)
      .where(eq(savedDesignsTable.userId, userId))
      .orderBy(desc(savedDesignsTable.updatedAt));
    return rows.map(this.toSavedDesign);
  }

  async getDesign(id: string, userId: string): Promise<SavedDesign | undefined> {
    const rows = await this.db
      .select()
      .from(savedDesignsTable)
      .where(and(
        eq(savedDesignsTable.id, id),
        eq(savedDesignsTable.userId, userId)
      ))
      .limit(1);
    return rows[0] ? this.toSavedDesign(rows[0]) : undefined;
  }

  async createDesign(insertDesign: InsertSavedDesign): Promise<SavedDesign> {
    const id = randomUUID();
    const now = new Date();
    const rows = await this.db
      .insert(savedDesignsTable)
      .values({
        id,
        userId: insertDesign.userId,
        name: insertDesign.name,
        description: insertDesign.description,
        canvasWidth: insertDesign.canvasWidth,
        canvasHeight: insertDesign.canvasHeight,
        backgroundColor: insertDesign.backgroundColor,
        elements: insertDesign.elements,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return this.toSavedDesign(rows[0]);
  }

  async updateDesign(id: string, userId: string, updates: Partial<InsertSavedDesign>): Promise<SavedDesign | undefined> {
    // Ensure userId cannot be changed
    const { userId: _, ...safeUpdates } = updates;
    
    const rows = await this.db
      .update(savedDesignsTable)
      .set({
        ...safeUpdates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(savedDesignsTable.id, id),
        eq(savedDesignsTable.userId, userId)
      ))
      .returning();
    return rows[0] ? this.toSavedDesign(rows[0]) : undefined;
  }

  async deleteDesign(id: string, userId: string): Promise<boolean> {
    const result = await this.db
      .delete(savedDesignsTable)
      .where(and(
        eq(savedDesignsTable.id, id),
        eq(savedDesignsTable.userId, userId)
      ))
      .returning();
    return result.length > 0;
  }

  // Helper to convert database row to DbUser type
  private toDbUser(row: typeof usersTable.$inferSelect): DbUser {
    return {
      id: row.id,
      email: row.email,
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
      plan: row.plan,
      planStatus: row.planStatus,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  // User methods
  async getUser(id: string): Promise<DbUser | undefined> {
    const rows = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    return rows[0] ? this.toDbUser(rows[0]) : undefined;
  }

  async getUserByEmail(email: string): Promise<DbUser | undefined> {
    const rows = await this.db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);
    return rows[0] ? this.toDbUser(rows[0]) : undefined;
  }

  async createUser(user: InsertDbUser): Promise<DbUser> {
    const now = new Date();
    const rows = await this.db
      .insert(usersTable)
      .values({
        id: user.id,
        email: user.email,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        plan: user.plan || 'free',
        planStatus: user.planStatus || 'active',
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return this.toDbUser(rows[0]);
  }

  async updateUser(id: string, updates: Partial<InsertDbUser>): Promise<DbUser | undefined> {
    const rows = await this.db
      .update(usersTable)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, id))
      .returning();
    return rows[0] ? this.toDbUser(rows[0]) : undefined;
  }

  async updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    plan?: string;
    planStatus?: string;
  }): Promise<DbUser | undefined> {
    const rows = await this.db
      .update(usersTable)
      .set({
        ...stripeInfo,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, userId))
      .returning();
    return rows[0] ? this.toDbUser(rows[0]) : undefined;
  }

  // Stripe data queries (from stripe schema managed by stripe-replit-sync)
  async getProduct(productId: string) {
    const result = await this.db.execute(
      sql`SELECT * FROM stripe.products WHERE id = ${productId}`
    );
    return result.rows[0] || null;
  }

  async listProducts(active = true, limit = 20, offset = 0) {
    const result = await this.db.execute(
      sql`SELECT * FROM stripe.products WHERE active = ${active} LIMIT ${limit} OFFSET ${offset}`
    );
    return result.rows;
  }

  async listProductsWithPrices(active = true, limit = 20, offset = 0) {
    const result = await this.db.execute(
      sql`
        WITH paginated_products AS (
          SELECT id, name, description, metadata, active
          FROM stripe.products
          WHERE active = ${active}
          ORDER BY id
          LIMIT ${limit} OFFSET ${offset}
        )
        SELECT 
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.active as product_active,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring,
          pr.active as price_active,
          pr.metadata as price_metadata
        FROM paginated_products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        ORDER BY p.id, pr.unit_amount
      `
    );
    return result.rows;
  }

  async getPrice(priceId: string) {
    const result = await this.db.execute(
      sql`SELECT * FROM stripe.prices WHERE id = ${priceId}`
    );
    return result.rows[0] || null;
  }

  async listPrices(active = true, limit = 20, offset = 0) {
    const result = await this.db.execute(
      sql`SELECT * FROM stripe.prices WHERE active = ${active} LIMIT ${limit} OFFSET ${offset}`
    );
    return result.rows;
  }

  async getPricesForProduct(productId: string) {
    const result = await this.db.execute(
      sql`SELECT * FROM stripe.prices WHERE product = ${productId} AND active = true`
    );
    return result.rows;
  }

  async getSubscription(subscriptionId: string) {
    const result = await this.db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return result.rows[0] || null;
  }
}

// Legacy MemStorage for fallback (kept for reference)
export class MemStorage implements IStorage {
  private templates: Map<string, Template>;
  private designs: Map<string, SavedDesign>;

  constructor() {
    this.templates = new Map();
    this.designs = new Map();
  }

  async getTemplates(): Promise<Template[]> {
    return Array.from(this.templates.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    return this.templates.get(id);
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const template: Template = {
      ...insertTemplate,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.templates.set(id, template);
    return template;
  }

  async updateTemplate(id: string, updates: Partial<InsertTemplate>): Promise<Template | undefined> {
    const existing = this.templates.get(id);
    if (!existing) return undefined;

    const updated: Template = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.templates.set(id, updated);
    return updated;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    return this.templates.delete(id);
  }

  async getDesignsByUser(userId: string): Promise<SavedDesign[]> {
    return Array.from(this.designs.values())
      .filter((design) => design.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getDesign(id: string, userId: string): Promise<SavedDesign | undefined> {
    const design = this.designs.get(id);
    if (!design || design.userId !== userId) return undefined;
    return design;
  }

  async createDesign(insertDesign: InsertSavedDesign): Promise<SavedDesign> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const design: SavedDesign = {
      ...insertDesign,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.designs.set(id, design);
    return design;
  }

  async updateDesign(id: string, userId: string, updates: Partial<InsertSavedDesign>): Promise<SavedDesign | undefined> {
    const existing = this.designs.get(id);
    if (!existing || existing.userId !== userId) return undefined;

    const updated: SavedDesign = {
      ...existing,
      ...updates,
      userId: existing.userId,
      updatedAt: new Date().toISOString(),
    };
    this.designs.set(id, updated);
    return updated;
  }

  async deleteDesign(id: string, userId: string): Promise<boolean> {
    const existing = this.designs.get(id);
    if (!existing || existing.userId !== userId) return false;
    return this.designs.delete(id);
  }

  // User methods (stub implementations - MemStorage requires DATABASE_URL for real use)
  private users: Map<string, DbUser> = new Map();

  async getUser(id: string): Promise<DbUser | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<DbUser | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(user: InsertDbUser): Promise<DbUser> {
    const now = new Date().toISOString();
    const dbUser: DbUser = {
      id: user.id,
      email: user.email,
      stripeCustomerId: user.stripeCustomerId || null,
      stripeSubscriptionId: user.stripeSubscriptionId || null,
      plan: user.plan || 'free',
      planStatus: user.planStatus || 'active',
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, dbUser);
    return dbUser;
  }

  async updateUser(id: string, updates: Partial<InsertDbUser>): Promise<DbUser | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    const updated: DbUser = { ...existing, ...updates, updatedAt: new Date().toISOString() };
    this.users.set(id, updated);
    return updated;
  }

  async updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    plan?: string;
    planStatus?: string;
  }): Promise<DbUser | undefined> {
    return this.updateUser(userId, stripeInfo);
  }
}

// Use DatabaseStorage when DATABASE_URL is available, otherwise fallback to MemStorage
export const storage: IStorage = process.env.DATABASE_URL 
  ? new DatabaseStorage() 
  : new MemStorage();
