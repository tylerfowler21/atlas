import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { loadPublishedTrip } from "@/lib/social";
import type { PublicTripDTO } from "@/lib/types";
import SharedTrip from "@/components/SharedTrip";
import CopyTripButton from "@/components/CopyTripButton";
import ReportOrBlock from "@/components/ReportOrBlock";
import { isBlockedBetween } from "@/lib/moderation";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const found = await loadPublishedTrip(id);
  return { title: found ? `${found.trip.title} on Roava` : "Not found" };
}

/// A published trip, readable by anyone. Unlike a share link this one is meant
/// to be found — it sits on a profile and in followers' feeds — and it offers
/// the visitor a copy of the itinerary for their own account.
export default async function PublishedTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const found = await loadPublishedTrip(id);
  if (!found) notFound();

  const viewer = await getCurrentUser();
  const { trip, items } = found;

  if (await isBlockedBetween(viewer?.id ?? null, trip.userId)) notFound();

  const publicTrip: PublicTripDTO = {
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate?.toISOString() ?? null,
    endDate: trip.endDate?.toISOString() ?? null,
    color: trip.color,
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            {trip.user.username ? (
              <Link href={`/u/${trip.user.username}`} className="text-accent-text hover:underline">
                @{trip.user.username}
              </Link>
            ) : (
              (trip.user.name ?? "Someone")
            )}
            {trip.copiedFrom?.user.username && (
              <> · copied from @{trip.copiedFrom.user.username}</>
            )}
          </p>
          <h1 className="truncate text-sm font-semibold">{trip.title}</h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <CopyTripButton
            tripId={trip.id}
            signedIn={Boolean(viewer)}
            isOwn={viewer?.id === trip.userId}
          />
          {viewer?.id !== trip.userId && (
            <ReportOrBlock
              tripId={trip.id}
              username={trip.user.username}
              signedIn={Boolean(viewer)}
            />
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <SharedTrip trip={publicTrip} items={items} />
      </div>
    </div>
  );
}
