import type { Metadata } from "next";
import { resolvedCategories } from "@/lib/categories";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/user";
import { loadPublishedTrip } from "@/lib/social";
import type { PublicTripDTO } from "@/lib/types";
import SharedTrip from "@/components/SharedTrip";
import CopyTripButton from "@/components/CopyTripButton";
import BackLink from "@/components/BackLink";
import SignUpInvite from "@/components/SignUpInvite";
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

  // The author's own categories, so their stops keep their icons and colours
  // for anyone reading this.
  const categories = await resolvedCategories(trip.userId);

  const publicTrip: PublicTripDTO = {
    title: trip.title,
    destination: trip.destination,
    destinations: trip.destinations,
    startDate: trip.startDate?.toISOString() ?? null,
    endDate: trip.endDate?.toISOString() ?? null,
    color: trip.color,
    notes: trip.notes,
  };
  const author = trip.user.username ? `@${trip.user.username}` : (trip.user.name ?? "Someone");

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="px-5 pt-4 lg:px-10">
        {/* You arrived here by clicking something, and this is the way back. */}
        <BackLink fallback="/discover" />
      </div>

      <SharedTrip
        viewerSignedIn={viewer !== null}
        trip={publicTrip}
        items={items}
        categories={categories}
        author={author}
        actions={
          <>
            <CopyTripButton
              endpoint={`/api/trips/${trip.id}/copy`}
              signedIn={Boolean(viewer)}
              isOwn={viewer?.id === trip.userId}
              returnTo={`/t/${trip.id}`}
            />
            {trip.user.username && (
              <Link href={`/u/${trip.user.username}`} className="btn btn-ghost">
                More from {author}
              </Link>
            )}
            {trip.copiedFrom?.user.username && (
              <span className="text-xs text-muted">copied from @{trip.copiedFrom.user.username}</span>
            )}
            {viewer?.id !== trip.userId && (
              <ReportOrBlock
                tripId={trip.id}
                username={trip.user.username}
                signedIn={Boolean(viewer)}
              />
            )}
          </>
        }
      />

      {!viewer && <SignUpInvite author={author} returnTo={`/t/${trip.id}`} />}
    </div>
  );
}
