import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from "wouter"; 
import { useQuery } from "@tanstack/react-query";
import { 
  FileSpreadsheet, 
  Palette, 
  Printer, 
  LayoutTemplate, 
  Download, 
  CheckCircle2, 
  ArrowRight, 
  QrCode, 
  Files, 
  ChevronRight,
  Layers,
  Loader2
} from 'lucide-react';
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Homepage() {
  const [, setLocation] = useLocation(); 
  const [isAnnual, setIsAnnual] = useState(false);

  const { data: prices, isLoading: isPricingLoading } = useQuery({
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

  // --- UPDATED FORMATTER ---
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
      minimumFractionDigits: 0, // Keeps $40 as $40
      maximumFractionDigits: 2, // Allows $39.99 to show as $39.99
    }).format(amount);
  };
  // -------------------------

  const accentColor = "text-[#2A9D90]";
  const accentBg = "bg-[#2A9D90]";

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

  const handleFreeSignup = () => {
    sessionStorage.removeItem("checkoutPlan");
    sessionStorage.removeItem("checkoutPriceId");
    setLocation("/registration");
  };

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Doculoom",
    "applicationCategory": "DesignApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "description": "Create stunning spec sheets by combining your design with Excel data."
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-[#2A9D90]/20">
      <Helmet>
        <title>Doculoom | Free Spec Sheet & Catalog Maker</title>
        <meta name="description" content="Generate data-driven PDF catalogs, price lists, and spec sheets from Excel. Professional CMYK export supported. Try for free." />
        <link rel="canonical" href="https://doculoom.io/" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <PublicHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-32 lg:pb-40">
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="text-center space-y-8 max-w-4xl mx-auto mb-16">
            <div className={`inline-flex items-center rounded-full border border-[#2A9D90]/30 bg-[#2A9D90]/10 px-3 py-1 text-sm font-medium ${accentColor} mb-4`}>
              <span className={`flex h-2 w-2 rounded-full ${accentBg} mr-2`}></span>
              New: CMYK Print Export & Dynamic QRs
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900">
              Data-Driven Design for <br className="hidden md:block" />
              <span className={accentColor}>Professional Spec Sheets</span>
            </h1>

            <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Batch generate multi-page PDF catalogs, price lists, and technical sheets directly from Excel. Includes professional CMYK color support.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              <Button 
                size="lg" 
                data-testid="btn-cta-signup" 
                onClick={handleFreeSignup}
                className={`h-14 px-8 text-lg ${accentBg} hover:bg-[#2A9D90]/90 text-white shadow-xl shadow-[#2A9D90]/20 hover:shadow-2xl transition-all border-0`}
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>

              <Button variant="outline" size="lg" data-testid="btn-learn-more" className="h-14 px-8 text-lg border-slate-200 hover:bg-slate-50 hover:text-slate-900">
                View Samples
              </Button>
            </div>

            <p className="text-sm text-slate-500">No credit card required · Free CMYK conversion test</p>
          </div>

          {/* Visual Canvas */}
          <div className="relative max-w-5xl mx-auto mt-12 perspective-1000">
            <div className="absolute -inset-4 bg-gradient-to-r from-[#2A9D90] to-teal-600 rounded-xl blur-2xl opacity-20 animate-pulse"></div>
            <div className="relative bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden aspect-[16/9] md:aspect-[21/9] flex flex-col md:flex-row">
              {/* Left Panel */}
              <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <FileSpreadsheet size={14} /> 1. Import Data
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500 font-mono mb-2">
                    <div>SKU</div><div>PRICE</div><div>QR_URL</div>
                  </div>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-8 w-full bg-slate-800/50 rounded flex items-center px-3 gap-2">
                      <div className="h-1.5 w-8 bg-slate-600 rounded"></div>
                      <div className={`h-1.5 w-12 ${accentBg} opacity-40 rounded`}></div>
                      <div className={`h-1.5 w-16 ${accentBg} opacity-20 rounded ml-auto`}></div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Middle Panel */}
              <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900 p-6 relative group">
                <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-semibold mb-4">
                  <Palette size={14} /> 2. Map & Design
                </div>
                <div className="aspect-[3/4] bg-white rounded shadow-lg mx-auto w-3/4 p-4 transform transition-transform group-hover:scale-105 duration-500 relative">
                  <div className="h-24 bg-slate-100 rounded mb-3 flex items-center justify-center border-2 border-dashed border-slate-200">
                    <div className="text-slate-400 text-[10px]">Product Image</div>
                  </div>
                  <div className={`h-2 w-full ${accentBg} opacity-20 rounded mb-2`}></div>
                  <div className="h-2 w-2/3 bg-slate-100 rounded mb-4"></div>
                  <div className="absolute bottom-4 right-4">
                    <QrCode className="w-8 h-8 text-slate-800 opacity-20" />
                  </div>
                </div>
              </div>
              {/* Right Panel */}
              <div className="w-full md:w-1/3 bg-slate-900/50 p-6 relative">
                <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-semibold mb-4">
                  <Printer size={14} /> 3. CMYK Export
                </div>
                <div className="relative h-full flex items-center justify-center">
                  <div className="absolute top-8 left-8 w-32 h-40 bg-white opacity-40 rounded shadow border border-slate-200 transform -rotate-12"></div>
                  <div className="relative w-32 h-40 bg-white rounded shadow-xl border border-slate-200 flex flex-col items-center justify-center gap-3">
                    <CheckCircle2 className={accentColor} size={32} />
                    <div className="text-center">
                      <span className="text-xs font-bold text-slate-800 block">Print Ready</span>
                      <span className="text-[10px] text-slate-500">CMYK Profile Applied</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4">Built for High-Volume Production</h2>
            <p className="text-lg text-slate-600">
              The only tool that combines variable data printing features with an intuitive web-based designer.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<FileSpreadsheet className={accentColor} size={24} />}
              title="Excel & CSV Import"
              description="Upload your product catalogs or employee lists. We automatically detect headers for instant field mapping."
            />
            <FeatureCard 
              icon={<LayoutTemplate className={accentColor} size={24} />}
              title="Drag & Drop Builder"
              description="Position images, text, and shapes precisely. Use alignment guides and snap-to-grid for pixel-perfect layouts."
            />
             <FeatureCard 
              icon={<Printer className={accentColor} size={24} />}
              title="CMYK Print Support"
              description="Don't risk dull colors. Our rendering engine converts your designs to professional CMYK profiles (Ghostscript) for print shops."
            />
            <FeatureCard 
              icon={<QrCode className={accentColor} size={24} />}
              title="Dynamic QR Codes"
              description="Create QR codes that track scans. Update the destination URL even after you've printed and distributed your PDFs."
            />
            <FeatureCard 
              icon={<Files className={accentColor} size={24} />}
              title="Multi-Page Documents"
              description="Need more space? Add multiple pages to your template. Perfect for brochures, catalogs, and detailed reports."
            />
            <FeatureCard 
              icon={<Download className={accentColor} size={24} />}
              title="Bulk Generation"
              description="Generate hundreds of unique PDFs in one click. Our queue system ensures stable, high-quality rendering for every file."
            />
          </div>
        </div>
      </section>

      {/* Steps */}
      <section id="how-it-works" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
           <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">From Spreadsheet to Print in 3 Steps</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-slate-200 -z-10"></div>
            <Step number="01" title="Import Data" desc="Upload your data as a CSV or Excel file." accentColor={accentColor} />
            <Step number="02" title="Design & Map" desc="Drag fields onto the canvas. Add dynamic QR codes." accentColor={accentColor} />
             <Step number="03" title="Export PDF" desc="Select RGB for web or CMYK for print." accentColor={accentColor} />
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Perfect for variable data workflows</h2>
              <div className="space-y-4">
                <UseCaseItem title="Retail & Wholesale" desc="Generate 1000s of shelf tags with unique barcodes and pricing." accentColor={accentColor} />
                <UseCaseItem title="Technical Specs" desc="Create standardized equipment specification sheets from ERP data exports." accentColor={accentColor} />
                <UseCaseItem title="Event Management" desc="Print personalized attendee badges with unique QR codes for check-in." accentColor={accentColor} />
                <UseCaseItem title="Direct Mail" desc="Design personalized postcards with dynamic offers and tracking URLs." accentColor={accentColor} />
              </div>
              <div className="mt-8">
                <Button variant="outline" className="gap-2 hover:text-[#2A9D90] hover:bg-[#2A9D90]/5">
                  See template library <ChevronRight size={16} />
                </Button>
              </div>
            </div>
            <div className="bg-slate-100 rounded-2xl p-8 border border-slate-200 h-[500px] flex items-center justify-center relative overflow-hidden">
               <div className={`absolute top-0 right-0 w-64 h-64 ${accentBg} rounded-full blur-3xl opacity-20 translate-x-1/2 -translate-y-1/2`}></div>
               <div className={`absolute bottom-0 left-0 w-64 h-64 ${accentBg} rounded-full blur-3xl opacity-20 -translate-x-1/2 translate-y-1/2`}></div>

               <div className="bg-white shadow-2xl rounded-lg w-[300px] h-[420px] p-6 relative z-10 rotate-3 transition-transform hover:rotate-0 duration-500">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-slate-900 rounded"></div>
                    <div className="text-right">
                      <div className="h-4 w-24 bg-slate-200 rounded mb-1"></div>
                      <div className="h-3 w-16 bg-slate-100 rounded ml-auto"></div>
                    </div>
                  </div>
                  <div className="h-32 bg-slate-100 rounded mb-4 flex items-center justify-center text-slate-400">
                    <div className="text-xs">Dynamic Image</div>
                  </div>
                  <div className={`h-6 w-3/4 ${accentBg} opacity-20 rounded mb-2`}></div>
                  <div className="space-y-2 mb-4">
                    <div className="h-2 w-full bg-slate-100 rounded"></div>
                    <div className="h-2 w-full bg-slate-100 rounded"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-slate-100">
                    <div>
                      <QrCode className="w-12 h-12 text-slate-800" />
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section - Dynamic */}
      <section id="pricing" className="py-24 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Simple, predictable pricing</h2>
            <p className="text-slate-400">Start for free, upgrade for professional print features.</p>

            {/* TOGGLE */}
            <div className="flex items-center justify-center gap-4 pt-6">
              <Label 
                className={`text-sm cursor-pointer ${!isAnnual ? "font-bold text-white" : "text-slate-400"}`}
                onClick={() => setIsAnnual(false)}
              >
                Monthly
              </Label>
              <Switch 
                checked={isAnnual} 
                onCheckedChange={setIsAnnual}
                className="data-[state=checked]:bg-[#2A9D90] bg-slate-600 border-slate-500" 
              />
              <Label 
                className={`text-sm cursor-pointer flex items-center gap-2 ${isAnnual ? "font-bold text-white" : "text-slate-400"}`}
                onClick={() => setIsAnnual(true)}
              >
                Annual 
                <span className="bg-[#2A9D90]/20 text-[#2A9D90] text-xs px-2 py-0.5 rounded-full font-medium border border-[#2A9D90]/30">
                  Save ~30%
                </span>
              </Label>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Tier */}
            <PricingCard 
              name="Starter"
              price="$0"
              period="/mo"
              features={[
                '50 PDFs / month', 
                'Digital Ready Export', 
                'CSV & Excel Import', 
                'Basic QR Codes',
                'Multi-page Product Templates',
                'Watermarked Exports'
              ]}
              cta="Start Free"
              variant="outline"
              accentColor={accentColor}
              onAction={handleFreeSignup}
            />

            {/* Pro Tier (Dynamic) */}
            <PricingCard 
              name="Pro"
              // DYNAMIC PRICE (Divided by 12 for annual)
              price={isAnnual 
                ? formatPrice("prod_pro_annual", "$13", true) 
                : formatPrice("prod_pro_monthly", "$29", false)
              }
              period="/mo"
              // SHOW YEARLY COST SUBTEXT
              subtext={isAnnual ? `Billed ${formatPrice("prod_pro_annual", "$159", false)} yearly` : undefined}
              features={[
                'Unlimited PDFs', 
                'Print Ready Exports', 
                'Manageable QR Codes', 
                'Full Catalog Assembly', 
                'Priority Rendering Queue',
                'Watermark Removal'
              ]}
              cta={isAnnual ? "Start Pro Annual" : "Start Pro Monthly"}
              variant="filled"
              popular
              accentBg={accentBg}
              onAction={() => handlePlanSelect(
                isAnnual ? "pro_annual" : "pro_monthly", 
                isAnnual ? "prod_pro_annual" : "prod_pro_monthly"
              )}
            />

            {/* Team Tier */}
            <PricingCard 
              name="Enterprise"
              price="Custom"
              period=""
              features={[
                'Dedicated Rendering Server', 
                'Custom Font Uploads', 
                'Template Migration Services', 
                'API Access', 
                'SLA Support'
              ]}
              cta="Contact Sales"
              variant="outline"
              accentColor={accentColor}
              onAction={() => window.location.href = "mailto:sales@doculoom.io"}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={`py-24 ${accentBg} bg-opacity-5`}>
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6 text-slate-900">Ready to automate your documents?</h2>
          <div className="flex justify-center gap-4">
             <Button 
                size="lg" 
                onClick={handleFreeSignup}
                className={`h-14 px-8 text-lg ${accentBg} hover:bg-[#2A9D90]/90 text-white shadow-lg`}
             >
                Get Started Free
             </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 font-bold text-xl text-slate-900 mb-4">
              <div className={`w-8 h-8 ${accentBg} rounded-lg flex items-center justify-center text-white`}>
                <Layers size={20} />
              </div>
              Doculoom
            </div>
            <p className="text-slate-500 text-sm">Automating document creation for modern teams.</p>
          </div>
           {/* Footer Links - Kept simple */}
           <div>
            <h4 className="font-bold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-[#2A9D90]">Features</a></li>
              <li><a href="#" className="hover:text-[#2A9D90]">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-[#2A9D90]">Blog</a></li>
              <li><a href="#" className="hover:text-[#2A9D90]">Help Center</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-[#2A9D90]">Privacy</a></li>
              <li><a href="#" className="hover:text-[#2A9D90]">Terms</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Sub-components

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 rounded-xl border border-slate-100 bg-slate-50 hover:shadow-lg transition-shadow">
      <div className="mb-4 bg-white w-12 h-12 rounded-lg flex items-center justify-center shadow-sm border border-slate-100">{icon}</div>
      <h3 className="text-xl font-bold mb-2 text-slate-900">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ number, title, desc, accentColor }: { number: string, title: string, desc: string, accentColor: string }) {
  return (
    <div className="text-center relative z-10">
      <div className={`w-16 h-16 bg-white border-4 border-[#2A9D90]/20 ${accentColor} rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 shadow-sm`}>{number}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-slate-600 max-w-xs mx-auto">{desc}</p>
    </div>
  );
}

