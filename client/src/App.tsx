import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SignedIn, SignedOut, SignIn, UserButton } from "@clerk/clerk-react";
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
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
