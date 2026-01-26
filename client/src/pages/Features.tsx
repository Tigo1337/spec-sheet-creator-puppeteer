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
  ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Features() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <Helmet>
        <title>Features - Excel to PDF Automation | Doculoom</title>
        <meta name="description" content="Explore Doculoom features: Drag-and-drop canvas, Excel/CSV integration, AI Product Memory, and professional high-resolution exports." />
        <link rel="canonical" href="https://doculoom.io/features" />
      </Helmet>

      <PublicHeader />

      <main className="pt-20 pb-24">
        {/* Header Section */}
        <section className="max-w-7xl mx-auto px-4 text-center mb-24">
          <div className="inline-flex items-center rounded-full bg-[#2A9D90]/10 px-3 py-1 text-sm font-medium text-[#2A9D90] mb-6">
            Core Capabilities
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">Built for High-Volume Production</h1>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Doculoom isn't just a design tool. It's an automation engine designed to handle thousands of unique documents with pixel-perfect precision.
          </p>
        </section>

        {/* Feature Grid */}
        <div className="max-w-7xl mx-auto px-4 space-y-32">

          {/* Feature 1: The Designer */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-[#2A9D90]">
                <Palette size={24} />
              </div>
              <h2 className="text-3xl font-bold">The Design Canvas</h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                Our intuitive drag-and-drop interface gives you full control over your layout. Position text, images, and shapes with sub-pixel precision using alignment guides and snap-to-grid.
              </p>
              <ul className="space-y-3">
                 <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#2A9D90]" /> 8-point resize & rotation handles</li>
                 <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#2A9D90]" /> Smart alignment guides</li>
                 <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#2A9D90]" /> Custom font support (Inter, Roboto, etc.)</li>
              </ul>
            </div>
            <div className="bg-slate-100 rounded-2xl aspect-video border border-slate-200 overflow-hidden shadow-inner flex items-center justify-center p-8">
               <div className="bg-white rounded-lg shadow-2xl w-full h-full border border-slate-300 relative">
                  <div className="absolute top-4 left-4 h-4 w-24 bg-slate-100 rounded"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-1/2 aspect-square border-2 border-dashed border-[#2A9D90] bg-[#2A9D90]/5 flex items-center justify-center text-[10px] text-[#2A9D90] font-bold">CANVAS AREA</div>
                  </div>
               </div>
            </div>
          </div>

          {/* Feature 2: AI Automation */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="order-2 lg:order-1 bg-[#2A9D90]/5 rounded-2xl aspect-video border border-[#2A9D90]/20 flex items-center justify-center p-8">
               <div className="space-y-4 w-full">
                  <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm flex items-center gap-4">
                     <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center"><Database size={16}/></div>
                     <div className="flex-1 h-2 bg-slate-100 rounded"></div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-[#2A9D90] shadow-md flex items-center gap-4 animate-pulse">
                     <div className="h-8 w-8 rounded bg-[#2A9D90]/10 flex items-center justify-center text-[#2A9D90]"><Sparkles size={16}/></div>
                     <div className="flex-1 h-2 bg-[#2A9D90]/20 rounded"></div>
                  </div>
               </div>
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <div className="w-12 h-12 bg-[#2A9D90]/10 rounded-xl flex items-center justify-center text-[#2A9D90]">
                <Sparkles size={24} />
              </div>
              <h2 className="text-3xl font-bold">AI Product Memory</h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                Doculoom's AI doesn't just generate text; it remembers your brand. It builds a knowledge base of your products to ensure descriptions and technical specs are consistent across every sheet you print.
              </p>
              <ul className="space-y-3">
                 <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#2A9D90]" /> Automatic data standardization</li>
                 <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#2A9D90]" /> Intelligent field mapping</li>
                 <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#2A9D90]" /> Bulk marketing copy enrichment</li>
              </ul>
            </div>
          </div>

          {/* Feature 3: Export Quality */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-6">
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-[#2A9D90]">
                <Printer size={24} />
              </div>
              <h2 className="text-3xl font-bold">Professional Export Engine</h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                Our rendering engine is designed to handle complex vector graphics and high-resolution images. Generate crisp, professional PDFs that look perfect on screen or coming off a printing press.
              </p>
              <ul className="space-y-3">
                 <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#2A9D90]" /> High-Res 300 DPI exports</li>
                 <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#2A9D90]" /> Digital & Print ready profiles</li>
                 <li className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-[#2A9D90]" /> Bleed and crop mark support</li>
              </ul>
            </div>
            <div className="bg-slate-900 rounded-2xl aspect-video border border-slate-800 flex items-center justify-center overflow-hidden">
               <div className="text-center">
                  <div className="flex justify-center gap-2 mb-4">
                     <div className="w-10 h-10 border border-[#2A9D90] bg-[#2A9D90]/10 flex items-center justify-center text-xs font-bold text-[#2A9D90]">PDF</div>
                  </div>
                  <div className="text-white/50 font-mono text-sm tracking-widest uppercase">Professional Render Queue</div>
               </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <section className="mt-32 max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to see it in action?</h2>
          <div className="flex justify-center gap-4">
            <Button size="lg" onClick={() => setLocation("/registration")} className="bg-[#2A9D90] hover:bg-[#2A9D90]/90 h-12 px-8">Get Started Free</Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/pricing")} className="h-12 px-8">View Pricing</Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}