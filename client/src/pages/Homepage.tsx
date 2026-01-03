import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from "wouter"; 
import { useQuery } from "@tanstack/react-query";
import { 
  FileSpreadsheet, 
  FileText,
  Palette, 
  Printer, 
  LayoutTemplate, 
  Download, 
  CheckCircle2, 
  ArrowRight, 
  QrCode, 
  Files, 
  Sparkles,
  Star,
  ChevronRight,
  Check, 
  Loader2
} from 'lucide-react';
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"; 

export default function Homepage() {
  const [, setLocation] = useLocation(); 
  const [isAnnual, setIsAnnual] = useState(false);

  // State for Scale Tier Dropdown
  const [scaleCredits, setScaleCredits] = useState("10000");

  const { data: prices, isLoading: isPricingLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: async () => {
      const res = await fetch("/api/plans");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });

  // --- SCALE TIER CONFIGURATION ---
  const scaleTiers: Record<string, { monthlyId: string; annualId: string }> = {
    "10000":  { monthlyId: "prod_scale_10k_mo",  annualId: "prod_scale_10k_yr" },
    "20000":  { monthlyId: "prod_scale_20k_mo",  annualId: "prod_scale_20k_yr" },
    "30000":  { monthlyId: "prod_scale_30k_mo",  annualId: "prod_scale_30k_yr" },
    "40000":  { monthlyId: "prod_scale_40k_mo",  annualId: "prod_scale_40k_yr" },
    "50000":  { monthlyId: "prod_scale_50k_mo",  annualId: "prod_scale_50k_yr" },
    "75000":  { monthlyId: "prod_scale_75k_mo",  annualId: "prod_scale_75k_yr" },
    "100000": { monthlyId: "prod_scale_100k_mo", annualId: "prod_scale_100k_yr" },
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

  const accentColor = "text-[#2A9D90]";
  const accentBg = "bg-[#2A9D90]";

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
        <title>Doculoom | Spec Sheet & Catalog Maker</title>
        <meta name="description" content="Generate data-driven PDF catalogs, price lists, and spec sheets from Excel. Professional CMYK export supported. Try for free." />
        <link rel="canonical" href="https://doculoom.io/" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <PublicHeader />

      <main className="space-y-32 mb-24">

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-[60px] pb-0">
          <div className="max-w-7xl mx-auto px-4 relative z-10">
            <div className="text-center space-y-8 max-w-4xl mx-auto">
              <div className={`inline-flex items-center rounded-full border border-[#2A9D90]/30 bg-[#2A9D90]/10 px-3 py-1 text-sm font-medium ${accentColor} mb-4`}>
                <Sparkles className={"h-4 w-4 ${accentBg} mr-2"} />
                New: AI Data Enrichment and Standardization
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

                <Button 
                  variant="outline" 
                  size="lg" 
                  data-testid="btn-learn-more" 
                  onClick={() => setLocation("/templates")}
                  className="h-14 px-8 text-lg border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                >
                  View Samples
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-0 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 space-y-16">

            {/* ROW 1: Import (Visual Left) */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">

              {/* Visual Container - Matches Row 2/3 Outer Structure */}
              <div className="w-full h-[515px] rounded-2xl overflow-hidden flex flex-col p-8 items-center justify-center relative">

                {/* Inner Card - Matches Row 2/3 Inner Structure (w-3/4, aspect ratio, border color) */}
                <div className="bg-white rounded w-3/4 aspect-[3/4] p-4 relative flex flex-col border border-slate-300">

                  {/* Grid Header */}
                  <div className="grid grid-cols-4 gap-2 text-[10px] text-slate-400 font-mono px-3 shrink-0 mb-2">
                    <div className="truncate">NAME</div>
                    <div className="truncate">SKU</div>
                    <div className="truncate">DESC</div>
                    <div className="truncate">IMAGE</div>
                  </div>

                  {/* Data Rows */}
                  <div className="flex-1 overflow-hidden flex flex-col gap-2 relative [mask-image:linear-gradient(to_bottom,black_90%,transparent)]">
                    {[...Array(11)].map((_, i) => (
                      <div key={i} className="h-8 w-full bg-white border border-slate-100 rounded grid grid-cols-4 items-center px-3 gap-2 shrink-0">
                        <div className={`h-1.5 w-8 ${accentBg} opacity-80 rounded`}></div>
                        <div className={`h-1.5 w-8 ${accentBg} opacity-50 rounded`}></div>
                        <div className={`h-1.5 w-8 ${accentBg} opacity-20 rounded`}></div>
                        <div className="h-1.5 w-8 bg-slate-100 rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div>
                <div className={`inline-flex items-center rounded-full bg-[#2A9D90]/10 px-3 py-1 text-sm font-medium ${accentColor} mb-6`}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Step 1
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-6">Import Your Data</h2>
                <p className="text-lg text-slate-600 leading-relaxed mb-8">
                  Upload your existing Excel or CSV files. Doculoom automatically detects headers and organizes your product data, SKUs, and descriptions for instant use. No need to reformat your entire database.
                </p>
                <ul className="space-y-4">
                  {['Automatic Header Detection', 'Bulk Image Matching', 'Validation Checks'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className={`h-5 w-5 ${accentColor}`} />
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* ROW 2: Map & Design (Visual Right) */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
              {/* Content */}
              <div className="order-2 lg:order-1">
                <div className={`inline-flex items-center rounded-full bg-[#2A9D90]/10 px-3 py-1 text-sm font-medium ${accentColor} mb-6`}>
                  <Palette className="h-4 w-4 mr-2" />
                  Step 2
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-6">Map & Design</h2>
                <p className="text-lg text-slate-600 leading-relaxed mb-8">
                  Drag and drop your data fields onto the canvas. Customize fonts, colors, and layout. Build one master template that works for thousands of records. What you see is exactly what gets printed.
                </p>
                <ul className="space-y-4">
                  {['Drag & Drop Builder', 'Dynamic Field Mapping', 'Conditional Formatting'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className={`h-5 w-5 ${accentColor}`} />
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual Container */}
              <div className="w-full h-[515px] rounded-2xl overflow-hidden flex flex-col p-8 items-center justify-center relative order-1 lg:order-2">
                 <div className="absolute top-4 left-6 flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                 </div>
                 {/* Original Card Visual */}
                 <div className="bg-white rounded w-3/4 aspect-[3/4] p-4 relative flex flex-col border border-slate-300">
                    <div className="flex justify-between mb-3">
                      <div className={`h-2 w-8 ${accentBg} opacity-80 rounded`}></div>
                      <div className={`h-2 w-8 ${accentBg} opacity-80 rounded`}></div>
                    </div>
                    <div className="h-32 bg-slate-50 rounded mb-3 flex items-center justify-center border-2 border-dashed border-slate-200 shrink-0">
                      <div className="text-slate-400 text-[10px]">Product Image</div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className={`h-2 w-full ${accentBg} opacity-20 rounded`}></div>
                      <div className={`h-2 w-full ${accentBg} opacity-20 rounded`}></div>
                      <div className={`h-2 w-full ${accentBg} opacity-20 rounded`}></div>
                      <div className={`h-2 w-full ${accentBg} opacity-20 rounded`}></div>
                      <div className={`h-2 w-2/3 ${accentBg} opacity-20 rounded`}></div>
                    </div>
                    <div className="absolute bottom-4 right-4">
                      <QrCode className="w-8 h-8 text-slate-800 opacity-90" />
                    </div>
                  </div>
              </div>
            </div>

            {/* ROW 3: Generate (Visual Left) */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">

              {/* Visual Container */}
              <div className="w-full h-[515px] rounded-2xl overflow-hidden flex flex-col p-8 items-center justify-center relative">
                 <div className="absolute top-4 left-6 flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                 </div>
                 {/* Original Card Visual */}
                 <div className="bg-white rounded w-3/4 aspect-[3/4] p-4 relative flex flex-col border border-slate-300">
                    <div className="flex justify-between mb-3 items-end shrink-0">
                      <span className={`text-[10px] font-bold ${accentColor} opacity-80`}>MODERN BATHTUB</span>
                      <span className={`text-[10px] font-bold ${accentColor} opacity-80`}>MOD-BATH-WHT</span>
                    </div>
                    <div className="aspect-video w-full bg-slate-50 rounded-sm mb-3 border border-slate-100 overflow-hidden shrink-0">
                        <img 
                          src="https://res.cloudinary.com/olilepage/image/upload/f_auto,q_auto/v1766578632/fluted-gray-modern-bathtub-japandi-ultra-4k-ar-16-9_q6ppsb.png" 
                          alt="Modern Bathtub" 
                          className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <p className="text-[10px] text-slate-500 leading-[1.4] text-left">
                        Transform your bathroom into a private sanctuary with this stunning freestanding bathtub. Featuring a sophisticated fluted exterior, the textured design adds architectural depth and modern elegance to any space.
                      </p>
                    </div>
                    <div className="absolute bottom-4 right-4">
                      <QrCode className="w-8 h-8 text-slate-800 opacity-90" />
                    </div>
                  </div>
              </div>

              {/* Content */}
              <div>
                <div className={`inline-flex items-center rounded-full bg-[#2A9D90]/10 px-3 py-1 text-sm font-medium ${accentColor} mb-6`}>
                  <FileText className="h-4 w-4 mr-2" />
                  Step 3
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-6">Generate & Export</h2>
                <p className="text-lg text-slate-600 leading-relaxed mb-8">
                  Generate hundreds of catalog pages or spec sheets in seconds. Export print-ready CMYK files for your print shop or digital RGB PDFs for the web. Includes automatic QR code generation.
                </p>
                <ul className="space-y-4">
                  {['CMYK & RGB Support', 'Bulk PDF Generation', 'High-Res 300 DPI'].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className={`h-5 w-5 ${accentColor}`} />
                      <span className="text-slate-700">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-0 bg-white">
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
        <section id="how-it-works" className="py-12 bg-slate-50">
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
        <section className="py-0">
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
                  <Button 
                    variant="outline" 
                    className="gap-2 hover:text-[#2A9D90] hover:bg-[#2A9D90]/5"
                    onClick={() => setLocation("/templates")}
                  >
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

        {/* Pricing Section - Merged Figma Layout + Doculoom Content */}
        <section id="pricing" className="py-0 bg-white text-slate-900">
          <div className="max-w-7xl mx-auto px-4">
            {/* Header */}
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">Simple, predictable pricing</h2>
              <p className="text-xl text-slate-600 mb-8">Start for free, upgrade for professional print features.</p>

              {/* Toggle (Preserved functionality, updated style for light mode) */}
              <div className="flex items-center justify-center gap-4">
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
                    Save ~17%
                  </span>
                </Label>
              </div>
            </div>

            {/* Figma-Style Pricing Cards */}
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">

              {/* Card 1: Starter (Standard) */}
              <PricingCard 
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

              {/* Card 2: Pro (Highlighted - Most Popular) */}
              <PricingCard 
                name="Pro"
                highlighted
                price={isAnnual 
                  ? formatPrice("prod_pro_annual", "$33.33", true) 
                  : formatPrice("prod_pro_monthly", "$39.99", false)
                }
                period="/mo"
                description="For growing teams needing print-ready files."
                subtext={isAnnual ? `Billed ${formatPrice("prod_pro_annual", "$399.99", false)} yearly` : undefined}
                features={[
                  'Unlimited PDFs', 
                  '1,000 AI Credits / month',
                  'Print Ready Exports', 
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

              {/* Card 3: Scale (Dynamic / Dropdown) */}
               <PricingCard 
                name="Scale"
                // Uses formatPrice with the new Floor Logic
                price={isAnnual 
                  ? formatPrice(currentScaleTier.annualId, "Loading...", true) 
                  : formatPrice(currentScaleTier.monthlyId, "Loading...", false)
                }
                period="/mo"
                description="For high-volume automation."
                subtext={isAnnual ? `Billed ${formatPrice(currentScaleTier.annualId, "...", false)} yearly` : undefined}
                features={[
                  'Everything in Pro',
                  // Dropdown Feature for Credits
                  <div key="credits-selector" className="w-full">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                      AI Credit Limit
                    </label>
                    <Select value={scaleCredits} onValueChange={setScaleCredits}>
                      <SelectTrigger className="w-full h-9 bg-slate-50 border-slate-200">
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

        {/* CTA */}
        <section className={`py-12 ${accentBg} bg-opacity-5`}>
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
      </main>

      <Footer />
    </div>
  );
}

// --- Sub-components ---

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

// Updated PricingCard to match the Figma Layout provided
function PricingCard({ 
  name, 
  price, 
  period, 
  description,
  subtext, 
  features, 
  cta, 
  ctaVariant, // 'teal' | 'dark'
  highlighted, 
  onAction 
}: { 
  name: string, 
  price: string, 
  period?: string, 
  description?: string,
  subtext?: string, 
  features: (string | React.ReactNode)[], 
  cta: string, 
  ctaVariant: 'teal' | 'dark',
  highlighted?: boolean, 
  onAction?: () => void 
}) {
  return (
    <div className={`p-8 relative rounded-2xl bg-white flex flex-col h-full ${
      highlighted 
        ? 'border-2 border-[#2A9D90] shadow-xl scale-105 z-10' 
        : 'border border-slate-200'
    }`}>
      {highlighted && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2A9D90] text-white hover:bg-[#2A9D90]">
          Most Popular
        </Badge>
      )}

      <div className="mb-6">
        <h3 className="text-2xl font-bold text-slate-900 mb-2">{name}</h3>
        {description && <p className="text-slate-600 text-sm">{description}</p>}
      </div>

      <div className="mb-6">
        <div className="flex items-baseline">
            <span className="text-4xl font-bold text-slate-900">{price}</span>
            <span className="text-slate-600 ml-2">{period}</span>
        </div>
        {subtext && (
           <span className="text-xs text-slate-500 mt-1 block">{subtext}</span>
        )}
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
    </div>
  );
}