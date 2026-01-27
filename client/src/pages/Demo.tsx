import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Cal, { getCalApi } from "@calcom/embed-react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  CheckCircle2,
  Calendar,
  Clock,
  Users,
  Video,
  ArrowRight,
  FileSpreadsheet,
  Palette,
  Printer,
  MessageSquare,
  Star
} from 'lucide-react';

export default function Demo() {
  const [, setLocation] = useLocation();

  // Initialize Cal.com embed settings on load
  useEffect(() => {
    (async function () {
      const cal = await getCalApi();
      cal("ui", {
        theme: "light",
        styles: { branding: { brandColor: "#2A9D90" } },
        hideEventTypeDetails: false,
        layout: "month_view"
      });
    })();
  }, []);

  const handleFreeSignup = () => {
    sessionStorage.removeItem("checkoutPlan");
    sessionStorage.removeItem("checkoutPriceId");
    setLocation("/registration");
  };

  return (
    <div className="min-h-screen bg-matte text-slate-900 font-sans selection:bg-[#2A9D90]/20">
      <Helmet>
        <title>Book a Demo | Doculoom</title>
        <meta name="description" content="Schedule a personalized demo of Doculoom's spec sheet automation platform." />
        <link rel="canonical" href="https://doculoom.io/demo" />
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
            <div className="grid lg:grid-cols-2 gap-16 items-start">

              {/* Left Column: Value Prop */}
              <div className="space-y-8">
                <div>
                  <span className="font-mono text-xs uppercase tracking-wider text-slate-400 mb-4 block">Book a Demo</span>
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 mb-6">
                    See Doculoom <span className="font-serif italic text-[#2A9D90]">in Action</span>
                  </h1>
                  <p className="text-xl text-slate-600 leading-relaxed">
                    Book a personalized demo with our product experts. We'll show you how to automate your specific catalog workflow.
                  </p>
                </div>

                {/* What to Expect */}
                <div className="space-y-4 pt-4">
                  <span className="font-mono text-xs uppercase tracking-wider text-slate-400 block">What We'll Cover</span>

                  <DemoFeatureRow
                    icon={<Palette size={18} />}
                    text="Walkthrough of the drag-and-drop editor"
                  />
                  <DemoFeatureRow
                    icon={<FileSpreadsheet size={18} />}
                    text="Deep dive into Excel data mapping strategies"
                  />
                  <DemoFeatureRow
                    icon={<Printer size={18} />}
                    text="CMYK print export configuration tips"
                  />
                  <DemoFeatureRow
                    icon={<MessageSquare size={18} />}
                    text="Q&A about your specific use case"
                  />
                </div>

                {/* Demo Details */}
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <DemoDetailCard icon={<Clock size={18} />} label="Duration" value="30 min" />
                  <DemoDetailCard icon={<Video size={18} />} label="Format" value="Video Call" />
                  <DemoDetailCard icon={<Users size={18} />} label="Attendees" value="1-on-1" />
                </div>

                {/* Social Proof Box */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 bg-[#2A9D90]/10 rounded-full flex items-center justify-center font-bold text-[#2A9D90] flex-shrink-0">
                      JD
                    </div>
                    <div>
                      <div className="flex gap-1 mb-2">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={14} className="fill-[#2A9D90] text-[#2A9D90]" />
                        ))}
                      </div>
                      <p className="text-sm font-medium text-slate-900 mb-2">
                        "The demo convinced us. We cut our production time by 90% in the first week."
                      </p>
                      <p className="text-xs text-slate-500 font-mono">
                        John D. — Marketing Director @ RetailCo
                      </p>
                    </div>
                  </div>
                  {/* Corner Mark */}
                  <div className="absolute bottom-3 right-3 text-slate-300 font-mono text-sm">&#x231F;</div>
                </div>

                {/* Alternative CTA */}
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-500 mb-4">
                    Prefer to explore on your own first?
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleFreeSignup}
                    className="border-slate-200 hover:bg-slate-50"
                  >
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Right Column: Cal.com Embed */}
              <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden min-h-[600px] flex flex-col relative">
                {/* Header Tab */}
                <div className="absolute -top-3 left-6 bg-[#2A9D90] border border-[#2A9D90] border-b-0 rounded-t px-4 py-1.5">
                  <span className="font-mono text-[10px] font-bold uppercase text-white tracking-wider flex items-center gap-2">
                    <Calendar size={12} />
                    Schedule
                  </span>
                </div>

                <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between pt-6">
                  <span className="text-sm text-slate-600 font-medium">Select a time below</span>
                  <span className="font-mono text-xs text-slate-400">30 MIN</span>
                </div>

                {/* Cal.com Embed */}
                <Cal
                  calLink="olivier-lepage-dumont-t3mei5/doculoom-demo-30min"
                  style={{ width: "100%", height: "100%", minHeight: "550px" }}
                  config={{ layout: 'month_view' }}
                />

                {/* Technical Footer */}
                <div className="tech-footer px-4 py-3 border-t border-slate-100 bg-white">
                  <span>REF: DEMO-001</span>
                  <span>&#x231F;</span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* What Happens Next Section */}
        <section className="py-0">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400 mb-4 block">Process</span>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">What Happens Next?</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <ProcessCard
                step="01"
                title="Confirmation Email"
                description="You'll receive a calendar invite with the video call link and any prep materials."
              />
              <ProcessCard
                step="02"
                title="30-Minute Demo"
                description="We'll walk through Doculoom's features tailored to your specific workflow needs."
              />
              <ProcessCard
                step="03"
                title="Custom Follow-Up"
                description="Get a personalized summary with template recommendations and next steps."
              />
            </div>
          </div>
        </section>

        {/* Additional Testimonials */}
        <section className="py-0 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-20">
            <div className="text-center mb-12">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400 mb-4 block">Testimonials</span>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">What Teams Say</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <TestimonialCard
                quote="Doculoom saved us from hiring another designer. We generate 500+ spec sheets monthly now."
                author="Sarah M."
                role="Operations Manager"
                company="FurniturePro"
              />
              <TestimonialCard
                quote="The demo showed us features we didn't even know we needed. Game changer for our catalog workflow."
                author="Michael T."
                role="Creative Director"
                company="BrandStudio"
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 bg-white border-y border-slate-100">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-slate-900 mb-6">
              Questions before booking?
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              Reach out anytime. We're happy to help you understand if Doculoom is right for your workflow.
            </p>
            <div className="flex justify-center gap-4">
              <Button
                size="lg"
                onClick={handleFreeSignup}
                className="h-14 px-8 text-lg bg-[#2A9D90] hover:bg-[#2A9D90]/90 text-white shadow-lg"
              >
                Try Free Instead
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

