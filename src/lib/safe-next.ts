/// Where to send somebody after they sign in, when the address said so.
///
/// A sign-in link that carries a destination is also an open redirect waiting
/// to happen: "?next=https://evil.example" sends people off our domain from a
/// link that looks like ours, which is how phishing gets its credibility.
///
/// So only same-site paths survive. It must start with a single slash — "//"
/// and "/\" are protocol-relative and go to another host — and must not carry
/// a scheme. Anything else falls back to the map.
export function safeNext(next: string | null | undefined, fallback = "/") {
  if (!next) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // A backslash after the first character can still be re-read as a separator
  // by some parsers, and no address of ours contains one.
  if (next.includes("\\")) return fallback;
  return next;
}
