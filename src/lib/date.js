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
