"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LINKS, PRIMARY, isActive } from "@/components/NavBar";

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
    {/* Bottom bar, phones only. A sibling in the page's flex column rather
        than fixed positioning, so it can never overlap the content above it
        and nothing needs padding to compensate. */}
    <nav className="flex shrink-0 border-t border-line pb-[env(safe-area-inset-bottom)] sm:hidden">
      {primary.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
              active ? "font-medium text-accent" : "text-muted"
            }`}
          >
            <span aria-hidden className="text-lg leading-none">
              {link.icon}
            </span>
            {link.label}
          </Link>
        );
      })}

      <button
        type="button"
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((v) => !v)}
        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
          moreOpen || overflow.some((l) => isActive(pathname, l.href))
            ? "font-medium text-accent"
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
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden">
          <ul className="divide-y divide-line">
            {overflow.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                  onClick={() => setMoreOpen(false)}
                >
                  <span aria-hidden>{link.icon}</span>
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
                <span aria-hidden>⚙️</span>
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
                  <span aria-hidden>📊</span>
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
                  <span aria-hidden>↩️</span>
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
