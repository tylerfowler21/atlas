"use client";

import Image from "next/image";
import AvatarImage from "@/components/AvatarImage";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DiscoverIcon,
  JournalIcon,
  MapIcon,
  NotificationsIcon,
  SignOutIcon,
  TripsIcon,
  WhosUsingRoavaIcon,
  YourProfileIcon,
} from "@/components/nav-icons";
import { useState } from "react";
import { useSearch } from "@/components/SearchProvider";

/// The brand's own icons rather than emoji. They are components, not strings,
/// because their stroke is currentColor — so they take the colour of whatever
/// they sit in and go teal alongside an active label instead of staying the
/// same picture everywhere.
export const LINKS = [
  { href: "/", label: "Map", Icon: MapIcon },
  { href: "/trips", label: "Trips", Icon: TripsIcon },
  { href: "/journal", label: "Journal", Icon: JournalIcon },
  { href: "/discover", label: "Discover", Icon: DiscoverIcon },
];

/// All four fit across a phone now, so nothing hides behind "More". There were
/// seven: Places was the map's own list without the map, Been was that list
/// filtered — both live on the map, which carries the filters — and Feed and
/// People are two views of other travellers.
export const PRIMARY = ["/", "/trips", "/journal", "/discover"];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

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
  const router = useRouter();
  const { query, setQuery } = useSearch();
  const [menuOpen, setMenuOpen] = useState(false);

  const label = user.name ?? user.email ?? "Account";
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  return (
    <header
      // Gone on the map, on a phone. The map runs to the top of the screen
      // there and the search floats on it — a title bar above that is a strip
      // of paint where the map should be. Every other page keeps it, and so
      // does the map from sm up, where there is room for both.
      className={`relative shrink-0 items-center gap-3 border-b border-line px-4 py-2.5 ${
        pathname === "/" ? "hidden sm:flex" : "flex"
      }`}
    >
      <Link href="/" className="flex items-center gap-2.5 text-base font-semibold">
        <Image src="/brand/mark-64.png" alt="" width={28} height={28} className="rounded-lg" />
        <span>Roava</span>
      </Link>

      {/* One group rather than four loose links, with the current page raised
          out of it. The old version tinted the active label and left it flat,
          which at a glance read as "this one is a different kind of link"
          rather than "you are here". */}
      <nav className="hidden items-center gap-1 rounded-full bg-foreground/5 p-1 sm:flex">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-surface font-medium text-foreground shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <link.Icon className="h-4 w-4 shrink-0" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        // The search field carries ml-auto and is hidden below sm, so without
        // this the bell and the avatar bunch up against the wordmark on a
        // phone — and the account menu, anchored to the avatar's right edge,
        // then opens off the side of the screen.
        className="relative ml-auto rounded-full p-2 text-sm text-muted hover:bg-foreground/5 sm:ml-0"
      >
        <NotificationsIcon className="h-5 w-5" />
        {unread > 0 && (
          // Ink on the coral, not white. White on it is 2.9:1 and on the teal
          // this used to be it was 2.5:1 — a count nobody can read is worse
          // than no count, and this is the smallest text in the interface.
          <span className="absolute -top-1 -right-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-[color:var(--accent-contrast)]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>

      {/* Searching from anywhere.
          
          The box is up here and the map that answers it is a page below, so
          what is typed lives in a provider in the layout between them. That
          also means it survives moving between pages: type on the trips page,
          press enter, and the map opens already looking for it.

          Below `sm` the bar has no room and the map keeps a field of its own,
          bound to the same value, so the two can never disagree. */}
      <form
        role="search"
        className="ml-auto hidden max-w-sm flex-1 sm:block"
        onSubmit={(e) => {
          e.preventDefault();
          // Somewhere else on the site, the answer is on the map.
          if (pathname !== "/") router.push("/");
        }}
      >
        <label className="relative block">
          <span className="sr-only">Search places or anywhere</span>
          {/* Inline rather than from nav-icons, which is generated from the
              shared SVGs by `npm run build:nav-icons` — a magnifier added by
              hand there would vanish the next time anyone ran it. */}
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m16.5 16.5 4 4" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search places or anywhere"
            className="w-full rounded-full border border-line bg-surface py-2 pr-4 pl-10 text-sm placeholder:text-muted focus:outline-2 focus:outline-offset-1 focus:outline-[color:var(--brand-active)]"
          />
        </label>
      </form>

      {/* The one thing this bar is for beyond getting somewhere: putting
          something on the map. Sun, because it is the only action up here and
          the design gives it the loudest colour in the kit. */}
      <Link
        href="/?add=pin"
        className="btn btn-accent hidden shrink-0 sm:inline-flex"
      >
        <span aria-hidden>+</span>
        Add place
      </Link>

      <div className="relative">
        <button
          type="button"
          aria-label="Your account"
          className="flex items-center gap-2 rounded-full p-0.5 hover:bg-foreground/5"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <AvatarImage
            src={user.image}
            size={28}
            className="size-7 rounded-full object-cover"
            fallback={
              <span className="grid size-7 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent-text">
                {initial}
              </span>
            }
          />
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
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-foreground/5"
              onClick={() => setMenuOpen(false)}
            >
              <YourProfileIcon className="h-4 w-4 shrink-0" />
              Your profile
            </Link>
            {admin && (
              <Link
                href="/admin"
                role="menuitem"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-foreground/5"
                onClick={() => setMenuOpen(false)}
              >
                <WhosUsingRoavaIcon className="h-4 w-4 shrink-0" />
                Who&apos;s using Roava
              </Link>
            )}
            <form action={signOutAction}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-foreground/5"
              >
                <SignOutIcon className="h-4 w-4 shrink-0" />
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}