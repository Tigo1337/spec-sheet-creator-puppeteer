import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { fadeUp, staggerContainer } from "./motion";

const MOTION = {
  div: motion.div,
  li: motion.li,
  ul: motion.ul,
  span: motion.span,
  h2: motion.h2,
} as const;

type Tag = keyof typeof MOTION;

interface RevealProps {
  as?: Tag;
  variants?: Variants;
  className?: string;
  children: ReactNode;
  /** Treat as a stagger container; children passed `item` will reveal in sequence. */
  stagger?: boolean;
  /** Treat as a stagger child: inherits the parent container's animate state. */
  item?: boolean;
}

/**
 * Scroll-reveal wrapper. Plays once when scrolled into view. Falls back to a
 * plain (fully-visible) element when the OS "reduce motion" setting is on.
 *
 * - Default: a single element that fades/slides up on view.
 * - `stagger`: a container whose `item` children reveal one after another.
 * - `item`: a child of a `stagger` container (no own viewport trigger).
 */
export function Reveal({ as = "div", variants, className, children, stagger, item }: RevealProps) {
  const reduceMotion = useReducedMotion();
  const Comp = MOTION[as];
  const resolved = variants ?? (stagger ? staggerContainer : fadeUp);

  if (reduceMotion) {
    const Plain = as;
    return <Plain className={className}>{children}</Plain>;
  }

  if (item) {
    return (
      <Comp className={className} variants={resolved}>
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={resolved}
    >
      {children}
    </Comp>
  );
}
