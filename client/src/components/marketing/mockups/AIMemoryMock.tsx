import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Database, Sparkles, CheckCircle2 } from "lucide-react";
import { EASE_OUT } from "../motion";

const container: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.1, staggerChildren: 0.45 } },
};

const card: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

const connector: Variants = {
  hidden: { scaleY: 0, opacity: 0 },
  visible: { scaleY: 1, opacity: 1, transition: { duration: 0.35, ease: EASE_OUT } },
};

const checkPop: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { duration: 0.4, ease: EASE_OUT } },
};

/** Features — AI Product Memory: raw -> processing -> enriched pipeline lights up. */
export function AIMemoryMock() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="w-3/4 space-y-3"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={container}
    >
      {/* RAW */}
      <motion.div variants={card} className="flex items-center gap-4 rounded-lg border border-slate-700 bg-slate-800 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-700">
          <Database size={20} className="text-slate-400" />
        </div>
        <div className="flex-1">
          <div className="mb-2 h-2 w-full rounded bg-slate-700" />
          <div className="h-2 w-2/3 rounded bg-slate-700" />
        </div>
        <span className="font-sans text-[10px] text-slate-500">RAW</span>
      </motion.div>

      <div className="flex justify-center">
        <motion.div variants={connector} style={{ originY: 0 }} className="h-5 w-px bg-[#2b9a8b]" />
      </div>

      {/* PROCESSING */}
      <motion.div
        variants={card}
        className="flex items-center gap-4 rounded-lg border border-[#2b9a8b]/40 bg-[#2b9a8b]/15 p-4"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded bg-[#2b9a8b]/30">
          <motion.div {...(!reduce && { animate: { rotate: 360 }, transition: { duration: 3, repeat: Infinity, ease: "linear" } })}>
            <Sparkles size={20} className="text-[#2b9a8b]" />
          </motion.div>
        </div>
        <div className="flex-1">
          <div className="mb-2 h-2 w-full rounded bg-[#2b9a8b]/40" />
          <div className="h-2 w-3/4 rounded bg-[#2b9a8b]/40" />
        </div>
        <span className={`font-sans text-[10px] text-[#2b9a8b] ${reduce ? "" : "animate-pulse"}`}>PROCESSING</span>
      </motion.div>

      <div className="flex justify-center">
        <motion.div variants={connector} style={{ originY: 0 }} className="h-5 w-px bg-[#2b9a8b]" />
      </div>

      {/* ENRICHED */}
      <motion.div variants={card} className="flex items-center gap-4 rounded-lg border border-green-500/40 bg-slate-800 p-4">
        <motion.div variants={checkPop} className="flex h-10 w-10 items-center justify-center rounded bg-green-500/20">
          <CheckCircle2 size={20} className="text-green-400" />
        </motion.div>
        <div className="flex-1">
          <div className="mb-2 h-2 w-full rounded bg-green-500/30" />
          <div className="h-2 w-5/6 rounded bg-green-500/30" />
        </div>
        <span className="font-sans text-[10px] text-green-400">ENRICHED</span>
      </motion.div>
    </motion.div>
  );
}
