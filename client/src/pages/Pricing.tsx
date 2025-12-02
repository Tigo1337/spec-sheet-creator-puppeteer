import { PublicHeader } from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useLocation } from "wouter";

const PRICE_IDS = {
  proMonthly: "price_1SZtioEFufdmlbEL2SX2yEof",
  proAnnual: "price_1SZtioEFufdmlbELICbVr7lk",
};

export default function Pricing() {
  const [, setLocation] = useLocation();

  const handlePlanSelect = (plan: string, priceId: string) => {
    sessionStorage.setItem("checkoutPlan", plan);
    sessionStorage.setItem("checkoutPriceId", priceId);
    setLocation(`/registration`);
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Simple, Transparent Pricing</h2>
            <p className="text-lg text-muted-foreground">Choose the plan that fits your needs</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-12">
            {/* Free Plan */}
            <div className="p-8 border rounded-lg bg-card">
              <h3 className="font-semibold text-xl mb-2">Free</h3>
              <p className="text-muted-foreground mb-6">For getting started</p>
              <div className="mb-6">
                <span className="text-3xl font-bold">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>5 saved designs</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Basic export (10 pages)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Community support</span>
                </li>
              </ul>
              <Button 
                variant="outline" 
                className="w-full" 
                data-testid="btn-pricing-free"
                onClick={() => setLocation("/registration")}
              >
                Get Started Free
              </Button>
            </div>

            {/* Pro Monthly Plan */}
            <div className="p-8 border-2 border-primary rounded-lg bg-card relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                Most Popular
              </div>
              <h3 className="font-semibold text-xl mb-2">Pro</h3>
              <p className="text-muted-foreground mb-6">For professionals</p>
              <div className="mb-6">
                <span className="text-3xl font-bold">$19.99</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Unlimited saved designs</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Unlimited data imports</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Batch export (unlimited pages)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Custom branding</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Priority support</span>
                </li>
              </ul>
              <Button 
                className="w-full" 
                data-testid="btn-pricing-pro-monthly"
                onClick={() => handlePlanSelect("pro_monthly", PRICE_IDS.proMonthly)}
              >
                Start Pro Monthly
              </Button>
            </div>

            {/* Pro Annual Plan */}
            <div className="p-8 border rounded-lg bg-card">
              <h3 className="font-semibold text-xl mb-2">Pro Annual</h3>
              <p className="text-muted-foreground mb-6">Save 2 months</p>
              <div className="mb-6">
                <span className="text-3xl font-bold">$159.90</span>
                <span className="text-muted-foreground">/year</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>2 months free</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span>Priority onboarding</span>
                </li>
              </ul>
              <Button 
                variant="outline" 
                className="w-full" 
                data-testid="btn-pricing-pro-annual"
                onClick={() => handlePlanSelect("pro_annual", PRICE_IDS.proAnnual)}
              >
                Start Pro Annual
              </Button>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground mt-8">
            All plans include a 14-day free trial. Cancel anytime.
          </div>
        </div>
      </section>
    </div>
  );
}
