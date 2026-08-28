"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  allCategories,
  category as resolve,
  placeIcon,
  stopIcon,
  type Category,
} from "@/lib/taxonomy";

/// The categories in scope for whoever is looking, so no component has to fetch
/// them or thread them down.
///
/// Seeded from the server on first render rather than fetched, so a place is
/// never briefly drawn under the wrong icon while a request is in flight.

type Value = {
  /// What to offer in a picker: built-in first, then this person's own, minus
  /// anything they have hidden.
  categories: Category[];
  /// Everything, hidden included. The settings screen needs this; nothing else
  /// should, because a hidden category is not somewhere new things go.
  everyCategory: Category[];
  /// The category behind an id, falling back to Other.
  categoryOf: (id: string) => Category;
  /// The same icon helpers as the taxonomy, aware of this person's own
  /// categories. Components use these rather than importing the bare versions,
  /// which only know the built-in ones.
  placeIconOf: (place: Parameters<typeof placeIcon>[0]) => string;
  stopIconOf: (item: Parameters<typeof stopIcon>[0]) => string;
  /// Called after adding, editing or deleting one.
  setCustom: (custom: Category[]) => void;
};

const CategoriesContext = createContext<Value | null>(null);

export default function CategoriesProvider({
  initial,
  children,
}: {
  initial: Category[];
  children: React.ReactNode;
}) {
  const [custom, setCustom] = useState(initial);

  const everyCategory = useMemo(() => allCategories(custom), [custom]);
  const categories = useMemo(
    () => everyCategory.filter((c) => !c.hidden),
    [everyCategory],
  );
  const categoryOf = useCallback((id: string) => resolve(id, custom), [custom]);
  const placeIconOf = useCallback(
    (place: Parameters<typeof placeIcon>[0]) => placeIcon(place, custom),
    [custom],
  );
  const stopIconOf = useCallback(
    (item: Parameters<typeof stopIcon>[0]) => stopIcon(item, custom),
    [custom],
  );

  const value = useMemo(
    () => ({ categories, everyCategory, categoryOf, placeIconOf, stopIconOf, setCustom }),
    [categories, everyCategory, categoryOf, placeIconOf, stopIconOf],
  );

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories(): Value {
  const value = useContext(CategoriesContext);
  // Outside the signed-in area — a shared itinerary, say — there is no
  // provider, and the built-in categories are the right answer.
  return value ?? FALLBACK;
}

const BUILT_IN_ONLY = allCategories();
const FALLBACK: Value = {
  categories: BUILT_IN_ONLY,
  everyCategory: BUILT_IN_ONLY,
  categoryOf: (id: string) => resolve(id),
  placeIconOf: (place) => placeIcon(place),
  stopIconOf: (item) => stopIcon(item),
  setCustom: () => {},
};
