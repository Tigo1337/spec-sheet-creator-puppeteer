import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setLocation("/editor");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Welcome to Pro!</h1>
          <p className="text-muted-foreground">
            Your subscription is now active. You have access to all Pro features.
          </p>
        </div>

        <div className="bg-card border rounded-lg p-4 text-left space-y-2">
          <h3 className="font-medium">Your Pro benefits:</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Unlimited saved designs</li>
            <li>• Unlimited data imports</li>
            <li>• Batch export (unlimited pages)</li>
            <li>• Custom branding</li>
            <li>• Priority support</li>
          </ul>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => setLocation("/editor")}
            className="w-full"
            data-testid="btn-go-editor"
          >
            Start Creating
          </Button>
          <p className="text-xs text-muted-foreground">
            Redirecting in {countdown} seconds...
          </p>
        </div>
      </div>
    </div>
  );
}
