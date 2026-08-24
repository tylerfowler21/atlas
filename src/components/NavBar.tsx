"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Map", icon: "🗺️" },
  { href: "/places", label: "Places", icon: "📍" },
  { href: "/trips", label: "Trips", icon: "🧭" },
  { href: "/been", label: "Been", icon: "🌍" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <header className="flex shrink-0 items-center gap-1 border-b border-line px-3 py-2">
      <Link href="/" className="mr-3 flex items-center gap-2 px-1 text-sm font-semibold">
        <span aria-hidden>🧭</span>
        <span>Atlas</span>
      </Link>

      <nav className="flex items-center gap-1">
        {LINKS.map((link) => {
          const active =
            link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-2.5 py-1.5 text-sm ${
                active
                  ? "bg-accent/12 font-medium text-accent"
                  : "text-muted hover:bg-foreground/5"
              }`}
            >
              <span aria-hidden className="mr-1.5">
                {link.icon}
              </span>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
