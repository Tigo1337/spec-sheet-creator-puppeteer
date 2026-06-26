import { motion, useReducedMotion, type Variants } from "framer-motion";
import { QrCode, ArrowRight, FileSpreadsheet, RefreshCw } from "lucide-react";

const EASE_OUT = [0.25, 0.1, 0.25, 1];

const sourceCard: Variants = {
  hidden: { opacity: 0, x: -28, rotate: -2 },
  visible: { opacity: 1, x: 0, rotate: -2, transition: { duration: 0.6, ease: EASE_OUT } },
};

const outputCard: Variants = {
  hidden: { opacity: 0, x: 28, rotate: 2 },
  visible: {
    opacity: 1,
    x: 0,
    rotate: 2,
    transition: { duration: 0.6, ease: EASE_OUT },
  },
};

export function BeforeAfterMock() {
  const reduce = useReducedMotion();
  const float = reduce ? {} : { y: [0, -6, 0] };

  return (
    <motion.div
      className="relative flex w-full flex-col items-center justify-center gap-8 md:flex-row"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {/* Soft Glow Background */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(43,154,139,0.15), transparent 70%)", filter: "blur(40px)" }}
      />

      {/* 1. Source Data (Messy/Raw Spreadsheet) */}
      <motion.div variants={sourceCard} className="relative z-10 w-full md:w-[300px]">
        <motion.div
          animate={float}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
        >
          {/* Excel UI Header */}
          <div className="mb-3 flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-emerald-100 text-emerald-700">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-sans text-[11px] font-bold text-slate-800">Q3_PIM_Export_Final.xlsx</span>
              <span className="text-[9px] text-slate-400">4,209 rows • Last synced 2m ago</span>
            </div>
          </div>

          {/* Simulated Raw Spreadsheet Grid */}
          <div className="flex flex-col overflow-hidden rounded border border-slate-200 font-mono text-[8px] text-slate-600">
            {/* Formula Bar */}
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 p-1.5 px-2 text-slate-400">
              <span className="italic">fx</span>
              <span className="truncate text-slate-700">https://res.cloudinary.com/doculoom/image/upload/v...</span>
            </div>

            {/* Grid Headers */}
            <div className="flex bg-slate-100 font-bold text-slate-500">
              <div className="w-6 border-r border-slate-200 text-center py-1.5"></div>
              <div className="w-16 border-r border-slate-200 px-1.5 py-1.5">A (SKU)</div>
              <div className="w-24 border-r border-slate-200 px-1.5 py-1.5">B (Image_URL)</div>
              <div className="flex-1 px-1.5 py-1.5">C (Desc_HTML)</div>
            </div>

            {/* Grid Rows */}
            <div className="flex border-t border-slate-200 bg-white">
              <div className="w-6 border-r border-slate-200 bg-slate-50 text-center py-1 text-slate-400">1</div>
              <div className="w-16 border-r border-slate-200 px-1.5 py-1 font-semibold text-slate-800">F-092-MDG</div>
              <div className="w-24 truncate border-r border-slate-200 px-1.5 py-1 text-blue-500 underline">https://res.cloudina...</div>
              <div className="flex-1 truncate px-1.5 py-1 text-orange-600">&lt;p&gt;Performance bo...</div>
            </div>
            <div className="flex border-t border-slate-200 bg-slate-50/50">
              <div className="w-6 border-r border-slate-200 bg-slate-50 text-center py-1 text-slate-400">2</div>
              <div className="w-16 border-r border-slate-200 px-1.5 py-1 font-semibold text-slate-800">F-093-LGR</div>
              <div className="w-24 truncate border-r border-slate-200 px-1.5 py-1 text-blue-500 underline">https://res.cloudina...</div>
              <div className="flex-1 truncate px-1.5 py-1 text-orange-600">&lt;strong&gt;Loom&lt;/st...</div>
            </div>
            <div className="flex border-t border-slate-200 bg-white">
              <div className="w-6 border-r border-slate-200 bg-slate-50 text-center py-1 text-slate-400">3</div>
              <div className="w-16 border-r border-slate-200 px-1.5 py-1 font-semibold text-slate-800">T-014-OAK</div>
              <div className="w-24 truncate border-r border-slate-200 px-1.5 py-1 text-blue-500 underline">https://res.cloudina...</div>
              <div className="flex-1 truncate px-1.5 py-1 text-orange-600">&lt;p&gt;Solid oak ba...</div>
            </div>
            <div className="flex border-t border-slate-200 bg-slate-50/50">
              <div className="w-6 border-r border-slate-200 bg-slate-50 text-center py-1 text-slate-400">4</div>
              <div className="w-16 border-r border-slate-200 px-1.5 py-1 font-semibold text-slate-800">C-112-WHT</div>
              <div className="w-24 truncate border-r border-slate-200 px-1.5 py-1 text-blue-500 underline">https://res.cloudina...</div>
              <div className="flex-1 truncate px-1.5 py-1 text-orange-600">&lt;ul&gt;&lt;li&gt;Cerami...</div>
            </div>
            <div className="flex border-t border-slate-200 bg-white">
              <div className="w-6 border-r border-slate-200 bg-slate-50 text-center py-1 text-slate-400">5</div>
              <div className="w-16 border-r border-slate-200 px-1.5 py-1 font-semibold text-slate-800">L-882-BRS</div>
              <div className="w-24 truncate border-r border-slate-200 px-1.5 py-1 text-blue-500 underline">https://res.cloudina...</div>
              <div className="flex-1 truncate px-1.5 py-1 text-orange-600">&lt;p&gt;Brushed bra...</div>
            </div>
            <div className="flex border-t border-slate-200 bg-slate-50/50">
              <div className="w-6 border-r border-slate-200 bg-slate-50 text-center py-1 text-slate-400 opacity-50">6</div>
              <div className="w-16 border-r border-slate-200 px-1.5 py-1 font-semibold text-slate-800 opacity-50">...</div>
              <div className="w-24 truncate border-r border-slate-200 px-1.5 py-1 text-blue-500 underline opacity-50">...</div>
              <div className="flex-1 truncate px-1.5 py-1 text-orange-600 opacity-50">...</div>
            </div>
          </div>

          {/* Status footer for the messy side */}
          <div className="mt-3 flex items-center justify-between rounded bg-slate-50 px-3 py-2 border border-slate-100">
            <span className="font-mono text-[9px] text-slate-500">Mapping 14 columns...</span>
            <RefreshCw className="h-3 w-3 animate-spin text-[#2b9a8b]" />
          </div>
        </motion.div>
      </motion.div>

      {/* Connector */}
      <div className="relative z-10 hidden items-center md:flex">
        <ArrowRight className="h-6 w-6 text-slate-300" />
      </div>

      {/* 2. Output Document (Minimalist, Editorial Spec Sheet) */}
      <motion.div variants={outputCard} className="relative z-10 w-full md:w-80">
        <motion.div
          animate={float}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          className="relative"
        >
          {/* Protruding "PDF Export" Badge (Moved fully outside the canvas) */}
          <div className="absolute -right-3 -top-3 z-20 flex items-center gap-1 rounded bg-[#2b9a8b] px-3 py-1 text-[8px] font-bold tracking-widest text-white shadow-lg rotate-3">
             PDF EXPORT
          </div>

          {/* Document Canvas */}
          <div className="flex aspect-[1/1.414] flex-col overflow-hidden rounded border border-slate-200 bg-white shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <span className="font-sans text-[10px] font-bold tracking-[0.3em] text-slate-900">LUMINA</span>
              <span className="font-mono text-[5px] tracking-widest text-slate-400 uppercase">Tech Spec // 2026</span>
            </div>

            {/* Image - beautifully framed in white space */}
            <div className="px-6 h-[38%] w-full">
              <div className="h-full w-full overflow-hidden bg-slate-50 border border-slate-100">
                <img
                  src="https://res.cloudinary.com/olilepage/image/upload/f_auto,q_auto:best,dpr_auto/v1769141734/room-scene-update/modular-corner-sectional-dark-gray-modern-ultra-4k-ar-16-9.webp"
                  className="h-full w-full object-cover"
                  alt="Aura Sectional"
                />
              </div>
            </div>

            {/* Document Body */}
            <div className="flex flex-1 flex-col px-6 pb-6 pt-4">

              {/* Title & SKU */}
              <div className="flex justify-between items-end mb-2">
                <div>
                  {/* Decorative sample label inside the product-sheet mockup —
                      intentionally not a heading so it stays out of the page outline. */}
                  <div className="font-serif text-3xl leading-none text-slate-900 tracking-tight" aria-hidden="true">Aura Sectional.</div>
                  <p className="mt-1.5 font-sans text-[6px] font-semibold uppercase tracking-[0.2em] text-slate-400">Modular / Dark Gray / F-092-MDG</p>
                </div>
              </div>

              {/* Description */}
              <p className="mb-3 text-[7px] leading-[1.6] text-slate-500 w-[90%]">
                A masterclass in modern proportion. The Aura features a deep, low-profile seat, tailored in commercial-grade performance bouclé. Stain-resistant and sustainably sourced, engineered for both high-traffic environments and curated luxury spaces.
              </p>

              {/* Specs Table - Clean, minimalist lines */}
              <div className="mt-auto flex flex-col border-t border-slate-900">
                <div className="flex justify-between border-b border-slate-200 py-1.5">
                  <span className="text-[6px] font-bold uppercase tracking-widest text-slate-400 w-1/4">Dimensions</span>
                  <span className="text-[7px] text-slate-800 w-3/4">112"W × 64"D × 32"H  (Seat Height: 17")</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 py-1.5">
                  <span className="text-[6px] font-bold uppercase tracking-widest text-slate-400 w-1/4">Materials</span>
                  <span className="text-[7px] text-slate-800 w-3/4">Kiln-dried hardwood, High-resiliency foam, Bouclé</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 py-1.5">
                  <span className="text-[6px] font-bold uppercase tracking-widest text-slate-400 w-1/4">Lead Time</span>
                  <span className="text-[7px] text-slate-800 w-3/4">In Stock: Ships within 2-4 business days</span>
                </div>

                {/* Footer Certs & QR */}
                <div className="flex justify-between items-end pt-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-[6px] font-bold uppercase tracking-widest text-slate-400">Certifications</p>
                    <div className="flex gap-2">
                       <span className="text-[7px] text-slate-600">FSC® Certified Wood</span>
                       <span className="text-[7px] text-slate-600">CertiPUR-US®</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-[5px] font-bold uppercase tracking-widest text-slate-400">3D / AR</p>
                      <p className="text-[5px] text-slate-400">Scan to view</p>
                    </div>
                    <QrCode className="h-7 w-7 text-slate-900" strokeWidth={1.2} />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}