import { motion, useReducedMotion, type Variants } from "framer-motion";
import { EASE_OUT } from "../motion";

const container: Variants = {
  hidden: {},
  visible: { transition: { delayChildren: 0.15, staggerChildren: 0.1 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

const handlePositions = [
  "-left-1 -top-1",
  "left-1/2 -top-1 -translate-x-1/2",
  "-right-1 -top-1",
  "-left-1 top-1/2 -translate-y-1/2",
  "-right-1 top-1/2 -translate-y-1/2",
  "-left-1 -bottom-1",
  "left-1/2 -bottom-1 -translate-x-1/2",
  "-right-1 -bottom-1",
];

/** Features — Professional Design Controls: selection box with pulsing handles + guide. */
export function CanvasMock() {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="flex aspect-[4/3] w-3/4 flex-col rounded border border-slate-700 bg-slate-800/70 p-4 backdrop-blur-sm"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={container}
    >
      {/* toolbar */}
      <div className="mb-4 flex items-center gap-2 border-b border-slate-700 pb-3">
        {[0, 1, 2].map((i) => (
          <motion.div key={i} variants={item} className="h-3 w-3 rounded-sm bg-slate-600" />
        ))}
        <motion.div variants={item} className="ml-1 h-3 w-3 rounded-sm bg-[#2b9a8b]" />
      </div>

      {/* canvas with selected element */}
      <motion.div variants={item} className="relative flex flex-1 items-center justify-center">
        <motion.div
          className="relative h-20 w-24 rounded border border-[#2b9a8b] bg-[#2b9a8b]/10"
          {...(!reduce && {
            animate: { x: [0, 6, 0], y: [0, -4, 0] },
            transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
          })}
        >
          {handlePositions.map((pos) => (
            <motion.span
              key={pos}
              className={`absolute ${pos} h-2 w-2 rounded-full bg-[#2b9a8b]`}
              {...(!reduce && {
                animate: { scale: [1, 1.4, 1] },
                transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" },
              })}
            />
          ))}
        </motion.div>

        {/* sweeping alignment guide */}
        {!reduce && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 h-px bg-[#2b9a8b]/50"
            animate={{ top: ["25%", "75%", "25%"] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </motion.div>

      <div className="mt-3 self-end font-sans text-xs text-slate-600">&#x231F;</div>
    </motion.div>
  );
}
