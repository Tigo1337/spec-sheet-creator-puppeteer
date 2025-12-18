import { useEffect, useRef } from "react";

interface RulerProps {
  type: "horizontal" | "vertical";
  zoom: number;
  length: number;
  offset?: number;
  mousePos?: number; // NEW: Accept mouse position
}

export function Ruler({ type, zoom, length, offset = 0, mousePos }: RulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw the Base Ruler (Static ticks)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Scale for high DPI
    const dpr = window.devicePixelRatio || 1;
    const width = type === "horizontal" ? length * zoom + 40 : 20;
    const height = type === "vertical" ? length * zoom + 40 : 20;

    // Set actual size in memory (scaled to account for device pixel ratio)
    canvas.width = width * dpr;
    canvas.height = height * dpr;

    // Set visible size
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = "#F3F4F6"; 
    ctx.fillRect(0, 0, width, height);

    // Tick Styles
    ctx.fillStyle = "#9CA3AF"; 
    ctx.strokeStyle = "#D1D5DB";
    ctx.lineWidth = 1;
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.beginPath();

    // Loop through pixels
    for (let i = 0; i <= length; i += 10) {
      const pos = i * zoom + offset;

      // Don't draw off-canvas
      if (pos < 0) continue; 

      if (type === "horizontal") {
        const isMajor = i % 50 === 0;
        const tickHeight = isMajor ? 20 : i % 10 === 0 ? 5 : 0;

        ctx.moveTo(pos, 20);
        ctx.lineTo(pos, 20 - tickHeight);

        if (isMajor && i > 0) {
           ctx.fillText(i.toString(), pos + 2, 2);
        }
      } else {
        const isMajor = i % 50 === 0;
        const tickWidth = isMajor ? 20 : i % 10 === 0 ? 5 : 0;

        ctx.moveTo(20, pos);
        ctx.lineTo(20 - tickWidth, pos);

        if (isMajor && i > 0) {
            ctx.save();
            ctx.translate(2, pos + 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText(i.toString(), 0, 0);
            ctx.restore();
        }
      }
    }
    ctx.stroke();

    // --- NEW: Draw Mouse Marker ---
    if (mousePos !== undefined && mousePos >= 0) {
        ctx.beginPath();
        ctx.strokeStyle = "#ef4444"; // Red color
        ctx.lineWidth = 1;

        if (type === "horizontal") {
            const screenX = mousePos * zoom + offset;
            ctx.moveTo(screenX, 0);
            ctx.lineTo(screenX, 20);
        } else {
            const screenY = mousePos * zoom + offset;
            ctx.moveTo(0, screenY);
            ctx.lineTo(20, screenY);
        }
        ctx.stroke();
    }

  }, [type, zoom, length, offset, mousePos]); // Re-render when mouse moves

  return <canvas ref={canvasRef} className="block pointer-events-none" />;
}