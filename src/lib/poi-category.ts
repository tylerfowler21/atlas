import type { BuiltInCategoryId } from "@/lib/taxonomy";

/// Apple's point-of-interest categories, mapped onto ours.
///
/// A tapped restaurant should arrive as a restaurant rather than as "other" —
/// Apple already knows what it is, and asking somebody to re-classify a place
/// the map has just labelled is a strange thing to do.
///
/// Only the ones worth telling apart are listed. Apple has around sixty and
/// most collapse into the same handful; anything unlisted falls through to the
/// keyword pass below, and then to "other", which is what it would have been.
const EXACT: Record<string, BuiltInCategoryId> = {
  Restaurant: "restaurant",
  // A food market is somewhere you shop, whatever the word "food" suggests.
  FoodMarket: "shop",
  Bakery: "cafe",
  Cafe: "cafe",
  Brewery: "bar",
  Distillery: "bar",
  Winery: "bar",
  Nightlife: "bar",
  Hotel: "hotel",
  Museum: "sight",
  Landmark: "sight",
  NationalMonument: "sight",
  Castle: "sight",
  Fortress: "sight",
  Planetarium: "sight",
  Zoo: "activity",
  Aquarium: "activity",
  AmusementPark: "activity",
  Fairground: "activity",
  Spa: "activity",
  // Somewhere you spend an afternoon is an activity, whether or not you are
  // any good at it. These were all landing in Other, which on a travel map is
  // where things go to be forgotten.
  Baseball: "activity",
  Basketball: "activity",
  Bowling: "activity",
  Fishing: "activity",
  FitnessCenter: "activity",
  GoKart: "activity",
  Golf: "activity",
  Kayaking: "activity",
  MiniGolf: "activity",
  RockClimbing: "activity",
  Skating: "activity",
  Skiing: "activity",
  Soccer: "activity",
  Surfing: "activity",
  Swimming: "activity",
  Tennis: "activity",
  Volleyball: "activity",
  MovieTheater: "activity",
  Theater: "activity",
  MusicVenue: "activity",
  Stadium: "activity",
  Park: "nature",
  NationalPark: "nature",
  Beach: "nature",
  Hiking: "nature",
  Campground: "nature",
  RVPark: "nature",
  Marina: "nature",
  Store: "shop",
  Airport: "transport",
  PublicTransport: "transport",
  // Matched "Station" and became transport. It is not.
  FireStation: "other",
  Parking: "transport",
  EVCharger: "transport",
  CarRental: "transport",
  GasStation: "transport",
};

/// Apple names categories in CamelCase and coins new ones over time, so a
/// substring pass catches the families rather than only the members known on
/// the day this was written: every "…Store" is a shop, every "…Museum" a sight.
const KEYWORDS: [string, BuiltInCategoryId][] = [
  ["Restaurant", "restaurant"],
  ["Food", "restaurant"],
  ["Cafe", "cafe"],
  ["Coffee", "cafe"],
  ["Bar", "bar"],
  ["Museum", "sight"],
  ["Monument", "sight"],
  ["Park", "nature"],
  ["Beach", "nature"],
  ["Garden", "nature"],
  ["Store", "shop"],
  ["Shop", "shop"],
  ["Market", "shop"],
  ["Transit", "transport"],
  ["Station", "transport"],
  ["Airport", "transport"],
  ["Hotel", "hotel"],
  ["Lodging", "hotel"],
];

export function categoryFromPoi(poi?: string | null): BuiltInCategoryId {
  if (!poi) return "other";
  if (EXACT[poi]) return EXACT[poi];

  for (const [needle, category] of KEYWORDS) {
    if (poi.includes(needle)) return category;
  }
  return "other";
}
