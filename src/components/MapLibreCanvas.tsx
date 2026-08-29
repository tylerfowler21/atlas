"use client";

import { useEffect, useRef, useState } from "react";
import { pinsToFit } from "@/lib/fit-pins";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import type { MapCanvasProps } from "@/components/map-types";

/// CARTO's free basemaps, no API key and OpenStreetMap data underneath.
///
/// Vector rather than raster: the browser renders the map from data instead of
/// stitching pre-drawn images, so labels stay sharp at every zoom and between
/// zoom levels rather than going soft. Same cartography as the raster tiles
/// this replaced.
function styleFor(dark: boolean) {
  return dark
    ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
    : "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
}

export default function MapLibreCanvas({
  pins,
  route,
  routeColor = "#0F2D4A",
  legs,
  selectedId,
  onSelect,
  onMapClick,
  fitToken,
  focus,
  initialCenter = [4, 30],
  initialZoom = 1.4,
  className,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markersRef = useRef(new Map<string, { marker: Marker; el: HTMLElement }>());

  // The map instance lives in state, not a ref: every effect below needs to
  // re-run once it exists, and state is what schedules that.
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [styleReady, setStyleReady] = useState(false);

  // Handlers live in refs so changing them never tears down the map. The refs
  // are updated in an effect (not during render) and this effect is declared
  // first, so it has already run by the time the map's listeners fire.
  const onSelectRef = useRef(onSelect);
  const onMapClickRef = useRef(onMapClick);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onMapClickRef.current = onMapClick;
  });

  // --- create the map once -------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let created: MapLibreMap | null = null;
    let observer: ResizeObserver | null = null;
    const markers = markersRef.current;

    // maplibre-gl touches `window` on import, so it is loaded in the effect
    // rather than at module scope where the server would evaluate it.
    import("maplibre-gl").then((maplibregl) => {
      if (cancelled || !containerRef.current) return;

      const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
      const instance = new maplibregl.Map({
        container: containerRef.current,
        style: styleFor(dark),
        center: initialCenter,
        zoom: initialZoom,
        attributionControl: { compact: true },
      });

      instance.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      instance.on("click", (e) => onMapClickRef.current?.(e.lngLat.lat, e.lngLat.lng));
      // Tile and style failures are otherwise silent, which makes a blank map
      // very hard to explain.
      instance.on("error", (event) =>
        console.warn("[map]", event.error?.message ?? event),
      );
      // Adding sources and layers needs the style parsed, not the first tiles
      // painted. The "load" event waits for both and does not reliably fire
      // when the map is created in a hidden tab, which left the route and leg
      // lines missing on a map that otherwise looked fine. `styledata` plus an
      // isStyleLoaded() check is the earlier, dependable signal.
      const markReady = () => {
        if (instance.isStyleLoaded()) setStyleReady(true);
      };
      instance.on("styledata", markReady);
      instance.on("load", markReady);
      markReady();

      // If the container has no size yet — a hidden tab, a collapsed panel, a
      // parent that lays out after us — maplibre falls back to 400x300 and
      // stays there. Watching the container is what makes the map recover.
      observer = new ResizeObserver(() => instance.resize());
      observer.observe(containerRef.current);

      libRef.current = maplibregl;
      created = instance;
      setMap(instance);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      markers.forEach(({ marker }) => marker.remove());
      markers.clear();
      created?.remove();
      setMap(null);
      setStyleReady(false);
    };
    // Initial camera is intentionally not reactive — later moves go via
    // fitToken and focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- sync markers --------------------------------------------------------
  useEffect(() => {
    const maplibregl = libRef.current;
    if (!map || !maplibregl) return;

    const existing = markersRef.current;
    const seen = new Set<string>();

    for (const pin of pins) {
      seen.add(pin.id);
      let entry = existing.get(pin.id);

      if (!entry) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "roava-pin";
        el.addEventListener("click", (event) => {
          // Otherwise the map's own click handler treats this as a bare click.
          event.stopPropagation();
          onSelectRef.current?.(pin.id);
        });

        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map);

        entry = { marker, el };
        existing.set(pin.id, entry);
      } else {
        entry.marker.setLngLat([pin.lng, pin.lat]);
      }

      const { el } = entry;
      el.style.setProperty("--pin-color", pin.color);
      el.classList.toggle("is-muted", Boolean(pin.muted));
      el.classList.toggle("is-selected", pin.id === selectedId);
      el.setAttribute("aria-label", pin.badge ? `Stop ${pin.badge}` : "Map pin");

      // The emoji is the point of choosing one, so it stays visible and the
      // day's running order rides along in a corner badge rather than
      // replacing it. textContent, not innerHTML — these are never raw user
      // input, but there is no reason to open that door.
      const face = el.querySelector<HTMLElement>(".roava-pin-face") ?? (() => {
        const span = document.createElement("span");
        span.className = "roava-pin-face";
        el.appendChild(span);
        return span;
      })();
      face.textContent = pin.icon;

      const existingBadge = el.querySelector<HTMLElement>(".roava-pin-badge");
      if (pin.badge) {
        const badge = existingBadge ?? (() => {
          const span = document.createElement("span");
          span.className = "roava-pin-badge";
          el.appendChild(span);
          return span;
        })();
        badge.textContent = pin.badge;
      } else if (existingBadge) {
        existingBadge.remove();
      }
    }

    for (const [id, entry] of existing) {
      if (seen.has(id)) continue;
      entry.marker.remove();
      existing.delete(id);
    }
  }, [map, pins, selectedId]);

  // --- sync the connector line --------------------------------------------
  useEffect(() => {
    // Sources can only be added once the style itself has loaded.
    if (!map || !styleReady) return;

    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: { type: "LineString" as const, coordinates: route ?? [] },
    };

    const source = map.getSource<GeoJSONSource>("roava-route");
    if (source) {
      source.setData(data);
      return;
    }

    map.addSource("roava-route", { type: "geojson", data });
    map.addLayer({
      id: "roava-route",
      type: "line",
      source: "roava-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": routeColor,
        "line-width": 2.5,
        "line-opacity": 0.7,
        "line-dasharray": [1.5, 1.5],
      },
    });
  }, [map, styleReady, route, routeColor]);

  // --- sync travel legs ----------------------------------------------------
  useEffect(() => {
    if (!map || !styleReady) return;

    const data = {
      type: "FeatureCollection" as const,
      features: (legs ?? []).map((leg) => ({
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: [leg.from, leg.to] },
      })),
    };

    const source = map.getSource<GeoJSONSource>("roava-legs");
    if (source) {
      source.setData(data);
      return;
    }

    map.addSource("roava-legs", { type: "geojson", data });
    map.addLayer({
      id: "roava-legs",
      type: "line",
      source: "roava-legs",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": routeColor,
        "line-width": 3,
        "line-opacity": 0.55,
      },
    });
  }, [map, styleReady, legs, routeColor]);

  // --- fit the viewport to every pin --------------------------------------
  //
  // Once per token, and not until there are pins to fit. Pins can arrive after
  // the map does, and this used to give up in that gap and never try again.
  const fittedFor = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!map || fitToken === undefined) return;
    if (fittedFor.current === fitToken) return;
    if (pins.length === 0) return;
    fittedFor.current = fitToken;

    const fitting = pinsToFit(pins);

    if (fitting.length === 1) {
      map.easeTo({ center: [fitting[0]!.lng, fitting[0]!.lat], zoom: 13, duration: 600 });
      return;
    }

    let west = 180;
    let south = 90;
    let east = -180;
    let north = -90;
    for (const p of fitting) {
      west = Math.min(west, p.lng);
      east = Math.max(east, p.lng);
      south = Math.min(south, p.lat);
      north = Math.max(north, p.lat);
    }

    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: 80, maxZoom: 14, duration: 600 },
    );
  }, [map, fitToken, pins]);

  // --- pan to a single point ----------------------------------------------
  useEffect(() => {
    if (!map || !focus) return;

    map.easeTo({
      center: [focus.lng, focus.lat],
      zoom: Math.max(map.getZoom(), focus.zoom ?? 13),
      duration: 600,
    });
    // Only a new token means "move the camera again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focus?.token]);

  return <div ref={containerRef} className={className ?? "h-full w-full"} />;
}
