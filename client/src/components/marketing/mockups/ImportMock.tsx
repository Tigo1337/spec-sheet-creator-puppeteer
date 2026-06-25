import { motion, useReducedMotion, type Variants } from "framer-motion";
import { EASE_OUT, fastStagger } from "../motion";

const row: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

const COLS = ["NAME", "SKU", "DESC", "IMAGE"];

/** Step 1 — Import: data rows stream in, a scan line sweeps, headers highlight. */
export function ImportMock() {
  const reduce = useReducedMotion();

  return (
    <div className="relative flex aspect-[3/4] w-3/4 flex-col rounded border border-slate-700 bg-slate-800/80 p-4 backdrop-blur-sm">
      {/* Header */}
      <motion.div
        className="mb-2 grid shrink-0 grid-cols-4 gap-2 px-3 font-sans text-[10px] text-slate-400"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={fastStagger}
      >
        {COLS.map((c) => (
          <motion.div key={c} variants={row} className="truncate text-[#2b9a8b]">
            {c}
          </motion.div>
        ))}
      </motion.div>

      {/* Rows */}
      <motion.div
        className="relative flex flex-1 flex-col gap-2 overflow-hidden [mask-image:linear-gradient(to_bottom,black_88%,transparent)]"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={fastStagger}
      >
        {[...Array(11)].map((_, i) => (
          <motion.div
            key={i}
            variants={row}
            className="grid h-8 shrink-0 grid-cols-4 items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3"
          >
            <div className="h-1.5 w-8 rounded bg-[#2b9a8b] opacity-80" />
            <div className="h-1.5 w-8 rounded bg-[#2b9a8b] opacity-50" />
            <div className="h-1.5 w-8 rounded bg-[#2b9a8b] opacity-20" />
            <div className="h-1.5 w-8 rounded bg-slate-600" />
          </motion.div>
        ))}

        {/* Scan line */}
        {!reduce && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 h-px"
            style={{ background: "linear-gradient(to right, transparent, #2b9a8b, transparent)", boxShadow: "0 0 8px #2b9a8b" }}
            animate={{ top: ["0%", "100%"] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 0.6 }}
          />
        )}
      </motion.div>

      <div className="absolute bottom-2 right-2 font-sans text-xs text-slate-600">&#x231F;</div>
    </div>
  );
}
