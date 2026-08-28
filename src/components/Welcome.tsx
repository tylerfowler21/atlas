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
  YourProfileIcon,
} from "@/components/nav-icons";

/// Each card carries the icon of the tab where that thing actually happens, so
/// the tour is teaching the navigation at the same time as the features. Emoji
/// were standing in for an icon set that already exists.
const TOUR = [
  {
    Icon: MapIcon,
    title: "Save places you care about",
    body: "Search anywhere in the world, or drop a pin on somewhere the map has never heard of. Give it a category, a note, an emoji — 🥐 on that bakery.",
  },
  {
    Icon: TripsIcon,
    title: "Build a trip, day by day",
    body: "Set the dates and the days appear. Click through them adding what you did, including the trains and ferries between cities.",
  },
  {
    Icon: BeenIcon,
    title: "Keep a map of everywhere you've been",
    body: "Anything marked “Been there” lands on your map, counted by place, city and country.",
  },
  {
    Icon: PeopleIcon,
    title: "Share it, or keep it to yourself",
    body: "Everything is private by default. Publish a trip to your profile, or send one secret read-only link — and copy anyone else's trip into your own account.",
  },
];

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

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-10">
      {step === 0 && (
        <div className="space-y-5">
          <div>
            <Image src="/brand/mark.png" alt="" width={64} height={64} />
            <h1 className="mt-3 text-2xl font-semibold">
              {name ? `Welcome, ${name.split(" ")[0]}` : "Welcome to Roava"}
            </h1>
            <p className="mt-2 text-sm text-muted">
              A map of the places you want to go and the ones you&apos;ve been.
              Two minutes and it&apos;ll feel like yours.
            </p>
          </div>

          <ul className="space-y-3">
            {TOUR.map((t) => (
              <li key={t.title} className="card flex gap-3 p-3">
                <t.Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" />
                <div>
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="mt-0.5 text-xs text-muted">{t.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="btn btn-primary w-full justify-center"
            onClick={() => setStep(1)}
          >
            Get started
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <YourProfileIcon className="h-9 w-9 text-accent-text" />
            <h1 className="mt-3 text-2xl font-semibold">Pick a username</h1>
            <p className="mt-2 text-sm text-muted">
              It&apos;s how friends find and follow you, and it gives you a profile
              page. Without one you don&apos;t appear anywhere — which is fine if
              that&apos;s what you want.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted">/u/</span>
              <input
                className="input"
                value={username}
                autoFocus
                placeholder="yourname"
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Lowercase letters, numbers and underscores. You can change it later.
            </p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="space-y-2">
            <button
              type="button"
              className="btn btn-primary w-full justify-center"
              disabled={busy || username.trim().length < 3}
              onClick={async () => {
                if (await save({ username: username.trim().toLowerCase() })) setStep(2);
              }}
            >
              {busy ? "Saving…" : "That's my name"}
            </button>
            <button
              type="button"
              className="w-full text-xs text-muted hover:underline"
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
        <div className="space-y-5">
          <div>
            <TripsIcon className="h-9 w-9 text-accent-text" />
            <h1 className="mt-3 text-2xl font-semibold">What next?</h1>
            <p className="mt-2 text-sm text-muted">
              The quickest way to a map that feels like yours is a trip
              you&apos;ve already taken — everywhere you went gets found and
              pinned for you. There&apos;s a short list of first steps waiting on
              your map either way.
            </p>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="space-y-2">
            <button
              type="button"
              className="btn btn-primary w-full justify-center"
              disabled={busy}
              onClick={() => finish("/trips/import")}
            >
              Add a trip I&apos;ve taken
            </button>
            <button
              type="button"
              className="btn btn-ghost w-full justify-center"
              disabled={busy}
              onClick={() => finish("/")}
            >
              Just show me the map
            </button>
            <button
              type="button"
              className="w-full text-xs text-muted hover:underline"
              disabled={busy}
              onClick={() => finish("/discover?view=people")}
            >
              See who else is here
            </button>
          </div>
        </div>
      )}

      {step > 0 && (
        <p className="mt-6 text-center text-xs text-muted">Step {step + 1} of 4</p>
      )}
    </div>
  );
}
