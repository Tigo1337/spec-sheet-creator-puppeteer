import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function Checkout() {
  const { isSignedIn, isLoaded } = useAuth();
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
      setLocation(`/registration?plan=${plan}&priceId=${priceId}`);
      return;
    }

    if (!priceId) {
      setError("No plan selected. Please choose a plan from the pricing page.");
      return;
    }

    createCheckoutSession();
  }, [isLoaded, isSignedIn, priceId]);

  const createCheckoutSession = async () => {
    if (!priceId) return;

    setIsLoading(true);
    setError(null);

    try {
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

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <h2 className="text-xl font-semibold">Preparing your checkout...</h2>
        <p className="text-muted-foreground">
          You'll be redirected to our secure payment page.
        </p>
      </div>
    </div>
  );
}
