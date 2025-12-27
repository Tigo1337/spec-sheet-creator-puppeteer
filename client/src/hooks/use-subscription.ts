import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";

export interface SubscriptionDetails {
  plan: string;
  planStatus: string;
  aiCredits: number;
  aiCreditsLimit: number;
  aiCreditsResetDate: string | null;
  pdfUsageCount: number;
  pdfUsageResetDate: string | null;
}

export function useSubscription() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [details, setDetails] = useState<SubscriptionDetails>({
    plan: "free",
    planStatus: "active",
    aiCredits: 0,
    aiCreditsLimit: 0,
    aiCreditsResetDate: null,
    pdfUsageCount: 0,
    pdfUsageResetDate: null
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!isLoaded || !isSignedIn) {
        setIsLoading(false);
        return;
      }

      try {
        const token = await getToken();
        const res = await fetch("/api/subscription", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setDetails(data);
        }
      } catch (error) {
        console.error("Failed to fetch subscription", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, [isLoaded, isSignedIn, getToken]);

  // Helper to check plan level
  const plan = details.plan;
  const isPro = plan.includes("pro") || plan.includes("scale") || plan.includes("business");
  const isScale = plan.includes("scale") || plan.includes("business");

  return { 
    ...details, // Exposes aiCredits, limits, etc directly
    isPro,
    isScale,
    isLoading 
  };
}