"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  JournalIcon,
  MapIcon,
  NotificationsIcon,
  PeopleIcon,
  SignOutIcon,
  TripsIcon,
  WhosUsingRoavaIcon,
  YourProfileIcon,
} from "@/components/nav-icons";
import { useState } from "react";

/// The brand's own icons rather than emoji. They are components, not strings,
/// because their stroke is currentColor — so they take the colour of whatever
/// they sit in and go teal alongside an active label instead of staying the
/// same picture everywhere.
export const LINKS = [
  { href: "/", label: "Map", Icon: MapIcon },
  { href: "/trips", label: "Trips", Icon: TripsIcon },
  { href: "/journal", label: "Journal", Icon: JournalIcon },
  { href: "/discover", label: "Discover", Icon: PeopleIcon },
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
  const [menuOpen, setMenuOpen] = useState(false);

  const label = user.name ?? user.email ?? "Account";
  const initial = label.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="relative flex shrink-0 items-center gap-1 border-b border-line px-3 py-2">
      <Link href="/" className="mr-3 flex items-center gap-2 px-1 text-sm font-semibold">
        <Image src="/brand/mark-64.png" alt="" width={22} height={22} />
        <span>Roava</span>
      </Link>

      <nav className="hidden items-center gap-1 sm:flex">
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
                  ? "bg-accent/12 font-medium text-accent-text"
                  : "text-muted hover:bg-foreground/5"
              }`}
            >
              <link.Icon className="mr-1.5 h-4 w-4 shrink-0" />
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
        <NotificationsIcon className="h-5 w-5" />
        {unread > 0 && (
          // Ink on the coral, not white. White on it is 2.9:1 and on the teal
          // this used to be it was 2.5:1 — a count nobody can read is worse
          // than no count, and this is the smallest text in the interface.
          <span className="absolute -top-1 -right-0.5 grid min-w-4 place-items-center rounded-full bg-[#E07A5F] px-1 text-[10px] font-bold text-[#14212B]">
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
            <span className="grid size-7 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent-text">
              {initial}
            </span>
          )}
          <span className="hidden max-w-32 truncate text-xs text-muted md:block">
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