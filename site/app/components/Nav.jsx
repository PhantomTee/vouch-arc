"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const overlay = path === "/";
  return (
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
    </nav>
  );
}
