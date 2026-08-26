import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import Link from "next/link";
import ProfileSettings from "@/components/ProfileSettings";
import DeleteAccount from "@/components/DeleteAccount";

export const metadata: Metadata = { title: "Profile — Roava" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      username: true,
      bio: true,
      email: true,
      _count: {
        select: { followers: true, following: true, trips: true, places: true, memories: true },
      },
    },
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-xl font-semibold">Your profile</h1>
      <p className="mt-1 text-sm text-muted">
        Everything stays private until you publish a trip. A profile only ever
        shows trips you&apos;ve chosen to publish.
      </p>

      <div className="mt-6">
        <ProfileSettings initialUsername={me.username} initialBio={me.bio} />
      </div>

      <div className="mt-8 flex gap-6 border-t border-line pt-4 text-sm">
        <span>
          <span className="font-semibold tabular-nums">{me._count.followers}</span>{" "}
          <span className="text-muted">followers</span>
        </span>
        <span>
          <span className="font-semibold tabular-nums">{me._count.following}</span>{" "}
          <span className="text-muted">following</span>
        </span>
        <span>
          <span className="font-semibold tabular-nums">{me._count.trips}</span>{" "}
          <span className="text-muted">trips</span>
        </span>
      </div>

      <div className="mt-8 space-y-3 border-t border-line pt-4">
        <Link href="/privacy" className="block text-xs text-accent-text hover:underline">
          What Roava stores and who can see it →
        </Link>
        <DeleteAccount
          username={me.username}
          email={me.email}
          counts={{
            places: me._count.places,
            trips: me._count.trips,
            memories: me._count.memories,
          }}
        />
      </div>
    </div>
  );
}