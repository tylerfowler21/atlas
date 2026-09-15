"use client";

import { useEffect, useState } from "react";
import type { TripRole } from "@/lib/trip-access";

export type Collaborator = {
  email: string;
  role: string;
  accepted: boolean;
  name: string | null;
  image: string | null;
  username: string | null;
};

type FollowedPerson = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
};

/// A small stack of who is on a trip. Initials rather than a text link,
/// because "who else can edit this" is a thing you should be able to see
/// rather than a thing you have to go looking for.
function Avatar({ person, title }: { person: Collaborator; title: string }) {
  const initial = (person.name ?? person.email).charAt(0).toUpperCase();
  return person.image ? (
    // Avatars come from the identity provider on arbitrary hosts.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={person.image}
      alt=""
      title={title}
      width={24}
      height={24}
      className="size-6 rounded-full object-cover ring-2 ring-surface"
    />
  ) : (
    <span
      title={title}
      className={`grid size-6 place-items-center rounded-full text-[10px] font-semibold ring-2 ring-surface ${
        person.accepted ? "bg-accent/15 text-accent-text" : "bg-foreground/10 text-muted"
      }`}
    >
      {initial}
    </span>
  );
}

function personLabel(person: { name: string | null; username: string | null; email?: string }) {
  return person.name ?? (person.username ? `@${person.username}` : (person.email ?? "them"));
}

function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/// What to send to the following search. Empty, or an email, is not a name.
function searchNeedle(value: string) {
  const trimmed = value.trim();
  if (!trimmed || looksLikeEmail(trimmed)) return "";
  return trimmed.replace(/^@+/, "").trim();
}

function matchesNeedle(person: FollowedPerson, needle: string) {
  const n = needle.toLowerCase();
  return (
    (person.username ?? "").toLowerCase().includes(n) ||
    (person.name ?? "").toLowerCase().includes(n)
  );
}

export default function TripPeople({
  tripId,
  role,
  ownerLabel,
  ownerImage,
  initialPeople,
}: {
  tripId: string;
  role: TripRole;
  ownerLabel: string;
  ownerImage: string | null;
  initialPeople: Collaborator[];
}) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Collaborator[] | null>(initialPeople);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /// Said out loud when an invitation is recorded but the email did not go.
  /// The person still has access — silence here would let the owner assume
  /// something landed in an inbox when nothing did.
  const [notice, setNotice] = useState<string | null>(null);
  const [fetched, setFetched] = useState<{ needle: string; people: FollowedPerson[] } | null>(
    null,
  );
  const needle = searchNeedle(query);

  useEffect(() => {
    if (!open || people !== null) return;
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

  useEffect(() => {
    if (!open || role !== "owner" || !needle) return;

    let cancelled = false;
    const requested = needle;
    const timer = window.setTimeout(() => {
      fetch(`/api/people?following=1&q=${encodeURIComponent(requested)}`)
        .then((res) => res.json())
        .then((body) => {
          if (!cancelled) setFetched({ needle: requested, people: body.people ?? [] });
        })
        .catch(() => {
          if (!cancelled) setFetched({ needle: requested, people: [] });
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, role, needle]);

  async function invite(payload: { email: string } | { username: string }) {
    setBusy(true);
    setError(null);
    setNotice(null);

    const res = await fetch(`/api/trips/${tripId}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    const byHandle = "username" in payload;
    const who = byHandle
      ? personLabel(body.collaborator)
      : body.collaborator.email;
    setNotice(
      body.emailed
        ? `Invitation sent to ${who}.`
        : `${who} has access, but the email didn't send — tell them yourself and send them this trip's link.`,
    );
    setQuery("");
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
    const shown = (people ?? []).slice(0, 4);
    const extra = (people ?? []).length - shown.length;

    return (
      <button
        type="button"
        className="-m-1 flex items-center gap-2 self-start rounded-md p-1 hover:bg-foreground/5"
        onClick={() => setOpen(true)}
        title={
          role === "owner"
            ? "Who can edit this trip"
            : `${ownerLabel} shared this trip with you`
        }
      >
        <span className="flex -space-x-1.5">
          <Avatar
            person={{
              email: ownerLabel,
              role: "owner",
              accepted: true,
              name: ownerLabel,
              image: ownerImage,
              username: null,
            }}
            title={`${ownerLabel} — owner`}
          />
          {shown.map((p) => (
            <Avatar
              key={p.email}
              person={p}
              title={`${p.name ?? p.email}${p.accepted ? "" : " — invited"}`}
            />
          ))}
          {extra > 0 && (
            <span className="grid size-6 place-items-center rounded-full bg-foreground/10 text-[10px] font-semibold text-muted ring-2 ring-surface">
              +{extra}
            </span>
          )}
        </span>

        <span className="text-xs text-accent-text">
          {role !== "owner"
            ? "Shared with you"
            : (people ?? []).length === 0
              ? "+ Invite someone"
              : "Manage"}
        </span>
      </button>
    );
  }

  const taken = new Set(
    (people ?? []).map((p) => p.username).filter((u): u is string => Boolean(u)),
  );
  const matches = needle
    ? (fetched?.people ?? []).filter(
        (p) => p.username && !taken.has(p.username) && matchesNeedle(p, needle),
      )
    : [];
  const searching = Boolean(needle) && fetched?.needle !== needle;
  const canEmail = looksLikeEmail(query);

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
          <span className="grid size-6 place-items-center rounded-full bg-accent/15 text-xs font-semibold text-accent-text">
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
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="Name, @username or email"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canEmail) {
                  e.preventDefault();
                  void invite({ email: query.trim() });
                }
              }}
            />
            <button
              type="button"
              className="btn btn-primary shrink-0"
              disabled={busy || !canEmail}
              onClick={() => invite({ email: query.trim() })}
            >
              Invite
            </button>
          </div>
          {needle ? (
            searching && matches.length === 0 ? (
              <p className="text-xs text-muted">Looking among people you follow…</p>
            ) : matches.length > 0 ? (
              <ul className="space-y-1">
                {matches.map((person) => {
                  const handle = person.username!;
                  const initial = (person.name ?? handle).charAt(0).toUpperCase();
                  return (
                    <li key={person.id} className="flex items-center gap-2 text-sm">
                      {person.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={person.image}
                          alt=""
                          width={24}
                          height={24}
                          className="size-6 rounded-full object-cover"
                        />
                      ) : (
                        <span className="grid size-6 place-items-center rounded-full bg-foreground/10 text-xs font-semibold">
                          {initial}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {person.name ?? `@${handle}`}
                        {person.name && (
                          <span className="text-xs text-muted"> @{handle}</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="rounded px-1.5 py-0.5 text-xs text-accent-text hover:bg-foreground/5"
                        disabled={busy}
                        onClick={() => invite({ username: handle })}
                      >
                        Invite
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-muted">Nobody you follow matches that.</p>
            )
          ) : null}
          {/* What actually happens, which is not what this said. Roava has
              emailed invitations since the collaborator work landed — the line
              below it says "Invitation sent to …" — and this paragraph was
              still telling people to go and pass it on themselves. */}
          <p className="text-xs text-muted">
            Type a name to pick someone you follow, or an email for anyone else
            — they don&apos;t need an account yet.
          </p>
        </>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
      {notice && <p className="text-xs text-muted">{notice}</p>}
    </div>
  );
}
