"use client";
import { ChevronRight, ArrowUpRight } from "lucide-react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  page:    "#0a0a0a",
  card:    "#0d0d0d",
  border:  "#1c1c1c",
  mint:    "#5BE2A9",
  mintHov: "#4dcf97",
  white:   "#ffffff",
  muted:   "#6b7280",
  mutedBd: "#374151",
};

export default function VouchHero() {
  return (
    <div
      style={{ background: C.page, minHeight: "100vh", padding: "1rem" }}
      className="font-sans"
    >
      <div className="mx-auto max-w-5xl">

        {/* ── Card wrapper ──────────────────────────────────────────────────── */}
        <div
          className="overflow-hidden rounded-2xl"
          style={{ background: C.card, border: `1px solid ${C.border}` }}
        >

          {/* ── Navigation ───────────────────────────────────────────────────── */}
          <nav
            className="grid grid-cols-3 items-start px-10 py-6"
            style={{ borderBottom: `1px solid ${C.border}` }}
          >
            {/* Left: vertical link stack */}
            <div className="flex flex-col gap-1.5">
              <a
                href="#"
                className="flex items-center gap-1 no-underline"
                style={{ color: C.white, fontSize: 13, fontWeight: 500 }}
              >
                Home
                <ChevronRight size={10} style={{ color: C.mint }} />
              </a>
              {["Platform", "Use Case", "Labs"].map((l) => (
                <a
                  key={l}
                  href="#"
                  className="no-underline transition-colors hover:text-gray-300"
                  style={{ color: C.muted, fontSize: 11, letterSpacing: ".02em" }}
                >
                  {l}
                </a>
              ))}
            </div>

            {/* Center: hollow square mark */}
            <div className="flex justify-center pt-0.5">
              <div
                className="rounded-md"
                style={{ width: 28, height: 28, border: `2px solid ${C.white}` }}
              />
            </div>

            {/* Right: launch button */}
            <div className="flex justify-end pt-0.5">
              <button
                className="flex items-center gap-1.5 rounded-lg transition-colors hover:bg-gray-100"
                style={{
                  background: C.white, color: "#000",
                  fontSize: 10, fontWeight: 700,
                  letterSpacing: ".1em", textTransform: "uppercase",
                  padding: "8px 16px", border: "none", cursor: "pointer",
                }}
              >
                Launch Agent
                <ArrowUpRight size={12} />
              </button>
            </div>
          </nav>

          {/* ── Hero ─────────────────────────────────────────────────────────── */}
          <div
            className="relative flex flex-col justify-between overflow-hidden"
            style={{ minHeight: 540, padding: "44px 44px 40px" }}
          >
            {/* Background: halftone silhouette */}
            <HalftoneSilhouette />

            {/* Headline — top-left, max 52% width to leave room for silhouette */}
            <h1
              className="relative z-10 m-0 uppercase text-white"
              style={{
                fontSize: "clamp(44px, 6.5vw, 76px)",
                fontWeight: 900,
                lineHeight: 0.87,
                letterSpacing: "-0.035em",
                maxWidth: "52%",
              }}
            >
              Build Agents<br />
              That Think Like<br />
              Humans
            </h1>

            {/* Bottom-left: sub-headline + CTAs */}
            <div className="relative z-10" style={{ maxWidth: 400 }}>
              <p
                className="m-0 mb-5"
                style={{
                  color: C.muted, fontSize: 13,
                  lineHeight: 1.6, letterSpacing: ".01em",
                }}
              >
                Synthetically trained. Symbolically steered.<br />
                Deploy AI agents that adapt, act, and learn.
              </p>
              <div className="flex flex-wrap gap-2.5">
                {/* Primary CTA */}
                <button
                  className="flex items-center gap-2 rounded-lg transition-colors hover:opacity-90"
                  style={{
                    background: C.mint, color: "#000",
                    fontSize: 10, fontWeight: 800,
                    letterSpacing: ".1em", textTransform: "uppercase",
                    padding: "11px 20px", border: "none", cursor: "pointer",
                  }}
                >
                  Try Agent Live
                  <ArrowUpRight size={12} />
                </button>
                {/* Secondary CTA */}
                <button
                  className="rounded-lg transition-colors"
                  style={{
                    background: "transparent", color: C.white,
                    fontSize: 10, fontWeight: 600,
                    letterSpacing: ".1em", textTransform: "uppercase",
                    padding: "11px 20px",
                    border: `1px solid ${C.mutedBd}`, cursor: "pointer",
                  }}
                >
                  Explore S. Engine
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Halftone person silhouette ──────────────────────────────────────────────
 *
 * Three visual layers (back → front):
 *
 *   1. Full-field ambient dot grid across the entire hero background.
 *      Masked with a left→right linear gradient so dots are invisible on
 *      the left and reach full opacity on the right.
 *
 *   2. An SVG with a person clip-path (head + neck + shoulders bezier curve)
 *      filled with the same dot pattern but at full #5BE2A9 saturation.
 *      A radial gradient mask fades the dots from bright in the head center
 *      to transparent at the body edges — creates depth and focus.
 *
 *   3. A soft ambient green glow halo centred on the head, bleeding slightly
 *      outside the silhouette for a luminous feel.
 */
function HalftoneSilhouette() {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden">

      {/* Layer 1: ambient dot field, left-to-right gradient fade */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(91,226,169,0.4) 1px, transparent 1px)",
          backgroundSize: "11px 11px",
          WebkitMaskImage:
            "linear-gradient(to right, transparent 15%, rgba(0,0,0,.15) 35%, rgba(0,0,0,.5) 60%, black 80%)",
          maskImage:
            "linear-gradient(to right, transparent 15%, rgba(0,0,0,.15) 35%, rgba(0,0,0,.5) 60%, black 80%)",
        }}
      />

      {/* Layers 2 + 3: SVG silhouette */}
      <svg
        className="absolute right-0 top-0 h-full w-auto"
        viewBox="0 0 420 520"
        preserveAspectRatio="xMaxYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Repeating dot pattern — mint green */}
          <pattern id="vd" width="11" height="11" patternUnits="userSpaceOnUse">
            <circle cx="5.5" cy="5.5" r="1.5" fill="#5BE2A9" />
          </pattern>

          {/* Radial fade mask: full at head centre → transparent at body edges */}
          <radialGradient id="vfade" cx="50%" cy="36%" r="48%">
            <stop offset="0%"   stopColor="white" stopOpacity="1" />
            <stop offset="50%"  stopColor="white" stopOpacity="0.65" />
            <stop offset="85%"  stopColor="white" stopOpacity="0.15" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="vm">
            <rect width="420" height="520" fill="url(#vfade)" />
          </mask>

          {/* Person clip-path: oval head, narrow neck, broad shoulders */}
          <clipPath id="vpc">
            <path d="
              M 210 25
              C 272 25, 322 76, 322 147
              C 322 212, 290 260, 262 282
              C 276 296, 282 318, 276 340
              C 340 360, 418 398, 434 458
              L 434 520 L -14 520 L -14 458
              C 2 398, 80 360, 144 340
              C 138 318, 144 296, 158 282
              C 130 260, 98 212, 98 147
              C 98 76, 148 25, 210 25 Z
            " />
          </clipPath>

          {/* Soft ambient glow — not clipped, bleeds slightly outside */}
          <radialGradient id="vglow" cx="50%" cy="36%" r="50%">
            <stop offset="0%"   stopColor="#5BE2A9" stopOpacity="0.12" />
            <stop offset="55%"  stopColor="#5BE2A9" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#5BE2A9" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Layer 3: ambient glow halo */}
        <ellipse cx="210" cy="200" rx="195" ry="255" fill="url(#vglow)" />

        {/* Layer 2: dot grid, clipped to person + radially faded */}
        <rect
          width="420"
          height="520"
          fill="url(#vd)"
          clipPath="url(#vpc)"
          mask="url(#vm)"
        />
      </svg>

    </div>
  );
}
