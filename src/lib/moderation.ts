import { prisma } from "@/lib/prisma";

/// Blocking cuts both ways regardless of who did it: neither person sees the
/// other's profile or published trips. Checking both directions in one query
/// keeps that rule in one place rather than scattered across pages.
export async function isBlockedBetween(a: string | null, b: string) {
  if (!a || a === b) return false;

  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });

  return block !== null;
}

/// Everyone the viewer has blocked or been blocked by, for filtering lists.
export async function hiddenUserIds(viewerId: string) {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });

  const ids = new Set<string>();
  for (const b of blocks) {
    ids.add(b.blockerId === viewerId ? b.blockedId : b.blockerId);
  }
  return [...ids];
}
