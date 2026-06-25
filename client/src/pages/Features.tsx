import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Helmet } from "react-helmet-async";
import {
  Palette,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Layers,
  Database,
  Zap,
  QrCode,
  CheckCircle2,
  ArrowRight,
  Files,
  LayoutTemplate,
  Download,
  Image,
  Type,
  Table2,
  Cpu,
  Shield,
  Cloud
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Reveal } from "@/components/marketing/Reveal";
import { ShowcasePanel } from "@/components/marketing/ShowcasePanel";
import { CanvasMock } from "@/components/marketing/mockups/CanvasMock";
import { AIMemoryMock } from "@/components/marketing/mockups/AIMemoryMock";
import { ExportEngineMock } from "@/components/marketing/mockups/ExportEngineMock";

export default function Features() {
  const [, setLocation] = useLocation();

  const handleFreeSignup = () => {
    sessionStorage.removeItem("checkoutPlan");
    sessionStorage.removeItem("checkoutPriceId");
    setLocation("/registration");
  };

  return (
    <div className="min-h-screen bg-matte text-slate-900 font-sans selection:bg-[#2b9a8b]/20">
      <Helmet>
        <title>Features - Excel to PDF Automation | Doculoom</title>
        <meta name="description" content="Explore Doculoom features: Drag-and-drop canvas, Excel/CSV integration, AI Product Memory, and professional high-resolution exports." />
        <link rel="canonical" href="https://doculoom.io/features" />
      </Helmet>

      <PublicHeader />

      <main className="space-y-20 mb-16">

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-0">
          {/* Tech Grid Background with Radial Fade */}
          <div className="absolute inset-0" style={{
            background: `radial-gradient(ellipse at center, transparent 0%, #f8fafc 70%),
                        repeating-linear-gradient(to right, rgba(0, 0, 0, 0.03) 0px, rgba(0, 0, 0, 0.03) 1px, transparent 1px, transparent 40px),
                        repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.03) 0px, rgba(0, 0, 0, 0.03) 1px, transparent 1px, transparent 40px)`
          }}></div>

          <div className="max-w-7xl mx-auto px-4 relative z-10">
            <div className="text-center space-y-6 max-w-4xl mx-auto">
              <span className="font-sans text-xs uppercase tracking-wider text-slate-400 mb-4 block">Core Capabilities</span>

              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900">
                Built for <span className="font-serif italic text-[#2b9a8b]">High-Volume</span> Production
              </h1>

              <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
                Doculoom isn't just a design tool. It's an automation engine designed to handle thousands of unique documents with pixel-perfect precision.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                <Button
                  size="lg"
                  onClick={handleFreeSignup}
                  className="h-14 px-8 text-lg bg-[#9f2842] hover:bg-[#9f2842]/90 text-white shadow-xl shadow-[#9f2842]/20 hover:shadow-2xl transition-all border-0"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setLocation("/pricing")}
                  className="h-14 px-8 text-lg border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                >
                  View Pricing
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Deep Dive Sections */}
        <section className="py-0">
          <div className="max-w-7xl mx-auto px-4 space-y-20">

            {/* Feature 1: The Design Canvas */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
              {/* Visual */}
              <Reveal className="w-full">
                <ShowcasePanel className="h-[450px]">
                  <CanvasMock />
                </ShowcasePanel>
              </Reveal>

              {/* Content */}
              <Reveal>
                <span className="font-sans text-xs uppercase tracking-wider text-slate-400 mb-2 block">Design System</span>
                <div className="inline-flex items-center rounded-full bg-[#2b9a8b]/10 px-3 py-1 text-sm font-medium text-[#2b9a8b] mb-6">
                  <Palette className="h-4 w-4 mr-2" />
                  The Canvas
                </div>
                <h2 className="font-serif text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-6 leading-[1.1]">Professional Design Controls</h2>
                <p className="text-lg text-slate-600 leading-relaxed mb-8">
                  Our intuitive drag-and-drop interface gives you full control over your layout. Position text, images, and shapes with sub-pixel precision using alignment guides and snap-to-grid.
                </p>
                <ul className="space-y-4">
                  {[
                    { icon: <Layers size={18} />, text: '8-point resize & rotation handles' },
                    { icon: <LayoutTemplate size={18} />, text: 'Smart alignment guides' },
                    { icon: <Type size={18} />, text: 'Custom font support (Inter, Roboto, etc.)' }
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#2b9a8b]/10 flex items-center justify-center text-[#2b9a8b]">
                        {item.icon}
                      </div>
                      <span className="text-slate-700">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            {/* Feature 2: AI Automation */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
              {/* Content */}
              <Reveal className="order-2 lg:order-1">
                <span className="font-sans text-xs uppercase tracking-wider text-slate-400 mb-2 block">Intelligence</span>
                <div className="inline-flex items-center rounded-full bg-[#2b9a8b]/10 px-3 py-1 text-sm font-medium text-[#2b9a8b] mb-6">
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Engine
                </div>
                <h2 className="font-serif text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-6 leading-[1.1]">AI Product Memory</h2>
                <p className="text-lg text-slate-600 leading-relaxed mb-8">
                  Doculoom's AI doesn't just generate text; it remembers your brand. It builds a knowledge base of your products to ensure descriptions and technical specs are consistent across every sheet you print.
                </p>
                <ul className="space-y-4">
                  {[
                    { icon: <Database size={18} />, text: 'Automatic data standardization' },
                    { icon: <Zap size={18} />, text: 'Intelligent field mapping' },
                    { icon: <Sparkles size={18} />, text: 'Bulk marketing copy enrichment' }
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#2b9a8b]/10 flex items-center justify-center text-[#2b9a8b]">
                        {item.icon}
                      </div>
                      <span className="text-slate-700">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>

              {/* Visual */}
              <Reveal className="order-1 lg:order-2 w-full">
                <ShowcasePanel className="h-[450px]">
                  <AIMemoryMock />
                </ShowcasePanel>
              </Reveal>
            </div>

            {/* Feature 3: Export Engine */}
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-center">
              {/* Visual */}
              <Reveal className="w-full">
                <ShowcasePanel className="h-[450px]">
                  <ExportEngineMock />
                </ShowcasePanel>
              </Reveal>

              {/* Content */}
              <Reveal>
                <span className="font-sans text-xs uppercase tracking-wider text-slate-400 mb-2 block">Output</span>
                <div className="inline-flex items-center rounded-full bg-[#2b9a8b]/10 px-3 py-1 text-sm font-medium text-[#2b9a8b] mb-6">
                  <Printer className="h-4 w-4 mr-2" />
                  Export Engine
                </div>
                <h2 className="font-serif text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 mb-6 leading-[1.1]">Professional Export Engine</h2>
                <p className="text-lg text-slate-600 leading-relaxed mb-8">
                  Our rendering engine is designed to handle complex vector graphics and high-resolution images. Generate crisp, professional PDFs that look perfect on screen or coming off a printing press.
                </p>
                <ul className="space-y-4">
                  {[
                    { icon: <Image size={18} />, text: 'High-Res 300 DPI exports' },
                    { icon: <Files size={18} />, text: 'Digital & Print ready profiles' },
                    { icon: <Download size={18} />, text: 'Bleed and crop mark support' }
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#2b9a8b]/10 flex items-center justify-center text-[#2b9a8b]">
                        {item.icon}
                      </div>
                      <span className="text-slate-700">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

          </div>
        </section>

        {/* Additional Features Grid */}
        <section className="py-0">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="font-sans text-xs uppercase tracking-wider text-slate-400 mb-4 block">More Capabilities</span>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">Everything You Need</h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                A complete toolkit for professional document automation.
              </p>
            </div>

            <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-6">
              <FeatureCard
                icon={<FileSpreadsheet className="text-[#2b9a8b]" size={20} />}
                title="Excel & CSV Import"
                description="Upload your data files with automatic header detection and field mapping."
              />
              <FeatureCard
                icon={<QrCode className="text-[#2b9a8b]" size={20} />}
                title="Dynamic QR Codes"
                description="Generate trackable QR codes that can be updated even after printing."
              />
              <FeatureCard
                icon={<Files className="text-[#2b9a8b]" size={20} />}
                title="Multi-Page Templates"
                description="Create brochures, catalogs, and multi-page documents with ease."
              />
              <FeatureCard
                icon={<Table2 className="text-[#2b9a8b]" size={20} />}
                title="Dynamic Tables"
                description="Auto-populate tables from your data with flexible column configurations."
              />
              <FeatureCard
                icon={<Image className="text-[#2b9a8b]" size={20} />}
                title="Image Matching"
                description="Automatically match product images by SKU or filename patterns."
              />
              <FeatureCard
                icon={<Cpu className="text-[#2b9a8b]" size={20} />}
                title="Batch Processing"
                description="Generate hundreds of unique documents in a single operation."
              />
              <FeatureCard
                icon={<Shield className="text-[#2b9a8b]" size={20} />}
                title="Version Control"
                description="Track changes and maintain history of all your template revisions."
              />
              <FeatureCard
                icon={<Cloud className="text-[#2b9a8b]" size={20} />}
                title="Cloud Storage"
                description="All your projects and exports are securely stored in the cloud."
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 bg-white border-y border-slate-100">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-slate-900 mb-6">Ready to see it in action?</h2>
            <p className="text-xl text-slate-600 mb-8">
              Start creating professional documents in minutes, not hours.
            </p>
            <div className="flex justify-center gap-4">
              <Button
                size="lg"
                onClick={handleFreeSignup}
                className="h-14 px-8 text-lg bg-[#9f2842] hover:bg-[#9f2842]/90 text-white shadow-lg border-0"
              >
                Get Started Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setLocation("/pricing")}
                className="h-14 px-8 text-lg border-slate-200 hover:bg-slate-50"
              >
                View Pricing
              </Button>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}

// Feature Card Component
function FeatureCard({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl border border-slate-200 bg-white hover:shadow-lg transition-shadow relative">
      <div className="mb-4 bg-slate-50 w-10 h-10 rounded-lg flex items-center justify-center border border-slate-100">
        {icon}
      </div>
      <h3 className="font-bold tracking-tight text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
      {/* Corner Mark */}
      <div className="absolute bottom-3 right-3 text-slate-300 font-sans text-sm">&#x231F;</div>
    </div>
  );
}
