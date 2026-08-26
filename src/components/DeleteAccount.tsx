"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

/// Deleting an account is irreversible, so it asks you to type your username
/// rather than clicking twice. The friction is the point.
export default function DeleteAccount({
  username,
  email,
  counts,
}: {
  username: string | null;
  email: string | null;
  counts: { places: number; trips: number; memories: number };
}) {
  const confirmWord = username ?? email ?? "delete";
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/me", { method: "DELETE" });
    if (!res.ok) {
      setBusy(false);
      setError("Could not delete your account. Try again, or get in touch.");
      return;
    }
    // The account row is already gone; this clears the session cookie that
    // still points at it.
    await signOut({ callbackUrl: "/signin" });
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-xs text-red-500 hover:underline"
        onClick={() => setOpen(true)}
      >
        Delete your account
      </button>
    );
  }

  return (
    <div className="card space-y-3 border-red-500/40 p-4">
      <h2 className="text-sm font-semibold text-red-500">Delete your account</h2>
      <p className="text-xs text-muted">
        This removes your {counts.places} saved{" "}
        {counts.places === 1 ? "place" : "places"}, {counts.trips}{" "}
        {counts.trips === 1 ? "trip" : "trips"} and {counts.memories} journal{" "}
        {counts.memories === 1 ? "entry" : "entries"}, along with every photo
        you&apos;ve uploaded. It cannot be undone and there is no backup.
      </p>
      <p className="text-xs text-muted">
        Trips you shared with other people stop working. Copies other people
        made of your trips are theirs and stay with them.
      </p>

      <label className="block text-xs text-muted">
        Type <span className="font-medium text-foreground">{confirmWord}</span> to
        confirm
        <input
          className="input mt-1"
          value={typed}
          autoFocus
          onChange={(e) => setTyped(e.target.value)}
        />
      </label>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary bg-red-600"
          disabled={busy || typed.trim() !== confirmWord}
          onClick={remove}
        >
          {busy ? "Deleting…" : "Delete everything"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => setOpen(false)}
        >
          Keep my account
        </button>
      </div>
    </div>
  );
}
