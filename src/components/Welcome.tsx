"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import WelcomeFirstPlace from "@/components/WelcomeFirstPlace";
import { useState } from "react";
import {
  BeenIcon,
  MapIcon,
  PeopleIcon,
  TripsIcon,
} from "@/components/nav-icons";

/// Each card carries the icon of the tab where that thing actually happens, so
/// the tour is teaching the navigation at the same time as the features. Emoji
/// were standing in for an icon set that already exists.
const TOUR = [
  {
    Icon: MapIcon,
    title: "Save places you care about",
    body: "Search the world or drop a pin, then add a category, a note and a rating.",
  },
  {
    Icon: TripsIcon,
    title: "Build a trip, day by day",
    body: "Set the dates and build each day, trains and ferries included.",
  },
  {
    Icon: BeenIcon,
    title: "Keep a map of everywhere you've been",
    body: "Every place, city and country you mark as been, counted for you.",
  },
  {
    Icon: PeopleIcon,
    title: "Share it, or keep it to yourself",
    body: "Private by default. Publish a trip, or send one secret read-only link.",
  },
];

/// One card, one row per thing the app does, with the icon of the tab where
/// it happens.
function Perks({ items }: { items: typeof TOUR }) {
  return (
    <ul className="card divide-y divide-line px-4">
      {items.map((t) => (
        <li key={t.title} className="flex gap-3 py-3.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-tint text-accent-text">
            <t.Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">{t.title}</p>
            <p className="mt-0.5 text-sm text-muted">{t.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Welcome({
  initialUsername,
  suggestion,
  name,
}: {
  initialUsername: string | null;
  suggestion: string;
  name: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(initialUsername ?? suggestion);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "That didn't save");
      return false;
    }
    return true;
  }

  /// Marks the welcome as seen so it never reappears, then hands over.
  async function finish(destination: string) {
    if (await save({ onboarded: true })) {
      router.push(destination);
      router.refresh();
    }
  }

  const handle = username.trim().toLowerCase();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 py-10">
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <Image src="/brand/mark.png" alt="" width={64} height={64} className="rounded-2xl" />
            <h1 className="mt-5 text-3xl leading-tight">
              {name ? `Welcome, ${name.split(" ")[0]}` : "Welcome to Roava"}
            </h1>
            <p className="mt-2 text-base text-muted">
              A map of the places you want to go and the ones you&apos;ve been.
              Two minutes and it&apos;ll feel like yours.
            </p>
          </div>

          <Perks items={TOUR} />

          <button
            type="button"
            className="btn btn-primary w-full justify-center py-3 text-base"
            onClick={() => setStep(1)}
          >
            Get started
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <Image src="/brand/mark.png" alt="" width={56} height={56} className="rounded-2xl" />
            <h1 className="mt-5 text-3xl leading-tight">Pick a name friends can find you by</h1>
            <p className="mt-2 text-base text-muted">
              It&apos;s how people follow you and open the trips you publish.
              Without one you don&apos;t appear anywhere — which is fine if
              that&apos;s what you want.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium" htmlFor="username">
              Username
            </label>
            <div className="mt-1.5 flex items-center gap-1 rounded-full border-2 border-line bg-surface px-4 py-2.5 text-base focus-within:border-brand-active">
              <span aria-hidden className="text-muted">@</span>
              <input
                id="username"
                className="min-w-0 flex-1 bg-transparent outline-none"
                value={username}
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="yourname"
                onChange={(e) => setUsername(e.target.value)}
              />
              {handle.length >= 3 && (
                <span aria-hidden className="grid size-5 place-items-center rounded-full bg-brand-active text-[10px] text-white">
                  ✓
                </span>
              )}
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {handle.length >= 3 ? (
                <>
                  Yours will be <span className="font-medium text-foreground">roava.co/u/{handle}</span>
                </>
              ) : (
                "Lowercase letters, numbers and underscores. You can change it later."
              )}
            </p>
          </div>

          <Perks items={TOUR.slice(0, 3)} />

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="space-y-2">
            <button
              type="button"
              className="btn btn-primary w-full justify-center py-3 text-base"
              disabled={busy || handle.length < 3}
              onClick={async () => {
                if (await save({ username: handle })) setStep(2);
              }}
            >
              {busy ? "Saving…" : "Continue"}
            </button>
            <button
              type="button"
              className="w-full py-1 text-sm text-muted hover:underline"
              disabled={busy}
              onClick={() => setStep(2)}
            >
              Skip for now
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <WelcomeFirstPlace
          onSaved={() => setStep(3)}
          onSkip={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div>
            <TripsIcon className="h-10 w-10 text-accent-text" />
            <h1 className="mt-5 text-3xl leading-tight">What next?</h1>
            <p className="mt-2 text-base text-muted">
              The quickest way to a map that feels like yours is a trip
              you&apos;ve already taken — everywhere you went gets found and
              pinned for you. There&apos;s a short list of first steps waiting on
              your map either way.
            </p>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <div className="space-y-2">
            <button
              type="button"
              className="btn btn-primary w-full justify-center py-3 text-base"
              disabled={busy}
              onClick={() => finish("/trips/import")}
            >
              Add a trip I&apos;ve taken
            </button>
            <button
              type="button"
              className="btn btn-ghost w-full justify-center py-3 text-base"
              disabled={busy}
              onClick={() => finish("/")}
            >
              Just show me the map
            </button>
            <button
              type="button"
              className="w-full py-1 text-sm text-muted hover:underline"
              disabled={busy}
              onClick={() => finish("/discover?view=people")}
            >
              See who else is here
            </button>
          </div>
        </div>
      )}

      {step > 0 && (
        <p className="mt-8 text-center text-xs text-muted">Step {step + 1} of 4</p>
      )}
    </div>
  );
}
