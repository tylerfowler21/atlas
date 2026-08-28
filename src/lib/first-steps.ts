import { prisma } from "@/lib/prisma";
import { BEEN_STATUSES } from "@/lib/taxonomy";

/// The short list of things that turn an empty account into a useful one.
///
/// Counted from what exists rather than ticked off as you go. A stored flag can
/// disagree with reality — a place deleted after the box was ticked, a write
/// that half-failed — and a checklist that lies about your own data is worse
/// than no checklist. This way it is always describing the account it is
/// attached to, and it completes itself when you do the thing anywhere: in the
/// app, on the website, or by importing a trip you took years ago.

export type Step = {
  id: string;
  label: string;
  /// What to do, in the imperative, short enough to read at a glance.
  hint: string;
  done: boolean;
  /// Where the thing is done. The app maps these to its own routes.
  href: string;
};

export type FirstSteps = {
  steps: Step[];
  done: number;
  total: number;
  /// True once every step is done, or once somebody has put the list away.
  hidden: boolean;
};

export async function firstSteps(userId: string): Promise<FirstSteps> {
  const [saved, been, trips, stops, shared, published, user] = await Promise.all([
    prisma.place.count({ where: { userId } }),
    prisma.place.count({ where: { userId, status: { in: [...BEEN_STATUSES] } } }),
    prisma.trip.count({ where: { userId } }),
    prisma.itineraryItem.count({ where: { trip: { userId } } }),
    prisma.tripShare.count({ where: { trip: { userId } } }),
    prisma.trip.count({ where: { userId, publishedAt: { not: null } } }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { stepsHiddenAt: true },
    }),
  ]);

  const steps: Step[] = [
    {
      id: "save",
      label: "Save somewhere you want to go",
      hint: "Search for it and drop it on your map.",
      done: saved > 0,
      href: "/",
    },
    {
      id: "been",
      label: "Mark somewhere you've been",
      hint: "Your map fills up from these, counted by city and country.",
      done: been > 0,
      href: "/?status=visited",
    },
    {
      id: "trip",
      label: "Start a trip",
      hint: "Give it a name and some dates — real or imagined.",
      done: trips > 0,
      href: "/trips",
    },
    {
      id: "stop",
      label: "Add a stop to a day",
      hint: "This is where a trip turns into a plan you can follow.",
      done: stops > 0,
      href: "/trips",
    },
    {
      id: "share",
      label: "Share a trip",
      hint: "A private link, or publish it to your profile.",
      done: shared + published > 0,
      href: "/trips",
    },
  ];

  const done = steps.filter((s) => s.done).length;

  return {
    steps,
    done,
    total: steps.length,
    // Finishing is its own dismissal — a list of ticks is clutter.
    hidden: Boolean(user.stepsHiddenAt) || done === steps.length,
  };
}
