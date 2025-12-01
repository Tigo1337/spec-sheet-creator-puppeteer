import { useEffect, useState } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SignedIn, SignedOut, SignIn, useClerk } from "@clerk/clerk-react";
import Editor from "@/pages/Editor";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Editor} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { loaded } = useClerk();
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Wait for Clerk to finish loading and checking for an existing session
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
    <>
      <SignedOut>
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="w-full max-w-md p-6">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold">SpecSheet Builder</h1>
              <p className="text-muted-foreground mt-2">Sign in to continue</p>
            </div>
            <SignIn 
              routing="hash"
              signUpUrl="#/sign-up"
              appearance={{
                elements: {
                  rootBox: "mx-auto",
                  card: "shadow-none"
                }
              }}
            />
          </div>
        </div>
      </SignedOut>
      <SignedIn>
        <Router />
      </SignedIn>
    </>
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
