import { useState, useEffect, useMemo } from 'react';
import { getHotelRoomTypes, getRoomAvailability } from '../api/services/accommodationInventoryService';

// Room types with rooms actually held at this hotel for this event. Falls back to
// `fallback` (the global room-type lookup) when the hotel is unmanaged — no
// contract blocks means nothing to narrow to, and an empty dropdown would read as
// "this hotel has no room types".
export function useHotelRoomTypes({ eventId, hotelId, fallback = [] }) {
  const [held, setHeld] = useState(null);

  useEffect(() => {
    if (!eventId || !hotelId) { setHeld(null); return undefined; }

    let cancelled = false;
    getHotelRoomTypes(eventId, hotelId)
      .then((rows) => { if (!cancelled) setHeld(rows?.length ? rows : null); })
      .catch(() => { if (!cancelled) setHeld(null); });

    return () => { cancelled = true; };
  }, [eventId, hotelId]);

  return held ?? fallback;
}

// Per-night availability for one hotel + room type.
//
// Returns { managed, nights, fullDates, window, availableOn }:
//   managed     — false when the event holds no rooms for this pair, so nothing is
//                 enforced and the calendar shouldn't grey anything out
//   fullDates   — nights with no rooms left, for DateField's excludeDates
//   window      — { min, max } first and last night held, to bound the pickers
//   availableOn — rooms left on a given 'YYYY-MM-DD', or null if outside the window
//
// `excludeAccommodationId` is deliberately absent: the endpoint counts every stay,
// so editing a booking sees its own night as taken. That errs toward showing a
// night as full, which the server-side check (which does exclude the edited row)
// then lets through — a warning that's too cautious beats one that's too loose.
export function useRoomAvailability({ eventId, hotelId, roomTypeId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!eventId || !hotelId || !roomTypeId) { setData(null); return undefined; }

    let cancelled = false;
    getRoomAvailability(eventId, hotelId, roomTypeId)
      .then((res) => { if (!cancelled) setData(res || null); })
      .catch(() => { if (!cancelled) setData(null); });

    return () => { cancelled = true; };
  }, [eventId, hotelId, roomTypeId]);

  return useMemo(() => {
    // One pair was requested, so there's at most one series. No series = nothing
    // held for it, which is the unmanaged case.
    const nights = data?.series?.[0]?.nights || [];
    const byDate = new Map(nights.map((n) => [n.date, n.available]));
    return {
      managed: nights.length > 0,
      nights,
      fullDates: nights.filter((n) => n.available <= 0).map((n) => n.date),
      window: nights.length ? { min: nights[0].date, max: nights[nights.length - 1].date } : null,
      availableOn: (date) => (byDate.has(date) ? byDate.get(date) : null),
    };
  }, [data]);
}
