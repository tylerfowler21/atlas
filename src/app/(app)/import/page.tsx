import type { Metadata } from "next";
import { requireUser } from "@/lib/user";
import TripImporter from "@/components/TripImporter";

export const metadata: Metadata = { title: "Import — Roava" };
export const dynamic = "force-dynamic";

/// Importing is not a trips feature, whatever the old address said. The
/// commonest thing anybody imports is a list of places with no trip anywhere
/// near it.
export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  await requireUser();
  const { mode } = await searchParams;

  return (
    <TripImporter
      initialMode={mode === "draft" || mode === "places" ? mode : "trip"}
    />
  );
}
