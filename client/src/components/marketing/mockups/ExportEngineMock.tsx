import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useInView, animate, type Variants } from "framer-motion";
import { EASE_OUT } from "../motion";

const container: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.1, staggerChildren: 0.15 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setVal(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 2.2,
      ease: "easeOut",
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, reduce]);

  return <span ref={ref}>{val}</span>;
}

/** Features — Professional Export Engine: render queue fills, page counter ticks up. */
export function ExportEngineMock() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="text-center"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={container}
    >
      {/* PDF format chips */}
      <div className="mb-8 flex justify-center gap-4">
        <motion.div
          variants={item}
          className="flex h-20 w-16 flex-col items-center justify-center rounded border-2 border-[#2b9a8b] bg-[#2b9a8b]/10"
          style={!reduce ? { boxShadow: "0 0 18px rgba(43,154,139,0.35)" } : undefined}
        >
          <span className="text-xs font-bold text-[#2b9a8b]">PDF</span>
          <span className="mt-1 text-[8px] text-slate-400">DIGITAL</span>
        </motion.div>
        <motion.div
          variants={item}
          className="flex h-20 w-16 flex-col items-center justify-center rounded border-2 border-slate-500 bg-slate-800"
        >
          <span className="text-xs font-bold text-slate-300">PDF</span>
          <span className="mt-1 text-[8px] text-slate-500">PRINT</span>
        </motion.div>
      </div>

      {/* render queue */}
      <motion.div variants={item} className="mx-auto max-w-xs rounded-lg border border-slate-700 bg-slate-800 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-sans text-xs text-slate-400">RENDER QUEUE</span>
          <span className={`font-sans text-xs text-green-400 ${reduce ? "" : "animate-pulse"}`}>ACTIVE</span>
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
            <motion.div
              className="h-full rounded-full bg-[#2b9a8b]"
              initial={{ width: reduce ? "75%" : "0%" }}
              whileInView={{ width: "75%" }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 2.2, ease: "easeOut" }}
            />
          </div>
          <div className="h-2 w-3/4 rounded-full bg-slate-700" />
          <div className="h-2 w-1/2 rounded-full bg-slate-700" />
        </div>
        <div className="mt-3 text-center">
          <span className="font-sans text-[10px] text-slate-500">
            Processing <CountUp to={127} /> of 500 pages
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