// Demo Feature Row Component
function DemoFeatureRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#2A9D90]/10 flex items-center justify-center text-[#2A9D90]">
        {icon}
      </div>
      <span className="text-slate-700 font-medium">{text}</span>
    </div>
  );
}

// Demo Detail Card Component
function DemoDetailCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-4 rounded-lg border border-slate-200 bg-white text-center">
      <div className="flex justify-center mb-2 text-[#2A9D90]">{icon}</div>
      <div className="font-mono text-xs uppercase tracking-wider text-slate-400 mb-1">{label}</div>
      <div className="font-bold text-slate-900">{value}</div>
    </div>
  );
}

// Process Card Component
function ProcessCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="p-6 rounded-xl border border-slate-200 bg-white relative">
      <div className="font-mono text-4xl font-bold text-[#2A9D90]/20 mb-4">{step}</div>
      <h3 className="font-bold tracking-tight text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
      {/* Corner Mark */}
      <div className="absolute bottom-3 right-3 text-slate-300 font-mono text-sm">&#x231F;</div>
    </div>
  );
}

// Testimonial Card Component
function TestimonialCard({
  quote,
  author,
  role,
  company
}: {
  quote: string;
  author: string;
  role: string;
  company: string;
}) {
  return (
    <div className="p-6 rounded-xl border border-slate-200 bg-slate-50 relative">
      <div className="flex gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star key={i} size={14} className="fill-[#2A9D90] text-[#2A9D90]" />
        ))}
      </div>
      <p className="text-slate-700 mb-4 leading-relaxed">"{quote}"</p>
      <div>
        <div className="font-bold text-slate-900">{author}</div>
        <div className="text-sm text-slate-500 font-mono">{role} @ {company}</div>
      </div>
      {/* Corner Mark */}
      <div className="absolute bottom-3 right-3 text-slate-300 font-mono text-sm">&#x231F;</div>
    </div>
  );
}
