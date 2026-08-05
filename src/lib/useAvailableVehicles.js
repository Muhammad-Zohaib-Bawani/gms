import { useState, useEffect } from 'react';
import { getAvailableVehicles } from '../api/services/vehicleService';

// Vehicles free over [pickupTime, dropoffTime) — the same overlap rule the server
// enforces on save, so the dropdown can't offer a car the save would reject.
//
// Returns the full `fallback` list until both times are picked: with no window
// there is nothing to check against, and blanking the dropdown before the user
// has entered times reads as "no vehicles exist".
//
// `excludeTransportId` is the ride being edited — without it the ride reports its
// own vehicle as busy and the current selection vanishes from the list.
export function useAvailableVehicles({ pickupTime, dropoffTime, eventId, excludeTransportId, fallback = [] }) {
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    if (!pickupTime || !dropoffTime) { setAvailable(null); return undefined; }

    let cancelled = false;
    getAvailableVehicles({ from: pickupTime, to: dropoffTime, eventId, excludeTransportId })
      // A failed lookup falls back to the unfiltered list rather than blocking
      // the booking — the server check is the one that actually guards this.
      .then((rows) => { if (!cancelled) setAvailable(rows || []); })
      .catch(() => { if (!cancelled) setAvailable(null); });

    return () => { cancelled = true; };
  }, [pickupTime, dropoffTime, eventId, excludeTransportId]);

  return available ?? fallback;
}
