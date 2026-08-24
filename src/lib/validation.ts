import { z } from "zod";
import { CATEGORY_IDS, STATUS_IDS } from "@/lib/taxonomy";

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const placeCreateSchema = z.object({
  name: trimmed(120).min(1, "Give the place a name"),
  category: z.enum(CATEGORY_IDS).default("other"),
  status: z.enum(STATUS_IDS).default("wishlist"),
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
});

export const placeUpdateSchema = placeCreateSchema.partial();

export const tripCreateSchema = z.object({
  title: trimmed(120).min(1, "Give the trip a title"),
  destination: optionalText(160),
  startDate: z.coerce.date().nullable().optional(),
  endDate: z.coerce.date().nullable().optional(),
  notes: optionalText(2000),
  color: trimmed(9).regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex colour").default("#2563eb"),
});

export const tripUpdateSchema = tripCreateSchema.partial();

export const itemCreateSchema = z.object({
  title: trimmed(160).min(1, "Give the item a title"),
  placeId: optionalText(40),
  notes: optionalText(1000),
  dayIndex: z.number().int().min(0).max(365).default(0),
  startTime: optionalText(5),
  category: z.enum(CATEGORY_IDS).default("other"),
});

export const itemUpdateSchema = itemCreateSchema.partial().extend({
  position: z.number().int().min(0).optional(),
});

/// Turns a ZodError into the single short message the UI shows in a toast.
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
