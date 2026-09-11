// Turning a service entry's stored values into something readable.
//
// A GuestServiceEntry's `values` is a flat map of the form's field KEYS to RAW
// values — `{"arrivalLounge": "alMahaLounge", "meetGreet": "true"}`. Neither
// half is display text: the key is an identifier and the value is an option
// code, a lookup PublicId or an ISO timestamp. Both sides only become words by
// being resolved against the service's own form definition, which is why any
// screen showing entries has to carry the form alongside them.
//
// This lived inside GuestServicesPanel until Guest Overview needed the same
// thing and started printing raw keys. One implementation, so a value can't
// read one way on the guest page and another way on the overview.
import { allFormFields } from '../components/ui/DynamicFields';
import { lookupLabelFor } from '../components/ui/lookupSources';
import { fmtDate } from './date';

/**
 * Every `lookup` source key a plan's dynamic services reference — what a screen
 * has to load options for before `makeFieldDisplay` can name those values.
 */
export function lookupSourceKeys(forms) {
  const sources = new Set();
  (forms || []).forEach((form) => {
    allFormFields(form).forEach((f) => {
      if (f.type === 'lookup' && f.sourceKey) sources.add(f.sourceKey);
    });
  });
  return [...sources];
}

/**
 * Builds the raw-value → display-text resolver for one language.
 * `lookups` is `{ [sourceKey]: options[] }`; an unloaded source falls back to
 * the raw value rather than blanking the field.
 */
export function makeFieldDisplay(lookups, isAr) {
  return (field, raw) => {
    if (raw == null || raw === '') return '';
    if (field.type === 'lookup') return lookupLabelFor(field.sourceKey, raw, lookups?.[field.sourceKey]);
    if (field.type === 'select') {
      const hit = (field.options || []).find((o) => o.value === String(raw));
      return (isAr ? hit?.labelAr : null) || hit?.label || String(raw);
    }
    if (field.type === 'checkbox') {
      return raw === true || raw === 'true' ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No');
    }
    if (field.type === 'datetime') return String(raw).replace('T', ' ').slice(0, 16);
    if (field.type === 'date') return fmtDate(raw, String(raw));
    return String(raw);
  };
}

/**
 * An entry's values as ordered [label, value] pairs, in the form's own field
 * order. Empty fields are dropped — a card states what is known rather than
 * printing a column of dashes.
 */
export function serviceFactPairs(form, values, display, isAr) {
  const v = values || {};
  const filled = (x) => x != null && String(x).trim() !== '';
  const pairs = [];
  const seen = new Set();

  allFormFields(form).forEach((f) => {
    seen.add(f.key);
    if (!filled(v[f.key])) return;
    pairs.push([(isAr ? f.labelAr : null) || f.label || f.key, display(f, v[f.key])]);
  });

  // Anything the form no longer declares — the schema changed after this entry
  // was saved. Better a raw key than silently dropping the guest's data.
  Object.entries(v).forEach(([k, raw]) => {
    if (seen.has(k) || !filled(raw)) return;
    pairs.push([k, String(raw)]);
  });

  return pairs;
}

/**
 * ServiceCard's props for one entry: the first pair is promoted to the card's
 * headline, the rest become its fact grid.
 */
export function serviceProps(form, values, display, isAr) {
  const [first, ...rest] = serviceFactPairs(form, values, display, isAr);
  return { primaryLabel: first?.[0], primary: first?.[1], facts: rest };
}
