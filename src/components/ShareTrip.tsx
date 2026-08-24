"use client";

import { useEffect, useState } from "react";

type Share = {
  token: string;
  path: string;
  createdAt: string;
  viewCount: number;
  lastViewedAt: string | null;
};

export default function ShareTrip({ tripId }: { tripId: string }) {
  const [open, setOpen] = useState(false);
  const [share, setShare] = useState<Share | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingStop, setConfirmingStop] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The existing link is only fetched once the panel is actually opened —
  // most visits to a trip are not about sharing it.
  useEffect(() => {
    if (!open || loaded) return;
    let cancelled = false;

    fetch(`/api/trips/${tripId}/share`)
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        setShare(body.share ?? null);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setError("Could not check the share link");
      });

    return () => {
      cancelled = true;
    };
  }, [open, loaded, tripId]);

  // The origin is only known in the browser, so the full URL is assembled here
  // rather than guessed on the server.
  const url = share ? `${window.location.origin}${share.path}` : "";

  async function post(rotate: boolean) {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/trips/${tripId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotate }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? "Could not create a link");
      return;
    }
    setShare(body.share);
    setCopied(false);
  }

  async function stopSharing() {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/trips/${tripId}/share`, { method: "DELETE" });
    setBusy(false);

    if (!res.ok) {
      setError("Could not stop sharing");
      return;
    }
    setShare(null);
    setConfirmingStop(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the field is selectable either way.
      setError("Copy the link from the box above");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="self-start text-xs text-muted hover:underline"
        onClick={() => setOpen(true)}
      >
        Share trip
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Share this trip</h2>
          <p className="mt-0.5 text-xs text-muted">
            Anyone with the link can read the itinerary. They can&apos;t change it,
            and they don&apos;t see your saved places or ratings.
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

      {!loaded ? (
        <p className="text-xs text-muted">Checking…</p>
      ) : share ? (
        <>
          <div className="flex gap-2">
            <input
              className="input font-mono text-xs"
              readOnly
              value={url}
              aria-label="Share link"
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              className="btn btn-primary shrink-0"
              disabled={busy}
              onClick={copy}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <p className="text-xs text-muted">
            {share.viewCount === 0
              ? "Not opened yet."
              : `Opened ${share.viewCount} ${share.viewCount === 1 ? "time" : "times"}.`}
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => post(true)}
            >
              Replace link
            </button>
            <button
              type="button"
              className="btn btn-ghost ml-auto text-red-500"
              disabled={busy}
              onClick={() => (confirmingStop ? stopSharing() : setConfirmingStop(true))}
            >
              {confirmingStop ? "Really stop?" : "Stop sharing"}
            </button>
          </div>

          <p className="text-xs text-muted">
            Replacing the link breaks the old one — that&apos;s how you un-share
            something you&apos;ve already sent.
          </p>
        </>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => post(false)}
        >
          {busy ? "Creating…" : "Create a share link"}
        </button>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
