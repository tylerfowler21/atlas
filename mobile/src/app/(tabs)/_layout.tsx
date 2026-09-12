import { Tabs } from "expo-router";
import {
  JournalIcon,
  MapIcon,
  DiscoverIcon,
  TripsIcon,
  YourProfileIcon,
} from "@/components/nav-icons";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Glass from "@/components/Glass";
import { TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from "@/lib/layout";
import { usePalette } from "@/lib/use-palette";

/// Five destinations, down from eight, and nothing hidden behind "More".
///
/// Feed and People became one: People exists mostly to fill the Feed, since
/// following someone is what gives the Feed anything to show.
///
/// Been went first: its list was the places list filtered, and its counts
/// describe that list rather than needing a screen. Places followed, because
/// once the map had the same status filters, a separate tab was the same
/// places under the same filters without the map behind them. Both now live on
/// Map — the list pulls up over it, which is what the website does at this
/// width.
export default function TabsLayout() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: palette.accentText,
        tabBarInactiveTintColor: palette.muted,
        /// A floating pill rather than a strip across the foot, which is what
        /// the kit draws and what gives the glass something to work with.
        /// Transparent here because the glass underneath is the background.
        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: insets.bottom + TAB_BAR_MARGIN,
          height: TAB_BAR_HEIGHT,
          paddingBottom: 0,
          borderRadius: TAB_BAR_HEIGHT / 2,
          borderTopWidth: 0,
          backgroundColor: "transparent",
          elevation: 0,
        },
        tabBarBackground: () => (
          <Glass radius={TAB_BAR_HEIGHT / 2} style={StyleSheet.absoluteFill} />
        ),
        headerStyle: { backgroundColor: palette.surface },
        headerTitleStyle: { color: palette.ink },
        headerTintColor: palette.ink,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Map", tabBarIcon: ({ color }) => <MapIcon color={color} /> }}
      />
      <Tabs.Screen
        name="trips"
        options={{ title: "Trips", tabBarIcon: ({ color }) => <TripsIcon color={color} /> }}
      />
      <Tabs.Screen
        name="journal"
        options={{ title: "Journal", tabBarIcon: ({ color }) => <JournalIcon color={color} /> }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: "Discover", tabBarIcon: ({ color }) => <DiscoverIcon color={color} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: "You", tabBarIcon: ({ color }) => <YourProfileIcon color={color} /> }}
      />
    </Tabs>
  );
}
