import { useEffect } from "react";
import { Switch, Route, Redirect } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SignedIn, SignedOut, useAuth } from "@clerk/clerk-react"; 

// Page Imports
import Editor from "@/pages/Editor";
import Homepage from "@/pages/Homepage";
import Solutions from "@/pages/Solutions";
import Features from "@/pages/Features";
import Pricing from "@/pages/Pricing";
import Login from "@/pages/Login";
import Demo from "@/pages/Demo";
import TemplateLibrary from "@/pages/TemplateLibrary";
import Registration from "@/pages/Registration";
import Checkout from "@/pages/Checkout";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import NotFound from "@/pages/not-found";
// Legal Pages
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import CookieBanner from "@/components/layout/CookieBanner";

// Support Widget Import
import { SupportWidget } from "@/components/support/SupportWidget";

function AppContent() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  // Sync the authenticated user to our DB once Clerk has loaded. This is a
  // side-effect only — it intentionally does NOT gate rendering. The public
  // marketing pages must render immediately (no auth-loading spinner) so they
  // are crawlable and can be statically pre-rendered for SEO/GEO. The protected
  // /editor route is still guarded below by Clerk's <SignedIn>/<SignedOut>.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    const syncUser = async () => {
      try {
        const token = await getToken();
        await fetch("/api/users/sync", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        console.error("User sync failed:", error);
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, getToken]);

  return (
    <>
      <Switch>
        {/* Public Marketing Routes */}
        <Route path="/" component={Homepage} />
        <Route path="/solutions" component={Solutions} />
        <Route path="/features" component={Features} />
        <Route path="/templates" component={TemplateLibrary} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/demo" component={Demo} />

        {/* Legal Routes */}
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />

        {/* Auth Routes */}
        <Route path="/login" component={Login} />
        <Route path="/registration" component={Registration} />

        {/* Checkout Handles Logic for Paid vs Free */}
        <Route path="/checkout" component={Checkout} />
        <Route path="/checkout/success" component={CheckoutSuccess} />

        {/* Protected App Route */}
        <Route path="/editor">
          <SignedIn>
            <Editor />
          </SignedIn>
          <SignedOut>
            <Redirect to="/login" />
          </SignedOut>
        </Route>

        {/* Fallback */}
        <Route component={NotFound} />
      </Switch>

      {/* Persistent Support Widget (Visible on all pages) */}
      <SupportWidget />
      <CookieBanner />
    </>
  );
}

function App() {
  return (
    <TooltipProvider>
      <AppContent />
    </TooltipProvider>
  );
}

export default App;