import { BUILT_IN_CATEGORY_IDS, type BuiltInCategoryId } from "@/lib/taxonomy";

/// What somebody's own word for a category means in ours.
///
/// A spreadsheet with a Category column is a person having already decided what
/// each row is, which is better information than a gazetteer's guess from an
/// OpenStreetMap tag. "Food" is a restaurant whatever the map thinks the
/// building is.
///
/// Only the unambiguous ones. Anything not listed is left alone rather than
/// forced into the nearest match — an unrecognised word means the category is
/// still an open question, and the review step is where somebody answers it.
const WORDS: [string, BuiltInCategoryId][] = [
  ["food", "restaurant"],
  ["eat", "restaurant"],
  ["dinner", "restaurant"],
  ["lunch", "restaurant"],
  ["breakfast", "cafe"],
  ["restaurant", "restaurant"],
  ["meal", "restaurant"],

  ["cafe", "cafe"],
  ["café", "cafe"],
  ["coffee", "cafe"],
  ["bakery", "cafe"],

  ["bar", "bar"],
  ["drink", "bar"],
  ["pub", "bar"],
  ["nightlife", "bar"],
  ["brewery", "bar"],
  ["wine", "bar"],

  ["sight", "sight"],
  ["sightseeing", "sight"],
  ["museum", "sight"],
  ["landmark", "sight"],
  ["monument", "sight"],
  ["church", "sight"],
  ["castle", "sight"],
  ["culture", "sight"],

  ["nature", "nature"],
  ["park", "nature"],
  ["hike", "nature"],
  ["hiking", "nature"],
  ["beach", "nature"],
  ["outdoors", "nature"],
  ["walk", "nature"],

  ["activity", "activity"],
  ["activities", "activity"],
  ["tour", "activity"],
  ["experience", "activity"],
  ["show", "activity"],
  ["sport", "activity"],

  ["hotel", "hotel"],
  ["stay", "hotel"],
  ["accommodation", "hotel"],
  ["lodging", "hotel"],
  ["airbnb", "hotel"],

  ["shop", "shop"],
  ["shopping", "shop"],
  ["market", "shop"],
  ["store", "shop"],

  ["travel", "transport"],
  ["transport", "transport"],
  ["transit", "transport"],
  ["train", "transport"],
  ["flight", "transport"],
  ["fly", "transport"],
  ["drive", "transport"],
  ["bus", "transport"],
  ["ferry", "transport"],
];

const BY_WORD = new Map(WORDS);

/// The category somebody's own word means, or null when it means nothing we
/// know — in which case it is left plain for them to choose.
export function categoryFromWord(word: string | null | undefined): BuiltInCategoryId | null {
  if (!word) return null;
  const w = word.trim().toLowerCase().replace(/[.!?]+$/, "");
  if (!w || w.includes(" ")) return null;

  // An exact category id is a word too — a sheet that says "restaurant" or
  // "hotel" is already speaking our language.
  if ((BUILT_IN_CATEGORY_IDS as readonly string[]).includes(w)) {
    return w as BuiltInCategoryId;
  }
  return BY_WORD.get(w) ?? null;
}
