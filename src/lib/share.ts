import { randomBytes } from "node:crypto";

/// Share tokens are the whole credential for a shared itinerary, so they are
/// generated from the CSPRNG rather than from anything guessable like an id or
/// a timestamp. 24 bytes of entropy, base64url so it drops straight into a URL.
export function newShareToken() {
  return randomBytes(24).toString("base64url");
}
