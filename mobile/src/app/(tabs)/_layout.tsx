import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";

/// Emoji rather than SF Symbols: the tab bar then matches the pins and the
/// category chips, which are emoji everywhere else in the app.
function icon(glyph: string) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ fontSize: 22, color, opacity: 0.9 }}>{glyph}</Text>;
  };
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#2563eb" }}>
      <Tabs.Screen name="index" options={{ title: "Map", tabBarIcon: icon("🗺️") }} />
      <Tabs.Screen name="places" options={{ title: "Places", tabBarIcon: icon("📍") }} />
      <Tabs.Screen name="trips" options={{ title: "Trips", tabBarIcon: icon("🧳") }} />
    </Tabs>
  );
}
