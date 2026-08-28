import { z } from "zod";
import { STATUS_IDS, TRAVEL_MODE_IDS } from "@/lib/taxonomy";
import { REPORT_REASON_IDS } from "@/lib/report-reasons";

/// A category id, which is either one of the built-in words or the cuid of one
/// somebody made. Which of those it is cannot be settled here — it depends on
/// who is asking — so the shape is checked here and the ownership by
/// `resolveCategory` in the route, where the user is known.
const categoryField = z.string().min(1).max(40);


const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

// Fields are declared once with NO defaults, because `.partial()` does not
// strip a `.default()` — a PATCH that omitted `status` would otherwise parse as
// "wishlist" and silently un-visit the place. Create schemas add the defaults
// back on top; update schemas take the bare fields.
/// A single emoji. Deliberately forgiving about length — flags, skin tones and
/// ZWJ sequences are several code points — but it must actually be pictographic
/// and must not be letters or digits, so a pin can never become text.
const emoji = z
  .string()
  .trim()
  .max(16, "That's too long for an emoji")
  // Flags are pairs of regional-indicator characters rather than pictographs,
  // and a travel app that rejects 🇨🇭 would be absurd.
  .refine(
    (v) => /[\p{Extended_Pictographic}\p{Regional_Indicator}]/u.test(v),
    "Pick an emoji",
  )
  .refine((v) => !/[\p{L}\p{N}]/u.test(v), "Emoji only, no letters or numbers")
  .nullable()
  .optional();

const placeFields = {
  name: trimmed(120).min(1, "Give the place a name"),
  category: categoryField,
  emoji,
  status: z.enum(STATUS_IDS),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  address: optionalText(300),
  city: optionalText(120),
  country: optionalText(120),
  countryCode: optionalText(8).transform((v) => v?.toLowerCase() ?? null),
  notes: optionalText(2000),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  website: optionalText(500),
  visitedAt: z.coerce.date().nullable().optional(),
  livedFrom: z.coerce.date().nullable().optional(),
  livedTo: z.coerce.date().nullable().optional(),
};

export const placeCreateSchema = z.object(placeFields).extend({
  category: categoryField.default("other"),
  status: z.enum(STATUS_IDS).default("wishlist"),
});

export const placeUpdateSchema = z.object(placeFields).partial();

const tripFields = {
  title: trimmed(120).min(1, "Give the trip a title"),
  destination: optionalText(160),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  notes: optionalText(2000),
  color: trimmed(9).regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex colour"),
};

export const tripCreateSchema = z.object(tripFields).extend({
  color: trimmed(9)
    .regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex colour")
    .default("#0F2D4A"),
});

export const tripUpdateSchema = z.object(tripFields).partial().extend({
  /// Publishing puts the trip on your public profile and in your followers'
  /// feeds. Stored as a timestamp, so it also orders the feed.
  published: z.boolean().optional(),
});

const itemFields = {
  title: trimmed(160).min(1, "Give the item a title"),
  emoji,
  /// "stop" for somewhere you were, "travel" for a journey between two places.
  kind: z.enum(["stop", "travel"]),
  toPlaceId: optionalText(40),
  mode: z.enum(TRAVEL_MODE_IDS).nullable().optional(),
  endTime: optionalText(5),
  placeId: optionalText(40),
  notes: optionalText(1000),
  dayIndex: z.number().int().min(0).max(365),
  startTime: optionalText(5),
  category: categoryField,
  position: z.number().int().min(0),
};

export const itemCreateSchema = z
  .object(itemFields)
  .omit({ position: true })
  .extend({
    dayIndex: z.number().int().min(0).max(365).default(0),
    category: categoryField.default("other"),
    // Everything created before travel legs existed is a stop, and so is
    // anything that does not say otherwise.
    kind: z.enum(["stop", "travel"]).default("stop"),
  });

export const itemUpdateSchema = z.object(itemFields).partial();

/// Turns a ZodError into the single short message the UI shows in a toast.
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/// One resolved line of a pasted itinerary. `place` is null when the entry is
/// something that isn't a location ("Train to Zermatt"), which still belongs on
/// the day but never gets a map pin.
const importEntrySchema = z.object({
  dayIndex: z.number().int().min(0).max(365),
  title: trimmed(160).min(1),
  startTime: optionalText(5),
  notes: optionalText(1000),
  category: categoryField.default("other"),
  place: z
    .object({
      name: trimmed(160).min(1),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      address: optionalText(300),
      city: optionalText(120),
      country: optionalText(120),
      countryCode: optionalText(8).transform((v) => v?.toLowerCase() ?? null),
    })
    .nullable()
    .optional(),
});

export const tripImportSchema = z.object({
  trip: tripCreateSchema,
  /// A trip you've already taken: every place it creates is marked visited.
  markVisited: z.boolean().default(true),
  entries: z.array(importEntrySchema).min(1, "Nothing to import").max(300),
});

export const collaboratorInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("That doesn't look like an email address"))
    .refine((v) => v.length <= 200, "That email is too long"),
});

/// Handles are lowercase, URL-safe and unmistakable in a path like /u/tyler.
/// The reserved list stops someone claiming a name that collides with a route.
const RESERVED_USERNAMES = new Set([
  "admin", "api", "roava", "atlas", "been", "feed", "help", "me", "new", "places",
  "settings", "signin", "signout", "s", "support", "trips", "u", "user", "users",
]);

export const profileSchema = z.object({
  /// Marks the welcome as done, whether it was completed or skipped.
  onboarded: z.boolean().optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/, "Use 3–30 letters, numbers or underscores")
    .refine((v) => !RESERVED_USERNAMES.has(v), "That name is reserved")
    .nullable()
    .optional(),
  bio: optionalText(280),
});

export const followSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Which person?"),
});


export const memoryCreateSchema = z.object({
  title: optionalText(160),
  // Optional so a photo with no words is still an entry — some things are
  // remembered by looking rather than reading.
  body: trimmed(20000),
  placeId: optionalText(40),
  tripId: optionalText(40),
  happenedOn: z.coerce.date().nullable().optional(),
});

export const memoryUpdateSchema = memoryCreateSchema.partial();

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASON_IDS),
  note: optionalText(1000),
  username: optionalText(40),
  tripId: optionalText(40),
});

export const blockSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Which person?"),
});
