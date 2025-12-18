import type { Template, InsertTemplate, SavedDesign, InsertSavedDesign, CanvasElement, DbUser, InsertDbUser, QrCode, InsertQrCode } from "@shared/schema";
import { savedDesignsTable, templatesTable, usersTable, qrCodesTable } from "@shared/schema";
import { randomUUID } from "crypto";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, and, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface IStorage {
  getTemplates(): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, template: Partial<InsertTemplate>): Promise<Template | undefined>;
  deleteTemplate(id: string): Promise<boolean>;
  getDesignsByUser(userId: string): Promise<SavedDesign[]>;
  getDesign(id: string, userId: string): Promise<SavedDesign | undefined>;
  createDesign(design: InsertSavedDesign): Promise<SavedDesign>;
  updateDesign(id: string, userId: string, design: Partial<InsertSavedDesign>): Promise<SavedDesign | undefined>;
  deleteDesign(id: string, userId: string): Promise<boolean>;
  getUser(id: string): Promise<DbUser | undefined>;
  getUserByEmail(email: string): Promise<DbUser | undefined>;
  getUserByStripeCustomerId(stripeCustomerId: string): Promise<DbUser | undefined>;
  createUser(user: InsertDbUser): Promise<DbUser>;
  updateUser(id: string, updates: Partial<InsertDbUser>): Promise<DbUser | undefined>;
  updateUserStripeInfo(userId: string, stripeInfo: {
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    plan?: string;
    planStatus?: string;
  }): Promise<DbUser | undefined>;

  // QR Codes
  createQRCode(userId: string, destinationUrl: string, designId?: string): Promise<QrCode>;
  getQRCode(id: string): Promise<QrCode | undefined>;
  incrementQRCodeScan(id: string): Promise<void>;
  // NEW: QR Dashboard Methods
  getQRCodesByUser(userId: string): Promise<QrCode[]>;
  updateQRCode(id: string, userId: string, destinationUrl: string): Promise<QrCode | undefined>;

  // NEW: Usage Enforcement
  checkAndIncrementUsage(userId: string): Promise<{ allowed: boolean; count: number; limit: number }>;
}

