import { PublicHeader } from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight } from "lucide-react";
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

  // Shared accent styles
  const accentText = "text-[#2A9D90]";
  const accentBg = "bg-[#2A9D90]";
  const accentBorder = "border-[#2A9D90]";

  return (
    <div className="min-h-screen bg-background font-sans">
      <PublicHeader />

      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900">Simple, Transparent Pricing</h2>
            <p className="text-lg text-slate-600">Choose the plan that fits your needs</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-12 max-w-6xl mx-auto">

            {/* STARTER (Previously Free) */}
            <div className="p-8 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-xl mb-2 text-slate-900">Starter</h3>
              <p className="text-slate-500 mb-6">For getting started</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-slate-900">$0</span>
                <span className="text-slate-500">/month</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm">
                {[
                  '50 PDFs / month', 
                  'Digital Ready Export', 
                  'CSV & Excel Import', 
                  'Basic QR Codes',
                  'Multi-page Product Templates',
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
                data-testid="btn-pricing-free"
                onClick={() => setLocation("/registration")}
              >
                Start Free
              </Button>
            </div>

            {/* PRO MONTHLY */}
            <div className={`p-8 border-2 ${accentBorder} rounded-2xl bg-white relative shadow-xl transform scale-105 z-10`}>
              <div className={`absolute -top-4 left-1/2 -translate-x-1/2 ${accentBg} text-white px-4 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm`}>
                Most Popular
              </div>
              <h3 className="font-semibold text-xl mb-2 text-slate-900">Pro</h3>
              <p className="text-slate-500 mb-6">For professionals</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-slate-900">$29</span>
                <span className="text-slate-500">/month</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm">
                {[
                  'Unlimited PDFs', 
                  'Print Ready Exports', 
                  'Manageable QR Codes', 
                  'Full Catalog Assembly', 
                  'Priority Rendering Queue',
                  'Watermark Removal'
                ].map((feat, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className={`h-5 w-5 ${accentText} shrink-0`} />
                    <span className="text-slate-700 font-medium">{feat}</span>
                  </li>
                ))}
              </ul>
              <Button 
                className={`w-full h-12 text-base ${accentBg} hover:bg-[#2A9D90]/90 text-white shadow-lg shadow-[#2A9D90]/20`}
                data-testid="btn-pricing-pro-monthly"
                onClick={() => handlePlanSelect("pro_monthly", PRICE_IDS.proMonthly)}
              >
                Start Pro Monthly
              </Button>
            </div>

            {/* PRO ANNUAL */}
            <div className="p-8 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-xl mb-2 text-slate-900">Pro Annual</h3>
              <p className="text-slate-500 mb-6">Best Value</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-slate-900">$159</span>
                <span className="text-slate-500">/year</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm">
                <li className="flex items-start gap-3">
                  <Check className={`h-5 w-5 ${accentText} shrink-0`} />
                  <span className="text-slate-700">Everything in Pro</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className={`h-5 w-5 ${accentText} shrink-0`} />
                  <span className="text-slate-700">Save ~50% per year</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className={`h-5 w-5 ${accentText} shrink-0`} />
                  <span className="text-slate-700">Priority onboarding</span>
                </li>
              </ul>
              <Button 
                variant="outline" 
                className={`w-full h-12 text-base border-slate-200 hover:border-[#2A9D90] hover:text-[#2A9D90]`}
                data-testid="btn-pricing-pro-annual"
                onClick={() => handlePlanSelect("pro_annual", PRICE_IDS.proAnnual)}
              >
                Start Pro Annual
              </Button>
            </div>
          </div>

          {/* Enterprise Section (Added to match Homepage) */}
          <div className="mt-16 max-w-4xl mx-auto bg-slate-50 rounded-2xl p-8 border border-slate-200 text-center">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">Need Enterprise Features?</h3>
            <p className="text-slate-600 mb-8 max-w-2xl mx-auto">
              For teams requiring dedicated rendering servers, custom font uploads, template migration services, and SLA support.
            </p>
            <a href="mailto:sales@doculoom.io">
                <Button variant="outline" size="lg" className="h-12 px-8 text-base border-slate-300 hover:bg-white">
                Contact Sales <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </a>
          </div>

          <div className="text-center text-sm text-slate-400 mt-12">
            All plans include a 14-day free trial. Cancel anytime.
          </div>
        </div>
      </section>
    </div>
  );
}