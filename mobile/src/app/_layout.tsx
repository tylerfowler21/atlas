import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useColorScheme } from "react-native";
import { AuthProvider, useAuth } from "@/lib/auth";

SplashScreen.preventAutoHideAsync();

function Routes() {
  const { user } = useAuth();

  // Undefined means the keychain has not been read yet. Rendering nothing
  // holds the splash screen rather than showing a sign-in screen to somebody
  // who is already signed in and then yanking it away.
  if (user === undefined) return null;
  SplashScreen.hideAsync();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={user !== null}>
        <Stack.Screen name="(tabs)" />
        {/* The tabs draw their own chrome, so the stack hides its header by
            default. A screen pushed on top of them needs it back — without a
            header there is no back button, and a trip becomes somewhere you
            can get into and not out of. */}
        <Stack.Screen name="trip/[id]" options={{ headerShown: true }} />
      </Stack.Protected>
      <Stack.Protected guard={user === null}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <Routes />
      </AuthProvider>
    </ThemeProvider>
  );
}
