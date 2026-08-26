import { Tabs } from "expo-router";
import { MapIcon, PlacesIcon, TripsIcon } from "@/components/nav-icons";
import { usePalette } from "@/lib/use-palette";

export default function TabsLayout() {
  const palette = usePalette();

  return (
    <Tabs
      screenOptions={{
        // Deep Ocean is the navigation colour in light, sea glass in dark —
        // the teal is a call-to-action colour and too pale to mark a tab.
        tabBarActiveTintColor: palette.accentText,
        tabBarInactiveTintColor: palette.muted,
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.border,
        },
        headerStyle: { backgroundColor: palette.surface },
        headerTitleStyle: { color: palette.ink },
        headerTintColor: palette.ink,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Map",
          // The icon takes the tab's own colour, so it tints along with the
          // label instead of staying the same picture whether active or not.
          tabBarIcon: ({ color }) => <MapIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="places"
        options={{
          title: "Places",
          tabBarIcon: ({ color }) => <PlacesIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ color }) => <TripsIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
