import { useEffect, useMemo, useRef } from "react";
import { Linking, Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import type { ItineraryItem } from "@/lib/api";
import { stopIcon, travelMode } from "@/lib/taxonomy";
import { usePalette } from "@/lib/use-palette";

/// Opens the platform's maps app with directions to somewhere.
///
/// Apple Maps on iOS, Google Maps elsewhere. `daddr` alone lets the maps app
/// decide where you are starting from, which is nearly always "here" and saves
/// asking for a location permission this app does not otherwise need.
export function openDirections(lat: number, lng: number, label: string) {
  const name = encodeURIComponent(label);
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?daddr=${lat},${lng}&q=${name}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  Linking.openURL(url).catch(() => {});
}

function regionFor(points: { lat: number; lng: number }[]): Region | undefined {
  if (points.length === 0) return undefined;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.02),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.02),
  };
}

/// The trip drawn as a shape.
///
/// Two kinds of line, matching the website: a dashed one through the stops in
/// the order they happen, and a solid one for each journey. They read
/// differently on purpose — one is the order of a day, the other is an actual
/// movement between two places.
export default function TripMap({
  items,
  color,
}: {
  items: ItineraryItem[];
  color: string;
}) {
  const palette = usePalette();

  const stops = useMemo(
    () => items.filter((i) => i.kind === "stop" && i.place),
    [items],
  );
  const legs = useMemo(
    () => items.filter((i) => i.kind === "travel" && i.place && i.toPlace),
    [items],
  );

  const points = useMemo(() => {
    const all = stops.map((i) => ({ lat: i.place!.lat, lng: i.place!.lng }));
    for (const leg of legs) {
      all.push({ lat: leg.place!.lat, lng: leg.place!.lng });
      all.push({ lat: leg.toPlace!.lat, lng: leg.toPlace!.lng });
    }
    return all;
  }, [stops, legs]);

  const region = useMemo(() => regionFor(points), [points]);

  /// initialRegion only applies when the map mounts, so filtering to a single
  /// day would redraw the lines and leave the camera where it was — showing a
  /// day's route somewhere off screen. Moving it explicitly is what makes the
  /// filter feel like it did anything.
  const map = useRef<MapView>(null);
  useEffect(() => {
    if (region) map.current?.animateToRegion(region, 400);
  }, [region]);

  if (points.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={{ color: palette.muted, fontSize: 13, textAlign: "center" }}>
          Attach saved places to your stops and the route appears here.
        </Text>
      </View>
    );
  }

  return (
    <MapView ref={map} style={styles.map} initialRegion={region}>
      {stops.length > 1 && (
        <Polyline
          coordinates={stops.map((i) => ({
            latitude: i.place!.lat,
            longitude: i.place!.lng,
          }))}
          strokeColor={color}
          strokeWidth={2.5}
          lineDashPattern={[6, 5]}
        />
      )}

      {legs.map((leg) => (
        <Polyline
          key={leg.id}
          coordinates={[
            { latitude: leg.place!.lat, longitude: leg.place!.lng },
            { latitude: leg.toPlace!.lat, longitude: leg.toPlace!.lng },
          ]}
          strokeColor={color}
          strokeWidth={3}
        />
      ))}

      {stops.map((i, index) => (
        <Marker
          key={i.id}
          coordinate={{ latitude: i.place!.lat, longitude: i.place!.lng }}
          title={i.title}
          description="Tap for directions"
          onCalloutPress={() => openDirections(i.place!.lat, i.place!.lng, i.title)}
        >
          <View style={[styles.pin, { borderColor: color, backgroundColor: palette.surface }]}>
            <Text style={styles.glyph}>{i.emoji || stopIcon(i)}</Text>
            <View style={[styles.badge, { backgroundColor: color }]}>
              <Text style={styles.badgeText}>{index + 1}</Text>
            </View>
          </View>
        </Marker>
      ))}

      {legs.map((leg) => (
        <Marker
          key={`${leg.id}-to`}
          coordinate={{ latitude: leg.toPlace!.lat, longitude: leg.toPlace!.lng }}
          title={leg.toPlace!.name}
          description={leg.title}
          onCalloutPress={() =>
            openDirections(leg.toPlace!.lat, leg.toPlace!.lng, leg.toPlace!.name)
          }
        >
          <View style={[styles.pin, { borderColor: color, backgroundColor: palette.surface }]}>
            <Text style={styles.glyph}>{travelMode(leg.mode).icon}</Text>
          </View>
        </Marker>
      ))}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { height: 240, width: "100%" },
  empty: {
    margin: 12,
    padding: 20,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
  },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  glyph: { fontSize: 16 },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
