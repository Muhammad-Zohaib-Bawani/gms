// Date helpers — keep everything as local 'YYYY-MM-DD' strings to match the
// backend DateOnly and avoid UTC off-by-one shifts.

export function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export function toIsoDate(date) {
  const d = date instanceof Date ? date : toDate(date);
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Datetime variants for 'YYYY-MM-DDTHH:mm' (local, no zone) — used by the
// datetime picker. Kept local to dodge UTC off-by-one like the date helpers.
export function toDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(value));
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return toDate(value);
}

export function toIsoDateTime(date) {
  const d = date instanceof Date ? date : toDateTime(date);
  if (!d) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ── Display ──────────────────────────────────────────────────────────────────
// One format across the whole portal: DD-MM-YYYY. Storage and the wire stay ISO
// ('YYYY-MM-DD') — this is only ever what a user reads. Deliberately not
// toLocaleDateString: that shifts with the browser locale, which is exactly the
// inconsistency this replaces.

/** react-datepicker's format token for the same thing. */
export const DISPLAY_DATE_FORMAT = 'dd-MM-yyyy';
export const DISPLAY_DATETIME_FORMAT = 'dd-MM-yyyy HH:mm';

const DASH = '—';

/** '2026-08-05' | Date → '05-08-2026'. Blank/unparsable → '—'. */
export function fmtDate(value, fallback = DASH) {
  const d = value instanceof Date ? value : toDateTime(value);
  if (!d) return fallback;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** '05-08' — for chart axes and grid columns too narrow for the full date. */
export function fmtDayMonth(value, fallback = DASH) {
  const d = value instanceof Date ? value : toDateTime(value);
  if (!d) return fallback;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}`;
}

/** '09:30' from a datetime. 24-hour, matching the pickers. */
export function fmtTime(value, fallback = DASH) {
  const d = value instanceof Date ? value : toDateTime(value);
  if (!d) return fallback;
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** '05-08-2026 09:30'. */
export function fmtDateTime(value, fallback = DASH) {
  const d = value instanceof Date ? value : toDateTime(value);
  return d ? `${fmtDate(d)} ${fmtTime(d)}` : fallback;
}

export function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

// true if `value` is a date strictly before today (local).
export function isPastDate(value) {
  const d = toDate(value);
  if (!d) return false;
  return d < startOfToday();
}

// Add (or subtract, with a negative count) whole days to a 'YYYY-MM-DD'
// string, returning another 'YYYY-MM-DD' string. Null in, null out.
export function addDaysIso(iso, days) {
  const d = toDate(iso);
  if (!d) return null;
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}
