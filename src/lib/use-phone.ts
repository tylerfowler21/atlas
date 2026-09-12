import { useSyncExternalStore } from "react";

/// True below Tailwind's `sm`, which is where the map turns into the kit's
/// phone layout: no bar across the top, the search floating on the map, and
/// the list a sheet that starts as a peek rather than open.
///
/// The same number as the `sm:` in the markup. Two places have to agree about
/// it, and a wrong guess here is a sheet that opens itself on a laptop.
const PHONE = "(max-width: 639px)";

/// Read through useSyncExternalStore rather than set in an effect.
///
/// The server has no window and has to render something, and anything that
/// corrects itself afterwards with setState is a second render React can only
/// find out about too late — the sheet would be drawn open and then shut
/// itself in front of you. A store React knows how to subscribe to gets the
/// correction into the first client render instead.
function subscribe(onChange: () => void) {
  const query = window.matchMedia(PHONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useIsPhone() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE).matches,
    // What the server assumes. A laptop is the safer guess: it renders the
    // sidebar open, which is what every wider screen wants, and a phone
    // corrects it as it hydrates.
    () => false,
  );
}
