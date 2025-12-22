import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { ClerkProvider } from "@clerk/clerk-react";
import * as Sentry from "@sentry/react";
import { HelmetProvider } from "react-helmet-async";

// --- Configuration Checks ---

// 1. Clerk Key - Select based on environment
// In development mode (Vite dev server), use DEV keys if available
// In production builds, always use production keys
const isDevelopment = import.meta.env.DEV;

const PUBLISHABLE_KEY = isDevelopment 
  ? (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY_DEV || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
  : import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  const envType = isDevelopment ? 'development' : 'production';
  throw new Error(`Missing Clerk Publishable Key for ${envType} environment. Please set ${isDevelopment ? 'VITE_CLERK_PUBLISHABLE_KEY_DEV' : 'VITE_CLERK_PUBLISHABLE_KEY'} in your environment.`);
}

// 2. Sentry Init
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || "", // Ensure DSN is set in .env
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of the transactions
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, always sample the session when an error occurs.
});

createRoot(document.getElementById("root")!).render(
  // ClerkProvider must wrap the App so useClerk works inside App.tsx
  <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
    <QueryClientProvider client={queryClient}>
      {/* 2. Wrap App in HelmetProvider for SEO management */}
      <HelmetProvider>
        {/* Sentry Error Boundary catches crashes in the App */}
        <Sentry.ErrorBoundary fallback={<div className="p-4 text-red-500 font-bold">An unexpected error has occurred.</div>}>
          <App />
          <Toaster />
        </Sentry.ErrorBoundary>
      </HelmetProvider>
    </QueryClientProvider>
  </ClerkProvider>
);