function UseCaseItem({ title, desc, accentColor }: { title: string, desc: string, accentColor: string }) {
  return (
    <div className="flex gap-4">
      <div className="mt-1">
        <div className="w-6 h-6 bg-[#2A9D90]/10 rounded-full flex items-center justify-center">
          <CheckCircle2 size={14} className={accentColor.replace('text-', '')} color="#2A9D90" />
        </div>
      </div>
      <div>
        <h4 className="font-bold text-slate-900">{title}</h4>
        <p className="text-slate-600 text-sm">{desc}</p>
      </div>
    </div>
  );
}

// Updated PricingCard to accept optional 'subtext'
function PricingCard({ name, price, period, subtext, features, cta, variant, popular, accentBg, onAction }: { 
  name: string, price: string, period?: string, subtext?: string, features: string[], cta: string, variant: 'filled' | 'outline', popular?: boolean, accentColor?: string, accentBg?: string, onAction?: () => void 
}) {
  const isFilled = variant === 'filled';
  return (
    <div className={`rounded-2xl p-8 relative flex flex-col ${isFilled ? `${accentBg} text-white shadow-xl scale-105 z-10` : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>
      {popular && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
          Most Popular
        </div>
      )}
      <h3 className="text-lg font-medium opacity-90 mb-2">{name}</h3>
      <div className="flex flex-col mb-6">
        <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">{price}</span>
            <span className="opacity-70">{period}</span>
        </div>
        {/* Render subtext if provided (e.g. "Billed $159 yearly") */}
        {subtext && (
            <span className="text-xs opacity-60 mt-1">{subtext}</span>
        )}
      </div>
      <ul className="space-y-4 mb-8 flex-1">
        {features.map((feat, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <CheckCircle2 size={18} className={isFilled ? 'text-white/80' : 'text-[#2A9D90]'} />
            <span className="opacity-90">{feat}</span>
          </li>
        ))}
      </ul>
      <Button 
        onClick={onAction}
        className={`w-full ${isFilled ? 'bg-white text-[#2A9D90] hover:bg-slate-50' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
      >
        {cta}
      </Button>
    </div>
  );
}