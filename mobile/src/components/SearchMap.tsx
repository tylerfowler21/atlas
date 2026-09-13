/// The strip of map above a list of search results.
///
/// Four results all called Dubai are four identical rows. Where they are is
/// the only thing that tells them apart — and the sheet that asks "which
/// place?" covers the trip's own map completely, so it carries its own.
///
/// Numbered to match the rows underneath, and no more interactive than that:
/// picking is done on the row, where the name and the address are. A pin here
/// is for recognising, not for choosing.
import { useEffect, useRef } from "react";
import MapView, { Marker } from "react-native-maps";
import { StyleSheet, Text, View } from "react-native";
import type { SearchResult } from "@/lib/api";
import { RADIUS } from "@/lib/brand";
import { type } from "@/lib/type";
import { usePalette } from "@/lib/use-palette";

const PIN_BOX = 34;
const PIN = 26;

/// Room around the fitted pins, so none sits under the strip's own edge.
const FIT_PADDING = { top: 34, right: 34, bottom: 34, left: 34 };

/// What a single result is framed at. `fitToCoordinates` on one point zooms to
/// the building, which says nothing about which town it is in.
const ONE_RESULT_SPAN = 0.08;

export default function SearchMap({
  results,
  height = 150,
}: {
  results: SearchResult[];
  /// Short on purpose. It is a strip above a list, not a map screen — the
  /// sheet's real job is the rows below it.
  height?: number;
}) {
  const palette = usePalette();
  const map = useRef<MapView | null>(null);
  const key = results.map((r) => r.id).join(",");
  /// Framed once per set of results. Fitting on every render restarts the
  /// animation against itself and the map creeps, which is exactly what the
  /// map tab had to be taught not to do.
  const fittedFor = useRef<string | null>(null);

  useEffect(() => {
    if (results.length === 0) {
      fittedFor.current = null;
      return;
    }
    if (fittedFor.current === key) return;
    fittedFor.current = key;

    if (results.length === 1) {
      map.current?.animateToRegion(
        {
          latitude: results[0]!.lat,
          longitude: results[0]!.lng,
          latitudeDelta: ONE_RESULT_SPAN,
          longitudeDelta: ONE_RESULT_SPAN,
        },
        350,
      );
      return;
    }

    map.current?.fitToCoordinates(
      results.map((r) => ({ latitude: r.lat, longitude: r.lng })),
      { edgePadding: FIT_PADDING, animated: true },
    );
  }, [key, results]);

  if (results.length === 0) return null;

  return (
    <View style={[styles.frame, { height, borderColor: palette.border }]}>
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        // The strip answers "where are these", and a rotated or tilted one
        // answers it worse. Panning and zooming stay, for a closer look.
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        {results.map((r, n) => (
          <Marker
            key={`found-${r.id}`}
            coordinate={{ latitude: r.lat, longitude: r.lng }}
            // A fixed box around a fixed pin: a marker is anchored by its own
            // geometry, so anything that resizes slides off the place it marks.
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.pinBox}>
              <View style={[styles.pin, { backgroundColor: palette.accent }]}>
                <Text style={[styles.number, { color: palette.onAccent }]}>{n + 1}</Text>
              </View>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: RADIUS.card,
    overflow: "hidden",
  },
  pinBox: { width: PIN_BOX, height: PIN_BOX, alignItems: "center", justifyContent: "center" },
  pin: {
    width: PIN,
    height: PIN,
    borderRadius: PIN / 2,
    borderWidth: 2.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    // Softer and greener than black, as everywhere else a pin is drawn.
    shadowColor: "#12322B",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  number: { ...type.metaStrong, fontSize: 12, lineHeight: 15 },
});
