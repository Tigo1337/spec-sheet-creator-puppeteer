import { useState } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer"; 
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Loader2, Minus, HelpCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch"; 
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Pricing() {
  const [, setLocation] = useLocation();
  const [isAnnual, setIsAnnual] = useState(false);

  const { data: prices, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await fetch("/api/plans");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
    staleTime: 1000 * 60 * 5, 
  });

  const getPrice = (planId: string) => {
    if (!prices) return null;
    return prices.find((p: any) => 
      p.metadata?.planId === planId || (p.product && p.product.metadata?.planId === planId)
    );
  }

  const formatPrice = (planId: string, fallback: string, divideByMonth = false) => {
    const price = getPrice(planId);
    if (!price || !price.unit_amount) return fallback;

    let amount = price.unit_amount / 100;
    if (divideByMonth) {
        amount = amount / 12;
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: price.currency || 'USD',
      minimumFractionDigits: 0, 
      maximumFractionDigits: 2, 
    }).format(amount);
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

            <div className="flex items-center justify-center gap-4 pt-4">
              <Label 
                className={`text-sm cursor-pointer ${!isAnnual ? "font-bold text-slate-900" : "text-slate-500"}`}
                onClick={() => setIsAnnual(false)}
              >
                Monthly
              </Label>
              <Switch 
                checked={isAnnual} 
                onCheckedChange={setIsAnnual}
                className="data-[state=checked]:bg-[#2A9D90]" 
              />
              <Label 
                className={`text-sm cursor-pointer flex items-center gap-2 ${isAnnual ? "font-bold text-slate-900" : "text-slate-500"}`}
                onClick={() => setIsAnnual(true)}
              >
                Annual 
                <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  Save ~17%
                </span>
              </Label>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-12 max-w-6xl mx-auto">

            {/* 1. STARTER */}
            <div className="p-8 border border-slate-200 rounded-2xl bg-white shadow-sm hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-xl mb-2 text-slate-900">Starter</h3>
              <p className="text-slate-500 mb-6">For getting started</p>
              <div className="mb-6 h-[60px] flex items-end">
                <span className="text-4xl font-bold text-slate-900">$0</span>
                <span className="text-slate-500 mb-1 ml-1">/month</span>
              </div>
              <ul className="space-y-4 mb-8 text-sm">
                {[
                  '50 PDFs / month', 
                  '50 AI Credits / month',
                  'Digital Ready Export', 
                  'CSV & Excel Import', 
                  'Basic QR Codes',
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

            {/* 2. PRO */}
            <div className="p-8 border-2 border-slate-200 rounded-2xl bg-white relative shadow-sm hover:shadow-md hover:border-[#2A9D90] transition-all">
              <h3 className="font-semibold text-xl mb-2 text-slate-900">Pro</h3>
              <p className="text-slate-500 mb-6">For professionals</p>

              <div className="mb-6 h-[60px] flex flex-col justify-end">
                <div className="flex items-end">
                    <span className="text-4xl font-bold text-slate-900 transition-all duration-300">
                    {isAnnual 
                        ? formatPrice("prod_pro_annual", "$33.33", true) 
                        : formatPrice("prod_pro_monthly", "$39.99", false)
                    }
                    </span>
                    <span className="text-slate-500 mb-1 ml-1 transition-all duration-300">
                    /month
                    </span>
                </div>
                {isAnnual && (
                    <span className="text-xs text-slate-400 mt-1">
                        Billed {formatPrice("prod_pro_annual", "$399.99", false)} yearly
                    </span>
                )}
              </div>

              <ul className="space-y-4 mb-8 text-sm">
                {[
                  'Unlimited PDFs', 
                  '1,000 AI Credits / month',
                  'Print Ready Exports', 
                  'Manageable QR Codes', 
                  'Watermark Removal',
                  'Priority Rendering Queue'
                ].map((feat, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className={`h-5 w-5 ${accentText} shrink-0`} />
                    <span className="text-slate-700 font-medium">{feat}</span>
                  </li>
                ))}
              </ul>

              <Button 
                variant="outline"
                className={`w-full h-12 text-base border-slate-300 hover:border-[#2A9D90] hover:text-[#2A9D90] transition-all`}
                onClick={() => handlePlanSelect(
                  isAnnual ? "pro_annual" : "pro_monthly", 
                  isAnnual ? "prod_pro_annual" : "prod_pro_monthly"
                )}
                disabled={!getPrice(isAnnual ? "prod_pro_annual" : "prod_pro_monthly")}
              >
                {isAnnual ? "Start Pro Annual" : "Start Pro Monthly"}
              </Button>
            </div>

            {/* 3. SCALE */}
            <div className={`p-8 border-2 ${accentBorder} rounded-2xl bg-white relative shadow-xl transform scale-105 z-10`}>
              <div className={`absolute -top-4 left-1/2 -translate-x-1/2 ${accentBg} text-white px-4 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm`}>
                Best Value
              </div>
              <h3 className="font-semibold text-xl mb-2 text-slate-900">Scale</h3>
              <p className="text-slate-500 mb-6">For high volume teams</p>

              <div className="mb-6 h-[60px] flex flex-col justify-end">
                <div className="flex items-end">
                    <span className="text-4xl font-bold text-slate-900 transition-all duration-300">
                    {isAnnual 
                        ? formatPrice("prod_scale_annual", "$58.33", true) 
                        : formatPrice("prod_scale_monthly", "$69.99", false)
                    }
                    </span>
                    <span className="text-slate-500 mb-1 ml-1 transition-all duration-300">
                    /month
                    </span>
                </div>
                {isAnnual && (
                    <span className="text-xs text-slate-400 mt-1">
                        Billed {formatPrice("prod_scale_annual", "$699.99", false)} yearly
                    </span>
                )}
              </div>

              <ul className="space-y-4 mb-8 text-sm">
                {[
                  'Everything in Pro',
                  '10,000 AI Credits / month', 
                  'AI Product Memory', 
                  'Dedicated Rendering Server', 
                  'SLA Support'
                ].map((feat, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className={`h-5 w-5 ${accentText} shrink-0`} />
                    <span className="text-slate-700 font-bold">{feat}</span>
                  </li>
                ))}
              </ul>

               <Button 
                className={`w-full h-12 text-base ${accentBg} hover:bg-[#2A9D90]/90 text-white shadow-lg shadow-[#2A9D90]/20 transition-all`}
                onClick={() => handlePlanSelect(
                  isAnnual ? "scale_annual" : "scale_monthly", 
                  isAnnual ? "prod_scale_annual" : "prod_scale_monthly"
                )}
                disabled={!getPrice(isAnnual ? "prod_scale_annual" : "prod_scale_monthly")}
              >
                {isAnnual ? "Start Scale Annual" : "Start Scale Monthly"}
              </Button>
            </div>

          </div>

          {/* --- NEW COMPARISON TABLE SECTION --- */}
          <div className="mt-32 max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900">Compare Plans</h2>
              <p className="text-slate-600 mt-2">Find the perfect features for your workflow.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-4 px-6 text-sm font-semibold text-slate-900 w-1/3">Features</th>
                    <th className="py-4 px-6 text-sm font-semibold text-slate-900 text-center w-1/6">Starter</th>
                    <th className="py-4 px-6 text-sm font-semibold text-[#2A9D90] text-center w-1/6">Pro</th>
                    <th className="py-4 px-6 text-sm font-semibold text-slate-900 text-center w-1/6">Scale</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-600">

                  {/* Usage & Limits */}
                  <tr className="bg-slate-50/50"><td colSpan={4} className="py-3 px-6 font-semibold text-xs text-slate-400 uppercase tracking-wider">Usage & Limits</td></tr>
                  <TableRow feature="PDF Exports / mo" starter="50" pro="Unlimited" scale="Unlimited" />
                  <TableRow feature="AI Credits / mo" starter="50" pro="1,000" scale="10,000" tooltip="Credits are used for AI text generation and standardization." />
                  <TableRow feature="Projects" starter="Unlimited" pro="Unlimited" scale="Unlimited" />

                  {/* Design & Export */}
                  <tr className="bg-slate-50/50"><td colSpan={4} className="py-3 px-6 font-semibold text-xs text-slate-400 uppercase tracking-wider">Design & Export</td></tr>
                  <TableRow feature="Spreadsheet Import" starter={true} pro={true} scale={true} />
                  <TableRow feature="Watermark-free" starter={false} pro={true} scale={true} />
                  <TableRow feature="Print Ready (CMYK)" starter={false} pro={true} scale={true} tooltip="Exports converted to CMYK color profile for professional printing." />
                  <TableRow feature="QR Codes" starter="Static" pro="Dynamic" scale="Dynamic" />
                  <TableRow feature="Custom Font Uploads" starter={false} pro={false} scale={true} />

                  {/* AI & Automation */}
                  <tr className="bg-slate-50/50"><td colSpan={4} className="py-3 px-6 font-semibold text-xs text-slate-400 uppercase tracking-wider">AI & Automation</td></tr>
                  <TableRow feature="AI Text Enrichment" starter={true} pro={true} scale={true} />
                  <TableRow feature="Data Standardization" starter={true} pro={true} scale={true} />
                  <TableRow feature="AI Product Memory" starter={false} pro={false} scale={true} tooltip="The AI remembers your product details for consistent descriptions across sheets." />

                  {/* Support */}
                  <tr className="bg-slate-50/50"><td colSpan={4} className="py-3 px-6 font-semibold text-xs text-slate-400 uppercase tracking-wider">Support & Performance</td></tr>
                  <TableRow feature="Rendering Queue" starter="Standard" pro="Priority" scale="Dedicated" />
                  <TableRow feature="Support" starter="Community" pro="Priority" scale="SLA" />
                </tbody>
              </table>
            </div>
          </div>
          {/* ---------------------------------- */}

          <div className="text-center text-sm text-slate-400 mt-12">
            All plans include a 14-day free trial. Cancel anytime.
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// Helper Component for Table Rows
function TableRow({ feature, starter, pro, scale, tooltip }: { feature: string, starter: string | boolean, pro: string | boolean, scale: string | boolean, tooltip?: string }) {
  const renderCell = (value: string | boolean, isPro = false) => {
    if (typeof value === 'boolean') {
      return value ? <Check className={`h-5 w-5 mx-auto ${isPro ? "text-[#2A9D90]" : "text-slate-600"}`} /> : <Minus className="h-4 w-4 mx-auto text-slate-300" />;
    }
    return <span className={isPro ? "font-semibold text-[#2A9D90]" : ""}>{value}</span>;
  };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
      <td className="py-4 px-6 font-medium text-slate-700 flex items-center gap-2">
        {feature}
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger><HelpCircle className="h-3 w-3 text-slate-400 cursor-help" /></TooltipTrigger>
              <TooltipContent><p className="max-w-xs">{tooltip}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </td>
      <td className="py-4 px-6 text-center">{renderCell(starter)}</td>
      <td className="py-4 px-6 text-center bg-[#2A9D90]/5">{renderCell(pro, true)}</td>
      <td className="py-4 px-6 text-center">{renderCell(scale)}</td>
    </tr>
  );
}