import type { Metadata } from "next";
import { requireUser } from "@/lib/user";
import TripImporter from "@/components/TripImporter";
import { tripAccess } from "@/lib/trip-access";

export const metadata: Metadata = { title: "Import — Roava" };
export const dynamic = "force-dynamic";

/// Importing is not a trips feature, whatever the old address said. The
/// commonest thing anybody imports is a list of places with no trip anywhere
/// near it.
export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; into?: string; link?: string }>;
}) {
  const user = await requireUser();
  const { mode, into, link } = await searchParams;

  // Arrived from a trip rather than from the trips list: it already knows
  // which trip this is for, and the pasting is the only question left.
  //
  // Looked up here, through the same access check the trip page uses, so the
  // picker can show its name rather than an id it cannot explain.
  const access = into ? await tripAccess(into, user) : null;
  const trip = access?.trip ?? null;

  return (
    <TripImporter
      initialMode={mode === "draft" || mode === "places" ? mode : "trip"}
      initialTrip={
        trip
          ? {
              id: trip.id,
              title: trip.title,
              startDate: trip.startDate?.toISOString() ?? null,
            }
          : null
      }
      openLink={link === "1"}
    />
  );
}
