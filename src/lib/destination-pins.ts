import type { SearchResult } from "@/lib/types";

/// Holding on to what the destination picker found.
///
/// A trip stores where it goes as a line of text — "Quebec, Canada" — because
/// that is what every screen showing a trip needs to show. Making the city a
/// place on the map needs coordinates, and looking the text up again to get
/// them is where it goes wrong: the picker shows the same label for Québec
/// City and for the province around it, and the gazetteer answers the string
/// with the province, five hundred kilometres north of the trip. New York,
/// Mexico, Panama and Luxembourg all have the same shape.
///
/// The coordinates were in hand at the moment somebody pointed at a
/// suggestion. These carry them as far as the request that creates the trip,
/// where they are spent and dropped — nothing stores them, because the label
/// is still what the trip is about.

export type DestinationPin = {
  /// Exactly the label that went into `destinations`, which is how the server
  /// pairs the two back up.
  label: string;
  name: string;
  lat: number;
  lng: number;
  city: string | null;
  country: string | null;
  countryCode: string | null;
  category: string;
};

export function pinFrom(label: string, result: SearchResult): DestinationPin {
  return {
    label,
    name: result.name,
    lat: result.lat,
    lng: result.lng,
    city: result.city ?? null,
    country: result.country ?? null,
    countryCode: result.countryCode ?? null,
    category: result.category,
  };
}

/// The pins for the destinations still on the form, in their order.
///
/// Filtered by what is actually there rather than sent wholesale: somebody who
/// adds a city, thinks better of it and takes it off should not have it turn
/// up on their map anyway. Undefined when there is nothing to send, so the
/// field stays absent rather than arriving empty.
export function pinsFor(
  destinations: string[],
  known: Record<string, DestinationPin>,
): DestinationPin[] | undefined {
  const pins = destinations
    .map((label) => known[label.trim()])
    .filter((pin): pin is DestinationPin => Boolean(pin));
  return pins.length > 0 ? pins : undefined;
}
