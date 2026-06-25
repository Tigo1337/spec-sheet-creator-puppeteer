import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const GRID_IMAGE =
  "linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)";

function CornerTick({ className }: { className: string }) {
  return <div className={cn("pointer-events-none absolute h-4 w-4 border-[#2b9a8b]/40", className)} />;
}

/**
 * Unified dark "blueprint" container for marketing mockups: deep-navy background,
 * engineering grid, a soft teal radial glow, a gradient border sheen, and corner
 * ticks. Replaces the duplicated inline grid/corner snippets and the inconsistent
 * `#041c2c` vs `slate-900` panels. Pass the animated mockup as children.
 */
export function ShowcasePanel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden rounded-2xl bg-[#041c2c] p-8 ring-1 ring-white/10",
        className,
      )}
    >
      {/* gradient border sheen */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{ background: "linear-gradient(135deg, rgba(43,154,139,0.18), transparent 45%)" }}
      />
      {/* blueprint grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{ backgroundSize: "20px 20px", backgroundImage: GRID_IMAGE }}
      />
      {/* teal radial glow */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-2/3 w-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(43,154,139,0.28), transparent 70%)", filter: "blur(48px)" }}
      />
      {/* corner ticks */}
      <CornerTick className="left-3 top-3 border-l border-t" />
      <CornerTick className="right-3 top-3 border-r border-t" />
      <CornerTick className="bottom-3 left-3 border-b border-l" />
      <CornerTick className="bottom-3 right-3 border-b border-r" />

      <div className="relative z-10 flex w-full items-center justify-center">{children}</div>
    </div>
  );
}
