import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Checkout() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const urlParams = new URLSearchParams(window.location.search);
  let priceId = urlParams.get("priceId");
  let plan = urlParams.get("plan");

  if (!priceId || !plan) {
    const pending = sessionStorage.getItem("pendingCheckout");
    if (pending) {
      const { plan: p, priceId: pid } = JSON.parse(pending);
      plan = p;
      priceId = pid;
    }
  }

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      // If not signed in, redirect to registration
      // Pass params along if they exist so the user isn't lost
      const params = new URLSearchParams();
      if (plan) params.append("plan", plan);
      if (priceId) params.append("priceId", priceId);
      const queryString = params.toString();
      setLocation(`/registration${queryString ? `?${queryString}` : ""}`);
      return;
    }

    // GAP FIX: If no priceId is found, this is a Free Tier signup.
    // Sync the user to DB and redirect to Editor.
    if (!priceId) {
      handleFreeTierEntry();
      return;
    }

    createCheckoutSession();
  }, [isLoaded, isSignedIn, priceId]);

  const handleFreeTierEntry = async () => {
    setIsLoading(true);
    try {
      const token = await getToken();
      // Explicitly call sync to create the user in the DB
      await fetch("/api/users/sync", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}` 
        }
      });
      // Clear any stale session data
      sessionStorage.removeItem("pendingCheckout");
      sessionStorage.removeItem("checkoutPlan");
      sessionStorage.removeItem("checkoutPriceId");

      // Redirect to app
      setLocation("/editor");
    } catch (err) {
      console.error("Sync error:", err);
      // Even if sync "fails" (e.g. network blip), try going to editor
      setLocation("/editor");
    }
  };

  const createCheckoutSession = async () => {
    if (!priceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = await getToken();
      
      // Ensure user exists in DB before checkout
      await fetch("/api/users/sync", {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}` 
        }
      });

      // Note: apiRequest should handle auth headers if configured globally, 
      // but explicitly passing token is safer if apiRequest doesn't.
      // Assuming apiRequest works for paid flow, we keep it as is.
      const response = await apiRequest("POST", "/api/checkout", { priceId });
      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Failed to create checkout session. Please try again.");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setError("An error occurred. Please try again or contact support.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <h2 className="text-xl font-semibold">
            {priceId ? "Preparing checkout..." : "Setting up your account..."}
          </h2>
          <p className="text-muted-foreground">
            Please wait while we finalize your registration.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <CreditCard className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">Checkout Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => setLocation("/pricing")} data-testid="btn-back-pricing">
              Back to Pricing
            </Button>
            <Button onClick={createCheckoutSession} disabled={!priceId} data-testid="btn-retry-checkout">
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null; // Should redirect before rendering this
}