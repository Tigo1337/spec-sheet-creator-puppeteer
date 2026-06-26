import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { prerender } from "./script/vite-plugin-prerender";

// Fix for "import.meta.dirname" to make TypeScript and older Node versions happy
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Public marketing routes that should ship as crawlable static HTML for SEO/GEO.
// (Auth, checkout and the editor stay client-only on purpose.)
const PRERENDER_ROUTES = ["/", "/features", "/pricing", "/solutions"];

export default defineConfig({
  plugins: [
    react(),
    // Generates static HTML snapshots of the marketing routes at build time so
    // SEO bots and AI crawlers receive fully-rendered markup instead of an empty
    // <div id="root">. No-op during `vite` dev (apply: "build") and non-fatal if
    // Chromium is unavailable. Disable with PRERENDER=false.
    prerender({ routes: PRERENDER_ROUTES }),
    // Only load Replit plugins if we are actually IN Replit (not in CI)
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
