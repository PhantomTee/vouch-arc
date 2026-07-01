"use client";
import { useEffect, useRef } from "react";

// Noise → Signal: the hero background starts as random ASCII static and
// resolves into a chevron glyph, echoing what verification actually does:
// turns an unverified claim into a confirmed, on-chain signal.
const CHARS = "01·:+*#%@$&";
const TARGET_COLS = 96;
const TARGET_ROWS = 34;
const REVEAL_MS = 500;
const REVEAL_SPREAD = 700;

export default function NoiseSignal() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cols = 0, rows = 0, cellW = 12, cellH = 14, cells = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let start = performance.now();
    let raf = 0, frameN = 0;

    const rand = (n) => (Math.random() * n) | 0;
    const isOnV = (x, y) => {
      const d1 = Math.abs(x - 0.5 * y - 0.055);
      const d2 = Math.abs(x - (1 - 0.5 * y) + 0.055);
      return Math.min(d1, d2) < 0.042;
    };

    function build() {
      const w = parent.clientWidth || 1;
      const h = parent.clientHeight || 1;
      cellW = Math.max(9, w / TARGET_COLS);
      cellH = Math.max(11, h / TARGET_ROWS);
      cols = Math.ceil(w / cellW);
      rows = Math.ceil(h / cellH);

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textBaseline = "top";
      ctx.font = `${Math.max(9, Math.min(13, Math.round(cellH * 0.72)))}px ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace`;

      cells = new Array(cols * rows);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = c / cols, y = r / rows;
          cells[r * cols + c] = {
            on: isOnV(x, y),
            delay: Math.random() * REVEAL_SPREAD,
            char: CHARS[rand(CHARS.length)],
          };
        }
      }
      start = performance.now();
      frameN = 0;
    }

    function frame(now) {
      frameN++;
      const elapsed = now - start;
      const settled = reduced || elapsed > REVEAL_SPREAD + REVEAL_MS + 400;
      if (settled && frameN % 3 !== 0) {
        raf = requestAnimationFrame(frame);
        return;
      }

      const w = parent.clientWidth, h = parent.clientHeight;
      ctx.clearRect(0, 0, w, h);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = cells[r * cols + c];
          const px = c * cellW, py = r * cellH;
          const progress = reduced ? 1 : Math.min(1, Math.max(0, (elapsed - cell.delay) / REVEAL_MS));

          if (progress < 1) {
            if (rand(6) === 0) cell.char = CHARS[rand(CHARS.length)];
            ctx.fillStyle = `rgba(45,255,196,${0.05 + 0.2 * progress})`;
            ctx.fillText(cell.char, px, py);
          } else if (cell.on) {
            const shimmer = 0.82 + 0.18 * Math.sin(now / 850 + r * 0.3 + c * 0.22);
            ctx.fillStyle = `rgba(45,255,196,${shimmer})`;
            ctx.fillText("@", px, py);
          } else {
            if (!reduced && rand(500) === 0) cell.char = CHARS[rand(CHARS.length)];
            ctx.fillStyle = "rgba(45,255,196,0.045)";
            ctx.fillText(cell.char, px, py);
          }
        }
      }
      raf = requestAnimationFrame(frame);
    }

    build();
    raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(() => build());
    ro.observe(parent);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="noise-hero" aria-hidden="true" />;
}
