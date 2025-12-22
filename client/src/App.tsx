import { useEffect, useState } from "react";
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
import Registration from "@/pages/Registration";
import Checkout from "@/pages/Checkout";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import NotFound from "@/pages/not-found";
// Legal Pages
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";

function AppContent() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [isInitializing, setIsInitializing] = useState(true);

  // 1. Sync User to DB on Load
  useEffect(() => {
    const syncUser = async () => {
      if (isLoaded && isSignedIn) {
        try {
          const token = await getToken();
          await fetch("/api/users/sync", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (error) {
          console.error("User sync failed:", error);
        }
      }
      if (isLoaded) {
        setIsInitializing(false);
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, getToken]);

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public Marketing Routes */}
      <Route path="/" component={Homepage} />
      <Route path="/solutions" component={Solutions} />
      <Route path="/features" component={Features} />
      <Route path="/pricing" component={Pricing} />

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