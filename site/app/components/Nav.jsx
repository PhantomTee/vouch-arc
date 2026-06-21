"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  ["/how-it-works", "How it works"],
  ["/workers", "Workers"],
  ["/clients", "Clients"],
  ["/reputation", "Reputation"],
];

function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 256 256" fill="none" aria-hidden="true">
      <path
        fill="rgb(84, 84, 84)"
        d="M 160 88 L 194 34 L 216 0 L 256 0 L 256 40 L 221.5 93.5 L 200 128 L 256 128 L 256 256 L 96 256 L 96 168 L 64.246 220 L 40 256 L 0 256 L 0 216 L 34 162 L 56 128 L 0 128 L 0 0 L 160 0 Z"
      />
    </svg>
  );
}

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const overlay = path === "/";

  return (
    <>
      <nav className={overlay ? "ov" : undefined}>
        <Link className="logo-pill" href="/" aria-label="Vouch home">
          <Logo />
        </Link>
        <div className="links-pill">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={path === href ? "on" : undefined}>
              {label}
            </Link>
          ))}
        </div>
        <button className="burger-pill" aria-label="Open menu" onClick={() => setOpen(true)}>
          <span />
          <span />
          <span />
        </button>
      </nav>

      {open && (
        <div className="sheet" role="dialog" aria-modal="true">
          <div className="top">
            <Link className="logo-pill" href="/" aria-label="Vouch home" onClick={() => setOpen(false)}>
              <Logo />
            </Link>
            <button className="close" aria-label="Close menu" onClick={() => setOpen(false)}>
              ✕
            </button>
          </div>
          <div className="ml">
            {links.map(([href, label]) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}>
                {label}
              </Link>
            ))}
          </div>
          <a className="cta-b" href="https://github.com/PhantomTee/vouch-arc" onClick={() => setOpen(false)}>
            View source →
          </a>
        </div>
      )}
    </>
  );
}
