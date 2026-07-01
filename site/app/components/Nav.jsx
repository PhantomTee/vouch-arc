"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CONTRACT, CONTRACT_SHORT, GITHUB } from "../lib/constants";

const links = [
  ["/how-it-works", "How it works"],
  ["/workers", "Workers"],
  ["/clients", "Clients"],
  ["/reputation", "Reputation"],
];

function Logo() {
  return (
    <svg width="16" height="16" viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        fill="currentColor"
        d="M 160 88 L 194 34 L 216 0 L 256 0 L 256 40 L 221.5 93.5 L 200 128 L 256 128 L 256 256 L 96 256 L 96 168 L 64.246 220 L 40 256 L 0 256 L 0 216 L 34 162 L 56 128 L 0 128 L 0 0 L 160 0 Z"
      />
    </svg>
  );
}

function useClock() {
  const [t, setT] = useState(null);
  useEffect(() => {
    const tick = () => setT(new Date().toISOString().slice(11, 19) + " UTC");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const clock = useClock();

  return (
    <>
      <div className="statusbar">
        <div className="statusbar-in">
          <span className="live">
            <i /> ONLINE
          </span>
          <span className="seg">
            <span className="hide-sm">{clock || "--:--:-- UTC"}</span>
            <a href={CONTRACT} target="_blank" rel="noreferrer" className="hide-sm">
              escrow {CONTRACT_SHORT}
            </a>
            <a href={GITHUB} target="_blank" rel="noreferrer">
              github
            </a>
          </span>
        </div>
      </div>

      <nav>
        <div className="nav-in">
          <Link className="brand" href="/" aria-label="Vouch home">
            <Logo />
            <b>Vouch</b>
          </Link>
          <div className="navlinks">
            {links.map(([href, label]) => (
              <Link key={href} href={href} className={path === href ? "on" : undefined}>
                {label}
              </Link>
            ))}
          </div>
          <button className="burger" aria-label="Open menu" onClick={() => setOpen(true)}>
            <span />
            <span />
            <span />
          </button>
        </div>
      </nav>

      {open && (
        <div className="sheet" role="dialog" aria-modal="true">
          <div className="top">
            <Link className="brand" href="/" aria-label="Vouch home" onClick={() => setOpen(false)}>
              <Logo />
              <b>Vouch</b>
            </Link>
            <button className="close" aria-label="Close menu" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="ml">
            {links.map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className={path === href ? "on" : undefined}>
                {label}
              </Link>
            ))}
          </div>
          <a className="cta-b" href={GITHUB} onClick={() => setOpen(false)}>
            View source →
          </a>
        </div>
      )}
    </>
  );
}
