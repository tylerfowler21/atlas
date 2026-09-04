"use client";

import { BOOKING_BOOKED, outstanding, tracked } from "@/lib/bookings";
import { dateForDay, formatDay } from "@/lib/trips";
import type { ItineraryItemDTO, TripDTO } from "@/lib/types";

/// Everything on the trip that has to be booked, in one list.
///
/// A trip's bookings are scattered across its days, which is the wrong shape
/// for the question people actually ask — "what have I still not booked?" —
/// because answering it means opening every day in turn. So the list is
/// gathered here, ordered by day, with the outstanding ones first: a booking
/// deadline is the one thing on a trip that can pass while you are looking at
/// something else.
export default function TripBookings({
  trip,
  items,
  onToggle,
  onRef,
  onOpen,
}: {
  trip: TripDTO;
  items: ItineraryItemDTO[];
  onToggle: (item: ItineraryItemDTO) => void;
  onRef: (item: ItineraryItemDTO, ref: string | null) => void;
  onOpen: (item: ItineraryItemDTO) => void;
}) {
  const all = tracked(items).sort(
    (a, b) => a.dayIndex - b.dayIndex || a.position - b.position,
  );
  const todo = outstanding(all);
  const done = all.filter((i) => i.booking === BOOKING_BOOKED);

  if (all.length === 0) {
    return (
      <div>
        <h2 className="text-sm font-semibold">Bookings</h2>
        <p className="mt-2 text-xs text-muted">
          Nothing on this trip is marked as needing a booking yet. Open a stop
          and tick <span className="font-medium">Needs booking</span> — the
          restaurant that takes reservations, the cable car, the tour that sells
          out — and it will collect here.
        </p>
      </div>
    );
  }

  function row(item: ItineraryItemDTO) {
    const date = dateForDay(trip, item.dayIndex);
    const isBooked = item.booking === BOOKING_BOOKED;
    return (
      <li key={item.id} className="rounded-lg border border-line p-2">
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-current"
            checked={isBooked}
            aria-label={`${item.title} is booked`}
            onChange={() => onToggle(item)}
          />
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className="block w-full text-left"
              onClick={() => onOpen(item)}
            >
              <p className={`truncate text-sm ${isBooked ? "text-muted line-through" : "font-medium"}`}>
                {item.title}
              </p>
              <p className="truncate text-xs text-muted">
                Day {item.dayIndex + 1}
                {date ? ` · ${formatDay(date, { year: undefined })}` : ""}
                {item.startTime ? ` · ${item.startTime}` : ""}
                {item.place?.city ? ` · ${item.place.city}` : ""}
              </p>
            </button>
            {isBooked && (
              <input
                // Saved on blur rather than per keystroke, and keyed so it
                // resets when a different booking takes this row.
                key={`ref-${item.id}`}
                className="input mt-1.5 text-xs"
                aria-label={`Confirmation for ${item.title}`}
                placeholder="Confirmation number, reference…"
                defaultValue={item.bookingRef ?? ""}
                onBlur={(e) => {
                  const next = e.target.value.trim() || null;
                  if (next !== item.bookingRef) onRef(item, next);
                }}
              />
            )}
            {!isBooked && item.notes && (
              <p className="mt-1 truncate text-xs text-muted">{item.notes}</p>
            )}
          </div>
        </div>
      </li>
    );
  }

  return (
    <div>
      <h2 className="text-sm font-semibold">
        Bookings
        <span className="ml-2 text-xs font-normal text-muted">
          {todo.length === 0
            ? "all booked"
            : `${todo.length} still to book`}
        </span>
      </h2>

      {todo.length > 0 && <ul className="mt-2 space-y-2">{todo.map(row)}</ul>}

      {done.length > 0 && (
        <>
          <p className="mt-4 text-xs font-medium text-muted">Booked</p>
          <ul className="mt-1.5 space-y-2">{done.map(row)}</ul>
        </>
      )}
    </div>
  );
}
