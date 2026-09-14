/// Mirrored from the website's src/lib/otto-says.ts — edit that copy and run
/// `npm run sync:mirror`.
export type OttoTip = {
  /// A line of his, in his voice: plain, specific, no exclamation marks. The
  /// screen usually has a heading already, so this is what somebody would ask
  /// next rather than a title.
  says: string;
  /// The one thing worth doing here, if there is one. Shown as a link; the
  /// app maps the href to its own route the way it already does for the first
  /// steps.
  go?: { label: string; href: string };
  /// A second line, for the thing people get wrong rather than the thing they
  /// do first. Left out more often than not.
  then?: string;
};

export const OTTO_SAYS = {
  /// The first screen of an empty account. What Roava is, in two sentences,
  /// from somebody standing in it.
  firstRun: {
    says:
      "Everywhere you have been and everywhere you want to go, on one map. Save a place when you hear about it, and it is waiting when you plan the trip.",
    then: "Nothing is public unless you publish it.",
    go: { label: "Save your first place", href: "/places" },
  },

  /// The trips list, before there are any.
  noTrips: {
    says:
      "A trip is a few days with places on them. Build one from what you have already saved, or paste an itinerary you took years ago and every stop gets found and pinned.",
    go: { label: "Start a trip", href: "/import" },
  },

  /// A trip that exists but has nothing in it yet.
  emptyTrip: {
    says:
      "Empty so far. Add the places you already know about — where you are staying, anything booked — and the days will start to shape themselves around them.",
    then: "Days are only days. Nothing has to have a time on it.",
  },

  /// The map, before anything is on it.
  noPlaces: {
    says:
      "Nothing saved yet. Search for somewhere, or press the map where you are, and it goes on as a place you want to go.",
    then: "Somewhere you have already been is a place too — mark it visited and it joins the map behind you.",
  },

  /// The journal.
  emptyJournal: {
    says:
      "What a place was actually like, written down while you remember. Journal entries stay private — publishing a trip never publishes them.",
  },

  /// Sharing, which is the thing most often misunderstood: three different
  /// doors, and people reach for the wrong one.
  sharing: {
    says:
      "Three ways out, and they are not the same. A share link makes one trip readable by anyone holding it. Publishing puts it on your profile. Inviting somebody lets them edit it.",
    then: "Only inviting gives anybody your account. The other two are read-only.",
  },
} as const satisfies Record<string, OttoTip>;

export type OttoTopic = keyof typeof OTTO_SAYS;
