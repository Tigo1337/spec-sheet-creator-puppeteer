import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Palette, 
  Zap, 
  LayoutTemplate, 
  Download, 
  CheckCircle2, 
  ArrowRight, 
  BarChart3,
  Layers,
  FileText,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/button";
import { SignUpButton } from "@clerk/clerk-react";

export default function Homepage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100">
      {/* Your Existing Header */}
      <PublicHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 lg:pt-32 lg:pb-40">
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="text-center space-y-8 max-w-4xl mx-auto mb-16">
            <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-800 mb-4">
              <span className="flex h-2 w-2 rounded-full bg-blue-600 mr-2"></span>
              New: AI-Powered Template Matching
            </div>

            <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900">
              Create Professional <br className="hidden md:block" />
              <span className="text-blue-600">Spec Sheets</span>
            </h2>

            <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Combine custom designs with Excel data to generate stunning spec sheets in minutes. No design experience required.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
              {/* Your Existing Buttons with attributes preserved */}
              <SignUpButton mode="modal">
                <Button size="lg" data-testid="btn-cta-signup" className="h-14 px-8 text-lg shadow-blue-200 shadow-xl hover:shadow-2xl transition-all">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </SignUpButton>

              <Button variant="outline" size="lg" data-testid="btn-learn-more" className="h-14 px-8 text-lg">
                Learn More
              </Button>
            </div>

            <p className="text-sm text-slate-500">No credit card required · Export up to 50 PDFs/mo for free</p>
          </div>

          {/* Abstract Visual Representation of the App */}
          <div className="relative max-w-5xl mx-auto mt-12 perspective-1000">
             {/* Background Glow */}
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur-2xl opacity-20 animate-pulse"></div>

            <div className="relative bg-slate-900 rounded-xl border border-slate-800 shadow-2xl overflow-hidden aspect-[16/9] md:aspect-[21/9] flex flex-col md:flex-row">
              {/* Left Panel: Data */}
              <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900/50 p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <FileSpreadsheet size={14} /> Data Source
                </div>
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-8 w-full bg-slate-800/50 rounded flex items-center px-3 gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500/50"></div>
                      <div className="h-1.5 w-16 bg-slate-700 rounded"></div>
                      <div className="h-1.5 w-8 bg-slate-700 rounded ml-auto"></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Middle Panel: Builder */}
              <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-900 p-6 relative group">
                <div className="absolute top-1/2 -left-3 z-10 bg-slate-800 rounded-full p-1 border border-slate-700 hidden md:block">
                  <ArrowRight size={14} className="text-slate-400" />
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-semibold mb-4">
                  <Palette size={14} /> Template Builder
                </div>
                <div className="aspect-[3/4] bg-white rounded shadow-lg mx-auto w-3/4 p-4 transform transition-transform group-hover:scale-105 duration-500">
                  <div className="h-24 bg-slate-100 rounded mb-3 flex items-center justify-center">
                    <div className="text-slate-300 text-xs">Image Placeholder</div>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded mb-2"></div>
                  <div className="h-2 w-2/3 bg-slate-200 rounded mb-4"></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-8 bg-blue-50 border border-blue-100 rounded"></div>
                    <div className="h-8 bg-slate-50 border border-slate-100 rounded"></div>
                  </div>
                </div>
              </div>

              {/* Right Panel: Output */}
              <div className="w-full md:w-1/3 bg-slate-900/50 p-6 relative">
                 <div className="absolute top-1/2 -left-3 z-10 bg-slate-800 rounded-full p-1 border border-slate-700 hidden md:block">
                  <ArrowRight size={14} className="text-slate-400" />
                </div>
                <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-semibold mb-4">
                  <Download size={14} /> Batch Export
                </div>
                <div className="relative h-full flex items-center justify-center">
                  <div className="absolute top-8 left-8 w-32 h-40 bg-white opacity-40 rounded shadow border border-slate-200 transform -rotate-12"></div>
                  <div className="absolute top-4 left-12 w-32 h-40 bg-white opacity-70 rounded shadow border border-slate-200 transform -rotate-6"></div>
                  <div className="relative w-32 h-40 bg-white rounded shadow-xl border border-slate-200 flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 className="text-emerald-500" size={32} />
                    <span className="text-[10px] font-bold text-slate-600">100 Files <br/>Generated</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="border-y border-slate-100 bg-slate-50 py-10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm font-semibold text-slate-500 mb-6 uppercase tracking-wider">Trusted by teams automating their workflows</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Simple SVG Placeholders for Logos */}
            <div className="flex items-center gap-2 font-bold text-xl"><div className="w-6 h-6 bg-slate-800 rounded"></div> Acme Corp</div>
            <div className="flex items-center gap-2 font-bold text-xl"><div className="w-6 h-6 bg-slate-800 rounded-full"></div> GlobalTech</div>
            <div className="flex items-center gap-2 font-bold text-xl"><div className="w-6 h-6 bg-slate-800 rotate-45"></div> Nexus</div>
            <div className="flex items-center gap-2 font-bold text-xl"><div className="w-6 h-6 border-2 border-slate-800 rounded"></div> Stark Ind</div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold mb-4">Everything you need to scale document creation</h2>
            <p className="text-lg text-slate-600">
              We bridge the gap between your data (Excel, CSV, JSON) and your design needs.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<FileSpreadsheet className="text-emerald-600" size={24} />}
              title="Bring Your Own Data"
              description="Upload Excel or CSV files. We automatically detect headers and let you map columns to design elements instantly."
            />
            <FeatureCard 
              icon={<LayoutTemplate className="text-blue-600" size={24} />}
              title="Drag & Drop Builder"
              description="Design pixel-perfect templates with our intuitive editor. Drag dynamic fields directly onto the canvas."
            />
            <FeatureCard 
              icon={<Zap className="text-amber-500" size={24} />}
              title="Bulk Generation"
              description="Generate 1 or 1,000 PDFs in a single click. Download as a ZIP or email them directly to your team."
            />
             <FeatureCard 
              icon={<Palette className="text-purple-600" size={24} />}
              title="Brand Consistency"
              description="Lock specific colors, fonts, and logos to ensure every generated document stays on brand."
            />
            <FeatureCard 
              icon={<BarChart3 className="text-indigo-600" size={24} />}
              title="QR Code & Barcode Gen"
              description="Automatically convert SKUs or URLs from your spreadsheet into scannable barcodes on the PDF."
            />
            <FeatureCard 
              icon={<Layers className="text-rose-600" size={24} />}
              title="Smart Logic"
              description="Use conditional logic to hide/show sections based on data values (e.g., if Price > $0, show price tag)."
            />
          </div>
        </div>
      </section>

      {/* How it Works Step-by-Step */}
      <section id="how-it-works" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4">
           <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">From Spreadsheet to Done in 3 Steps</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-12 relative">
             {/* Connector Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-slate-200 -z-10"></div>

            <Step 
              number="01"
              title="Import Data"
              desc="Upload your product list, employee directory, or price sheet as a CSV/Excel file."
            />
            <Step 
              number="02"
              title="Design Template"
              desc="Drag dynamic fields (like {{Product_Name}}) onto the canvas and style them."
            />
             <Step 
              number="03"
              title="Batch Export"
              desc="Click generate. We merge each row of data into a unique, high-res PDF."
            />
          </div>
        </div>
      </section>

      {/* Use Cases Tab-like section */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Perfect for any industry</h2>
              <div className="space-y-4">
                <UseCaseItem title="Sales Teams" desc="Create custom sell sheets for 500+ SKUs with unique pricing per client." />
                <UseCaseItem title="Manufacturing" desc="Generate technical spec sheets and safety data sheets from ERP exports." />
                <UseCaseItem title="Event Organizers" desc="Print personalized badges, tickets, and itinerary cards for thousands of attendees." />
                <UseCaseItem title="Real Estate" desc="Turn property listings into open-house flyers instantly." />
              </div>
              <div className="mt-8">
                <Button variant="outline" className="gap-2">
                  See more examples <ChevronRight size={16} />
                </Button>
              </div>
            </div>
            <div className="bg-slate-100 rounded-2xl p-8 border border-slate-200 h-[500px] flex items-center justify-center relative overflow-hidden">
               {/* Decorative background elements */}
               <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100 rounded-full blur-3xl opacity-50 translate-x-1/2 -translate-y-1/2"></div>
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-100 rounded-full blur-3xl opacity-50 -translate-x-1/2 translate-y-1/2"></div>

               {/* Mockup of a Tech Sheet */}
               <div className="bg-white shadow-2xl rounded-lg w-[300px] h-[420px] p-6 relative z-10 rotate-3 transition-transform hover:rotate-0 duration-500">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-slate-900 rounded"></div>
                    <div className="text-right">
                      <div className="h-4 w-24 bg-slate-200 rounded mb-1"></div>
                      <div className="h-3 w-16 bg-slate-100 rounded ml-auto"></div>
                    </div>
                  </div>
                  <div className="h-32 bg-slate-100 rounded mb-4 flex items-center justify-center text-slate-400">Product Image</div>
                  <div className="h-6 w-3/4 bg-blue-100 rounded mb-2"></div>
                  <div className="space-y-2 mb-4">
                    <div className="h-2 w-full bg-slate-100 rounded"></div>
                    <div className="h-2 w-full bg-slate-100 rounded"></div>
                    <div className="h-2 w-2/3 bg-slate-100 rounded"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-auto pt-4 border-t border-slate-100">
                    <div>
                      <div className="h-2 w-12 bg-slate-200 rounded mb-1"></div>
                      <div className="h-4 w-16 bg-slate-800 rounded"></div>
                    </div>
                    <div className="text-right">
                      <div className="h-2 w-12 bg-slate-200 rounded ml-auto mb-1"></div>
                      <div className="h-4 w-16 bg-emerald-100 rounded ml-auto"></div>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Simple */}
      <section id="pricing" className="py-24 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Simple, predictable pricing</h2>
            <p className="text-slate-400">Start for free, upgrade as you scale.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Tier */}
            <PricingCard 
              name="Starter"
              price="$0"
              features={['50 PDFs / month', '1 Template', 'CSV Import', 'Standard Quality']}
              cta="Start Free"
              variant="outline"
            />
            {/* Pro Tier */}
            <PricingCard 
              name="Pro"
              price="$29"
              period="/mo"
              features={['Unlimited PDFs', 'Unlimited Templates', 'Excel & JSON Import', 'High-Res Print Quality', 'Priority Support']}
              cta="Get Pro"
              variant="filled"
              popular
            />
            {/* Team Tier */}
            <PricingCard 
              name="Team"
              price="$99"
              period="/mo"
              features={['Everything in Pro', '5 Team Members', 'Shared Asset Library', 'API Access', 'Custom Fonts']}
              cta="Contact Sales"
              variant="outline"
            />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-blue-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6 text-slate-900">Ready to automate your design workflow?</h2>
          <p className="text-xl text-slate-600 mb-8">
            Join thousands of marketers and engineers saving hours every week.
          </p>
          <div className="flex justify-center gap-4">
             <SignUpButton mode="modal">
                <Button size="lg" data-testid="btn-cta-signup" className="h-14 px-8 text-lg">
                  Get Started Free
                </Button>
             </SignUpButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 font-bold text-xl text-slate-900 mb-4">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <Layers size={20} />
              </div>
              PDFForge
            </div>
            <p className="text-slate-500 text-sm">
              Automating document creation for modern teams.
            </p>
          </div>
          <div>
            <h4 className="font-bold mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-blue-600">Features</a></li>
              <li><a href="#" className="hover:text-blue-600">Templates</a></li>
              <li><a href="#" className="hover:text-blue-600">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-blue-600">Blog</a></li>
              <li><a href="#" className="hover:text-blue-600">Help Center</a></li>
              <li><a href="#" className="hover:text-blue-600">API Docs</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm text-slate-500">
              <li><a href="#" className="hover:text-blue-600">Privacy</a></li>
              <li><a href="#" className="hover:text-blue-600">Terms</a></li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- SUB-COMPONENTS ---

