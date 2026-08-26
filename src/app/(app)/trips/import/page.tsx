import type { Metadata } from "next";
import { requireUser } from "@/lib/user";
import TripBuilder from "@/components/TripBuilder";

export const metadata: Metadata = { title: "Add a past trip — Roava" };
export const dynamic = "force-dynamic";

export default async function AddTripPage() {
  await requireUser();
  return <TripBuilder />;
}
