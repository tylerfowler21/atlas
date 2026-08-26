import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/// A GET with the three states every screen here needs to show: loading, an
/// error worth putting on screen, and the data. Signing out on a 401 matters
/// because the alternative is a screen that just fails forever after the
/// account is deleted or the token lapses.
export function useApi<T>(path: string) {
  const { signOut } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /// Bumped to ask for a refetch. A counter rather than a boolean so two pulls
  /// in quick succession are two fetches, not one.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Guards against a response landing after the screen is gone, or after a
    // newer request for a different path has already been answered.
    let cancelled = false;

    (async () => {
      try {
        const result = await api<T>(path);
        if (cancelled) return;
        setData(result);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.isSignedOut) {
          await signOut();
          return;
        }
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [path, attempt, signOut]);

  /// Pull to refresh. Only ever called from a gesture, so showing the spinner
  /// straight away is safe.
  const reload = useCallback(() => {
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  return { data, error, loading, reload };
}
