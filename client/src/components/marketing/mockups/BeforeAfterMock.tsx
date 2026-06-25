import { motion, useReducedMotion, type Variants } from "framer-motion";
import { FileSpreadsheet, QrCode, Diamond } from "lucide-react";
import { EASE_OUT } from "../motion";

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
    transition: { duration: 0.6, ease: EASE_OUT, delayChildren: 0.45, staggerChildren: 0.12 },
  },
};

const bar: Variants = {
  hidden: { scaleX: 0, opacity: 0 },
  visible: { scaleX: 1, opacity: 1, transition: { duration: 0.45, ease: EASE_OUT } },
};

const pop: Variants = {
  hidden: { opacity: 0, scale: 0.6 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: EASE_OUT } },
};

/** Homepage "From messy data to polished design" — animated before/after proof. */
export function BeforeAfterMock() {
  const reduce = useReducedMotion();
  const float = reduce ? {} : { y: [0, -8, 0] };

  return (
    <motion.div
      className="relative flex w-full flex-col items-center justify-center gap-4 md:flex-row"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {/* soft glow halo */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(43,154,139,0.18), transparent 70%)", filter: "blur(50px)" }}
      />

      {/* Source CSV card */}
      <motion.div variants={sourceCard} className="relative z-10 w-full md:w-64">
        <motion.div
          animate={float}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="relative rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="absolute -top-3 left-4 rounded-t border border-b-0 border-slate-200 bg-slate-100 px-3 py-1">
            <span className="font-sans text-[9px] font-bold uppercase tracking-wider text-slate-500">Source File</span>
          </div>
          <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-2 pt-2">
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            <span className="font-sans text-[10px] font-bold uppercase text-slate-400">Inventory.csv</span>
          </div>
          <div className="space-y-2">
            {["w-full", "w-2/3", "w-full", "w-3/4"].map((w, i) => (
              <div key={i} className={`h-2 ${w} rounded bg-slate-100`} />
            ))}
          </div>
          <div className="tech-footer mt-4">
            <span>REF: CSV-001</span>
            <span>RAW DATA</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Connector with travelling pulse */}
      <div className="relative z-10 hidden items-center md:flex">
        <div className="h-[1px] w-8 bg-slate-300" />
        <Diamond className="h-3 w-3 fill-[#2b9a8b] text-[#2b9a8b]" />
        <div className="relative h-[1px] w-8 bg-slate-300 overflow-visible">
          {!reduce && (
            <motion.span
              className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[#2b9a8b]"
              animate={{ x: [-20, 20], opacity: [0, 1, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.4 }}
            />
          )}
        </div>
      </div>

      {/* Output spec-sheet card */}
      <motion.div variants={outputCard} className="relative z-10 w-full md:w-72">
        <motion.div
          animate={float}
          transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
          className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-lg"
        >
          <div className="absolute -top-3 left-4 rounded-t border border-b-0 border-[#2b9a8b] bg-[#2b9a8b] px-3 py-1">
            <span className="font-sans text-[9px] font-bold uppercase tracking-wider text-white">Output</span>
          </div>
          <div className="absolute right-0 top-0 bg-[#2b9a8b] px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-white">
            PDF Export
          </div>
          <div className="flex aspect-[3/4] flex-col pt-2">
            <motion.div variants={pop} className="mb-3 h-32 overflow-hidden rounded bg-slate-100">
              <img
                src="https://res.cloudinary.com/olilepage/image/upload/f_auto,q_auto:best,dpr_auto/v1769141734/room-scene-update/modular-corner-sectional-dark-gray-modern-ultra-4k-ar-16-9.webp"
                className="h-full w-full object-cover"
                alt="Sample render"
              />
            </motion.div>
            <motion.div variants={bar} style={{ originX: 0 }} className="mb-2 h-3 w-1/2 rounded bg-[#2b9a8b]" />
            <div className="space-y-1">
              {["w-full", "w-full", "w-3/4"].map((w, i) => (
                <motion.div key={i} variants={bar} style={{ originX: 0 }} className={`h-1.5 ${w} rounded bg-slate-100`} />
              ))}
            </div>
            <div className="mt-auto flex items-end justify-between">
              <div className="h-4 w-4 rounded bg-slate-200" />
              <motion.div variants={pop}>
                <QrCode className="h-6 w-6 text-slate-900" />
              </motion.div>
            </div>
          </div>
          <div className="tech-footer">
            <span>FIG 1.0</span>
            <span>SCALE: 100%</span>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
