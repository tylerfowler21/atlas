import type { Metadata } from "next";
import { requireUser } from "@/lib/user";
import TripImporter from "@/components/TripImporter";

export const metadata: Metadata = { title: "Add a past trip — Atlas" };
export const dynamic = "force-dynamic";

export default async function ImportTripPage() {
  await requireUser();
  return <TripImporter />;
}
