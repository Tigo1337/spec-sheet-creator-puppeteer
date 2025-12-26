import React, { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Cal, { getCalApi } from "@calcom/embed-react"; // Import Cal.com
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { CheckCircle2 } from 'lucide-react';

export default function Demo() {
  // Initialize Cal.com embed settings on load
  useEffect(() => {
    (async function () {
      const cal = await getCalApi();
      cal("ui", {
        theme: "light",
        styles: { branding: { brandColor: "#2A9D90" } }, // Match your Brand Color
        hideEventTypeDetails: false,
        layout: "month_view"
      });
    })();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <Helmet>
        <title>Book a Demo | Doculoom</title>
        <meta name="description" content="Schedule a personalized demo of Doculoom's spec sheet automation platform." />
      </Helmet>

      <PublicHeader />

      <main className="max-w-7xl mx-auto px-4 py-16 md:py-24">
        <div className="grid lg:grid-cols-2 gap-16 items-start">

          {/* Left Column: Value Prop */}
          <div className="space-y-8">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight">
              See Doculoom in Action
            </h1>
            <p className="text-xl text-slate-600 leading-relaxed">
              Book a personalized demo with our product experts. We'll show you how to automate your specific catalog workflow.
            </p>

            <div className="space-y-6 pt-4">
              <FeatureRow text="Walkthrough of the drag-and-drop editor" />
              <FeatureRow text="Deep dive into Excel data mapping strategies" />
              <FeatureRow text="CMYK print export configuration tips" />
              <FeatureRow text="Q&A about your specific use case" />
            </div>

            {/* Social Proof Box */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mt-8">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center font-bold text-[#2A9D90]">
                  JD
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">"The demo convinced us. We cut our production time by 90% in the first week."</p>
                  <p className="text-xs text-slate-500 mt-1">John D. — Marketing Director @ RetailCo</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Cal.com Embed */}
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden min-h-[600px] flex flex-col">
            <div className="p-4 bg-slate-50 border-b border-slate-100 text-center text-sm text-slate-500">
               Select a time below
            </div>

            {/* IMPORTANT: Replace 'rick/30min' with your Cal.com username/link 
               1. Go to Cal.com -> Create Account (it's free)
               2. Copy your username (e.g. "tigo") or specific event (e.g. "tigo/demo")
            */}
            <Cal 
              calLink="olivier-lepage-dumont-t3mei5/doculoom-demo-30min" // <--- UPDATE THIS LINK
              style={{ width: "100%", height: "100%", minHeight: "600px" }}
              config={{ layout: 'month_view' }}
            />
          </div>

        </div>
      </main>
      <Footer />
    </div>
  );
}

function FeatureRow({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="bg-[#2A9D90]/10 p-1 rounded-full">
        <CheckCircle2 size={18} className="text-[#2A9D90]" />
      </div>
      <span className="text-slate-700 font-medium">{text}</span>
    </div>
  );
}