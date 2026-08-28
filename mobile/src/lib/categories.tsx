/// The categories in scope for whoever is signed in — the built-in ones plus
/// their own — so no screen has to fetch them or thread them down.
import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  allCategories,
  category as resolve,
  placeIcon,
  stopIcon,
  type Category,
} from "@/lib/taxonomy";

type Value = {
  /// What to offer in a picker — everything except what has been hidden.
  categories: Category[];
  /// Everything, hidden included, for the settings screen.
  everyCategory: Category[];
  categoryOf: (id: string) => Category;
  placeIconOf: (place: Parameters<typeof placeIcon>[0]) => string;
  stopIconOf: (item: Parameters<typeof stopIcon>[0]) => string;
  /// Re-reads them from the server, after adding or deleting one.
  refresh: () => Promise<void>;
  setCustom: (custom: Category[]) => void;
};

const CategoriesContext = createContext<Value | null>(null);

export function useCategories(): Value {
  const value = use(CategoriesContext);
  // The sign-in screen renders outside the provider, and the built-in
  // categories are the right answer there.
  return value ?? FALLBACK;
}

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [custom, setCustom] = useState<Category[]>([]);

  const { user } = useAuth();

  const refresh = useCallback(async () => {
    try {
      const { categories } = await api<{ categories: Category[] }>("/api/categories");
      setCustom(categories);
    } catch {
      // Not being able to load somebody's own categories is not a reason to
      // fail to draw the map: everything falls back to the built-in ones.
    }
  }, []);

  // Re-read whenever who is signed in changes, since these are per-person —
  // signing out has to take them away, not leave the last person's on screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        if (!cancelled) setCustom([]);
        return;
      }
      try {
        const { categories } = await api<{ categories: Category[] }>("/api/categories");
        if (!cancelled) setCustom(categories);
      } catch {
        // Falls back to the built-in ones.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

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
    () => ({
      categories,
      everyCategory,
      categoryOf,
      placeIconOf,
      stopIconOf,
      refresh,
      setCustom,
    }),
    [categories, everyCategory, categoryOf, placeIconOf, stopIconOf, refresh],
  );

  return <CategoriesContext value={value}>{children}</CategoriesContext>;
}

const BUILT_IN_ONLY = allCategories();
const FALLBACK: Value = {
  categories: BUILT_IN_ONLY,
  everyCategory: BUILT_IN_ONLY,
  categoryOf: (id: string) => resolve(id),
  placeIconOf: (place) => placeIcon(place),
  stopIconOf: (item) => stopIcon(item),
  refresh: async () => {},
  setCustom: () => {},
};
