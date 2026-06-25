import { motion, useReducedMotion, type Variants } from "framer-motion";
import { QrCode } from "lucide-react";
import { EASE_OUT } from "../motion";

const container: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.15, staggerChildren: 0.12 } },
};

const bar: Variants = {
  hidden: { scaleX: 0, opacity: 0 },
  visible: { scaleX: 1, opacity: 1, transition: { duration: 0.45, ease: EASE_OUT } },
};

const fieldDrop: Variants = {
  hidden: { opacity: 0, y: -40, x: 30, scale: 0.8 },
  visible: { opacity: 1, y: 0, x: 0, scale: 1, transition: { duration: 0.6, ease: EASE_OUT } },
};

const handle: Variants = {
  hidden: { opacity: 0, scale: 0 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE_OUT } },
};

/** Step 2 — Map & Design: a data field drops onto the canvas, bars fill, handles pulse. */
export function MapDesignMock() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="relative flex aspect-[3/4] w-3/4 flex-col rounded border border-slate-700 bg-slate-800/80 p-4 backdrop-blur-sm"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={container}
    >
      <div className="mb-3 flex justify-between">
        <motion.div variants={bar} style={{ originX: 0 }} className="h-2 w-8 rounded bg-[#2b9a8b] opacity-80" />
        <motion.div variants={bar} style={{ originX: 1 }} className="h-2 w-8 rounded bg-[#2b9a8b] opacity-80" />
      </div>

      {/* image placeholder with a dropping data field + selection handles */}
      <div className="relative mb-3 flex h-32 shrink-0 items-center justify-center rounded border-2 border-dashed border-slate-600 bg-slate-700/60">
        <span className="font-sans text-[10px] text-slate-500">Product Image</span>

        <motion.div
          variants={fieldDrop}
          className="absolute right-2 top-2 rounded bg-[#2b9a8b]/20 px-2 py-1 font-sans text-[9px] font-bold text-[#2b9a8b] ring-1 ring-[#2b9a8b]/40"
        >
          {"{{ SKU }}"}
        </motion.div>

        {/* selection handles */}
        {[
          "left-1 top-1",
          "right-1 top-1",
          "bottom-1 left-1",
          "bottom-1 right-1",
        ].map((pos) => (
          <motion.span
            key={pos}
            variants={handle}
            className={`absolute ${pos} h-2 w-2 rounded-full bg-[#2b9a8b]`}
            {...(!reduce && {
              animate: { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] },
              transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
            })}
          />
        ))}

        {/* sweeping alignment guide */}
        {!reduce && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 h-px bg-[#2b9a8b]/60"
            animate={{ top: ["20%", "80%", "20%"] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        {["w-full", "w-full", "w-full", "w-full", "w-2/3"].map((w, i) => (
          <motion.div key={i} variants={bar} style={{ originX: 0 }} className={`h-2 ${w} rounded bg-[#2b9a8b] opacity-20`} />
        ))}
      </div>

      <div className="absolute bottom-4 right-4">
        <QrCode className="h-8 w-8 text-slate-600 opacity-90" />
      </div>
      <div className="absolute bottom-2 right-12 font-sans text-xs text-slate-600">&#x231F;</div>
    </motion.div>
  );
}
