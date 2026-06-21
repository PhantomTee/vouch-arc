"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/", "Home"],
  ["/how-it-works", "How it works"],
  ["/workers", "Workers"],
  ["/clients", "Clients"],
  ["/reputation", "Reputation"],
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav>
      <div className="nav-in">
        <Link className="mark" href="/">
          VOUCH
        </Link>
        <span className="links">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className={path === href ? "on" : undefined}>
              {label}
            </Link>
          ))}
        </span>
        <a className="dl" href="https://github.com/PhantomTee/vouch-arc">
          View source
        </a>
      </div>
    </nav>
  );
}
