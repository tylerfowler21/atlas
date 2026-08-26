"use client";

import { useEffect, useRef, useState } from "react";
import type { MapCanvasProps, MapPin } from "@/components/map-types";

type Props = MapCanvasProps & {
  /// Called when Apple Maps cannot be used after all — the script is blocked,
  /// or the token is rejected because the key was revoked or expired. Without
  /// this the viewer is left staring at an empty rectangle.
  onUnavailable: () => void;
};

/// Apple Maps. Same props as the MapLibre implementation, so the two are
/// interchangeable and callers never learn which one they got.

const SCRIPT_SRC = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";

/// One shared init for the whole page. mapkit.init may only be called once,
/// and several maps can be mounted at the same time.
let mapkitReady: Promise<typeof mapkit> | null = null;

function loadMapKit(): Promise<typeof mapkit> {
  mapkitReady ??= new Promise((resolve, reject) => {
    const start = () => {
      // mapkit.init returns immediately, long before Apple has accepted or
      // rejected the token, so resolving here would report success for a
      // MapKit that is about to fail — and the caller would build a map that
      // never draws. "configuration-change" is the signal that it really came
      // up; "error" is a rejected or expired key.
      mapkit.addEventListener("configuration-change", () => resolve(mapkit));
      mapkit.addEventListener("error", () =>
        reject(new Error("mapkit rejected the token")),
      );

      // And if neither ever arrives — a proxy swallowing the request, an
      // already-initialised mapkit after a hot reload — fall back rather than
      // leave an empty rectangle on screen forever.
      setTimeout(() => reject(new Error("mapkit did not initialise")), 10_000);

      mapkit.init({
        authorizationCallback: (done) => {
          fetch("/api/mapkit-token", { cache: "no-store" })
            .then((r) => {
              if (!r.ok) throw new Error(String(r.status));
              return r.text();
            })
            .then(done)
            .catch(reject);
        },
      });
    };

    if (typeof mapkit !== "undefined") return start();

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", start, { once: true });
    script.addEventListener("error", () => reject(new Error("mapkit.js failed to load")), {
      once: true,
    });
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
  });
  return mapkitReady;
}

/// The pin, built as DOM so it matches the MapLibre one exactly — same emoji,
/// same coloured ring, same badge.
function pinElement(pin: MapPin) {
  const el = document.createElement("div");
  el.className = "roava-pin";
  el.style.borderColor = pin.color;
  if (pin.muted) el.style.opacity = "0.45";

  const face = document.createElement("span");
  face.className = "roava-pin-face";
  face.textContent = pin.icon;
  el.appendChild(face);

  if (pin.badge) {
    const badge = document.createElement("span");
    badge.className = "roava-pin-badge";
    badge.textContent = pin.badge;
    el.appendChild(badge);
  }
  return el;
}

