import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { firstIssue, profileSchema } from "@/lib/validation";
import { removePhoto } from "@/lib/photos";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = profileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { username, bio, onboarded } = parsed.data;

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
      ...(onboarded ? { onboardedAt: new Date() } : {}),
    },
    select: { username: true, bio: true, onboardedAt: true },
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
