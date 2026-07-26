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
