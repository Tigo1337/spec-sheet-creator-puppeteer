import { useEffect, useState } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SignedIn, SignedOut, useClerk, useUser } from "@clerk/clerk-react"; // Added useUser
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

function AppContent() {
  const { loaded } = useClerk();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    if (loaded) {
      setIsInitializing(false);
    }
  }, [loaded]);

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
      {/* Public Marketing Routes - Accessible to everyone */}
      <Route path="/" component={Homepage} />
      <Route path="/solutions" component={Solutions} />
      <Route path="/features" component={Features} />
      <Route path="/pricing" component={Pricing} />

      {/* Auth Routes */}
      <Route path="/login" component={Login} />
      <Route path="/registration" component={Registration} />

      {/* Checkout handles its own auth redirects internally */}
      <Route path="/checkout" component={Checkout} />
      <Route path="/checkout/success" component={CheckoutSuccess} />

      {/* Protected App Route */}
      <Route path="/editor">
        {/* If signed in, show Editor. If not, redirect to Login */}
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;