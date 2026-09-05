/// Permission for the blue dot, asked for when a map opens.
///
/// The dot is the whole point of carrying a map around: the pins say where the
/// good things are, and you are the only thing that says which of them is
/// close. Until now the app only ever asked for location when somebody pressed
/// "I'm here now", so anyone who had not pressed it had a map of a city with
/// themselves left off it.
///
/// Asked on the map screens rather than at launch, because a permission prompt
/// makes sense standing in front of the thing it is for and looks like a
/// shakedown on a splash screen.
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking } from "react-native";
import { currentPosition } from "@/lib/here";

type Status =
  /// Still finding out — the first moment of a screen, before the answer.
  | "unknown"
  | "granted"
  /// Refused, but the system will still ask again.
  | "denied"
  /// Refused for good; only Settings can undo it.
  | "blocked"
  /// No expo-location in this build at all.
  | "unavailable";

async function load() {
  // Imported lazily for the same reason here.ts does it: a build made before
  // the module was added does not contain it, and a top-level import would
  // take the whole app down on startup rather than disabling one button.
  try {
    return await import("expo-location");
  } catch {
    return null;
  }
}

export function useMyLocation() {
  const [status, setStatus] = useState<Status>("unknown");

  useEffect(() => {
    let alive = true;

    (async () => {
      const Location = await load();
      if (!alive) return;
      if (!Location) {
        setStatus("unavailable");
        return;
      }

      // Asked about before being asked for: somebody who has already said yes
      // should never see the prompt again, and somebody who has said no for
      // good should not be nagged by every screen with a map on it.
      const existing = await Location.getForegroundPermissionsAsync();
      if (!alive) return;
      if (existing.granted) {
        setStatus("granted");
        return;
      }
      if (!existing.canAskAgain) {
        setStatus("blocked");
        return;
      }

      const asked = await Location.requestForegroundPermissionsAsync();
      if (!alive) return;
      setStatus(asked.granted ? "granted" : asked.canAskAgain ? "denied" : "blocked");
    })();

    return () => {
      alive = false;
    };
  }, []);

  /// Where the phone is now, for centring the map on it. Says what went wrong
  /// rather than doing nothing, and offers the only door out of a refusal that
  /// iOS will not reopen by itself.
  const locate = useCallback(async () => {
    if (status === "unavailable") {
      Alert.alert(
        "Location needs a newer build",
        "This phone is running a version from before location was added. Everything else works.",
      );
      return null;
    }

    const here = await currentPosition();
    if (here.ok) {
      setStatus("granted");
      return { lat: here.lat, lng: here.lng };
    }

    Alert.alert(
      here.title,
      here.detail,
      here.detail.includes("Settings")
        ? [
            { text: "Not now", style: "cancel" },
            { text: "Open Settings", onPress: () => void Linking.openSettings() },
          ]
        : undefined,
    );
    return null;
  }, [status]);

  return { status, granted: status === "granted", locate };
}
