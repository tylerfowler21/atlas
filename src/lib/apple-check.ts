/// Asks Apple whether this deployment's Sign in with Apple credentials work.
///
/// "There is a problem with the server configuration" after a successful Apple
/// prompt almost always means the client secret the *server* holds is not the
/// one that was generated — truncated on paste, or from the wrong key. That is
/// invisible from the outside and indistinguishable from every other cause, so
/// this asks Apple directly.
///
/// The trick is that a deliberately invalid authorization code still exercises
/// client authentication: Apple checks who is asking before it checks what
/// they asked for. "invalid_grant" therefore means the credentials were
/// accepted, and "invalid_client" means they were not.
export type AppleCheck =
  | { ok: true; detail: string }
  | { ok: false; detail: string };

export async function checkAppleCredentials(
  redirectUri: string,
): Promise<AppleCheck> {
  const clientId = process.env.AUTH_APPLE_ID;
  const clientSecret = process.env.AUTH_APPLE_SECRET;
  if (!clientId || !clientSecret) {
    return { ok: false, detail: "AUTH_APPLE_ID or AUTH_APPLE_SECRET is not set" };
  }

  let response: Response;
  try {
    response = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code: "credential-check-not-a-real-code",
        redirect_uri: redirectUri,
      }),
    });
  } catch {
    return { ok: false, detail: "Could not reach appleid.apple.com" };
  }

  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    error_description?: string;
  };

  if (body.error === "invalid_grant") {
    return {
      ok: true,
      detail:
        "Apple accepted these credentials — only the test code was rejected, which is expected.",
    };
  }
  if (body.error === "invalid_client") {
    return {
      ok: false,
      detail:
        "Apple rejected the client secret. It is usually truncated on paste, or signed with the wrong key. Regenerate with npm run apple:secret and replace AUTH_APPLE_SECRET — delete the variable and add it again rather than editing it.",
    };
  }
  return {
    ok: false,
    detail: `Unexpected reply from Apple: ${body.error ?? response.status}${
      body.error_description ? ` — ${body.error_description}` : ""
    }`,
  };
}
