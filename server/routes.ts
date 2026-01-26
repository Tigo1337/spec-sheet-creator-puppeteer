/**
 * Main routes configuration
 * Mounts all route modules and handles top-level routes
 */

import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "./objectStorage";

// Import route modules
import aiRouter from "./routes/ai";
import exportRouter from "./routes/export";
import jobsRouter from "./routes/jobs";
import commerceRouter from "./routes/commerce";
import assetsRouter, { objectStorageService } from "./routes/assets";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // Health check endpoint
  app.get("/health", async (req, res) => {
    const health = {
      uptime: process.uptime(),
      timestamp: Date.now(),
      status: "OK",
      checks: { database: "unknown", stripe: "unknown" }
    };

    try {
      await storage.getUser("health-check-probe");
      health.checks.database = "connected";
    } catch (e) {
      health.checks.database = "disconnected";
      health.status = "DEGRADED";
      console.error("Health check failed: Database", e);
    }

    health.checks.stripe = process.env.STRIPE_SECRET_KEY ? "configured" : "missing_key";
    res.status(health.status === "OK" ? 200 : 503).json(health);
  });

  // QR code redirect (short URL)
  app.get("/q/:id", async (req, res) => {
    try {
      const qr = await storage.getQRCode(req.params.id);
      if (qr) {
        storage.incrementQRCodeScan(req.params.id).catch(console.error);
        return res.redirect(302, qr.destinationUrl);
      }
      res.status(404).send("Not found");
    } catch {
      res.status(500).send("Error");
    }
  });

  // Public object storage routes
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    try {
      const file = await objectStorageService.searchPublicObject(req.params.filePath);
      if (!file) return res.status(404).json({ error: "Not found" });
      objectStorageService.downloadObject(file, res);
    } catch {
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const f = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(f, res);
    } catch (e) {
      res.sendStatus(e instanceof ObjectNotFoundError ? 404 : 500);
    }
  });

  // Mount API route modules
  app.use("/api/ai", aiRouter);
  app.use("/api/export", exportRouter);
  app.use("/api/jobs", jobsRouter);
  app.use("/api", commerceRouter);  // Includes /api/plans, /api/checkout, /api/subscription, /api/users/sync, etc.
  app.use("/api", assetsRouter);    // Includes /api/designs, /api/templates, /api/qrcodes, /api/objects/*

  return httpServer;
}
