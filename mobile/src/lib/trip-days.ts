import type { ItineraryItem, Trip } from "@/lib/api";

/// How many days a trip has.
///
/// Its dates say so when it has them, but never fewer days than there are
/// entries — or a stop could have nowhere to be, including the morning an
/// overnight flight lands, which is a day of the trip before anything else is
/// planned on it. A trip with neither dates nor entries still has one day.
export function dayCount(
  trip: Pick<Trip, "startDate" | "endDate">,
  items: Pick<ItineraryItem, "dayIndex" | "endDayOffset">[],
) {
  const fromDates =
    trip.startDate && trip.endDate
      ? Math.round(
          (new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86_400_000,
        ) + 1
      : 0;
  const fromItems = items.reduce(
    (n, i) => Math.max(n, i.dayIndex + (i.endDayOffset ?? 0) + 1),
    0,
  );
  return Math.max(1, fromDates, fromItems);
}
