"use client";

import { useState } from "react";

export default function ProfileSettings({
  initialUsername,
  initialBio,
  initialHomeCity,
  initialWantsToGo,
  initialTravelStyle,
}: {
  initialUsername: string | null;
  initialBio: string | null;
  initialHomeCity: string | null;
  initialWantsToGo: string | null;
  initialTravelStyle: string | null;
}) {
  const [username, setUsername] = useState(initialUsername ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [homeCity, setHomeCity] = useState(initialHomeCity ?? "");
  const [wantsToGo, setWantsToGo] = useState(initialWantsToGo ?? "");
  const [travelStyle, setTravelStyle] = useState(initialTravelStyle ?? "");
  const [saved, setSaved] = useState<string | null>(initialUsername);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim() || null,
        bio: bio.trim() || null,
        homeCity: homeCity.trim() || null,
        wantsToGo: wantsToGo.trim() || null,
        travelStyle: travelStyle.trim() || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? "Could not save that");
      return;
    }
    setSaved(body.profile.username);
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs text-muted">
        Username
        <div className="mt-1 flex items-center gap-1">
          <span className="text-sm text-muted">roava.app/u/</span>
          <input
            className="input"
            placeholder="tyler"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <span className="mt-1 block text-xs text-muted">
          Lowercase letters, numbers and underscores. This is how people find and
          follow you — until you pick one you have no public profile at all.
        </span>
      </label>

      <label className="block text-xs text-muted">
        Bio
        <textarea
          className="input mt-1 min-h-16 resize-y"
          placeholder="Slow travel, good bread, long train rides."
          maxLength={280}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </label>

      <label className="block text-xs text-muted">
        Where you&apos;re based
        <input
          className="input mt-1"
          placeholder="Lisbon"
          maxLength={80}
          value={homeCity}
          onChange={(e) => setHomeCity(e.target.value)}
        />
        <span className="mt-1 block text-xs text-muted">
          In your own words, and as rough as you like — it sits under your name
          on your profile. It is not a pin and goes on nobody&apos;s map.
        </span>
      </label>

      {/* The two questions somebody actually wants answered about a stranger
          before following them, and the two no count of countries answers.
          Prose rather than a list of pins: a wishlist is built out of saved
          places, and those stay private. */}
      <label className="block text-xs text-muted">
        Where you want to go next
        <textarea
          className="input mt-1 min-h-14 resize-y"
          placeholder="Patagonia, if the flights ever behave. Seoul again."
          maxLength={200}
          value={wantsToGo}
          onChange={(e) => setWantsToGo(e.target.value)}
        />
      </label>

      <label className="block text-xs text-muted">
        How you travel
        <textarea
          className="input mt-1 min-h-14 resize-y"
          placeholder="Slowly, one city at a time. Trains over planes wherever there's a train."
          maxLength={200}
          value={travelStyle}
          onChange={(e) => setTravelStyle(e.target.value)}
        />
      </label>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save profile"}
        </button>
        {saved && (
          <a href={`/u/${saved}`} className="text-xs text-accent-text hover:underline">
            View your profile →
          </a>
        )}
      </div>
    </div>
  );
}
