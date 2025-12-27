import express, { type Request, Response, NextFunction } from "express";
import { clerkMiddleware } from "@clerk/express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { WebhookHandlers } from "./webhookHandlers";
import { exec } from "child_process";
import { promisify } from "util";
import puppeteer from "puppeteer";
import { storage } from "./storage";
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import { rateLimit } from "express-rate-limit"; // --- NEW IMPORT ---

const execAsync = promisify(exec);

const app = express();

// --- FIX: Trust the Replit proxy ---
// This ensures that secure cookies (like Clerk's) are accepted even if the 
// internal Express server sees the request as HTTP.
app.set("trust proxy", 1); 
// -----------------------------------

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

const httpServer = createServer(app);

// --- RATE LIMITING CONFIGURATION ---
// 1. Strict Limiter: For AI routes (expensive API calls)
const strictLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 30, // Limit each IP to 30 AI requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down to prevent abuse." }
});

// 2. Export Limiter: Higher limit for bulk PDF exports (paid feature)
const exportLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 100, // Allow 100 PDF exports per minute for bulk operations
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Export rate limit reached. Please wait a moment." }
});

// 3. General API Limiter: For standard usage (saving, fetching)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // Limit each IP to 300 requests per 15 mins (approx 1 every 3 sec)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." }
});

// Apply Strict Limits to expensive AI routes
app.use("/api/ai", strictLimiter);

// Apply Export Limiter to PDF export (higher limit for bulk operations)
app.use("/api/export", exportLimiter);

// Apply Strict Limits to upload routes
app.use("/api/objects/upload", strictLimiter);

// Apply General Limits to all other API routes
app.use("/api", apiLimiter);
// -----------------------------------

// Add Clerk authentication middleware
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
async function checkGhostscript() {
  try {
    const { stdout } = await execAsync("gs --version");
    console.log(`✅ Ghostscript detected: v${stdout.trim()} (CMYK Export Ready)`);
  } catch (error) {
    console.warn("⚠️  Ghostscript NOT found. CMYK exports will fallback to RGB.");
  }
}

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

async function checkDatabase() {
  try {
    await storage.getUser("health_check_probe");
    console.log(`✅ Database connected`);
  } catch (error) {
    console.error("❌ CRITICAL: Database connection failed");
    console.error(error);
    Sentry.captureException(error);
  }
}

// Initialize Stripe (Async)
initStripe();

// Register Stripe webhook route BEFORE express.json()
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) return res.status(400).json({ error: 'Missing stripe-signature' });

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;
      if (!Buffer.isBuffer(req.body)) {
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

// --- SECURITY FIX: DoS Protection via Payload Size ---
// Use strict 1MB limit by default, but allow 50MB for specific heavy routes
const largePayloadRoutes = ['/api/export/pdf', '/api/export/preview', '/api/objects/upload'];

app.use((req, res, next) => {
  if (largePayloadRoutes.some(route => req.path.startsWith(route))) {
    // 50MB limit for export/upload routes
    express.json({ 
      limit: "50mb", 
      verify: (req, _res, buf) => { req.rawBody = buf; } 
    })(req, res, next);
  } else {
    // 1MB limit for everything else (Auth, Data saving, etc.)
    express.json({ 
      limit: "1mb", 
      verify: (req, _res, buf) => { req.rawBody = buf; } 
    })(req, res, next);
  }
});

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
  console.log("--- Starting System Checks ---");
  await Promise.all([
    checkGhostscript(),
    checkPuppeteer(),
    checkDatabase(),
  ]);
  console.log("--- System Checks Complete ---");

  await registerRoutes(httpServer, app);

  Sentry.setupExpressErrorHandler(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
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