import { useState } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch"; // Ensure you have this component
import { Label } from "@/components/ui/label";

export default function Pricing() {
  const [, setLocation] = useLocation();
  const [isAnnual, setIsAnnual] = useState(false);

  // 1. Fetch Plans from API
  const { data: prices, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await fetch("/api/plans");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    }
  });

  // 2. Helper to find the price object
  const getPrice = (planId: string) => {
    if (!prices) return null;
    return prices.find((p: any) => 
      p.metadata?.planId === planId || (p.product && p.product.metadata?.planId === planId)
    );
  }

  // 3. Helper to format price
  const formatPrice = (planId: string, fallback: string) => {
    const price = getPrice(planId);
    if (!price || !price.unit_amount) return fallback;

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: price.currency || 'USD',
      minimumFractionDigits: 0,
    }).format(price.unit_amount / 100);
  };

  const handlePlanSelect = (plan: string, planIdMetadata: string) => {
    const price = getPrice(planIdMetadata);

    if (!price) {
      console.error(`Price not found for ${planIdMetadata}`);
      return; 
    }

    sessionStorage.setItem("checkoutPlan", plan);
    sessionStorage.setItem("checkoutPriceId", price.id);
    setLocation(`/registration`);
  };

  // Shared accent styles
  const accentText = "text-[#2A9D90]";
  const accentBg = "bg-[#2A9D90]";
  const accentBorder = "border-[#2A9D90]";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <Helmet>
        <title>Pricing - Start for Free | Doculoom</title>
        <meta name="description" content="Simple pricing for automation. Start for free. Upgrade to Pro for unlimited exports." />
        <link rel="canonical" href="https://doculoom.io/pricing" />
      </Helmet>

      <PublicHeader />

      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Simple, Transparent Pricing</h1>
            <p className="text-lg text-slate-600">Choose the plan that fits your needs</p>

            {/* TOGGLE SWITCH */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <Label 
                htmlFor="billing-mode" 
                className={`text-sm cursor-pointer ${!isAnnual ? "font-bold text-slate-900" : "text-slate-500"}`}
                onClick={() => setIsAnnual(false)}
              >
                Monthly
              </Label>
              <Switch 
                id="billing-mode" 
                checked={isAnnual} 
                onCheckedChange={setIsAnnual}
                className="data-[state=checked]:bg-[#2A9D90]" 
              />
              <Label 
                htmlFor="billing-mode" 
                className={`text-sm cursor-pointer flex items-center gap-2 ${isAnnual ? "font-bold text-slate-900" : "text-slate-500"}`}
                onClick={() => setIsAnnual(true)}
              >
                Annual 
                <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  Save ~30%
                </span>
              </Label>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-12 max-w-6xl mx-auto">

            {/* 1. STARTER (Free) */}
            <div className="p-8 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-xl mb-2 text-slate-900">Starter</h3>
              <p className="text-slate-500 mb-6">For testing & small projects</p>
              <div className="mb-6 h-[60px] flex items-end">
                <span className="text-4xl font-bold text-slate-900">$0</span>
                <span className="text-slate-500 mb-1 ml-1">/month</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm">
                {[
                  '50 PDFs / month', 
                  'Digital Ready Export', 
                  'Basic Templates', 
                  'Watermarked Exports'
                ].map((feat, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className={`h-5 w-5 ${accentText} shrink-0`} />
                    <span className="text-slate-700">{feat}</span>
                  </li>
                ))}
              </ul>
              <Button 
                variant="outline" 
                className={`w-full h-12 text-base border-slate-200 hover:border-[#2A9D90] hover:text-[#2A9D90]`}
                onClick={() => setLocation("/registration")}
              >
                Start Free
              </Button>
            </div>

            {/* 2. PRO (Dynamic) */}
            <div className={`p-8 border-2 ${accentBorder} rounded-2xl bg-white relative shadow-xl transform scale-105 z-10`}>
              <div className={`absolute -top-4 left-1/2 -translate-x-1/2 ${accentBg} text-white px-4 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm`}>
                Most Popular
              </div>
              <h3 className="font-semibold text-xl mb-2 text-slate-900">Pro</h3>
              <p className="text-slate-500 mb-6">For scaling production</p>

              <div className="mb-6 h-[60px] flex items-end">
                <span className="text-4xl font-bold text-slate-900 transition-all duration-300">
                  {isAnnual 
                    ? formatPrice("prod_pro_annual", "$159") 
                    : formatPrice("prod_pro_monthly", "$29")
                  }
                </span>
                <span className="text-slate-500 mb-1 ml-1 transition-all duration-300">
                   {isAnnual ? "/year" : "/month"}
                </span>
              </div>

              <ul className="space-y-4 mb-8 text-sm">
                {[
                  'Unlimited PDFs', 
                  'Print Ready', 
                  'Dynamic QR Codes', 
                  'Priority Rendering',
                  'No Watermarks',
                  isAnnual ? '2 Months Free' : null // Only show on annual view
                ].filter(Boolean).map((feat, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className={`h-5 w-5 ${accentText} shrink-0`} />
                    <span className="text-slate-700 font-medium">{feat}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className={`w-full h-12 text-base ${accentBg} hover:bg-[#2A9D90]/90 text-white shadow-lg shadow-[#2A9D90]/20 transition-all`}
                onClick={() => handlePlanSelect(
                  isAnnual ? "pro_annual" : "pro_monthly", 
                  isAnnual ? "prod_pro_annual" : "prod_pro_monthly"
                )}
                disabled={!getPrice(isAnnual ? "prod_pro_annual" : "prod_pro_monthly")}
              >
                {isAnnual ? "Start Pro Annual" : "Start Pro Monthly"}
              </Button>

              {isAnnual && (
                <p className="text-xs text-center text-slate-400 mt-3">
                  Billed once per year
                </p>
              )}
            </div>

            {/* 3. ENTERPRISE */}
            <div className="p-8 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-xl mb-2 text-slate-900">Enterprise</h3>
              <p className="text-slate-500 mb-6">For large teams</p>
              <div className="mb-6 h-[60px] flex items-end">
                <span className="text-4xl font-bold text-slate-900">Custom</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm">
                {[
                  'Everything in Pro',
                  'Dedicated Rendering Server', 
                  'Custom Font Uploads', 
                  'Template Migration Service', 
                  'SLA Support',
                  'SSO / SAML'
                ].map((feat, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className={`h-5 w-5 ${accentText} shrink-0`} />
                    <span className="text-slate-700">{feat}</span>
                  </li>
                ))}
              </ul>
              <a href="mailto:sales@doculoom.io" className="block w-full">
                <Button 
                  variant="outline" 
                  className={`w-full h-12 text-base border-slate-200 hover:border-[#2A9D90] hover:text-[#2A9D90]`}
                >
                  Contact Sales <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
            </div>

          </div>

          <div className="text-center text-sm text-slate-400 mt-12">
            All plans include a 14-day free trial. Cancel anytime.
          </div>
        </div>
      </section>
    </div>
  );
}