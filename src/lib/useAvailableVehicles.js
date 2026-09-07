import { useState, useEffect } from 'react';
import { getAvailableVehicles } from '../api/services/vehicleService';
import { getDrivers } from '../api/services/travelService';

// Vehicles / drivers free over [pickupTime, dropoffTime) — the same overlap rule
// the server enforces, so the dropdown can't offer one the save would reject.
//
// Returns the full `fallback` list until both times are picked: with no window
// there is nothing to check against, and blanking the dropdown before the user
// has entered times reads as "no vehicles exist".
//
// `excludeTransportId` is the ride being edited — without it the ride reports its
// own vehicle/driver as busy and the current selection vanishes from the list.
function useFreeOver(fetchFree, { pickupTime, dropoffTime, eventId, excludeTransportId, fallback = [] }) {
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    if (!pickupTime || !dropoffTime) { setAvailable(null); return undefined; }

    let cancelled = false;
    fetchFree({ from: pickupTime, to: dropoffTime, eventId, excludeTransportId })
      // A failed lookup falls back to the unfiltered list rather than blocking
      // the booking — the server check is the one that actually guards this.
      .then((rows) => { if (!cancelled) setAvailable(rows || []); })
      .catch(() => { if (!cancelled) setAvailable(null); });

    return () => { cancelled = true; };
    // fetchFree is a module-level import at every call site — stable by construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupTime, dropoffTime, eventId, excludeTransportId]);

  return available ?? fallback;
}

export const useAvailableVehicles = (opts) => useFreeOver(getAvailableVehicles, opts);

// Drivers ignore eventId — the roster isn't event-scoped (getDrivers drops it).
export const useAvailableDrivers = (opts) => useFreeOver(getDrivers, opts);