export class DatabaseStorage implements IStorage {
  private db: ReturnType<typeof drizzle>;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is required for database storage");
    }
    const sql = neon(process.env.DATABASE_URL);
    this.db = drizzle(sql);
  }

  private toSavedDesign(row: typeof savedDesignsTable.$inferSelect): SavedDesign {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      description: row.description ?? undefined,
      canvasWidth: row.canvasWidth,
      canvasHeight: row.canvasHeight,
      pageCount: row.pageCount,
      backgroundColor: row.backgroundColor,
      elements: row.elements as CanvasElement[],
      type: (row.type as "single" | "catalog") || "single",
      catalogData: row.catalogData,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  private toTemplate(row: typeof templatesTable.$inferSelect): Template {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      canvasWidth: row.canvasWidth,
      canvasHeight: row.canvasHeight,
      pageCount: row.pageCount,
      previewImages: (row.previewImages as string[]) ?? [], 
      backgroundColor: row.backgroundColor,
      elements: row.elements as CanvasElement[],
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  // ... (Template Methods - No Change)
  async getTemplates(): Promise<Template[]> {
    const rows = await this.db.select().from(templatesTable).orderBy(desc(templatesTable.updatedAt));
    return rows.map(this.toTemplate);
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const rows = await this.db.select().from(templatesTable).where(eq(templatesTable.id, id)).limit(1);
    return rows[0] ? this.toTemplate(rows[0]) : undefined;
  }

  async createTemplate(insertTemplate: InsertTemplate): Promise<Template> {
    const id = randomUUID();
    const now = new Date();
    const rows = await this.db.insert(templatesTable).values({ ...insertTemplate, id, createdAt: now, updatedAt: now }).returning();
    return this.toTemplate(rows[0]);
  }

  async updateTemplate(id: string, updates: Partial<InsertTemplate>): Promise<Template | undefined> {
    const rows = await this.db.update(templatesTable).set({ ...updates, updatedAt: new Date() }).where(eq(templatesTable.id, id)).returning();
    return rows[0] ? this.toTemplate(rows[0]) : undefined;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const result = await this.db.delete(templatesTable).where(eq(templatesTable.id, id)).returning();
    return result.length > 0;
  }

  // ... (Design Methods - No Change)
  async getDesignsByUser(userId: string): Promise<SavedDesign[]> {
    const rows = await this.db.select().from(savedDesignsTable).where(eq(savedDesignsTable.userId, userId)).orderBy(desc(savedDesignsTable.updatedAt));
    return rows.map((row) => this.toSavedDesign(row));
  }

  async getDesign(id: string, userId: string): Promise<SavedDesign | undefined> {
    const rows = await this.db.select().from(savedDesignsTable).where(and(eq(savedDesignsTable.id, id), eq(savedDesignsTable.userId, userId))).limit(1);
    return rows[0] ? this.toSavedDesign(rows[0]) : undefined;
  }

  async createDesign(insertDesign: InsertSavedDesign): Promise<SavedDesign> {
    const id = randomUUID();
    const now = new Date();
    const rows = await this.db.insert(savedDesignsTable).values({ ...insertDesign, id, createdAt: now, updatedAt: now }).returning();
    return this.toSavedDesign(rows[0]);
  }

  async updateDesign(id: string, userId: string, updates: Partial<InsertSavedDesign>): Promise<SavedDesign | undefined> {
    const { userId: _, ...safeUpdates } = updates;
    const rows = await this.db.update(savedDesignsTable).set({ ...safeUpdates, updatedAt: new Date() }).where(and(eq(savedDesignsTable.id, id), eq(savedDesignsTable.userId, userId))).returning();
    return rows[0] ? this.toSavedDesign(rows[0]) : undefined;
  }

  async deleteDesign(id: string, userId: string): Promise<boolean> {
    const result = await this.db.delete(savedDesignsTable).where(and(eq(savedDesignsTable.id, id), eq(savedDesignsTable.userId, userId))).returning();
    return result.length > 0;
  }

  private toDbUser(row: typeof usersTable.$inferSelect): DbUser {
    return {
      id: row.id,
      email: row.email,
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
      plan: row.plan,
      planStatus: row.planStatus,
      pdfUsageCount: row.pdfUsageCount,
      pdfUsageResetDate: row.pdfUsageResetDate,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  async getUser(id: string): Promise<DbUser | undefined> {
    const rows = await this.db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    return rows[0] ? this.toDbUser(rows[0]) : undefined;
  }

  async getUserByEmail(email: string): Promise<DbUser | undefined> {
    const rows = await this.db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    return rows[0] ? this.toDbUser(rows[0]) : undefined;
  }

  async getUserByStripeCustomerId(stripeCustomerId: string): Promise<DbUser | undefined> {
    const rows = await this.db.select().from(usersTable).where(eq(usersTable.stripeCustomerId, stripeCustomerId)).limit(1);
    return rows[0] ? this.toDbUser(rows[0]) : undefined;
  }

  async createUser(user: InsertDbUser): Promise<DbUser> {
    const now = new Date();
    // Ensure usage fields are initialized correctly
    const rows = await this.db.insert(usersTable).values({ 
      ...user, 
      pdfUsageCount: 0,
      pdfUsageResetDate: now,
      createdAt: now, 
      updatedAt: now 
    }).returning();
    return this.toDbUser(rows[0]);
  }

  async updateUser(id: string, updates: Partial<InsertDbUser>): Promise<DbUser | undefined> {
    const rows = await this.db.update(usersTable).set({ ...updates, updatedAt: new Date() }).where(eq(usersTable.id, id)).returning();
    return rows[0] ? this.toDbUser(rows[0]) : undefined;
  }

  async updateUserStripeInfo(userId: string, stripeInfo: any): Promise<DbUser | undefined> {
    return this.updateUser(userId, stripeInfo);
  }

  // --- USAGE ENFORCEMENT LOGIC (FIXED) ---
  async checkAndIncrementUsage(userId: string): Promise<{ allowed: boolean; count: number; limit: number }> {
    const user = await this.getUser(userId);
    if (!user) {
      console.log(`[Usage Check] User not found: ${userId}`);
      return { allowed: false, count: 0, limit: 0 };
    }

    console.log(`[Usage Check] User: ${userId}, Plan: ${user.plan}, Count: ${user.pdfUsageCount}`);

    // Pro users = Unlimited
    if (user.plan === "pro") {
      return { allowed: true, count: user.pdfUsageCount || 0, limit: -1 };
    }

    const now = new Date();
    const lastReset = user.pdfUsageResetDate ? new Date(user.pdfUsageResetDate) : new Date(0);
    const limit = 50;

    // Check if new month (Reset Logic)
    const isNewMonth = now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear();
    let currentCount = user.pdfUsageCount || 0;

    if (isNewMonth) {
      console.log(`[Usage Check] New month detected. Resetting count to 1.`);
      currentCount = 0;
      // Reset logic
      await this.db.update(usersTable)
        .set({ 
          pdfUsageCount: 1, 
          pdfUsageResetDate: now,
          updatedAt: now // Force update timestamp so we can see the change
        })
        .where(eq(usersTable.id, userId));
      return { allowed: true, count: 1, limit };
    }

    if (currentCount >= limit) {
      console.log(`[Usage Check] Limit reached (${currentCount}/${limit}).`);
      return { allowed: false, count: currentCount, limit };
    }

    const newCount = currentCount + 1;
    console.log(`[Usage Check] Incrementing count to ${newCount}`);

    // EXPLICIT UPDATE (Removing Atomic SQL to fix potential compatibility issues)
    await this.db.update(usersTable)
      .set({ 
        pdfUsageCount: newCount,
        updatedAt: now // Force update timestamp so we can see the change
      })
      .where(eq(usersTable.id, userId));

    return { allowed: true, count: newCount, limit };
  }

  // QR Code Methods
  async createQRCode(userId: string, destinationUrl: string, designId?: string): Promise<QrCode> {
    const id = nanoid(8); 
    const [row] = await this.db.insert(qrCodesTable).values({ id, userId, destinationUrl, designId, scanCount: 0 }).returning();
    return row;
  }

  async getQRCode(id: string): Promise<QrCode | undefined> {
    const [row] = await this.db.select().from(qrCodesTable).where(eq(qrCodesTable.id, id));
    return row;
  }

  async incrementQRCodeScan(id: string): Promise<void> {
    await this.db.update(qrCodesTable).set({ scanCount: sql`${qrCodesTable.scanCount} + 1` }).where(eq(qrCodesTable.id, id));
  }

  async getQRCodesByUser(userId: string): Promise<QrCode[]> {
    const rows = await this.db.select().from(qrCodesTable).where(eq(qrCodesTable.userId, userId)).orderBy(desc(qrCodesTable.createdAt));
    return rows;
  }

  async updateQRCode(id: string, userId: string, destinationUrl: string): Promise<QrCode | undefined> {
    const [row] = await this.db.update(qrCodesTable).set({ destinationUrl, updatedAt: new Date() }).where(and(eq(qrCodesTable.id, id), eq(qrCodesTable.userId, userId))).returning();
    return row;
  }
}

export class MemStorage implements IStorage {
  private templates: Map<string, Template>;
  private designs: Map<string, SavedDesign>;
  private qrCodes: Map<string, QrCode>; 
  private users: Map<string, DbUser> = new Map();

  constructor() {
    this.templates = new Map();
    this.designs = new Map();
    this.qrCodes = new Map();
  }

  // ... (All MemStorage methods must implement the interface, including usage tracking)
  async getTemplates(): Promise<Template[]> { return Array.from(this.templates.values()); }
  async getTemplate(id: string) { return this.templates.get(id); }
  async createTemplate(t: InsertTemplate) { const id = randomUUID(); const now = new Date().toISOString(); const tmpl = { ...t, id, previewImages: t.previewImages || [], createdAt: now, updatedAt: now }; this.templates.set(id, tmpl); return tmpl; }
  async updateTemplate(id: string, u: Partial<InsertTemplate>) { const e = this.templates.get(id); if(!e) return undefined; const n = { ...e, ...u, updatedAt: new Date().toISOString() }; this.templates.set(id, n); return n; }
  async deleteTemplate(id: string) { return this.templates.delete(id); }

  async getDesignsByUser(userId: string) { return Array.from(this.designs.values()).filter(d => d.userId === userId); }
  async getDesign(id: string, userId: string) { const d = this.designs.get(id); return d?.userId === userId ? d : undefined; }
  async createDesign(d: InsertSavedDesign) { const id = randomUUID(); const now = new Date().toISOString(); const des = { ...d, id, createdAt: now, updatedAt: now }; this.designs.set(id, des); return des; }
  async updateDesign(id: string, userId: string, u: Partial<InsertSavedDesign>) { const e = this.designs.get(id); if(!e || e.userId !== userId) return undefined; const n = { ...e, ...u, updatedAt: new Date().toISOString() }; this.designs.set(id, n); return n; }
  async deleteDesign(id: string, userId: string) { const e = this.designs.get(id); if(!e || e.userId !== userId) return false; return this.designs.delete(id); }

  async getUser(id: string) { return this.users.get(id); }
  async getUserByEmail(email: string) { return Array.from(this.users.values()).find(u => u.email === email); }
  async getUserByStripeCustomerId(cid: string) { return Array.from(this.users.values()).find(u => u.stripeCustomerId === cid); }
  async createUser(u: InsertDbUser) { const now = new Date().toISOString(); const dbUser = { ...u, stripeCustomerId: u.stripeCustomerId||null, stripeSubscriptionId: u.stripeSubscriptionId||null, plan: u.plan||'free', planStatus: u.planStatus||'active', pdfUsageCount: 0, pdfUsageResetDate: new Date(), createdAt: now, updatedAt: now }; this.users.set(u.id, dbUser); return dbUser; }
  async updateUser(id: string, u: Partial<InsertDbUser>) { const e = this.users.get(id); if(!e) return undefined; const n = { ...e, ...u, updatedAt: new Date().toISOString() }; this.users.set(id, n); return n; }
  async updateUserStripeInfo(uid: string, info: any) { return this.updateUser(uid, info); }

  async createQRCode(userId: string, destinationUrl: string, designId?: string) { const id = nanoid(8); const now = new Date(); const q = { id, userId, destinationUrl, designId: designId ?? null, scanCount: 0, createdAt: now, updatedAt: now }; this.qrCodes.set(id, q); return q; }
  async getQRCode(id: string) { return this.qrCodes.get(id); }
  async incrementQRCodeScan(id: string) { const q = this.qrCodes.get(id); if(q) { q.scanCount = (q.scanCount||0)+1; this.qrCodes.set(id, q); } }
  async getQRCodesByUser(userId: string) { return Array.from(this.qrCodes.values()).filter(q => q.userId === userId); }
  async updateQRCode(id: string, userId: string, url: string) { const q = this.qrCodes.get(id); if(!q || q.userId !== userId) return undefined; const n = { ...q, destinationUrl: url, updatedAt: new Date() }; this.qrCodes.set(id, n); return n; }

  async checkAndIncrementUsage(userId: string) {
    const user = this.users.get(userId);
    if (!user) return { allowed: false, count: 0, limit: 0 };
    if (user.plan === "pro") return { allowed: true, count: 0, limit: -1 };

    const count = (user.pdfUsageCount || 0) + 1;
    if (count > 50) return { allowed: false, count: count - 1, limit: 50 };

    user.pdfUsageCount = count;
    return { allowed: true, count, limit: 50 };
  }
}

export const storage: IStorage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();