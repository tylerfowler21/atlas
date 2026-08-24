import Link from "next/link";
import { formatRange } from "@/lib/trips";
import type { FeedTrip } from "@/lib/social";

/// One published trip, as it appears on a profile or in a feed.
export default function TripCard({
  trip,
  showAuthor = true,
}: {
  trip: FeedTrip;
  showAuthor?: boolean;
}) {
  return (
    <Link
      href={`/t/${trip.id}`}
      className="card flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/5"
    >
      <span
        aria-hidden
        className="h-10 w-1.5 shrink-0 rounded-full"
        style={{ background: trip.color }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{trip.title}</p>
        <p className="truncate text-xs text-muted">
          {[trip.destination, formatRange(trip)].filter(Boolean).join(" · ")}
        </p>
        {showAuthor && (
          <p className="truncate text-xs text-muted">
            by {trip.author.username ? `@${trip.author.username}` : (trip.author.name ?? "someone")}
          </p>
        )}
        {trip.copiedFrom?.username && (
          <p className="truncate text-xs text-muted">
            copied from @{trip.copiedFrom.username}
          </p>
        )}
      </div>
      <span className="shrink-0 text-xs text-muted">
        {trip.stopCount} {trip.stopCount === 1 ? "stop" : "stops"}
      </span>
    </Link>
  );
}
