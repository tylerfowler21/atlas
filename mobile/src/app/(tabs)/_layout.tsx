import { Tabs } from "expo-router";
import { Text, useColorScheme, type ColorValue } from "react-native";

/// Emoji rather than SF Symbols: the tab bar then matches the pins and the
/// category chips, which are emoji everywhere else in the app.
function icon(glyph: string) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ fontSize: 22, color, opacity: 0.9 }}>{glyph}</Text>;
  };
}

export default function TabsLayout() {
  // Navy on a light tab bar, teal on a dark one — the navy would vanish
  // against it, and the teal is washed out on white.
  const dark = useColorScheme() === "dark";
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: dark ? "#14B8A6" : "#0F2D4A" }}>
      <Tabs.Screen name="index" options={{ title: "Map", tabBarIcon: icon("🗺️") }} />
      <Tabs.Screen name="places" options={{ title: "Places", tabBarIcon: icon("📍") }} />
      <Tabs.Screen name="trips" options={{ title: "Trips", tabBarIcon: icon("🧳") }} />
    </Tabs>
  );
}
