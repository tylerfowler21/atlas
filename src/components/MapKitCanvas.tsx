"use client";

import { useEffect, useRef, useState } from "react";
import { pinsToFit } from "@/lib/fit-pins";
import type { MapCanvasProps, MapPin } from "@/components/map-types";
import { categoryFromPoi } from "@/lib/poi-category";

type Props = MapCanvasProps & {
  /// Called when Apple Maps cannot be used after all — the script is blocked,
  /// or the token is rejected. Carries MapKit's own reason, which is the only
  /// place the distinction between "Unauthorized" and "Too Many Requests"
  /// exists; without it a quota problem and a credentials problem look
  /// identical from outside.
  onUnavailable: (reason: string) => void;
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
      mapkit.addEventListener("configuration-change", (event) => {
        // "Initialized" and "Refreshed" are both success; anything else that
        // arrives on this event is not.
        if (event.status === "Initialized" || event.status === "Refreshed") {
          resolve(mapkit);
        } else {
          reject(new Error(`mapkit: ${event.status}`));
        }
      });
      mapkit.addEventListener("error", (event) =>
        reject(new Error(`mapkit: ${event.status ?? "error"}`)),
      );

      // And if neither ever arrives — a proxy swallowing the request, an
      // already-initialised mapkit after a hot reload — fall back rather than
      // leave an empty rectangle on screen forever.
      setTimeout(() => reject(new Error("mapkit: no response in 10s")), 10_000);

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
  // Matches the free basemap's muted pins, which used a different value.
  if (pin.muted) el.style.opacity = "0.72";

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
  routeColor = "#0F2D4A",
  legs,
  selectedId,
  onSelect,
  onMapClick,
  onPlaceSelect,
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
  const handlers = useRef({ onSelect, onMapClick, onPlaceSelect });
  useEffect(() => {
    handlers.current = { onSelect, onMapClick, onPlaceSelect };
  }, [onSelect, onMapClick, onPlaceSelect]);

  useEffect(() => {
    let cancelled = false;
    let created: mapkit.Map | null = null;
    let cleanupClick: (() => void) | undefined;
    // When Apple last answered a tap with one of its own places.
    let lastFeature = 0;

    (async () => {
      let kit: typeof mapkit;
      try {
        kit = await loadMapKit();
      } catch (e) {
        // A failed init is permanent for this page, so let the next attempt
        // start clean rather than reusing the rejected promise.
        mapkitReady = null;
        if (!cancelled) {
          onUnavailable(e instanceof Error ? e.message : "mapkit: unknown failure");
        }
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

      // The restaurants and museums Apple already draws become tappable.
      //
      // Without this they are decoration: you can see the place you mean and
      // there is no way to say so, short of typing its name into a search box
      // while looking straight at it.
      //
      // Only asked for when somebody is listening, because it changes what a
      // tap on the map means, and the drop-a-pin flow relies on that.
      if (handlers.current.onPlaceSelect) {
        created.selectableMapFeatures = [kit.MapFeatureType.PointOfInterest];
      }

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
        // Nor is a click that Apple has just answered with a place of its own:
        // dropping a nameless pin on top of a restaurant it named is worse than
        // either outcome on its own.
        if (Date.now() - lastFeature < 400) return;
        const coordinate = created.convertPointOnPageToCoordinate(
          new DOMPoint(event.pageX, event.pageY),
        );
        click(coordinate.latitude, coordinate.longitude);
      };
      container.current.addEventListener("click", onClick);

      const onFeature = (event: { annotation?: unknown }) => {
        const report = handlers.current.onPlaceSelect;
        if (!report) return;

        // A map feature, not one of our own pins. Ours are added through the
        // annotation API and handled by their own click listeners; this event
        // fires for both, and only Apple's carry a category.
        const annotation = event.annotation as
          | {
              coordinate?: { latitude: number; longitude: number };
              title?: string;
              pointOfInterestCategory?: string;
            }
          | undefined;
        if (!annotation?.coordinate || !annotation.pointOfInterestCategory) return;

        lastFeature = Date.now();
        report({
          name: annotation.title ?? "Dropped pin",
          lat: annotation.coordinate.latitude,
          lng: annotation.coordinate.longitude,
          category: categoryFromPoi(annotation.pointOfInterestCategory),
        });
      };
      created.addEventListener("select", onFeature);

      const mapForCleanup = created;
      cleanupClick = () => {
        container.current?.removeEventListener("click", onClick);
        try {
          mapForCleanup.removeEventListener("select", onFeature);
        } catch {
          // A map already destroyed has nothing to detach from.
        }
      };

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

  /// Match the map to the interface theme.
  ///
  /// The stylesheet themes purely off prefers-color-scheme — there is no dark
  /// class on the document to read — so this asks the same media query the CSS
  /// does, and follows it when the system setting changes.
  useEffect(() => {
    if (!map) return;

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const live = instance.current;
      if (live !== map) return;
      live.colorScheme = query.matches
        ? mapkit.Map.ColorSchemes.Dark
        : mapkit.Map.ColorSchemes.Light;
    };

    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
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
  ///
  /// Waits for the pins to exist. The map becomes available a moment before its
  /// annotations are added, and this used to run in that gap, find nothing to
  /// fit, and never try again — which is why opening a trip could leave you
  /// looking at the whole world with the trip somewhere on it.
  ///
  /// Once per token, so adding a stop does not drag the map back from wherever
  /// you had panned to. Changing day or trip changes the token, and that does
  /// refit.
  const fittedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!map || fitToken === undefined) return;
    if (fittedFor.current === fitToken) return;
    if (map.annotations.length === 0) return;

    fittedFor.current = fitToken;

    // Matched by the id each annotation carries, not by position: the map owns
    // that array and makes no promise about its order.
    const wanted = new Set(pinsToFit(pins).map((p) => p.id));
    const focused = map.annotations.filter(
      (a) => wanted.has((a.data as { id?: string } | undefined)?.id ?? ""),
    );
    map.showItems(focused.length > 0 ? focused : map.annotations, { animate: true });
  }, [map, fitToken, pins]);

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
