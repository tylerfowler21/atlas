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
import { inspectAppleSecret } from "@/lib/apple-secret-inspect";

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

  // Check the credentials make sense before asking Apple, because Apple cannot
  // answer this question. It validates the authorization code first, so a
  // deliberately invalid code comes back "invalid_grant" even when the client
  // id is nonsense — which is exactly what happened here: AUTH_APPLE_ID had a
  // whole JWT pasted into it and this check still reported success.
  const facts = inspectAppleSecret();
  if (facts.looksWhitespaceDamaged) {
    return {
      ok: false,
      detail:
        "A value has leading or trailing whitespace. Delete it in the host's settings and add it again — do not edit it in place.",
    };
  }
  if (clientId.includes(".") === false || clientId.length > 100) {
    return {
      ok: false,
      detail: `AUTH_APPLE_ID does not look like a Services ID (${clientId.length} characters). It should be something like com.example.app.web — check nothing else was pasted into it.`,
    };
  }
  // A client secret is a compact JWS: three base64url segments, two dots, and
  // no whitespace anywhere. Anything else means something was pasted alongside
  // it — and trailing junk survives decoding, because the header and payload
  // still parse, so this has to be checked on the raw string.
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(clientSecret)) {
    const extra = clientSecret.replace(/^[A-Za-z0-9_.-]+/, "").trim().slice(0, 40);
    return {
      ok: false,
      detail: `AUTH_APPLE_SECRET is not a bare JWT — it has something else in it${
        extra ? `, starting "${extra}"` : ""
      }. Delete the variable in the host's settings and add just the token, from "eyJ" to the last character.`,
    };
  }
  if (!facts.subject) {
    return { ok: false, detail: "AUTH_APPLE_SECRET is not a readable JWT — it was probably truncated or has extra text pasted into it." };
  }
  if (!facts.subjectMatchesClientId) {
    return {
      ok: false,
      detail: `The secret was minted for "${facts.subject}" but AUTH_APPLE_ID is "${clientId}". Apple rejects the pair. Regenerate the secret for the right Services ID, or correct the id.`,
    };
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