export default function MapKitCanvas({
  pins,
  route,
  routeColor = "#2563eb",
  legs,
  selectedId,
  onSelect,
  onMapClick,
  fitToken,
  focus,
  initialCenter,
  initialZoom,
  className,
  onUnavailable,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  /// The map lives in both: state so effects re-run once it exists, and a ref
  /// because MapKit is configured by assigning to properties, and the compiler
  /// treats anything from useState as immutable — correctly, in general.
  const instance = useRef<mapkit.Map | null>(null);
  const [map, setMap] = useState<mapkit.Map | null>(null);

  // Callbacks live in a ref so the map is not town down and rebuilt every time
  // a parent re-renders with a new inline function.
  const handlers = useRef({ onSelect, onMapClick });
  useEffect(() => {
    handlers.current = { onSelect, onMapClick };
  }, [onSelect, onMapClick]);

  useEffect(() => {
    let cancelled = false;
    let created: mapkit.Map | null = null;
    let cleanupClick: (() => void) | undefined;

    (async () => {
      let kit: typeof mapkit;
      try {
        kit = await loadMapKit();
      } catch {
        // A failed init is permanent for this page, so let the next attempt
        // start clean rather than reusing the rejected promise.
        mapkitReady = null;
        if (!cancelled) onUnavailable();
        return;
      }
      if (cancelled || !container.current) return;

      // React can tear this component down and rebuild it immediately — in
      // development it always does — and MapKit leaves its DOM behind. Left
      // alone, the second map is built on top of the first one's wreckage.
      container.current.replaceChildren();

      created = new kit.Map(container.current, {
        showsCompass: kit.FeatureVisibility.Adaptive,
        showsScale: kit.FeatureVisibility.Adaptive,
        showsPointsOfInterest: true,
      });

      if (initialCenter) {
        created.center = new kit.Coordinate(initialCenter[1], initialCenter[0]);
        if (initialZoom) {
          // MapKit spans rather than zoom levels; this is the usual conversion
          // and only sets the opening view, which is then usually re-fit.
          const span = 360 / 2 ** initialZoom;
          created.region = new kit.CoordinateRegion(
            created.center,
            new kit.CoordinateSpan(span, span),
          );
        }
      }

      // A DOM click rather than MapKit's "single-tap": the tap event carries
      // the page position at runtime but not in its type definitions, and
      // reaching past the types for a property that cannot be verified here
      // is how this breaks silently later. pageX/pageY feed the documented
      // conversion instead.
      const onClick = (event: MouseEvent) => {
        const click = handlers.current.onMapClick;
        if (!click || !created) return;
        // A click that landed on a pin is a selection, not a drop-a-pin.
        if ((event.target as Element | null)?.closest(".roava-pin")) return;
        const coordinate = created.convertPointOnPageToCoordinate(
          new DOMPoint(event.pageX, event.pageY),
        );
        click(coordinate.latitude, coordinate.longitude);
      };
      container.current.addEventListener("click", onClick);
      cleanupClick = () => container.current?.removeEventListener("click", onClick);

      if (cancelled) return;
      instance.current = created;
      setMap(created);
    })();

    return () => {
      cancelled = true;
      cleanupClick?.();
      instance.current = null;
      // Clears the state too, so no effect can run against a dead map while
      // the replacement is still being built.
      setMap(null);
      // Tearing down a third-party imperative map is best-effort: MapKit
      // throws from inside destroy() if any of its own teardown has already
      // happened, and there is nothing useful to do about it. Letting that
      // escape turns a tidy-up detail into a crashed page.
      try {
        created?.destroy();
      } catch {}
    };
    // Opening position is read once, on purpose: re-running this would rebuild
    // the whole map under someone who has panned away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onUnavailable]);

  /// Follow the page's theme rather than the system's, so the map matches the
  /// rest of the interface when someone has overridden it.
  useEffect(() => {
    if (!map) return;
    const apply = () => {
      const live = instance.current;
      if (live !== map) return;
      live.colorScheme = document.documentElement.classList.contains("dark")
        ? mapkit.Map.ColorSchemes.Dark
        : mapkit.Map.ColorSchemes.Light;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [map]);

  /// Pins, including which one is selected.
  ///
  /// Selection is set when the annotation is built rather than assigned
  /// afterwards. Rebuilding a few dozen annotations costs nothing, and the
  /// alternative — reaching into the live map to flip a property — is exactly
  /// the mutation the compiler refuses, with good reason.
  useEffect(() => {
    if (!map) return;

    const annotations = pins.map((pin) => {
      const annotation = new mapkit.Annotation(
        new mapkit.Coordinate(pin.lat, pin.lng),
        () => pinElement(pin),
        {
          anchorOffset: new DOMPoint(0, -8),
          data: { id: pin.id },
          selected: pin.id === selectedId,
        },
      );
      annotation.addEventListener("select", () => handlers.current.onSelect?.(pin.id));
      return annotation;
    });

    map.addAnnotations(annotations);
    return () => {
      // Identity, not truthiness. React destroys the map in an earlier
      // cleanup, and in development it then immediately builds a second one —
      // so by the time this runs `instance.current` can be a *different*,
      // living map while `map` here is the destroyed one. Calling into that
      // throws, which is precisely the bug this replaced.
      if (instance.current !== map) return;
      try {
        map.removeAnnotations(annotations);
      } catch {}
    };
  }, [map, pins, selectedId]);

  /// The dashed day-order connector and the solid travel legs.
  useEffect(() => {
    if (!map) return;

    const overlays: mapkit.Overlay[] = [];

    if (route && route.length > 1) {
      overlays.push(
        new mapkit.PolylineOverlay(
          route.map(([lng, lat]) => new mapkit.Coordinate(lat, lng)),
          {
            style: new mapkit.Style({
              strokeColor: routeColor,
              lineWidth: 2.5,
              lineDash: [6, 4],
            }),
          },
        ),
      );
    }

    for (const leg of legs ?? []) {
      overlays.push(
        new mapkit.PolylineOverlay(
          [
            new mapkit.Coordinate(leg.from[1], leg.from[0]),
            new mapkit.Coordinate(leg.to[1], leg.to[0]),
          ],
          { style: new mapkit.Style({ strokeColor: routeColor, lineWidth: 3 }) },
        ),
      );
    }

    if (overlays.length === 0) return;
    map.addOverlays(overlays);
    return () => {
      if (instance.current !== map) return;
      try {
        map.removeOverlays(overlays);
      } catch {}
    };
  }, [map, route, routeColor, legs]);

  /// Fit to the pins when the caller asks.
  useEffect(() => {
    if (!map || fitToken === undefined || map.annotations.length === 0) return;
    map.showItems(map.annotations, { animate: true });
  }, [map, fitToken]);

  /// Pan to one place without disturbing the rest.
  useEffect(() => {
    if (!map || !focus) return;
    const centre = new mapkit.Coordinate(focus.lat, focus.lng);
    const span = 360 / 2 ** (focus.zoom ?? 14);
    map.setRegionAnimated(
      new mapkit.CoordinateRegion(centre, new mapkit.CoordinateSpan(span, span)),
    );
  }, [map, focus]);

  // Same default as the MapLibre implementation. Without it the container has
  // no height, and MapKit renders a map 896 pixels wide and zero tall — which
  // looks exactly like a map that failed to load.
  return <div ref={container} className={className ?? "h-full w-full"} />;
}
