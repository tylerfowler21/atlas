/// Reading a shared video link.
///
/// Somebody sends you a reel of six restaurants in Lisbon and you want the six
/// restaurants, not the video. What can actually be read differs sharply by
/// platform, and pretending otherwise would mean building on sand:
///
/// - TikTok publishes an oEmbed endpoint that needs no key and returns the
///   caption, which on a travel video is usually the list itself.
/// - Instagram's oEmbed without an app token does not fail loudly — it answers
///   200 with `html`, `provider_name`, `type`, `version` and `width`, and no
///   caption, no author, nothing. A placeholder embed for their own script to
///   fill in a browser. Scraping the page instead is against their terms and
///   breaks whenever they reshuffle their markup, so it is not attempted.
///
/// Anything unreadable falls back to asking for the caption, which the person
/// can copy from the app in two taps. That is a worse experience than magic
/// and a far better one than a spinner that never resolves.

export type LinkSource = "tiktok" | "instagram" | "other";

export function sourceOf(url: string): LinkSource {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host.endsWith("tiktok.com")) return "tiktok";
    if (host.endsWith("instagram.com") || host.endsWith("instagr.am")) return "instagram";
    return "other";
  } catch {
    return "other";
  }
}

/// The short links both apps hand you when you press Share, which is what
/// people actually paste. oEmbed wants the long one.
const SHORTENED = /^(vm|vt)\.tiktok\.com$/;

async function resolveShortLink(url: string): Promise<string> {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (!SHORTENED.test(host)) return url;
    // Followed rather than parsed: a share link is opaque and only the
    // redirect knows which video it means.
    const res = await fetch(url, { redirect: "follow", cache: "no-store" });
    return res.url || url;
  } catch {
    return url;
  }
}

export type LinkContent = {
  source: LinkSource;
  /// The caption, when the platform will part with it.
  caption: string | null;
  author: string | null;
};

/// What a link will tell us without an account, a key, or a scraper.
export async function readLink(url: string): Promise<LinkContent> {
  const source = sourceOf(url);

  if (source === "tiktok") {
    try {
      const full = await resolveShortLink(url);
      const res = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(full)}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const body = (await res.json()) as { title?: string; author_name?: string };
        return {
          source,
          caption: body.title?.trim() || null,
          author: body.author_name?.trim() || null,
        };
      }
    } catch {
      // A dead link and a rate limit look the same from here, and both end in
      // the same place: ask for the caption.
    }
  }

  return { source, caption: null, author: null };
}
