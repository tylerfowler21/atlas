"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import type { MapCanvasProps } from "@/components/map-types";

export type { MapPin } from "@/components/map-types";

/// Chooses between Apple Maps and the free basemap, so no caller has to know
/// or care which one it gets.
///
/// The decision is made by asking for an Apple Maps token. A viewer who is not
/// signed in gets a 401 and a deployment with no Apple credentials gets a 404;
/// either way the free basemap is used, which is what keeps public share pages
/// working — and off the Apple quota — for people with no account.

const MapLibreCanvas = dynamic(() => import("@/components/MapLibreCanvas"), {
  ssr: false,
});
const MapKitCanvas = dynamic(() => import("@/components/MapKitCanvas"), {
  ssr: false,
});

/// Cached for the page's lifetime: every map would otherwise ask again, and
/// the answer cannot change without a navigation.
let appleAvailable: Promise<boolean> | null = null;

function checkApple(): Promise<boolean> {
  appleAvailable ??= fetch("/api/mapkit-token", { cache: "no-store" })
    .then((r) => r.ok)
    .catch(() => false);
  return appleAvailable;
}

export default function MapCanvas(props: MapCanvasProps) {
  const { basemap = "auto" } = props;
  // Undefined while we find out. Rendering nothing for that moment avoids
  // building a MapLibre map and then immediately throwing it away.
  const [apple, setApple] = useState<boolean | undefined>(
    basemap === "free" ? false : undefined,
  );

  useEffect(() => {
    if (basemap === "free") return;
    let cancelled = false;
    checkApple().then((ok) => {
      if (!cancelled) setApple(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [basemap]);

  /// Apple Maps can still fail after the token check passes — a revoked key,
  /// a blocked script. Falling back then is the difference between a map that
  /// looks different and no map at all.
  const fallBack = useCallback(() => {
    appleAvailable = Promise.resolve(false);
    setApple(false);
  }, []);

  // Holds the same space the real map will take, so the page does not jump.
  if (apple === undefined)
    return <div className={props.className ?? "h-full w-full"} />;
  return apple ? (
    <MapKitCanvas {...props} onUnavailable={fallBack} />
  ) : (
    <MapLibreCanvas {...props} />
  );
}
