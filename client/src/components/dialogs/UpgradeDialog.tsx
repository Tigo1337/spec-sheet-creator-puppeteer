import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useToast } from "@/hooks/use-toast";

// Price IDs must match your Stripe Dashboard / Pricing Page
const PRICE_IDS = {
  proMonthly: "price_1SZtioEFufdmlbEL2SX2yEof",
  proAnnual: "price_1SZtioEFufdmlbELICbVr7lk",
};

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeDialog({ open, onOpenChange }: UpgradeDialogProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const { getToken } = useAuth();
  const { toast } = useToast();

  const handleUpgrade = async (priceId: string, planType: "monthly" | "annual") => {
    setIsLoading(planType);
    try {
      const token = await getToken();
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ priceId }),
      });

      if (!res.ok) throw new Error("Failed to initiate checkout");

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      toast({
        title: "Error",
        description: "Could not start checkout. Please try again.",
        variant: "destructive",
      });
      setIsLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden gap-0">
        <div className="bg-[#2A9D90] p-6 text-white text-center">
          <div className="mx-auto bg-white/20 w-12 h-12 rounded-full flex items-center justify-center mb-4">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-2xl font-bold mb-2 text-white">Unlock Pro Features</DialogTitle>
          <DialogDescription className="text-white/90 text-base">
            Get unlimited access to professional tools and high-quality exports.
          </DialogDescription>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            {/* Monthly Plan */}
            <div className="border rounded-xl p-4 space-y-4 hover:border-[#2A9D90] transition-colors relative">
              <div>
                <h3 className="font-semibold text-lg">Monthly</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">$29</span>
                  <span className="text-muted-foreground">/mo</span>
                </div>
              </div>
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => handleUpgrade(PRICE_IDS.proMonthly, "monthly")}
                disabled={!!isLoading}
              >
                {isLoading === "monthly" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Subscribe Monthly
              </Button>
            </div>

            {/* Annual Plan */}
            <div className="border-2 border-[#2A9D90] rounded-xl p-4 space-y-4 bg-[#2A9D90]/5 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2A9D90] text-white px-3 py-0.5 rounded-full text-xs font-bold uppercase">
                Best Value
              </div>
              <div>
                <h3 className="font-semibold text-lg">Annual</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">$159</span>
                  <span className="text-muted-foreground">/yr</span>
                </div>
                <p className="text-xs text-[#2A9D90] font-medium mt-1">Save ~50% per year</p>
              </div>
              <Button 
                className="w-full bg-[#2A9D90] hover:bg-[#2A9D90]/90"
                onClick={() => handleUpgrade(PRICE_IDS.proAnnual, "annual")}
                disabled={!!isLoading}
              >
                {isLoading === "annual" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Subscribe Annual
              </Button>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg">
            <h4 className="font-medium mb-3 text-sm text-slate-900">What you'll get immediately:</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                "Unlimited PDF Exports",
                "Print Ready (CMYK) Mode",
                "Full Catalog Assembly",
                "Watermark Removal",
                "Priority Rendering",
                "Manageable QR Codes"
              ].map((feat, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <Check className="h-4 w-4 text-[#2A9D90] shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}