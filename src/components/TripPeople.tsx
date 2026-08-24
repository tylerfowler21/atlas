"use client";

import { useEffect, useState } from "react";
import type { TripRole } from "@/lib/trip-access";

type Collaborator = {
  email: string;
  role: string;
  accepted: boolean;
  name: string | null;
  image: string | null;
};

export default function TripPeople({
  tripId,
  role,
  ownerLabel,
}: {
  tripId: string;
  role: TripRole;
  ownerLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Collaborator[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || people) return;
    let cancelled = false;

    fetch(`/api/trips/${tripId}/collaborators`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setPeople(body.collaborators ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load who's on this trip");
      });

    return () => {
      cancelled = true;
    };
  }, [open, people, tripId]);

  async function invite() {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/trips/${tripId}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? "Could not invite that person");
      return;
    }
    setPeople((prev) => [
      ...(prev ?? []).filter((p) => p.email !== body.collaborator.email),
      body.collaborator,
    ]);
    setEmail("");
  }

  async function remove(target: string) {
    setBusy(true);
    const res = await fetch(
      `/api/trips/${tripId}/collaborators?email=${encodeURIComponent(target)}`,
      { method: "DELETE" },
    );
    setBusy(false);

    if (!res.ok) {
      setError("Could not remove that person");
      return;
    }
    setPeople((prev) => (prev ?? []).filter((p) => p.email !== target));
  }

  if (!open) {
    return (
      <button
        type="button"
        className="self-start text-xs text-muted hover:underline"
        onClick={() => setOpen(true)}
      >
        {role === "owner" ? "Who's on this trip" : "Shared with you"}
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Who&apos;s on this trip</h2>
          <p className="mt-0.5 text-xs text-muted">
            {role === "owner"
              ? "Anyone here can add, reorder and remove stops. Only you can rename the trip, share it or delete it."
              : `${ownerLabel} shared this with you. You can change the itinerary; the trip itself is theirs.`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="rounded-md px-2 py-1 text-muted hover:bg-foreground/5"
        >
          ✕
        </button>
      </div>

      <ul className="space-y-1.5">
        <li className="flex items-center gap-2 text-sm">
          <span className="grid size-6 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
            {ownerLabel.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate">{ownerLabel}</span>
          <span className="text-xs text-muted">owner</span>
        </li>

        {(people ?? []).map((person) => (
          <li key={person.email} className="flex items-center gap-2 text-sm">
            <span className="grid size-6 place-items-center rounded-full bg-foreground/10 text-xs font-semibold">
              {(person.name ?? person.email).charAt(0).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate">
              {person.name ?? person.email}
            </span>
            {!person.accepted && (
              <span className="text-xs text-muted">invited</span>
            )}
            {role === "owner" && (
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-xs text-muted hover:bg-foreground/5"
                disabled={busy}
                onClick={() => remove(person.email)}
              >
                Remove
              </button>
            )}
          </li>
        ))}

        {people?.length === 0 && (
          <li className="text-xs text-muted">Nobody else yet.</li>
        )}
      </ul>

      {role === "owner" && (
        <>
          <div className="flex gap-2">
            <input
              className="input"
              type="email"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary shrink-0"
              disabled={busy || email.trim().length === 0}
              onClick={invite}
            >
              Invite
            </button>
          </div>
          <p className="text-xs text-muted">
            They don&apos;t need an account yet — the invitation waits for them and
            works the moment they sign in with that address. Atlas doesn&apos;t send
            the email, so tell them yourself.
          </p>
        </>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
