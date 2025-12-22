import express, { type Request, Response, NextFunction } from "express";
import { clerkMiddleware } from "@clerk/express";
import { runMigrations } from 'stripe-replit-sync';
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { exec } from "child_process";
import { promisify } from "util";
import puppeteer from "puppeteer";
import { storage } from "./storage";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const execAsync = promisify(exec);

const app = express();

// 1. INITIALIZE SENTRY (Must be the very first thing)
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    nodeProfilingIntegration(),
  ],
  // Performance Monitoring: Capture 100% of transactions for MVP
  tracesSampleRate: 1.0, 
  profilesSampleRate: 1.0, 
});

// NOTE: In Sentry v8, we do NOT manually add requestHandler or tracingHandler.
// Request isolation is now handled automatically by the SDK.

const httpServer = createServer(app);

// Add Clerk authentication middleware
// Select Clerk keys based on NODE_ENV to prevent dev/prod key mismatches
const isDevelopment = process.env.NODE_ENV !== 'production';

const clerkPublishableKey = isDevelopment 
  ? (process.env.VITE_CLERK_PUBLISHABLE_KEY_DEV || process.env.VITE_CLERK_PUBLISHABLE_KEY)
  : process.env.VITE_CLERK_PUBLISHABLE_KEY;

const clerkSecretKey = isDevelopment 
  ? (process.env.CLERK_SECRET_KEY_DEV || process.env.CLERK_SECRET_KEY)
  : process.env.CLERK_SECRET_KEY;

// Fail fast if required Clerk keys are missing
if (!clerkPublishableKey || !clerkSecretKey) {
  const envType = isDevelopment ? 'development' : 'production';
  console.error(`❌ CRITICAL: Missing Clerk keys for ${envType} environment.`);
  console.error(`   Required: ${isDevelopment ? 'VITE_CLERK_PUBLISHABLE_KEY_DEV & CLERK_SECRET_KEY_DEV (or fallback to prod keys)' : 'VITE_CLERK_PUBLISHABLE_KEY & CLERK_SECRET_KEY'}`);
  process.exit(1);
}

console.log(`Clerk configured for ${isDevelopment ? 'development' : 'production'} environment`);

app.use(clerkMiddleware({
  publishableKey: clerkPublishableKey,
  secretKey: clerkSecretKey,
}));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Initialize Stripe
async function initStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('STRIPE_SECRET_KEY not set, skipping Stripe initialization');
    return;
  }
  console.log('Stripe configured with manual API keys');
}

// === SMOKE TESTS ===

// 1. Ghostscript Check
async function checkGhostscript() {
  try {
    const { stdout } = await execAsync("gs --version");
    console.log(`✅ Ghostscript detected: v${stdout.trim()} (CMYK Export Ready)`);
  } catch (error) {
    console.warn("⚠️  Ghostscript NOT found. CMYK exports will fallback to RGB.");
    console.warn("   -> Fix: Add 'pkgs.ghostscript' to your replit.nix file.");
  }
}

// 2. Puppeteer Launch Check (non-blocking with timeout)
function checkPuppeteer() {
  const timeoutMs = 10000;
  const checkPromise = (async () => {
    try {
      console.log("Testing Puppeteer launch...");
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-setuid-sandbox']
      });
      const version = await browser.version();
      await browser.close();
      console.log(`✅ Puppeteer functional: ${version}`);
    } catch (error) {
      console.error("❌ Puppeteer failed to launch:", error);
      Sentry.captureException(error);
    }
  })();
  
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.log("⚠️  Puppeteer check timed out (will retry on first PDF export)");
      resolve();
    }, timeoutMs);
  });
  
  return Promise.race([checkPromise, timeoutPromise]);
}

// 3. Database Connection Check
async function checkDatabase() {
  try {
    // Attempt a lightweight query
    await storage.getUser("health_check_probe");
    console.log(`✅ Database connected`);
  } catch (error) {
    console.error("❌ CRITICAL: Database connection failed");
    console.error(error);
    Sentry.captureException(error);
  }
}
// ===================

// Initialize Stripe (Async)
initStripe();

// Register Stripe webhook route BEFORE express.json()
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        console.error('STRIPE WEBHOOK ERROR: req.body is not a Buffer');
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      Sentry.captureException(error);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

// Increase limit to 50mb for large file uploads
app.use(
  express.json({
    limit: "50mb", 
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "50mb" }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Run all Smoke Tests in parallel
  console.log("--- Starting System Checks ---");
  await Promise.all([
    checkGhostscript(),
    checkPuppeteer(),
    checkDatabase(),
  ]);
  console.log("--- System Checks Complete ---");

  await registerRoutes(httpServer, app);

  // 3. SENTRY ERROR HANDLER (Replaces app.use(Sentry.Handlers.errorHandler))
  Sentry.setupExpressErrorHandler(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    // throw err; // <-- REMOVED THIS to prevent duplicate header sending/crashing
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();