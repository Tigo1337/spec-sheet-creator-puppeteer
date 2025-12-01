import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <SignedOut>
          <div className="flex items-center justify-center h-screen bg-background">
            <div className="text-center">
              <h1 className="text-2xl font-bold mb-4">SpecSheet Builder</h1>
              <p className="text-muted-foreground mb-6">Sign in to continue</p>
              <SignInButton mode="modal" />
            </div>
          </div>
        </SignedOut>
        <SignedIn>
          <Router />
        </SignedIn>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
