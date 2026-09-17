"use client";

import Link from "next/link";
import type { SharedPlace } from "@/lib/shared-places";

/// Somebody else's place, read-only.
///
/// Deliberately not PlaceDetail with the buttons taken out. That screen is for
/// a place you own — status, rating, trips, delete — and hiding most of it
/// would leave something that looks like yours and is not. This says the four
/// things that matter about a stranger's pin: what it is, who has been, what
/// they thought, and where to read more about them.
export default function SharedPlaceCard({
  place,
  onClose,
}: {
  place: SharedPlace;
  onClose: () => void;
}) {
  const who = place.user.name ?? (place.user.username ? `@${place.user.username}` : "Someone");

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg leading-tight">{place.name}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {[place.city, place.country].filter(Boolean).join(", ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 text-sm text-muted hover:underline"
        >
          Close
        </button>
      </div>

      {place.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={place.photoUrl}
          alt=""
          className="mt-3 h-36 w-full rounded-xl object-cover"
        />
      )}

      <p className="mt-3 text-sm">
        {place.user.username ? (
          <Link href={`/u/${place.user.username}`} className="font-medium hover:underline">
            {who}
          </Link>
        ) : (
          <span className="font-medium">{who}</span>
        )}{" "}
        <span className="text-muted">has been here</span>
        {place.rating ? (
          <span className="text-muted"> · {"★".repeat(place.rating)}</span>
        ) : null}
      </p>

      {/* Their note, which is the whole reason this pin is worth tapping. */}
      {place.notes && (
        <p className="mt-2 rounded-xl bg-brand-surface p-3 text-sm">{place.notes}</p>
      )}
    </div>
  );
}
