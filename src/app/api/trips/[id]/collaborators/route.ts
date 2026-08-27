import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorized } from "@/lib/api";
import { getCurrentUser } from "@/lib/user";
import { tripAccess } from "@/lib/trip-access";
import { collaboratorInviteSchema, firstIssue } from "@/lib/validation";
import { invitationEmail, sendMail } from "@/lib/mail";

function serialize(c: {
  email: string;
  role: string;
  acceptedAt: Date | null;
  user: { name: string | null; image: string | null } | null;
}) {
  return {
    email: c.email,
    role: c.role,
    accepted: c.acceptedAt !== null,
    name: c.user?.name ?? null,
    image: c.user?.image ?? null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const access = await tripAccess(id, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const collaborators = await prisma.tripCollaborator.findMany({
    where: { tripId: id },
    orderBy: { invitedAt: "asc" },
    include: { user: { select: { name: true, image: true } } },
  });

  return NextResponse.json({
    role: access.role,
    collaborators: collaborators.map(serialize),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const access = await tripAccess(id, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Only the owner decides who else gets in.
  if (access.role !== "owner") {
    return NextResponse.json({ error: "Only the trip owner can invite people" }, { status: 403 });
  }

  const parsed = collaboratorInviteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  }
  const { email } = parsed.data;

  if (email === user.email?.toLowerCase()) {
    return NextResponse.json({ error: "That's you — you already own this trip" }, { status: 400 });
  }

  // Invitations are addressed to an email, so someone who has not signed up
  // yet can still be invited; it binds to their account when they first open
  // the trip.
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  const collaborator = await prisma.tripCollaborator.upsert({
    where: { tripId_email: { tripId: id, email } },
    update: {},
    create: {
      tripId: id,
      email,
      userId: existingUser?.id ?? null,
      acceptedAt: existingUser ? new Date() : null,
    },
    include: { user: { select: { name: true, image: true } } },
  });

  // Told about it, if we can. Deliberately after the row exists and never
  // able to undo it: the collaborator record is what grants access, and the
  // email only says so. A provider having a bad afternoon should not cost
  // somebody their invitation.
  const trip = await prisma.trip.findUnique({
    where: { id },
    select: { title: true },
  });

  const origin = new URL(request.url).origin;
  const { subject, text, html } = invitationEmail({
    inviterName: user.name ?? user.email ?? "Someone",
    tripTitle: trip?.title ?? "a trip",
    url: `${origin}/trips/${id}`,
  });

  const delivery = await sendMail({ to: email, subject, text, html });

  return NextResponse.json(
    {
      collaborator: serialize(collaborator),
      // Reported so the interface can say "invited, but the email did not go"
      // rather than implying something arrived that did not.
      emailed: delivery.sent,
      emailError: delivery.sent ? null : delivery.reason,
    },
    { status: 201 },
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const access = await tripAccess(id, user);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "Which person?" }, { status: 400 });

  // The owner can remove anyone; an editor may only remove themselves.
  const removingSelf = email === user.email?.toLowerCase();
  if (access.role !== "owner" && !removingSelf) {
    return NextResponse.json({ error: "Only the trip owner can remove people" }, { status: 403 });
  }

  await prisma.tripCollaborator.deleteMany({ where: { tripId: id, email } });
  return NextResponse.json({ ok: true });
}
