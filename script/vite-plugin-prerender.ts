import path from "path";
import fs from "fs/promises";
import http from "http";
import type { AddressInfo } from "net";
import type { Plugin, ResolvedConfig } from "vite";

/**
 * Build-time static pre-rendering for the public marketing routes.
 *
 * Why a custom plugin instead of `vite-plugin-prerender`? That package was last
 * published in 2022 and pulls in an unmaintained, puppeteer-based stack. The
 * maintained alternative (`@prerenderer/prerenderer`) wants the full `puppeteer`
 * package, which downloads its own Chromium and is fragile in CI. This repo
 * already ships `puppeteer-core`, and a Chromium binary is available locally, so
 * we drive that directly. It renders the *real* client bundle in a real browser
 * (no SSR-safety refactor of Clerk/wouter required) and snapshots the resulting
 * DOM + <head> (react-helmet-async tags) into static HTML files.
 *
 * The step is intentionally NON-FATAL: if no browser is available, or a route
 * fails to render, the build still succeeds and the app falls back to the normal
 * SPA shell for that route. SEO is an enhancement here, never a build blocker.
 */

interface PrerenderOptions {
  /** Routes to pre-render, e.g. ["/", "/features", "/pricing"]. */
  routes: string[];
  /** Per-route timeout in ms while waiting for the app to mount. */
  timeout?: number;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json",
};

export function prerender(options: PrerenderOptions): Plugin {
  let outDir = "";

  return {
    name: "spec-sheet-prerender",
    // Only participate in `vite build`; never in the dev server / middleware mode.
    apply: "build",
    // Run after the bundle (and other plugins') output has been written.
    enforce: "post",
    configResolved(config: ResolvedConfig) {
      outDir = config.build.outDir;
    },
    async closeBundle() {
      if (process.env.PRERENDER === "false") {
        console.log("[prerender] Disabled via PRERENDER=false — skipping.");
        return;
      }
      try {
        await runPrerender(outDir, options.routes, options.timeout ?? 30_000);
      } catch (err) {
        // Non-fatal: the SPA shell still serves every route correctly.
        console.warn(
          "\n[prerender] Skipped — the build still produced a working SPA shell.",
        );
        console.warn("[prerender] Reason:", (err as Error)?.message ?? err);
      }
    },
  };
}

async function runPrerender(outDir: string, routes: string[], timeout: number) {
  const distPath = path.isAbsolute(outDir)
    ? outDir
    : path.resolve(process.cwd(), outDir);

  // The client build must exist before we can pre-render it.
  await fs.access(path.join(distPath, "index.html"));

  const executablePath = await resolveChromium();
  if (!executablePath) {
    throw new Error(
      "No Chromium executable found. Set PUPPETEER_EXECUTABLE_PATH to a Chrome/Chromium binary.",
    );
  }

  const { server, origin } = await startStaticServer(distPath);

  // Imported lazily so the dev server never loads puppeteer.
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  console.log(`[prerender] Rendering ${routes.length} route(s) via ${executablePath}`);

  try {
    for (const route of routes) {
      try {
        await prerenderRoute(browser, origin, distPath, route, timeout);
      } catch (err) {
        // Isolate failures so one bad route doesn't drop the others.
        console.warn(
          `[prerender] ${route} failed (${(err as Error)?.message ?? err}) — SPA fallback retained.`,
        );
      }
    }
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function prerenderRoute(
  browser: import("puppeteer-core").Browser,
  origin: string,
  distPath: string,
  route: string,
  timeout: number,
) {
  const page = await browser.newPage();
  try {
    // Hermetic + fast: only allow requests back to our local static server.
    // External calls (Google Fonts, Clerk, Sentry, analytics) are aborted —
    // they don't affect the marketing HTML/<head> we snapshot, and blocking
    // them avoids network hangs in CI.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith(origin) || url.startsWith("data:") || url.startsWith("blob:")) {
        req.continue();
      } else {
        req.abort();
      }
    });

    await page.goto(origin + route, { waitUntil: "domcontentloaded", timeout });

    // Wait until React has actually mounted content into #root.
    await page.waitForFunction(
      () => {
        const root = document.getElementById("root");
        return !!root && root.children.length > 0;
      },
      { timeout },
    );

    // Let react-helmet-async flush its <head> mutations.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const html = await page.evaluate(
      () => "<!DOCTYPE html>\n" + document.documentElement.outerHTML,
    );

    const outPath =
      route === "/"
        ? path.join(distPath, "index.html")
        : path.join(distPath, route.replace(/^\/+/, ""), "index.html");

    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, html, "utf-8");
    console.log(
      `[prerender] ${route} -> ${path.relative(process.cwd(), outPath)}`,
    );
  } finally {
    await page.close();
  }
}

/** Locate a usable Chromium/Chrome binary across common environments. */
async function resolveChromium(): Promise<string | null> {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    "/opt/pw-browsers/chromium", // pre-installed in this execution environment
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter((c): c is string => Boolean(c));

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/**
 * Minimal static file server with SPA fallback, mirroring how the production
 * Express server serves `dist/public`. The fallback shell is captured before
 * pre-rendering overwrites files, so unknown routes always boot the SPA.
 */
async function startStaticServer(distPath: string) {
  const fallbackHtml = await fs.readFile(
    path.join(distPath, "index.html"),
    "utf-8",
  );

  const server = http.createServer(async (req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
      let filePath = path.normalize(path.join(distPath, urlPath));

      // Guard against path traversal outside the build directory.
      if (!filePath.startsWith(distPath)) {
        res.statusCode = 403;
        return res.end();
      }

      let stat = await fs.stat(filePath).catch(() => null);
      if (stat?.isDirectory()) {
        filePath = path.join(filePath, "index.html");
        stat = await fs.stat(filePath).catch(() => null);
      }

      if (stat?.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader("Content-Type", MIME[ext] || "application/octet-stream");
        return res.end(await fs.readFile(filePath));
      }

      // SPA fallback — the client router resolves the actual route.
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(fallbackHtml);
    } catch {
      res.statusCode = 500;
      res.end();
    }
  });

  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const port = (server.address() as AddressInfo).port;
  return { server, origin: `http://127.0.0.1:${port}` };
}
