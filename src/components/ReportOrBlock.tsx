"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { REPORT_REASONS } from "@/lib/report-reasons";

/// Reporting and blocking, kept together because they are the same decision at
/// different strengths: "someone should look at this" and "I never want to see
/// this person again".
export default function ReportOrBlock({
  username,
  tripId,
  signedIn,
  initiallyBlocked = false,
}: {
  username?: string | null;
  tripId?: string | null;
  signedIn: boolean;
  initiallyBlocked?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0].id);
  const [note, setNote] = useState("");
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function report() {
    setBusy(true);
    setError(null);

    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, note: note.trim() || null, username, tripId }),
    });
    setBusy(false);

    if (!res.ok) {
      setError("Could not send that report");
      return;
    }
    setSent(true);
  }

  async function toggleBlock() {
    if (!username) return;
    setBusy(true);
    setError(null);

    const res = blocked
      ? await fetch(`/api/block?username=${encodeURIComponent(username)}`, { method: "DELETE" })
      : await fetch("/api/block", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username }),
        });
    setBusy(false);

    if (!res.ok) {
      setError("Could not do that");
      return;
    }
    setBlocked(!blocked);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        className="text-xs text-muted hover:underline"
        onClick={() => setOpen(true)}
      >
        Report{username ? " or block" : ""}
      </button>
    );
  }

  return (
    <div className="card mt-3 space-y-3 p-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Report {username ? `@${username}` : "this trip"}
        </h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="rounded-md px-2 py-1 text-muted hover:bg-foreground/5"
        >
          ✕
        </button>
      </div>

      {sent ? (
        <p className="text-xs text-muted">
          Thanks — this has been sent for review. You won&apos;t hear back
          automatically, and the person reported isn&apos;t told.
        </p>
      ) : (
        <>
          <label className="block text-xs text-muted">
            What&apos;s wrong?
            <select
              className="input mt-1"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {REPORT_REASONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <textarea
            className="input min-h-16 resize-y text-xs"
            placeholder="Anything else worth knowing (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          <button type="button" className="btn btn-ghost" disabled={busy} onClick={report}>
            {busy ? "Sending…" : "Send report"}
          </button>
        </>
      )}

      {username && signedIn && (
        <div className="border-t border-line pt-3">
          <button
            type="button"
            className="text-xs text-red-500 hover:underline"
            disabled={busy}
            onClick={toggleBlock}
          >
            {blocked ? `Unblock @${username}` : `Block @${username}`}
          </button>
          <p className="mt-1 text-xs text-muted">
            {blocked
              ? "You can see each other again."
              : "Neither of you will see the other's profile or published trips, and any follows between you are removed."}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
