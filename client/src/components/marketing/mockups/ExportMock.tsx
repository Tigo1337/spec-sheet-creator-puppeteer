import { motion, useReducedMotion, type Variants } from "framer-motion";
import { QrCode } from "lucide-react";
import { EASE_OUT } from "../motion";

const container: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.2, staggerChildren: 0.1 } },
};

const line: Variants = {
  hidden: { scaleX: 0, opacity: 0 },
  visible: { scaleX: 1, opacity: 1, transition: { duration: 0.4, ease: EASE_OUT } },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: EASE_OUT } },
};

const stackPage: Variants = {
  hidden: { opacity: 0, x: 0, y: 0 },
  visible: (i: number) => ({
    opacity: 0.4 - i * 0.12,
    x: (i + 1) * 10,
    y: (i + 1) * 10,
    transition: { duration: 0.5, ease: EASE_OUT, delay: 0.1 * i },
  }),
};

/** Step 3 — Generate & Export: page assembles, with extra pages stacking ("bulk"). */
export function ExportMock() {
  const reduce = useReducedMotion();

  return (
    <div className="relative w-3/4">
      {/* stacked pages behind (bulk generation) */}
      {[1, 0].map((i) => (
        <motion.div
          key={i}
          custom={i}
          variants={stackPage}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="absolute inset-0 rounded border border-slate-700 bg-slate-800"
        />
      ))}

      {/* front page */}
      <motion.div
        className="relative flex aspect-[3/4] flex-col rounded border border-slate-700 bg-slate-800 p-4"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={container}
      >
        <div className="mb-3 flex shrink-0 items-end justify-between">
          <motion.span variants={line} style={{ originX: 0 }} className="font-sans text-[10px] font-bold text-[#2b9a8b] opacity-80">
            FLOATING VANITY
          </motion.span>
          <motion.span variants={line} style={{ originX: 1 }} className="font-sans text-[10px] font-bold text-[#2b9a8b] opacity-80">
            FLT-VAN-WNT
          </motion.span>
        </div>

        <motion.div variants={scaleIn} className="mb-3 aspect-video w-full shrink-0 overflow-hidden rounded-sm border border-slate-600 bg-slate-700">
          <img
            src="https://res.cloudinary.com/olilepage/image/upload/f_auto,q_auto:best,dpr_auto/v1768705685/room-scene-update/floating-vanity-walnut-brown-zen-spa-ultra-4k-ar-16-9.jpg"
            alt="Floating vanity"
            className="h-full w-full object-cover"
          />
        </motion.div>

        <div className="flex flex-1 flex-col gap-1.5">
          {["w-full", "w-full", "w-5/6", "w-full", "w-2/3"].map((w, i) => (
            <motion.div key={i} variants={line} style={{ originX: 0 }} className={`h-1.5 ${w} rounded bg-slate-600`} />
          ))}
        </div>

        {/* render badge */}
        <motion.div variants={scaleIn} className="mt-2 flex items-center gap-1.5 self-start rounded-full bg-[#2b9a8b]/15 px-2 py-0.5">
          <span className={`h-1.5 w-1.5 rounded-full bg-[#2b9a8b] ${reduce ? "" : "animate-pulse"}`} />
          <span className="font-sans text-[8px] font-bold uppercase tracking-wider text-[#2b9a8b]">300 DPI · Ready</span>
        </motion.div>

        <div className="absolute bottom-4 right-4">
          <QrCode className="h-8 w-8 text-slate-600 opacity-90" />
        </div>
        <div className="absolute bottom-2 right-12 font-sans text-xs text-slate-600">&#x231F;</div>
      </motion.div>
    </div>
  );
}
