import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SharedPlaces from "@/components/SharedPlaces";
import SignUpInvite from "@/components/SignUpInvite";
import { loadShare, countShareView } from "@/lib/place-shares";
import { resolvedCategories } from "@/lib/categories";
import { getCurrentUser } from "@/lib/user";
import { toPublicPlace } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const found = await loadShare(token);
  if (!found) return { title: "Not found" };

  const who = found.share.user.username
    ? `@${found.share.user.username}`
    : (found.share.user.name ?? "Someone");

  return {
    title: `${found.share.area} — ${who}'s places`,
    description:
      found.share.note ??
      `${found.places.length} places in ${found.share.area}, shared from Roava.`,
  };
}

export default async function SharedPlacesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const found = await loadShare(token);
  if (!found) notFound();

  const { share, places } = found;
  await countShareView(share.id);

  const viewer = await getCurrentUser();
  const author = share.user.username
    ? `@${share.user.username}`
    : (share.user.name ?? null);

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex min-h-full flex-col lg:h-full">
        <SharedPlaces
          area={share.area}
          note={share.note}
          author={author}
          places={places.map(toPublicPlace)}
          categories={await resolvedCategories(share.userId)}
        />

        {/* Somebody sent this to a friend who is going there, which makes it
            the same kind of introduction a shared itinerary is. */}
        {!viewer && <SignUpInvite author={author} returnTo={`/c/${token}`} />}
      </div>
    </div>
  );
}
