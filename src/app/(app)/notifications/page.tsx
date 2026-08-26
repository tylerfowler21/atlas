import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/user";

export const metadata: Metadata = { title: "Notifications — Roava" };
export const dynamic = "force-dynamic";

function ago(date: Date) {
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default async function NotificationsPage() {
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { actor: { select: { name: true, username: true, image: true } } },
  });

  // Opening the list is what reading it means.
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold">Notifications</h1>
      <p className="mt-1 text-sm text-muted">
        When someone follows you or copies one of your trips. Nothing is emailed
        — this is the only place it shows.
      </p>

      {notifications.length === 0 ? (
        <p className="mt-8 text-sm text-muted">
          Nothing yet. Pick a username at{" "}
          <Link href="/settings" className="text-accent underline">
            your profile
          </Link>{" "}
          so people can find and follow you.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {notifications.map((n) => {
            const who = n.actor?.name ?? (n.actor?.username ? `@${n.actor.username}` : "Someone");
            return (
              <li
                key={n.id}
                className={`card flex items-center gap-3 px-4 py-3 ${
                  n.readAt ? "" : "border-accent/40 bg-accent/5"
                }`}
              >
                <span aria-hidden className="text-lg">
                  {n.kind === "follow" ? "👤" : "📋"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {n.actor?.username ? (
                      <Link href={`/u/${n.actor.username}`} className="font-medium hover:underline">
                        {who}
                      </Link>
                    ) : (
                      <span className="font-medium">{who}</span>
                    )}{" "}
                    {n.kind === "follow" ? (
                      "started following you"
                    ) : (
                      <>
                        copied{" "}
                        <span className="font-medium">{n.tripTitle ?? "one of your trips"}</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted">{ago(n.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
