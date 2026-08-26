import { NextResponse } from "next/server";
import {
  issueNativeToken,
  userForAppleIdentity,
  verifyAppleIdentityToken,
} from "@/lib/native-auth";

/// Exchanges an Apple identity token from the iOS app for one of ours.
///
/// Apple hands the device a signed token; we verify it against Apple's keys
/// rather than trusting the app, because anything can POST here. `fullName`
/// is only ever sent on somebody's first sign-in — Apple does not give it out
/// again — and is ignored for accounts that already exist.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const { identityToken, fullName } = (body ?? {}) as {
    identityToken?: unknown;
    fullName?: unknown;
  };

  if (typeof identityToken !== "string" || !identityToken) {
    return NextResponse.json({ error: "Missing identityToken" }, { status: 400 });
  }

  const identity = await verifyAppleIdentityToken(identityToken);
  if (!identity) {
    return NextResponse.json({ error: "That sign-in didn't verify" }, { status: 401 });
  }

  const user = await userForAppleIdentity(
    identity,
    typeof fullName === "string" && fullName.trim() ? fullName.trim() : null,
  );

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
