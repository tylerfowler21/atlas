"use client";

import { useState } from "react";

/// Pulling a list of places out of a shared video.
///
/// Somebody sends you a reel of six restaurants and you want the six
/// restaurants. TikTok will part with the caption; Instagram will not, without
/// an account and a Facebook app — so that case asks for a paste rather than
/// pretending to fail.
///
/// What comes back lands in the same box as anything else pasted, and goes
/// through the same lookup and confirmation. A caption is a rough thing and a
/// model reading it is a rough process; neither gets to put a pin on a map on
/// its own.
export default function ImportLink({
  onRead,
  busy,
}: {
  onRead: (result: { text: string; region: string | null }) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [needsCaption, setNeedsCaption] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function read() {
    setReading(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/import/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim() || undefined,
          caption: caption.trim() || undefined,
        }),
      });
      const body = await res.json();

      if (body.needsCaption) {
        setNeedsCaption(true);
        setNote(body.error);
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "Could not read that");

      if (body.count === 0) {
        setNote("No places in that one — it may be a video with nothing named in the caption.");
        return;
      }

      onRead({ text: body.text, region: body.region ?? null });
      setNote(`Found ${body.count} ${body.count === 1 ? "place" : "places"}. Check them below.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that");
    } finally {
      setReading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost text-xs"
        onClick={() => setOpen(true)}
      >
        From a TikTok link
      </button>
    );
  }

  return (
    <div className="card w-full space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted">
          Paste a TikTok link and the places in its caption land in the box below.
        </p>
        <button
          type="button"
          className="rounded px-1.5 text-muted hover:bg-foreground/5"
          onClick={() => setOpen(false)}
        >
          ✕
        </button>
      </div>

      <input
        className="input text-sm"
        placeholder="https://www.tiktok.com/@someone/video/…"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />

      {needsCaption && (
        <textarea
          className="input min-h-20 resize-y text-xs"
          placeholder="Paste the caption here"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
      )}

      {note && <p className="text-xs text-muted">{note}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        className="btn btn-primary text-xs"
        disabled={reading || busy || (!url.trim() && !caption.trim())}
        onClick={read}
      >
        {reading ? "Reading…" : needsCaption ? "Read this caption" : "Read this link"}
      </button>
    </div>
  );
}
