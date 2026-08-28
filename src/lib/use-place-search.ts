import { useEffect, useRef, useState } from "react";

/// Searching as you type, without asking a rate-limited geocoder for a result
/// per keystroke.
///
/// Two searches run for every query, at different speeds. The quick one goes to
/// Photon alone, which exists to answer half-typed words and answers in about a
/// tenth of a second — so something is on screen while you are still typing.
/// The thorough one runs once you stop and asks both geocoders, which is slower
/// but better at full addresses and precise names; its answer replaces the
/// quick one.
///
/// The effect is that suggestions appear immediately and quietly improve,
/// rather than nothing happening until you press enter.
///
/// Shared by the website and the app, because a search that behaves one way in
/// one and another way in the other is two things to learn.

/// Photon will guess from two letters. The thorough search needs three, which
/// is what its geocoders will accept.
export const MIN_SUGGEST = 2;
export const MIN_FULL = 3;

/// Long enough that typing a word is one request rather than five, short enough
/// to feel like it is keeping up.
const QUICK_MS = 180;
/// Roughly the gap that means you have stopped typing.
const SETTLE_MS = 650;

type Mode = "suggest" | "full";

export function usePlaceSearch<T>(
  query: string,
  load: (query: string, mode: Mode) => Promise<T[]>,
) {
  const [state, setState] = useState<{ q: string; items: T[]; full: boolean }>({
    q: "",
    items: [],
    full: false,
  });

  // Answers arrive out of order — the thorough search for "lisb" can land after
  // the quick one for "lisbon". Only the newest query's answers are kept.
  const requestId = useRef(0);
  // `load` is usually written inline at the call site, so a new function every
  // render. Reading it through a ref keeps it out of the effect's dependencies,
  // where it would restart the search on every keystroke of every other field.
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  });

  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_SUGGEST) return;

    const id = ++requestId.current;

    async function run(mode: Mode) {
      try {
        const items = await loader.current(trimmed, mode);
        if (id !== requestId.current) return;
        setState((current) => {
          // A slow suggestion must not overwrite the thorough answer it was
          // meant to tide us over until.
          if (mode === "suggest" && current.q === trimmed && current.full) return current;
          return { q: trimmed, items, full: mode === "full" };
        });
      } catch {
        if (id === requestId.current) {
          setState((current) =>
            current.q === trimmed ? current : { q: trimmed, items: [], full: true },
          );
        }
      }
    }

    const quick = setTimeout(() => void run("suggest"), QUICK_MS);
    const settle =
      trimmed.length >= MIN_FULL ? setTimeout(() => void run("full"), SETTLE_MS) : undefined;

    return () => {
      clearTimeout(quick);
      if (settle) clearTimeout(settle);
    };
  }, [trimmed]);

  return {
    results: state.q === trimmed ? state.items : [],
    /// True only until the first answer for this query. The thorough search
    /// carrying on afterwards is not something to put a spinner on: there are
    /// already results on screen.
    searching: trimmed.length >= MIN_SUGGEST && state.q !== trimmed,
  };
}
