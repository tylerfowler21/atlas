import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { ottoOffered } from "@/lib/admin";
import { firstIssue, profileSchema } from "@/lib/validation";
import { removePhoto } from "@/lib/photos";

/// Who the caller is. The iOS app calls this on launch to find out whether the
/// token in its keychain still means anything — it may have expired, or the
/// account may have been deleted from the website since.
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: current.id },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      /// Their own address, back to them. The app needs it to take itself off
      /// a trip somebody else owns: a collaborator is recorded by the address
      /// they were invited at, and leaving is removing that row.
      email: true,
      onboardedAt: true,
    },
  });
  if (!user) return unauthorized();

  const { onboardedAt, ...rest } = user;
  return NextResponse.json({
    user: {
      ...rest,
      onboarded: Boolean(onboardedAt),
      /// Whether Otto's paid half is switched on for this account, so the app
      /// knows whether to offer it at all. The website decides this per render
      /// on the server; the app has no equivalent, and the alternative is a
      /// button that appears and then vanishes when the route answers 404.
      otto: ottoOffered(current),
    },
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = profileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { username, bio, homeCity, wantsToGo, travelStyle, onboarded } = parsed.data;

  if (username) {
    const taken = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (taken && taken.id !== user.id) {
      return NextResponse.json({ error: "That username is taken" }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(username !== undefined ? { username } : {}),
      ...(bio !== undefined ? { bio } : {}),
      ...(homeCity !== undefined ? { homeCity } : {}),
      ...(wantsToGo !== undefined ? { wantsToGo } : {}),
      ...(travelStyle !== undefined ? { travelStyle } : {}),
      ...(onboarded ? { onboardedAt: new Date() } : {}),
    },
    select: {
      username: true,
      bio: true,
      homeCity: true,
      wantsToGo: true,
      travelStyle: true,
      onboardedAt: true,
    },
  });

  return NextResponse.json({ profile: updated });
}

/// Deleting an account, for real.
///
/// Every table hangs off User with onDelete: Cascade, so the rows go on their
/// own — but photo files live in blob storage and would survive, which is not
/// what "delete my account" means to the person asking. They are removed
/// first, then the row, so a failure part way through leaves an account that
/// can be deleted again rather than an orphaned pile of files.
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const photos = await prisma.photo.findMany({
    where: { userId: user.id },
    select: { pathname: true },
  });

  await Promise.all(photos.map((p) => removePhoto(p.pathname)));
  await prisma.user.delete({ where: { id: user.id } });

  return NextResponse.json({ deleted: true });
}
