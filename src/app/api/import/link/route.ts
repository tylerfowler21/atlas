import { NextResponse } from "next/server";
import { z } from "zod";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { readLink, sourceOf } from "@/lib/social-links";
import { placesFromCaption, captionToText } from "@/lib/extract-places";
import { modelConfigured } from "@/lib/generate-trip";
import { firstIssue } from "@/lib/validation";

const bodySchema = z.object({
  url: z.string().trim().max(500).optional(),
  /// Pasted by hand when the platform will not part with it — which is every
  /// Instagram link, and any TikTok that has been taken down or rate-limited.
  caption: z.string().trim().max(4000).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  if (!modelConfigured) {
    return NextResponse.json(
      { error: "Reading links isn't set up on this deployment" },
      { status: 503 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const { url, caption: pasted } = parsed.data;
  if (!url && !pasted) {
    return NextResponse.json({ error: "Paste a link or a caption" }, { status: 400 });
  }

  let caption = pasted ?? null;
  let author: string | null = null;
  const source = url ? sourceOf(url) : "other";

  if (!caption && url) {
    const read = await readLink(url);
    caption = read.caption;
    author = read.author;
  }

  // Said plainly and separately from a failure, because the two need different
  // things from the person: one needs a retry, the other needs a paste.
  if (!caption) {
    return NextResponse.json({
      needsCaption: true,
      source,
      error:
        source === "instagram"
          ? "Instagram doesn't let anything read a post's caption without an account, so paste the caption here and it works the same."
          : "That link didn't give up its caption — it may be private or removed. Paste the caption here instead.",
    });
  }

  try {
    const found = await placesFromCaption(caption);
    return NextResponse.json({
      source,
      author,
      region: found.region,
      count: found.places.length,
      text: captionToText(found),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not read places out of that caption" },
      { status: 502 },
    );
  }
}
