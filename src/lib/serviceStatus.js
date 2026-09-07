// Service status for a guest's checklist, as the API reports it:
//   pending   — may be worked on now
//   confirmed — has at least one completed entry
//   locked    — fixed event only: an earlier service must be finished first
//
// The server derives all three per read (Core.Constants.ServiceFlow), so they
// can't drift from the work actually recorded.
//
// `completed` is still accepted everywhere `confirmed` is: that is the value
// STORED on GuestServiceEntry (deliberately not renamed, so no migration has to
// rewrite existing rows), and some overview screens run on fixture data that
// still uses it. Treating the two as one keeps both paths working.

export const SERVICE_STATUS = {
  pending: 'pending',
  confirmed: 'confirmed',
  locked: 'locked',
};

/** Done — the service has a completed entry. */
export const isConfirmed = (status) => status === 'confirmed' || status === 'completed';

/** Blocked behind an unfinished earlier service. Never true on a flexible event. */
export const isLocked = (status) => status === 'locked';

/** Actionable now: neither done nor blocked. */
export const isPending = (status) => !isConfirmed(status) && !isLocked(status);

/**
 * Label for a status chip. `isAr` picks Arabic.
 * Kept here so the wording stays identical across the checklist, the guest
 * overview and the CSV export.
 */
export function serviceStatusLabel(status, isAr = false) {
  if (isConfirmed(status)) return isAr ? 'مؤكد' : 'Confirmed';
  if (isLocked(status)) return isAr ? 'مقفل' : 'Locked';
  return isAr ? 'قيد الانتظار' : 'Pending';
}
