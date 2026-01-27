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
  Loader2,
  Zap,
  ShieldCheck,
  MousePointer2,
  X,
  Diamond
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
    "10000":  { monthlyId: "prod_scale_10k_monthly",  annualId: "prod_scale_10k_annual" },
    "20000":  { monthlyId: "prod_scale_20k_monthly",  annualId: "prod_scale_20k_annual" },
    "30000":  { monthlyId: "prod_scale_30k_monthly",  annualId: "prod_scale_30k_annual" },
    "40000":  { monthlyId: "prod_scale_40k_monthly",  annualId: "prod_scale_40k_annual" },
    "50000":  { monthlyId: "prod_scale_50k_monthly",  annualId: "prod_scale_50k_annual" },
    "75000":  { monthlyId: "prod_scale_75k_monthly",  annualId: "prod_scale_75k_annual" },
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
    <div className="min-h-screen bg-matte text-slate-900 font-sans selection:bg-[#2A9D90]/20">
      <Helmet>
        <title>Doculoom | Spec Sheet & Catalog Maker</title>
        <meta name="description" content="Generate data-driven PDF catalogs, price lists, and spec sheets from Excel. Professional high-resolution export supported. Try for free." />
        <link rel="canonical" href="https://doculoom.io/" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <PublicHeader />

      <main className="space-y-20 mb-16">

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-0">
          {/* Tech Grid Background with Radial Fade */}
          <div className="absolute inset-0 bg-tech-grid" style={{
            background: `radial-gradient(ellipse at center, transparent 0%, #f8fafc 70%),
                        repeating-linear-gradient(to right, rgba(0, 0, 0, 0.03) 0px, rgba(0, 0, 0, 0.03) 1px, transparent 1px, transparent 40px),
                        repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.03) 0px, rgba(0, 0, 0, 0.03) 1px, transparent 1px, transparent 40px)`
          }}></div>

          <div className="max-w-7xl mx-auto px-4 relative z-10">
            <div className="text-center space-y-6 max-w-4xl mx-auto">
              {/* System Notification Badge */}
              <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm mb-4">
                <Sparkles className="h-4 w-4 text-[#2A9D90] mr-2" />
                New: AI Data Enrichment and Standardization
              </div>

              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900">
                Data-Driven Design for <br className="hidden md:block" />
                <span className="font-serif italic text-[#2A9D90]">Professional</span> Spec Sheets
              </h1>

              <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                Batch generate multi-page PDF catalogs, price lists, and technical sheets directly from Excel. Engineered for speed and design precision.
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

        {/* Visual Proof Section: Before & After */}
        <section className="py-0 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4">
             <div className="bg-white rounded-3xl p-8 lg:p-16 border border-slate-200 relative overflow-hidden shadow-sm">
                <div className="grid lg:grid-cols-5 gap-12 items-center">
                   <div className="lg:col-span-2 space-y-6">
                      <h2 className="text-3xl font-bold tracking-tight text-slate-900">From messy data to <br/>polished design.</h2>
                      <p className="text-slate-600 leading-relaxed">Stop fighting with manual copy-pasting. Doculoom bridges the gap between your product database and professional PDF output.</p>
                      <ul className="space-y-3">
                         <li className="flex items-center gap-2 text-sm font-medium text-slate-700"><Check className="h-4 w-4 text-[#2A9D90]" /> No more formatting errors</li>
                         <li className="flex items-center gap-2 text-sm font-medium text-slate-700"><Check className="h-4 w-4 text-[#2A9D90]" /> Instant multi-page generation</li>
                         <li className="flex items-center gap-2 text-sm font-medium text-slate-700"><Check className="h-4 w-4 text-[#2A9D90]" /> Professional 300 DPI exports</li>
                      </ul>
                   </div>
                   <div className="lg:col-span-3 flex flex-col md:flex-row gap-4 items-center justify-center relative">
                      {/* Before: Raw Data Card - Blueprint/File Folder Style */}
                      <div className="w-full md:w-64 bg-white border border-slate-200 rounded-lg shadow-sm p-4 rotate-[-2deg] z-10 relative">
                         {/* Folder Tab Effect */}
                         <div className="absolute -top-3 left-4 bg-slate-100 border border-slate-200 border-b-0 rounded-t px-3 py-1">
                            <span className="font-sans text-[9px] font-bold uppercase text-slate-500 tracking-wider">Source File</span>
                         </div>
                         <div className="flex items-center gap-2 mb-3 border-b border-slate-100 pb-2 pt-2">
                            <FileSpreadsheet className="h-4 w-4 text-green-600" />
                            <span className="font-sans text-[10px] font-bold uppercase text-slate-400">Inventory.csv</span>
                         </div>
                         <div className="space-y-2">
                            <div className="h-2 w-full bg-slate-100 rounded"></div>
                            <div className="h-2 w-2/3 bg-slate-100 rounded"></div>
                            <div className="h-2 w-full bg-slate-100 rounded"></div>
                            <div className="h-2 w-3/4 bg-slate-100 rounded"></div>
                         </div>
                         {/* Technical Footer */}
                         <div className="tech-footer mt-4">
                            <span>REF: CSV-001</span>
                            <span>RAW DATA</span>
                         </div>
                      </div>

                      {/* Technical Line Connector with Diamond */}
                      <div className="hidden md:flex items-center gap-0">
                         <div className="w-8 h-[1px] bg-slate-300"></div>
                         <Diamond className="w-3 h-3 text-[#2A9D90] fill-[#2A9D90]" />
                         <div className="w-8 h-[1px] bg-slate-300"></div>
                      </div>

                      {/* After: Polished Spec Sheet Card - Blueprint Style */}
                      <div className="w-full md:w-72 bg-white border border-slate-200 rounded-lg shadow-sm p-4 rotate-[2deg] z-10 relative overflow-hidden">
                         {/* Folder Tab Effect */}
                         <div className="absolute -top-3 left-4 bg-[#2A9D90] border border-[#2A9D90] border-b-0 rounded-t px-3 py-1">
                            <span className="font-sans text-[9px] font-bold uppercase text-white tracking-wider">Output</span>
                         </div>
                         <div className="absolute top-0 right-0 bg-[#2A9D90] text-white text-[8px] px-2 py-0.5 font-bold uppercase tracking-widest">PDF Export</div>
                         <div className="aspect-[3/4] flex flex-col pt-2">
                            <div className="h-32 bg-slate-100 rounded mb-3 overflow-hidden">
                               <img
                                src="https://res.cloudinary.com/olilepage/image/upload/f_auto,q_auto:best,dpr_auto/v1769141734/room-scene-update/modular-corner-sectional-dark-gray-modern-ultra-4k-ar-16-9.webp"
                                className="w-full h-full object-cover"
                                alt="Sample"
                               />
                            </div>
                            <div className={`h-3 w-1/2 ${accentBg} rounded mb-2`}></div>
                            <div className="space-y-1">
                               <div className="h-1.5 w-full bg-slate-100 rounded"></div>
                               <div className="h-1.5 w-full bg-slate-100 rounded"></div>
                               <div className="h-1.5 w-3/4 bg-slate-100 rounded"></div>
                            </div>
                            <div className="mt-auto flex justify-between items-end">
                               <div className="h-4 w-4 bg-slate-200 rounded"></div>
                               <QrCode className="h-6 w-6 text-slate-900" />
                            </div>
                         </div>
                         {/* Technical Footer */}
                         <div className="tech-footer">
                            <span>FIG 1.0</span>
                            <span>SCALE: 100%</span>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </section>

        {/* How it Works Section - CAD Wireframe Style */}
        <section className="py-0 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 space-y-16">

            {/* ROW 1: Import (Visual Left) */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">

              {/* Visual Container - CAD Wireframe Style */}
              <div className="w-full h-[515px] rounded-2xl overflow-hidden flex flex-col p-8 items-center justify-center relative bg-slate-900">
                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-20" style={{
                  backgroundSize: '20px 20px',
                  backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)'
                }}></div>

                <div className="bg-slate-800 border border-slate-700 rounded w-3/4 aspect-[3/4] p-4 relative flex flex-col">
                  <div className="grid grid-cols-4 gap-2 text-[10px] text-slate-500 font-sans px-3 shrink-0 mb-2">
                    <div className="truncate">NAME</div>
                    <div className="truncate">SKU</div>
                    <div className="truncate">DESC</div>
                    <div className="truncate">IMAGE</div>
                  </div>
                  <div className="flex-1 overflow-hidden flex flex-col gap-2 relative [mask-image:linear-gradient(to_bottom,black_90%,transparent)]">
                    {[...Array(11)].map((_, i) => (
                      <div key={i} className="h-8 w-full bg-slate-800 border border-slate-700 rounded grid grid-cols-4 items-center px-3 gap-2 shrink-0">
                        <div className="h-1.5 w-8 bg-[#2A9D90] opacity-80 rounded"></div>
                        <div className="h-1.5 w-8 bg-[#2A9D90] opacity-50 rounded"></div>
                        <div className="h-1.5 w-8 bg-[#2A9D90] opacity-20 rounded"></div>
                        <div className="h-1.5 w-8 bg-slate-700 rounded"></div>
                      </div>
                    ))}
                  </div>
                  {/* Corner Mark */}
                  <div className="absolute bottom-2 right-2 text-slate-600 font-sans text-xs">&#x231F;</div>
                </div>
              </div>

              {/* Content */}
              <div>
                <span className="font-sans text-xs uppercase tracking-wider text-slate-400 mb-2 block">Step 1</span>
                <div className={`inline-flex items-center rounded-full bg-[#2A9D90]/10 px-3 py-1 text-sm font-medium ${accentColor} mb-6`}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Import
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-6">Import Your Data</h2>
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
                <span className="font-sans text-xs uppercase tracking-wider text-slate-400 mb-2 block">Step 2</span>
                <div className={`inline-flex items-center rounded-full bg-[#2A9D90]/10 px-3 py-1 text-sm font-medium ${accentColor} mb-6`}>
                  <Palette className="h-4 w-4 mr-2" />
                  Design
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-6">Map & Design</h2>
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

              {/* Visual Container - CAD Wireframe Style */}
              <div className="w-full h-[515px] rounded-2xl overflow-hidden flex flex-col p-8 items-center justify-center relative order-1 lg:order-2 bg-slate-900">
                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-20" style={{
                  backgroundSize: '20px 20px',
                  backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)'
                }}></div>

                 <div className="bg-slate-800 border border-slate-700 rounded w-3/4 aspect-[3/4] p-4 relative flex flex-col">
                    <div className="flex justify-between mb-3">
                      <div className="h-2 w-8 bg-[#2A9D90] opacity-80 rounded"></div>
                      <div className="h-2 w-8 bg-[#2A9D90] opacity-80 rounded"></div>
                    </div>
                    <div className="h-32 bg-slate-700 rounded mb-3 flex items-center justify-center border-2 border-dashed border-slate-600 shrink-0">
                      <div className="text-slate-500 text-[10px] font-sans">Product Image</div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="h-2 w-full bg-[#2A9D90] opacity-20 rounded"></div>
                      <div className="h-2 w-full bg-[#2A9D90] opacity-20 rounded"></div>
                      <div className="h-2 w-full bg-[#2A9D90] opacity-20 rounded"></div>
                      <div className="h-2 w-full bg-[#2A9D90] opacity-20 rounded"></div>
                      <div className="h-2 w-2/3 bg-[#2A9D90] opacity-20 rounded"></div>
                    </div>
                    <div className="absolute bottom-4 right-4">
                      <QrCode className="w-8 h-8 text-slate-600 opacity-90" />
                    </div>
                    {/* Corner Mark */}
                    <div className="absolute bottom-2 right-12 text-slate-600 font-sans text-xs">&#x231F;</div>
                  </div>
              </div>
            </div>

            {/* ROW 3: Generate (Visual Left) */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">

              {/* Visual Container - CAD Wireframe Style */}
              <div className="w-full h-[515px] rounded-2xl overflow-hidden flex flex-col p-8 items-center justify-center relative bg-slate-900">
                {/* Grid overlay */}
                <div className="absolute inset-0 opacity-20" style={{
                  backgroundSize: '20px 20px',
                  backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)'
                }}></div>

                 <div className="bg-slate-800 border border-slate-700 rounded w-3/4 aspect-[3/4] p-4 relative flex flex-col">
                    <div className="flex justify-between mb-3 items-end shrink-0">
                      <span className="text-[10px] font-bold text-[#2A9D90] opacity-80 font-sans">FLOATING VANITY</span>
                      <span className="text-[10px] font-bold text-[#2A9D90] opacity-80 font-sans">FLT-VAN-WNT</span>
                    </div>
                    <div className="aspect-video w-full bg-slate-700 rounded-sm mb-3 border border-slate-600 overflow-hidden shrink-0">
                        <img
                          src="https://res.cloudinary.com/olilepage/image/upload/f_auto,q_auto:best,dpr_auto/v1768705685/room-scene-update/floating-vanity-walnut-brown-zen-spa-ultra-4k-ar-16-9.jpg"
                          alt="Floating Vanity"
                          className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <p className="text-[10px] text-slate-400 leading-[1.4] text-left font-sans">
                        Transform your bathroom into a private sanctuary with this stunning floating vanity. Featuring a sophisticated fluted exterior, the textured design adds architectural depth and modern elegance to any space.
                      </p>
                    </div>
                    <div className="absolute bottom-4 right-4">
                      <QrCode className="w-8 h-8 text-slate-600 opacity-90" />
                    </div>
                    {/* Corner Mark */}
                    <div className="absolute bottom-2 right-12 text-slate-600 font-sans text-xs">&#x231F;</div>
                  </div>
              </div>

              {/* Content */}
              <div>
                <span className="font-sans text-xs uppercase tracking-wider text-slate-400 mb-2 block">Step 3</span>
                <div className={`inline-flex items-center rounded-full bg-[#2A9D90]/10 px-3 py-1 text-sm font-medium ${accentColor} mb-6`}>
                  <FileText className="h-4 w-4 mr-2" />
                  Export
                </div>
                <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 mb-6">Generate & Export</h2>
                <p className="text-lg text-slate-600 leading-relaxed mb-8">
                  Generate hundreds of catalog pages or spec sheets in seconds. Export professional high-resolution files or digital PDFs for the web. Includes automatic QR code generation for every record.
                </p>
                <ul className="space-y-4">
                  {['Print & Digital Formats', 'Bulk PDF Generation', 'High-Res 300 DPI'].map((item, i) => (
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

        {/* Features Grid - Bento Grid Layout */}
        <section id="features" className="py-0 bg-matte">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="font-sans text-xs uppercase tracking-wider text-slate-400 mb-4 block">Capabilities</span>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">Built for High-Volume Production</h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                The only tool that combines variable data printing features with an intuitive web-based designer.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid md:grid-cols-4 gap-6">
              {/* Excel & CSV Import - Regular */}
              <BentoCard
                icon={<FileSpreadsheet className={accentColor} size={24} />}
                title="Excel & CSV Import"
                description="Upload your product catalogs or employee lists. We automatically detect headers for instant field mapping."
                className="md:col-span-1"
              />

              {/* Drag & Drop Builder - Large */}
              <BentoCard
                icon={<LayoutTemplate className={accentColor} size={24} />}
                title="Drag & Drop Builder"
                description="Position images, text, and shapes precisely. Use alignment guides and snap-to-grid for pixel-perfect layouts. Our free-form canvas gives you complete creative control while maintaining data integrity across all your documents."
                className="md:col-span-2"
                large
              />

              {/* High-Resolution Output - Regular */}
              <BentoCard
                icon={<Printer className={accentColor} size={24} />}
                title="High-Resolution Output"
                description="Our rendering engine converts your designs to professional high-resolution PDFs suitable for any professional use."
                className="md:col-span-1"
              />

              {/* Dynamic QR Codes - Regular */}
              <BentoCard
                icon={<QrCode className={accentColor} size={24} />}
                title="Dynamic QR Codes"
                description="Create QR codes that track scans. Update the destination URL even after you've printed and distributed your PDFs."
                className="md:col-span-1"
              />

              {/* Multi-Page Documents - Regular */}
              <BentoCard
                icon={<Files className={accentColor} size={24} />}
                title="Multi-Page Documents"
                description="Need more space? Add multiple pages to your template. Perfect for brochures, catalogs, and detailed reports."
                className="md:col-span-1"
              />

              {/* Bulk Generation - Large */}
              <BentoCard
                icon={<Download className={accentColor} size={24} />}
                title="Bulk Generation"
                description="Generate hundreds of unique PDFs in one click. Our queue system ensures stable, high-quality rendering for every file. Process thousands of records without manual intervention."
                className="md:col-span-2"
                large
              />
            </div>
          </div>
        </section>

        {/* Why Doculoom? */}
        <section className="py-0 bg-white">
           <div className="max-w-5xl mx-auto px-4 py-20">
              <div className="text-center mb-12">
                 <span className="font-sans text-xs uppercase tracking-wider text-slate-400 mb-4 block">The Difference</span>
                 <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">Why Doculoom?</h2>
                 <p className="text-slate-600 leading-relaxed">Most design tools aren't built for data. Most data tools aren't built for design.</p>
              </div>
              <div className="grid md:grid-cols-3 gap-8">
                 <div className="p-8 bg-white border border-slate-200 rounded-xl space-y-4 shadow-sm relative">
                    <div className={`w-10 h-10 rounded-lg ${accentBg} bg-opacity-10 flex items-center justify-center`}>
                       <Palette className={accentColor} size={20} />
                    </div>
                    <h3 className="font-bold text-lg tracking-tight text-slate-900">Total Design Control</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                       Don't settle for rigid layouts. Our free-form canvas gives you the creative freedom of a professional design suite while maintaining strict data integrity.
                    </p>
                    {/* Corner Mark */}
                    <div className="absolute bottom-3 right-3 text-slate-300 font-sans text-sm">&#x231F;</div>
                 </div>
                 <div className="p-8 bg-white border border-slate-200 rounded-xl space-y-4 shadow-sm relative">
                    <div className={`w-10 h-10 rounded-lg ${accentBg} bg-opacity-10 flex items-center justify-center`}>
                       <FileSpreadsheet className={accentColor} size={20} />
                    </div>
                    <h3 className="font-bold text-lg tracking-tight text-slate-900">Seamless Data Linking</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                       Doculoom was built from the ground up to speak the language of Excel and CSV. Change a value in your spreadsheet, and every related document updates instantly.
                    </p>
                    {/* Corner Mark */}
                    <div className="absolute bottom-3 right-3 text-slate-300 font-sans text-sm">&#x231F;</div>
                 </div>
                 <div className="p-8 bg-slate-900 text-white rounded-xl space-y-4 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-[#2A9D90] px-3 py-1 text-[10px] font-bold uppercase font-sans tracking-wider">The Advantage</div>
                    <div className={`w-10 h-10 rounded-lg bg-[#2A9D90] bg-opacity-20 flex items-center justify-center`}>
                       <Zap className="text-[#2A9D90]" size={20} />
                    </div>
                    <h3 className="font-bold text-lg tracking-tight">Production-Grade Speed</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                       Generate 100 or 1,000 pages with a single click. Our cloud engine handles the heavy lifting, delivering high-resolution PDFs ready for any professional use.
                    </p>
                    {/* Corner Mark */}
                    <div className="absolute bottom-3 right-3 text-slate-600 font-sans text-sm">&#x231F;</div>
                 </div>
              </div>
           </div>
        </section>

        {/* Use Cases */}
        <section className="py-0">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <span className="font-sans text-xs uppercase tracking-wider text-slate-400 mb-4 block">Applications</span>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-6">Perfect for variable data workflows</h2>
                <div className="space-y-4">
                  <UseCaseItem title="Retail & Wholesale" desc="Generate 1000s of shelf tags with unique barcodes and pricing." accentColor={accentColor} />
                  <UseCaseItem title="Technical Specs" desc="Create standardized equipment specification sheets from ERP data exports." accentColor={accentColor} />
                  <UseCaseItem title="Event Management" desc="Print personalized attendee badges with unique QR codes for check-in." accentColor={accentColor} />
                  <UseCaseItem title="Direct Mail" desc="Design personalized postcards with dynamic offers and tracking URLs." accentColor={accentColor} />
                </div>
                <div className="mt-8">
                  <Button
                    variant="outline"
                    className="gap-2 hover:text-[#2A9D90] hover:bg-[#2A9D90]/5 border-slate-200"
                    onClick={() => setLocation("/templates")}
                  >
                    See template library <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
              <div className="bg-slate-100 rounded-2xl p-8 border border-slate-200 h-[500px] flex items-center justify-center relative overflow-hidden">
                 <div className={`absolute top-0 right-0 w-64 h-64 ${accentBg} rounded-full blur-3xl opacity-20 translate-x-1/2 -translate-y-1/2`}></div>
                 <div className={`absolute bottom-0 left-0 w-64 h-64 ${accentBg} rounded-full blur-3xl opacity-20 -translate-x-1/2 translate-y-1/2`}></div>
                 <div className="bg-white shadow-2xl rounded-lg w-[300px] h-[420px] p-6 relative z-10 rotate-3 transition-transform hover:rotate-0 duration-500 border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-12 h-12 bg-slate-900 rounded"></div>
                      <div className="text-right">
                        <div className="h-4 w-24 bg-slate-200 rounded mb-1"></div>
                        <div className="h-3 w-16 bg-slate-100 rounded ml-auto"></div>
                      </div>
                    </div>
                    <div className="h-32 bg-slate-100 rounded mb-4 flex items-center justify-center text-slate-400">
                      <div className="text-xs font-sans">Dynamic Image</div>
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
                    {/* Technical Footer */}
                    <div className="tech-footer">
                       <span>SAMPLE-001</span>
                       <span>PREVIEW</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section - Specification Sheet Style */}
        <section id="pricing" className="py-0 bg-matte text-slate-900">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="font-sans text-xs uppercase tracking-wider text-slate-400 mb-4 block">Pricing</span>
              <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-slate-900 mb-4">Simple, predictable pricing</h2>
              <p className="text-xl text-slate-600 leading-relaxed mb-8">Start for free, upgrade for professional automation features.</p>

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
                    Get 2 months on us when you pay annually.
                  </span>
                </Label>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto items-start">

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
                    <label className="font-sans text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                      AI Credit Limit
                    </label>
                    <Select value={scaleCredits} onValueChange={setScaleCredits}>
                      <SelectTrigger className="w-full h-9 bg-slate-50 border-slate-200 font-sans text-sm">
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
        <section className="py-12 bg-white border-y border-slate-100">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-slate-900 mb-6">Ready to automate your documents?</h2>
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

// Sub-components

// Bento Card Component with corner mark
function BentoCard({ icon, title, description, className = "", large = false }: {
  icon: React.ReactNode,
  title: string,
  description: string,
  className?: string,
  large?: boolean
}) {
  return (
    <div className={`p-6 rounded-xl border border-slate-200 bg-white hover:shadow-lg transition-shadow relative ${className}`}>
      <div className="mb-4 bg-slate-50 w-12 h-12 rounded-lg flex items-center justify-center border border-slate-100">{icon}</div>
      <h3 className={`font-bold tracking-tight text-slate-900 mb-2 ${large ? 'text-2xl' : 'text-xl'}`}>{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
      {/* Corner Mark */}
      <div className="absolute bottom-3 right-3 text-slate-300 font-sans text-sm">&#x231F;</div>
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
        <h4 className="font-bold tracking-tight text-slate-900">{title}</h4>
        <p className="text-slate-600 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// Specification Sheet Style Pricing Card
function SpecPricingCard({ name, price, period, description, subtext, features, cta, ctaVariant, highlighted, onAction }: {
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
    <div className={`p-8 relative rounded-xl bg-white flex flex-col h-full ${
      highlighted
        ? 'border-t-4 border-t-[#2A9D90] border-x border-b border-slate-200 shadow-xl scale-105 z-10'
        : 'border-t-4 border-t-slate-900 border-x border-b border-slate-200'
    }`}>
      {highlighted && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2A9D90] text-white hover:bg-[#2A9D90] font-sans text-[10px] uppercase tracking-wider">Most Popular</Badge>
      )}
      <div className="mb-6">
        <span className="font-sans text-xs uppercase tracking-wider text-slate-400 block mb-1">Plan</span>
        <h3 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">{name}</h3>
        {description && <p className="text-slate-600 text-sm leading-relaxed">{description}</p>}
      </div>
      <div className="mb-6">
        <span className="font-sans text-xs uppercase tracking-wider text-slate-400 block mb-1">Price</span>
        <div className="flex items-baseline">
            <span className="text-4xl font-sans font-bold text-slate-900">{price}</span>
            <span className="text-slate-600 ml-2">{period}</span>
        </div>
        {subtext && (<span className="font-sans text-xs text-slate-500 mt-1 block">{subtext}</span>)}
      </div>
      <Button onClick={onAction} className={`w-full mb-8 h-12 text-lg ${ctaVariant === 'teal' ? 'bg-[#2A9D90] hover:bg-[#2A9D90]/90 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>
        {cta}
      </Button>
      <div className="space-y-4 flex-1">
        <span className="font-sans text-xs uppercase tracking-wider text-slate-400 block">Includes</span>
        {features.map((feature, i) => (
          <div key={i} className="flex items-start gap-3">
             {typeof feature === 'string' ? (
              <><div className="mt-0.5 flex-shrink-0"><div className="w-5 h-5 rounded-full bg-[#2A9D90]/10 flex items-center justify-center"><Check className="h-3 w-3 text-[#2A9D90]" /></div></div><span className="text-slate-600 text-sm">{feature}</span></>
            ) : (<div className="w-full">{feature}</div>)}
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
