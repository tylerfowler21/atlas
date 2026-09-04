/// Mirrored from the website's src/lib/bookings.ts — edit that copy and run
/// `npm run sync-mirror`. Both clients have to agree about what "booked" means,
/// since the same trip is read on a laptop and ticked off on a phone.
export const BOOKING_NEEDED = "needed";
export const BOOKING_BOOKED = "booked";

export type BookingState = typeof BOOKING_NEEDED | typeof BOOKING_BOOKED;

export const BOOKING_STATES = [BOOKING_NEEDED, BOOKING_BOOKED] as [BookingState, ...BookingState[]];

export function isBookingState(value: unknown): value is BookingState {
  return value === BOOKING_NEEDED || value === BOOKING_BOOKED;
}

type Bookable = { booking?: string | null };

export function tracked<T extends Bookable>(items: T[]): T[] {
  return items.filter((i) => isBookingState(i.booking));
}

export function booked<T extends Bookable>(items: T[]): T[] {
  return items.filter((i) => i.booking === BOOKING_BOOKED);
}

/// Still to do. This is the number worth putting on the tab: a bookings list
/// is only ever consulted to find out what is still outstanding.
export function outstanding<T extends Bookable>(items: T[]): T[] {
  return items.filter((i) => i.booking === BOOKING_NEEDED);
}

/// What the toggle does next. Marking something booked and unmarking it are
/// the same gesture, because the mistake — ticking the wrong row — needs to be
/// as cheap to undo as it was to make.
export function nextState(current: string | null | undefined): BookingState | null {
  if (current === BOOKING_NEEDED) return BOOKING_BOOKED;
  if (current === BOOKING_BOOKED) return BOOKING_NEEDED;
  return BOOKING_NEEDED;
}