function FeatureCard({ icon, title, description }) {
  return (
    <div className="p-6 rounded-xl border border-slate-100 bg-slate-50 hover:shadow-lg transition-shadow">
      <div className="mb-4 bg-white w-12 h-12 rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2 text-slate-900">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ number, title, desc }) {
  return (
    <div className="text-center relative z-10">
      <div className="w-16 h-16 bg-white border-4 border-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 shadow-sm">
        {number}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-slate-600 max-w-xs mx-auto">{desc}</p>
    </div>
  );
}

function UseCaseItem({ title, desc }) {
  return (
    <div className="flex gap-4">
      <div className="mt-1">
        <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
          <CheckCircle2 size={14} className="text-blue-600" />
        </div>
      </div>
      <div>
        <h4 className="font-bold text-slate-900">{title}</h4>
        <p className="text-slate-600 text-sm">{desc}</p>
      </div>
    </div>
  );
}

function PricingCard({ name, price, period, features, cta, variant, popular }) {
  const isFilled = variant === 'filled';
  return (
    <div className={`rounded-2xl p-8 relative flex flex-col ${isFilled ? 'bg-blue-600 text-white shadow-xl scale-105 z-10' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>
      {popular && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
          Most Popular
        </div>
      )}
      <h3 className="text-lg font-medium opacity-90 mb-2">{name}</h3>
      <div className="flex items-baseline gap-1 mb-6">
        <span className="text-4xl font-bold">{price}</span>
        <span className="opacity-70">{period}</span>
      </div>
      <ul className="space-y-4 mb-8 flex-1">
        {features.map((feat, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <CheckCircle2 size={18} className={isFilled ? 'text-blue-200' : 'text-blue-500'} />
            <span className="opacity-90">{feat}</span>
          </li>
        ))}
      </ul>
      <Button 
        className={`w-full ${isFilled ? 'bg-white text-blue-600 hover:bg-blue-50' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
      >
        {cta}
      </Button>
    </div>
  );
}