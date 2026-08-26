import type { Metadata } from "next";
import { requireUser } from "@/lib/user";
import TripImporter from "@/components/TripImporter";

export const metadata: Metadata = { title: "Paste a trip — Roava" };
export const dynamic = "force-dynamic";

/// The bulk route, for when you already have the itinerary written down
/// somewhere. The guided builder at /trips/import is the front door.
export default async function PasteTripPage() {
  await requireUser();
  return <TripImporter />;
}
