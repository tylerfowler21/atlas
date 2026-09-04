import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issueNativeToken, redeemNativeAuthCode } from "@/lib/native-auth";

/// Trades the one-time code from the URL scheme for a real token, over HTTPS.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const { code, state } = (body ?? {}) as { code?: unknown; state?: unknown };
  if (typeof code !== "string" || typeof state !== "string" || !code || !state) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const userId = await redeemNativeAuthCode(code, state);
  if (!userId) {
    // Used, expired, or never existed — all the same thing to whoever asked.
    return NextResponse.json({ error: "That sign-in has expired" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true, image: true, onboardedAt: true },
  });
  if (!user) {
    return NextResponse.json({ error: "That account is gone" }, { status: 401 });
  }

  return NextResponse.json({
    token: await issueNativeToken(user.id),
    user: {
      id: user.id,
      name: user.name,
      username: user.username,
      image: user.image,
      onboarded: Boolean(user.onboardedAt),
    },
  });
}
