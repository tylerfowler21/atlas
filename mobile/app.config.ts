import type { ConfigContext, ExpoConfig } from "expo/config";

/// The parts of the config that cannot be written down in app.json.
///
/// Everything static still lives there; this only adds what has to come from
/// the environment. Expo reads this file when it exists and hands it the
/// static config to build on, so app.json remains the thing to edit.
///
/// One entry so far: the Android Maps key.
///
/// iOS gets Apple Maps for nothing. Android's half of react-native-maps is
/// Google Maps, which will not draw a single tile without a key — so without
/// this the app's main screen on Android is a grey grid. The key is restricted
/// by package name and signing certificate at Google's end, and ships inside
/// the APK either way, but it is still an account credential and does not
/// belong in a file in the repository.
///
/// Set GOOGLE_MAPS_ANDROID_KEY as an EAS environment variable before the first
/// Android build. Absent, this leaves the field off entirely rather than
/// writing an empty one, because an empty key fails in a way that looks like a
/// bug in the map rather than a missing setting.
export default ({ config }: ConfigContext): ExpoConfig => {
  const key = process.env["GOOGLE_MAPS_ANDROID_KEY"];

  return {
    ...config,
    name: config.name ?? "Roava",
    slug: config.slug ?? "roava",
    android: {
      ...config.android,
      ...(key ? { config: { googleMaps: { apiKey: key } } } : {}),
    },
  };
};
