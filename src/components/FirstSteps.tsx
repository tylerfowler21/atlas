"use client";

import { useState } from "react";
import Link from "next/link";
import type { FirstSteps as Steps } from "@/lib/first-steps";

/// The short list that carries on after the welcome.
///
/// The welcome gets somebody as far as one pin. This is what stops the app
/// going quiet afterwards: five things worth doing once, in the order they make
/// sense, each linking to where it happens.
///
/// It never nags. It is collapsed to a single line by default once the first
/// step is done, it disappears on its own when the list is finished, and
/// dismissing it is permanent.

export default function FirstSteps({ initial }: { initial: Steps }) {
  const [steps, setSteps] = useState(initial);
  // Open on arrival for somebody who has just finished the welcome, folded away
  // once they are clearly under way.
  const [open, setOpen] = useState(initial.done <= 1);

  if (steps.hidden) return null;

  async function dismiss() {
    setSteps((current) => ({ ...current, hidden: true }));
    await fetch("/api/first-steps", { method: "DELETE" }).catch(() => {
      // Staying dismissed for this visit is the part that matters; the next
      // page load will show it again if the write did not land.
    });
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden className="text-sm">
            {open ? "▾" : "▸"}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            First steps
          </span>
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {steps.done} of {steps.total}
          </span>
        </button>
        <button
          type="button"
          className="shrink-0 text-xs text-muted hover:underline"
          onClick={() => void dismiss()}
        >
          Hide
        </button>
      </div>

      {open && (
        <ul className="divide-y divide-line border-t border-line">
          {steps.steps.map((step) => (
            <li key={step.id}>
              <Link
                href={step.href}
                className={`flex items-start gap-2.5 px-3 py-2 hover:bg-foreground/5 ${
                  step.done ? "opacity-55" : ""
                }`}
              >
                <span aria-hidden className="mt-0.5 text-sm">
                  {step.done ? "✅" : "⬜️"}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm ${step.done ? "line-through" : ""}`}
                  >
                    {step.label}
                  </span>
                  {!step.done && (
                    <span className="mt-0.5 block text-xs text-muted">
                      {step.hint}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
