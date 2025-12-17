import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";

export function useSubscription() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [plan, setPlan] = useState<"free" | "pro">("free");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!isLoaded || !isSignedIn) {
        setIsLoading(false);
        return;
      }

      try {
        const token = await getToken();
        // Uses the existing endpoint defined in server/routes.ts
        const res = await fetch("/api/subscription", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPlan(data.plan);
        }
      } catch (error) {
        console.error("Failed to fetch subscription", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, [isLoaded, isSignedIn, getToken]);

  return { 
    plan, 
    isPro: plan === "pro", 
    isLoading 
  };
}