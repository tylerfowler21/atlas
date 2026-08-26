/// Sign in with Apple on the device, exchanged for the app's own token.
import * as AppleAuthentication from "expo-apple-authentication";
import { createContext, use, useCallback, useEffect, useState } from "react";
import { API_URL, clearToken, storeToken, storedToken } from "@/lib/api";

export type Me = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  onboarded: boolean;
};

type AuthState = {
  /// Undefined while the keychain is still being read, so the UI can wait
  /// rather than flashing the sign-in screen at somebody already signed in.
  user: Me | null | undefined;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const value = use(AuthContext);
  if (!value) throw new Error("useAuth used outside AuthProvider");
  return value;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await storedToken();
      if (cancelled) return;
      if (!token) {
        setUser(null);
        return;
      }
      // A stored token proves nothing on its own — it may have expired, or the
      // account may have been deleted from the website since.
      try {
        const me = await fetch(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (me.ok) {
          const body = await me.json();
          setUser(body.user ?? null);
        } else {
          await clearToken();
          setUser(null);
        }
      } catch {
        if (!cancelled) setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    // Checked before Apple is invoked: otherwise someone completes Face ID,
    // waits, and gets a generic failure — when the app simply had nowhere to
    // send the result.
    if (!API_URL) {
      throw new Error(
        "This build has no API address (EXPO_PUBLIC_API_URL). Under `expo start` it comes from mobile/.env.",
      );
    }

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) throw new Error("Apple returned no identity token");

    // Apple gives the name exactly once, on first consent, and never again —
    // so it has to be forwarded now or it is lost for good.
    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(" ");

    const response = await fetch(`${API_URL}/api/auth/native`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identityToken: credential.identityToken,
        fullName: fullName || undefined,
      }),
    });
    if (!response.ok) throw new Error("That sign-in didn't go through");

    const body = await response.json();
    await storeToken(body.token);
    setUser(body.user);
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext value={{ user, signIn, signOut }}>{children}</AuthContext>
  );
}
