import { useState } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Loader2, Minus, HelpCircle, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Pricing() {
  const [, setLocation] = useLocation();
  const [isAnnual, setIsAnnual] = useState(false);
  const [scaleCredits, setScaleCredits] = useState("10000");

  const { data: prices, isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await fetch("/api/plans");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  const scaleTiers: Record<string, { monthlyId: string; annualId: string }> = {
    "10000": { monthlyId: "prod_scale_10k_monthly", annualId: "prod_scale_10k_annual" },
    "20000": { monthlyId: "prod_scale_20k_monthly", annualId: "prod_scale_20k_annual" },
    "30000": { monthlyId: "prod_scale_30k_monthly", annualId: "prod_scale_30k_annual" },
    "40000": { monthlyId: "prod_scale_40k_monthly", annualId: "prod_scale_40k_annual" },
    "50000": { monthlyId: "prod_scale_50k_monthly", annualId: "prod_scale_50k_annual" },
    "75000": { monthlyId: "prod_scale_75k_monthly", annualId: "prod_scale_75k_annual" },
    "100000": { monthlyId: "prod_scale_100k_monthly", annualId: "prod_scale_100k_annual" },
  };

  const currentScaleTier = scaleTiers[scaleCredits];

  const calculateMarketingPrice = (amount: number) => {
    return Math.floor(amount * 100) / 100;
  };

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
      amount = calculateMarketingPrice(amount);
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: price.currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handlePlanSelect = (plan: string, planIdMetadata: string) => {
    if (plan === "scale_custom") {
      sessionStorage.setItem("checkoutPlan", plan);
      sessionStorage.setItem("checkoutPriceId", planIdMetadata);
      setLocation(`/registration`);
      return;
    }

    const price = getPrice(planIdMetadata);
    if (!price) {
      console.error(`Price not found for ${planIdMetadata}`);
      return;
    }
    sessionStorage.setItem("checkoutPlan", plan);
    sessionStorage.setItem("checkoutPriceId", price.id);
    setLocation(`/registration`);
  };

  const handleFreeSignup = () => {
    sessionStorage.removeItem("checkoutPlan");
    sessionStorage.removeItem("checkoutPriceId");
    setLocation("/registration");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-matte flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#2A9D90]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-matte text-slate-900 font-sans selection:bg-[#2A9D90]/20">
      <Helmet>
        <title>Pricing - Start for Free | Doculoom</title>
        <meta name="description" content="Simple pricing for automation. Start for free. Upgrade to Pro for unlimited professional exports." />
        <link rel="canonical" href="https://doculoom.io/pricing" />
      </Helmet>

      <PublicHeader />

      <main className="space-y-32 mb-24">

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-[60px] pb-0">
          {/* Tech Grid Background with Radial Fade */}
          <div className="absolute inset-0" style={{
            background: `radial-gradient(ellipse at center, transparent 0%, #f8fafc 70%),
                        repeating-linear-gradient(to right, rgba(0, 0, 0, 0.03) 0px, rgba(0, 0, 0, 0.03) 1px, transparent 1px, transparent 40px),
                        repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.03) 0px, rgba(0, 0, 0, 0.03) 1px, transparent 1px, transparent 40px)`
          }}></div>

          <div className="max-w-7xl mx-auto px-4 relative z-10">
            <div className="text-center space-y-8 max-w-4xl mx-auto">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400 mb-4 block">Pricing</span>

              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900">
                Simple, <span className="font-serif italic text-[#2A9D90]">Predictable</span> Pricing
              </h1>

              <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                Start for free, upgrade for professional automation features. No hidden fees, no surprises.
              </p>

              {/* Toggle */}
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
                  className="data-[state=checked]:bg-[#2A9D90] bg-slate-200 border-slate-200"
                />
                <Label
                  className={`text-sm cursor-pointer flex items-center gap-2 ${isAnnual ? "font-bold text-slate-900" : "text-slate-500"}`}
                  onClick={() => setIsAnnual(true)}
                >
                  Annual
                  <span className="bg-[#2A9D90]/10 text-[#2A9D90] text-xs px-2 py-0.5 rounded-full font-medium border border-[#2A9D90]/20">
                    Get 2 months on us
                  </span>
                </Label>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="py-0">
          <div className="max-w-6xl mx-auto px-4">
            <div className="grid md:grid-cols-3 gap-8 items-start">

              {/* Starter Plan */}
              <SpecPricingCard
                name="Starter"
                price="$0"
                period="/mo"
                description="Perfect for individuals and testing."
                features={[
                  '50 Pages / month',
                  '50 AI Credits / month',
                  'Digital Ready Export',
                  'CSV & Excel Data Import',
                  'Basic QR Codes',
                  'Watermarked Exports'
                ]}
                cta="Start Free"
                ctaVariant="dark"
                onAction={handleFreeSignup}
              />

              {/* Pro Plan */}
              <SpecPricingCard
                name="Pro"
                highlighted
                price={isAnnual
                  ? formatPrice("prod_pro_annual", "$33.33", true)
                  : formatPrice("prod_pro_monthly", "$39.99", false)
                }
                period="/mo"
                description="For growing teams needing professional files."
                subtext={isAnnual ? `Billed ${formatPrice("prod_pro_annual", "$399.99", false)} yearly` : undefined}
                features={[
                  'Unlimited PDFs',
                  '1,000 AI Credits / month',
                  'Professional Exports',
                  'Manageable QR Codes',
                  'Watermark Removal',
                  'Priority Rendering Queue',
                ]}
                cta={isAnnual ? "Start Pro Annual" : "Start Pro Monthly"}
                ctaVariant="teal"
                onAction={() => handlePlanSelect(
                  isAnnual ? "pro_annual" : "pro_monthly",
                  isAnnual ? "prod_pro_annual" : "prod_pro_monthly"
                )}
              />

              {/* Scale Plan */}
              <SpecPricingCard
                name="Scale"
                price={isAnnual
                  ? formatPrice(currentScaleTier.annualId, "Loading...", true)
                  : formatPrice(currentScaleTier.monthlyId, "Loading...", false)
                }
                period="/mo"
                description="For high-volume automation."
                subtext={isAnnual ? `Billed ${formatPrice(currentScaleTier.annualId, "...", false)} yearly` : undefined}
                features={[
                  'Everything in Pro',
                  <div key="credits-selector" className="w-full">
                    <label className="font-mono text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                      AI Credit Limit
                    </label>
                    <Select value={scaleCredits} onValueChange={setScaleCredits}>
                      <SelectTrigger className="w-full h-9 bg-slate-50 border-slate-200 font-mono text-sm">
                        <SelectValue placeholder="Select limit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10000">10,000 Credits</SelectItem>
                        <SelectItem value="20000">20,000 Credits</SelectItem>
                        <SelectItem value="30000">30,000 Credits</SelectItem>
                        <SelectItem value="40000">40,000 Credits</SelectItem>
                        <SelectItem value="50000">50,000 Credits</SelectItem>
                        <SelectItem value="75000">75,000 Credits</SelectItem>
                        <SelectItem value="100000">100,000 Credits</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>,
                  'AI Product Memory',
                  'Dedicated Rendering Server',
                  'SLA Support'
                ]}
                cta={isAnnual ? "Start Scale Annual" : "Start Scale Monthly"}
                ctaVariant="dark"
                onAction={() => handlePlanSelect(
                  "scale_custom",
                  isAnnual ? currentScaleTier.annualId : currentScaleTier.monthlyId
                )}
              />

            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="py-0">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400 mb-4 block">Feature Comparison</span>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">Compare Plans</h2>
              <p className="text-slate-600">Find the perfect features for your workflow.</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="py-4 px-6 text-sm font-semibold text-slate-900 w-1/3">
                        <span className="font-mono text-xs uppercase tracking-wider text-slate-400">Features</span>
                      </th>
                      <th className="py-4 px-6 text-sm font-semibold text-slate-900 text-center w-1/6">Starter</th>
                      <th className="py-4 px-6 text-sm font-semibold text-[#2A9D90] text-center w-1/6 bg-[#2A9D90]/5">Pro</th>
                      <th className="py-4 px-6 text-sm font-semibold text-slate-900 text-center w-1/6">Scale</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm text-slate-600">
                    {/* Usage & Limits */}
                    <tr className="bg-slate-50/50">
                      <td colSpan={4} className="py-3 px-6 font-mono text-[10px] text-slate-400 uppercase tracking-wider">Usage & Limits</td>
                    </tr>
                    <TableRow feature="PDF Exports / mo" starter="50 Pages" pro="Unlimited" scale="Unlimited" />
                    <TableRow feature="AI Credits" starter="50" pro="1,000 / mo" scale="10k - 100k+ / mo" tooltip="Credits are used for AI text generation and standardization." />
                    <TableRow feature="Projects" starter="3" pro="Unlimited" scale="Unlimited" />

                    {/* Design & Export */}
                    <tr className="bg-slate-50/50">
                      <td colSpan={4} className="py-3 px-6 font-mono text-[10px] text-slate-400 uppercase tracking-wider">Design & Export</td>
                    </tr>
                    <TableRow feature="Watermark-free" starter={false} pro={true} scale={true} />
                    <TableRow feature="Professional Exports" starter={false} pro={true} scale={true} tooltip="High-quality PDF output for print and digital use." />
                    <TableRow feature="High-Res (300 DPI)" starter={false} pro={true} scale={true} />
                    <TableRow feature="QR Codes" starter="Static" pro="Dynamic" scale="Dynamic" />

                    {/* AI & Automation */}
                    <tr className="bg-slate-50/50">
                      <td colSpan={4} className="py-3 px-6 font-mono text-[10px] text-slate-400 uppercase tracking-wider">AI & Automation</td>
                    </tr>
                    <TableRow feature="AI Text Enrichment" starter={true} pro={true} scale={true} />
                    <TableRow feature="Data Standardization" starter={true} pro={true} scale={true} />
                    <TableRow feature="AI Product Memory" starter={false} pro={false} scale={true} tooltip="Doculoom remembers product data for consistent description generation across sheets." />

                    {/* Support & Performance */}
                    <tr className="bg-slate-50/50">
                      <td colSpan={4} className="py-3 px-6 font-mono text-[10px] text-slate-400 uppercase tracking-wider">Support & Performance</td>
                    </tr>
                    <TableRow feature="Rendering Queue" starter="Standard" pro="Priority" scale="Dedicated" />
                    <TableRow feature="Support" starter="Community" pro="Priority" scale="SLA" />
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-0">
          <div className="max-w-4xl mx-auto px-4">
            <div className="text-center mb-12">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400 mb-4 block">FAQ</span>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">Common Questions</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <FAQCard
                question="What counts as a page?"
                answer="Each unique PDF page generated from your data counts as one page. A 10-page catalog with 50 products would count as 500 pages."
              />
              <FAQCard
                question="Can I upgrade or downgrade anytime?"
                answer="Yes! You can change your plan at any time. Upgrades take effect immediately, and downgrades apply at the end of your billing cycle."
              />
              <FAQCard
                question="What are AI Credits used for?"
                answer="AI Credits power our text enrichment and data standardization features. Each AI-generated description or data transformation uses credits."
              />
              <FAQCard
                question="Is there a free trial?"
                answer="All plans include a 14-day free trial. The Starter plan is free forever with limited features. No credit card required to start."
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 bg-white border-y border-slate-100">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-slate-900 mb-6">Ready to get started?</h2>
            <p className="text-xl text-slate-600 mb-8">
              Join thousands of teams automating their document workflows.
            </p>
            <div className="flex justify-center gap-4">
              <Button
                size="lg"
                onClick={handleFreeSignup}
                className="h-14 px-8 text-lg bg-[#2A9D90] hover:bg-[#2A9D90]/90 text-white shadow-lg"
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setLocation("/demo")}
                className="h-14 px-8 text-lg border-slate-200 hover:bg-slate-50"
              >
                Book a Demo
              </Button>
            </div>
            <p className="text-sm text-slate-400 mt-8 font-mono">All plans include a 14-day free trial. Cancel anytime.</p>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}

// Specification Sheet Style Pricing Card
function SpecPricingCard({
  name,
  price,
  period,
  description,
  subtext,
  features,
  cta,
  ctaVariant,
  highlighted,
  onAction
}: {
  name: string;
  price: string;
  period?: string;
  description?: string;
  subtext?: string;
  features: (string | React.ReactNode)[];
  cta: string;
  ctaVariant: 'teal' | 'dark';
  highlighted?: boolean;
  onAction?: () => void;
}) {
  return (
    <div className={`p-8 relative rounded-xl bg-white flex flex-col h-full ${
      highlighted
        ? 'border-t-4 border-t-[#2A9D90] border-x border-b border-slate-200 shadow-xl scale-105 z-10'
        : 'border-t-4 border-t-slate-900 border-x border-b border-slate-200'
    }`}>
      {highlighted && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2A9D90] text-white hover:bg-[#2A9D90] font-mono text-[10px] uppercase tracking-wider">
          Most Popular
        </Badge>
      )}

      <div className="mb-6">
        <span className="font-mono text-xs uppercase tracking-wider text-slate-400 block mb-1">Plan</span>
        <h3 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">{name}</h3>
        {description && <p className="text-slate-600 text-sm leading-relaxed">{description}</p>}
      </div>

      <div className="mb-6">
        <span className="font-mono text-xs uppercase tracking-wider text-slate-400 block mb-1">Price</span>
        <div className="flex items-baseline">
          <span className="text-4xl font-mono font-bold text-slate-900">{price}</span>
          <span className="text-slate-600 ml-2">{period}</span>
        </div>
        {subtext && <span className="font-mono text-xs text-slate-500 mt-1 block">{subtext}</span>}
      </div>

      <Button
        onClick={onAction}
        className={`w-full mb-8 h-12 text-lg ${
          ctaVariant === 'teal'
            ? 'bg-[#2A9D90] hover:bg-[#2A9D90]/90 text-white'
            : 'bg-slate-900 hover:bg-slate-800 text-white'
        }`}
      >
        {cta}
      </Button>

      <div className="space-y-4 flex-1">
        <span className="font-mono text-xs uppercase tracking-wider text-slate-400 block">Includes</span>
        {features.map((feature, i) => (
          <div key={i} className="flex items-start gap-3">
            {typeof feature === 'string' ? (
              <>
                <div className="mt-0.5 flex-shrink-0">
                  <div className="w-5 h-5 rounded-full bg-[#2A9D90]/10 flex items-center justify-center">
                    <Check className="h-3 w-3 text-[#2A9D90]" />
                  </div>
                </div>
                <span className="text-slate-600 text-sm">{feature}</span>
              </>
            ) : (
              <div className="w-full">{feature}</div>
            )}
          </div>
        ))}
      </div>

      {/* Technical Footer */}
      <div className="tech-footer">
        <span>REV 1.0</span>
        <span>{name.toUpperCase()}</span>
      </div>
    </div>
  );
}

// Table Row Component
function TableRow({
  feature,
  starter,
  pro,
  scale,
  tooltip
}: {
  feature: string;
  starter: string | boolean;
  pro: string | boolean;
  scale: string | boolean;
  tooltip?: string;
}) {
  const renderCell = (value: string | boolean, isPro = false) => {
    if (typeof value === 'boolean') {
      return value
        ? <Check className={`h-5 w-5 mx-auto ${isPro ? "text-[#2A9D90]" : "text-slate-600"}`} />
        : <Minus className="h-4 w-4 mx-auto text-slate-300" />;
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
              <TooltipTrigger>
                <HelpCircle className="h-3 w-3 text-slate-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{tooltip}</p>
              </TooltipContent>
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

// FAQ Card Component
function FAQCard({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="p-6 rounded-xl border border-slate-200 bg-white relative">
      <h3 className="font-bold tracking-tight text-slate-900 mb-2">{question}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{answer}</p>
      {/* Corner Mark */}
      <div className="absolute bottom-3 right-3 text-slate-300 font-mono text-sm">&#x231F;</div>
    </div>
  );
}
