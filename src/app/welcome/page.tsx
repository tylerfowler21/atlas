import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";
import Welcome from "@/components/Welcome";

export const metadata: Metadata = { title: "Welcome to Roava" };
export const dynamic = "force-dynamic";

/// Turns a name or email into a plausible free handle, so the field starts
/// filled in rather than as a blank someone has to invent an answer for.
async function suggestUsername(name: string | null, email: string | null) {
  const base =
    (name ?? email?.split("@")[0] ?? "traveller")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 20) || "traveller";

  for (const candidate of [base, `${base}1`, `${base}2`, `${base}_`]) {
    if (candidate.length < 3) continue;
    const taken = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return "";
}

/// Sits outside the (app) group deliberately: that layout is what redirects
/// people here, so this page must not be inside it.
export default async function WelcomePage() {
  const user = await requireUser();
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { username: true, name: true, onboardedAt: true },
  });

  // Someone who has already been through it and comes back by hand.
  if (me.onboardedAt) redirect("/");

  const suggestion = me.username ?? (await suggestUsername(me.name, user.email));

  return (
    <Welcome
      initialUsername={me.username}
      suggestion={suggestion}
      name={me.name}
    />
  );
}
