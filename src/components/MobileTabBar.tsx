"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LINKS, PRIMARY, isActive } from "@/components/NavBar";
import {
  SignOutIcon,
  WhosUsingRoavaIcon,
  YourProfileIcon,
} from "@/components/nav-icons";

/// The phone navigation. Rendered after <main> so it sits at the bottom of the
/// flex column — a sibling rather than a fixed overlay, so it can never cover
/// the content and nothing needs padding to compensate.
export default function MobileTabBar({
  admin = false,
  signOutAction,
}: {
  admin?: boolean;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = LINKS.filter((l) => PRIMARY.includes(l.href));
  const overflow = LINKS.filter((l) => !PRIMARY.includes(l.href));

  return (
    <>
    {/* Bottom bar, phones only.
    
        A pill floating over the content rather than a strip ruled off beneath
        it — the kit draws it that way, and on the map it is what gives the
        glass something to sit on. The cost is that it covers what is under
        it, so <main> leaves room for it; that room is `pb-tabbar` in the app
        layout, and this is the only thing that needs it. */}
    <nav className="glass-opaque fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+0.625rem)] z-30 flex rounded-full sm:hidden">
      {primary.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`m-1.5 flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] ${
              active
                ? "bg-brand-surface font-medium text-accent-text"
                : "text-muted"
            }`}
          >
            <link.Icon className="h-6 w-6" />
            {link.label}
          </Link>
        );
      })}

      <button
        type="button"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((v) => !v)}
        className={`m-1.5 flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10px] ${
          moreOpen || overflow.some((l) => isActive(pathname, l.href))
            ? "bg-brand-surface font-medium text-accent-text"
            : "text-muted"
        }`}
      >
        <span aria-hidden className="text-lg leading-none">
          ⋯
        </span>
        More
      </button>
    </nav>

    {moreOpen && (
      <>
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-20 bg-black/20 sm:hidden"
          onClick={() => setMoreOpen(false)}
        />
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[calc(env(safe-area-inset-bottom)+4.5rem)] sm:hidden">
          <ul className="divide-y divide-line">
            {overflow.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                  onClick={() => setMoreOpen(false)}
                >
                  <link.Icon className="h-5 w-5 shrink-0" />
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/settings"
                className="flex items-center gap-3 px-4 py-3 text-sm"
                onClick={() => setMoreOpen(false)}
              >
                <YourProfileIcon className="h-5 w-5 shrink-0" />
                Your profile
              </Link>
            </li>
            {admin && (
              <li>
                <Link
                  href="/admin"
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                  onClick={() => setMoreOpen(false)}
                >
                  <WhosUsingRoavaIcon className="h-5 w-5 shrink-0" />
                  Who&apos;s using Roava
                </Link>
              </li>
            )}
            <li>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm"
                >
                  <SignOutIcon className="h-5 w-5 shrink-0" />
                  Sign out
                </button>
              </form>
            </li>
          </ul>
        </div>
      </>
    )}
    </>
  );
}
