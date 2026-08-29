import type { MapPin } from "@/components/map-types";

/// Which pins the map should frame.
///
/// Muted means "still worth drawing, but not part of what is selected" — the
/// rest of a trip behind the day you are reading. Framing everything meant a
/// day in Lisbon was framed by a day trip to Sintra, and the two stops actually
/// on that day ended up a centimetre apart.
///
/// When nothing is muted there is no selection — the world map, where every pin
/// is the answer — so everything is framed, which is what it did before.
export function pinsToFit(pins: MapPin[]): MapPin[] {
  const selected = pins.filter((p) => !p.muted);
  return selected.length > 0 ? selected : pins;
}
