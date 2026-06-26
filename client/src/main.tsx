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

if (typeof window !== 'undefined') {
  const consent = localStorage.getItem('doculoom_cookie_consent');
  if (consent === 'accepted') {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN || "",
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
      ],
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  }
}

const PUBLISHABLE_KEY = isDevelopment
  ? (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY_DEV || import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
  : import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Syntactically-valid Clerk key (decodes to "clerk.example.com$") used ONLY when
// no real key is configured. Previously a missing key threw at module load,
// producing a white screen that also broke the SEO pre-render. With this
// fallback the public marketing pages still render (and pre-render) while auth
// degrades gracefully to a signed-out state. Set VITE_CLERK_PUBLISHABLE_KEY in
// any environment where authentication must actually work.
const FALLBACK_PUBLISHABLE_KEY = "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k";

const resolvedPublishableKey = PUBLISHABLE_KEY || FALLBACK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  const envVar = isDevelopment ? 'VITE_CLERK_PUBLISHABLE_KEY_DEV' : 'VITE_CLERK_PUBLISHABLE_KEY';
  console.warn(
    `[auth] Missing Clerk Publishable Key (${envVar}). Falling back to a non-functional placeholder so the app can render; authentication is disabled until a real key is set.`,
  );
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={resolvedPublishableKey}>
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        {/* Even if Sentry isn't initialized, the ErrorBoundary component 
            from @sentry/react will still work as a standard UI fallback */}
        <Sentry.ErrorBoundary fallback={<div className="p-4 text-red-500 font-bold">An unexpected error has occurred.</div>}>
          <App />
          <Toaster />
        </Sentry.ErrorBoundary>
      </HelmetProvider>
    </QueryClientProvider>
  </ClerkProvider>
);