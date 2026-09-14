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
      "Nothing on the map yet. The quickest start is a list you already have — a note full of places, a spreadsheet, a document — and every one gets found and pinned for you.",
    then: "Anywhere you have already been counts too — mark it visited and it joins the map behind you.",
  },

  /// The journal.
  ///
  /// The `then` is not optional here, whatever the shape of the others. An
  /// entry hangs off a place rather than being written from this page, so a
  /// screen that says only what a journal is for is a dead end — which is the
  /// one thing he exists to stop.
  emptyJournal: {
    says:
      "What a place was actually like, written down while you remember. Entries stay private — publishing a trip never publishes them.",
    then:
      "They hang off a place rather than starting here: open one on the map and choose Memories & journal.",
    go: { label: "Open the map", href: "/" },
  },

  /// The feed, before anybody is followed.
  noFollowing: {
    says:
      "Nobody followed yet. Following somebody puts the trips they publish here — their itineraries, not their map.",
    then: "What you publish shows up in theirs the same way. Nothing else of yours does.",
    go: { label: "Find people", href: "/discover?view=people" },
  },
} as const satisfies Record<string, OttoTip>;

export type OttoTopic = keyof typeof OTTO_SAYS;
