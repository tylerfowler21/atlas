/// Which stops need booking, and which are booked.
///
/// This started as a column in a spreadsheet — Yes / No / N/A against each row
/// of the agenda — and the useful part of that column was never the "N/A".
/// Most of a trip needs no booking at all, so the third state here is simply
/// the absence of the other two: nothing is a booking until somebody says it
/// is, and the tab stays short enough to read before a flight.
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
