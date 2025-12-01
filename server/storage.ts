import type { Template, InsertTemplate, SavedDesign, InsertSavedDesign } from "@shared/schema";
import { randomUUID } from "crypto";

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
}

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

  // Saved Designs methods
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
      userId: existing.userId, // Prevent userId from being changed
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
}

export const storage = new MemStorage();
