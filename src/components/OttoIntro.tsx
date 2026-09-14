"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Otto from "@/components/Otto";

/// Otto, standing on the map, ready to be asked what he is.
///
/// He does his actual work inside a trip, on a day with nothing on it — which
/// is the right place for it and the wrong place to meet somebody for the
/// first time. Nobody opens an empty day on purpose. So he stands here, where
/// the app opens, and explains himself when asked: hover on a pointer, tap on
/// a phone, and the same card either way.
///
/// Deliberately not a tooltip that fires on its own. A character who
/// interrupts is a character people learn to dismiss.

export default function OttoIntro() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Escape closes it, and so does anywhere else — the same two ways every
  // other thing that floats over this map closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div
      ref={box}
      className="absolute bottom-4 left-4 z-20 flex items-end gap-2 max-lg:hidden"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-label="What Otto does"
        className="rounded-xl transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        onClick={() => setOpen((was) => !was)}
      >
        <Otto pose="idle" />
      </button>

      {open && (
        <div className="card w-72 p-3.5 shadow-lg">
          <p className="text-sm font-semibold">Otto</p>
          <p className="mt-1 text-sm text-muted">
            I fill in the gaps. Open a trip, find a day with nothing on it, and
            ask me — I read the days either side, look for real places near
            where you already are, and show you what I found.
          </p>
          <p className="mt-2 text-sm text-muted">
            I can&apos;t invent anywhere: every place I suggest has to come back
            off the map first. And nothing goes on your trip until you tick it.
          </p>
          <Link
            href="/trips"
            className="mt-2.5 inline-block text-xs text-accent-text hover:underline"
          >
            Open a trip →
          </Link>
        </div>
      )}
    </div>
  );
}
