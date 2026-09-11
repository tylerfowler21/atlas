"use client";

import { createContext, useContext, useMemo, useState } from "react";

/// What is being searched for, shared between the bar at the top and the map
/// underneath it.
///
/// The search box lives in the header, which is a layout, while the thing it
/// searches lives in a page — so the two cannot pass it between them as props.
/// It sits here instead, in the layout, which means it also survives moving
/// between pages: typing on the trips page and pressing enter arrives at the
/// map with the query intact.
///
/// Deliberately not in the address bar. A query per keystroke is a history
/// entry per keystroke, and getting back to where you were would mean pressing
/// back once for every letter you typed.
const SearchContext = createContext<{
  query: string;
  setQuery: (query: string) => void;
} | null>(null);

export default function SearchProvider({ children }: { children: React.ReactNode }) {
  const [query, setQuery] = useState("");
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch() {
  const value = useContext(SearchContext);
  if (!value) {
    throw new Error("useSearch needs a SearchProvider above it");
  }
  return value;
}
