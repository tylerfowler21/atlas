"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Map", icon: "🗺️" },
  { href: "/places", label: "Places", icon: "📍" },
  { href: "/trips", label: "Trips", icon: "🧭" },
  { href: "/been", label: "Been", icon: "🌍" },
  { href: "/feed", label: "Feed", icon: "📡" },
  { href: "/people", label: "People", icon: "👥" },
];

export type NavUser = {
  name: string | null;
  email: string | null;
  image: string | null;
};

export default function NavBar({
  user,
  admin = false,
  unread = 0,
  signOutAction,
}: {
  user: NavUser;
  /// Unread notifications, shown as a dot on the bell.
  unread?: number;
  /// Shows the admin entry. The page guards itself as well — this only keeps
  /// it out of sight for everyone else.
  admin?: boolean;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const label = user.name ?? user.email ?? "Account";
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="relative flex shrink-0 items-center gap-1 border-b border-line px-3 py-2">
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

      <Link
        href="/notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative ml-auto rounded-md px-2 py-1.5 text-sm text-muted hover:bg-foreground/5"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 right-0 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>

      <div className="relative">
        <button
          type="button"
          className="flex items-center gap-2 rounded-full p-0.5 pr-2 hover:bg-foreground/5"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {user.image ? (
            // Avatars come from the identity provider on arbitrary hosts, and
            // next/image would need every one of them allow-listed.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              width={28}
              height={28}
              className="size-7 rounded-full object-cover"
            />
          ) : (
            <span className="grid size-7 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
              {initial}
            </span>
          )}
          <span className="hidden max-w-32 truncate text-xs text-muted sm:block">
            {label}
          </span>
        </button>

        {menuOpen && (
          <div
            className="card absolute top-full right-0 z-20 mt-1 w-56 p-2 shadow-lg"
            role="menu"
          >
            <p className="truncate px-2 py-1 text-xs text-muted">{user.email}</p>
            <Link
              href="/settings"
              role="menuitem"
              className="block rounded-md px-2 py-1.5 text-sm hover:bg-foreground/5"
              onClick={() => setMenuOpen(false)}
            >
              Your profile
            </Link>
            {admin && (
              <Link
                href="/admin"
                role="menuitem"
                className="block rounded-md px-2 py-1.5 text-sm hover:bg-foreground/5"
                onClick={() => setMenuOpen(false)}
              >
                Who&apos;s using Atlas
              </Link>
            )}
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-foreground/5"
              >
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
