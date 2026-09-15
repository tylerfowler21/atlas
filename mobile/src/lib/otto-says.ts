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

/// What Otto adds to each of the first steps.
///
/// The checklist already says what to do and has a line of hint under it. He
/// says the thing neither has room for: why it is worth doing, or the part
/// people get wrong. He only ever talks about the step somebody is actually on
/// — the first one not yet ticked — so the list teaches as it is worked
/// through rather than explaining five things at once to somebody who has done
/// none of them.
export const OTTO_STEPS: Record<string, { says: string; pose: string }> = {
  save: {
    says:
      "Start with somewhere you have actually been meaning to go. One real place is worth more than fifty added to fill the map up.",
    pose: "pointing",
  },
  been: {
    says:
      "Somewhere you have already been turns this from a wishlist into a record. The counts by city and country are built from these.",
    pose: "planning",
  },
  trip: {
    says:
      "A trip can be imaginary. Dates you might never use still make the days line up, and nothing about them is fixed.",
    pose: "planning",
  },
  stop: {
    says:
      "One thing on one day is already a plan. Times are optional — most days read better with three things and room between them than with nine.",
    pose: "typing",
  },
  share: {
    says:
      "Three different doors, and people reach for the wrong one. A link is read-only and needs no account. Publishing puts it on your profile. Inviting is the only one that lets somebody change it.",
    pose: "pointing",
  },
};
