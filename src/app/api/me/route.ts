import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { firstIssue, profileSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const parsed = profileSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { username, bio } = parsed.data;

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
    },
    select: { username: true, bio: true },
  });

  return NextResponse.json({ profile: updated });
}
