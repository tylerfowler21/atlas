import { prisma } from "@/lib/prisma";

/// Atlas currently runs as a single local user — there is no sign-in yet.
/// Every query still goes through this function and scopes by `id`, so
/// dropping in real sessions (and then trip sharing) means changing this
/// file rather than every route.
const LOCAL_USER = {
  email: "you@atlas.local",
  name: "You",
};

let cached: { id: string; name: string; email: string } | null = null;

export async function getCurrentUser() {
  if (cached) return cached;

  const user = await prisma.user.upsert({
    where: { email: LOCAL_USER.email },
    update: {},
    create: LOCAL_USER,
    select: { id: true, name: true, email: true },
  });

  cached = user;
  return user;
}
