import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { tripAccess } from "@/lib/trip-access";
import { firstIssue, resourceUpdateSchema } from "@/lib/validation";
import type { CurrentUser } from "@/lib/user";

/// A resource is editable by anyone who can edit the trip it hangs off.
async function loadEditable(id: string, user: CurrentUser) {
  const resource = await prisma.tripResource.findUnique({ where: { id } });
  if (!resource) return null;
  return (await tripAccess(resource.tripId, user)) ? resource : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  if (!(await loadEditable(id, user))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = resourceUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }

  const resource = await prisma.tripResource.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ resource });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  if (!(await loadEditable(id, user))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.tripResource.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
