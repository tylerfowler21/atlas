/// The headers a private image needs to load.
///
/// Anything served from /api is authenticated by a bearer token, but an
/// <Image source={{ uri }}> sends nothing of the sort — it makes its own bare
/// request, gets a 401 and renders an empty box. That is what journal photos
/// have been doing in the app.
import { useEffect, useState } from "react";
import { storedToken } from "@/lib/api";

export function useAuthHeaders(): Record<string, string> | undefined {
  const [headers, setHeaders] = useState<Record<string, string> | undefined>();

  useEffect(() => {
    let alive = true;
    void storedToken().then((token) => {
      if (alive && token) setHeaders({ Authorization: `Bearer ${token}` });
    });
    return () => {
      alive = false;
    };
  }, []);

  return headers;
}
