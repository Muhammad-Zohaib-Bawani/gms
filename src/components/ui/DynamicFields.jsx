// The dynamic-form story for the global Services catalogue.
//
//   <FormSchemaBuilder>   — admin DEFINES a service's form (sections of fields)
//   <DynamicFormInputs>   — someone FILLS that form in, for a guest
//
// The two inner pieces (<FieldSchemaBuilder>, <DynamicFieldInputs>) handle one
// section's worth of fields and are exported for reuse.
//
// Shapes mirror Core.Constants exactly:
//   form  { sections: [{ key, label, labelAr, fields: [...] }] }
//   field { key, label, labelAr, type, required, placeholder, helpText,
//           options: [{ value, label, labelAr }] }
//
// Field keys are unique across the WHOLE form, not per section, because values
// are stored as one flat { key: value } map. See docs/service-levels-v2.md.
import React from 'react';
import { Icon } from '../Icons';
import Select from './Select';
import DateField from './DateField';
import { LOOKUP_SOURCE_KEYS, lookupSourceLabel, loadLookupOptions } from './lookupSources';
import { useRoomAvailability } from '../../lib/useRoomInventory';

export const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'datetime', 'time', 'select', 'lookup', 'checkbox'];

const TYPE_LABELS = {
  en: { text: 'Text', textarea: 'Long text', number: 'Number', date: 'Date',
        datetime: 'Date & time', time: 'Time', select: 'Dropdown (fixed list)',
        lookup: 'Dropdown (from existing data)', checkbox: 'Yes / No' },
  ar: { text: 'نص', textarea: 'نص طويل', number: 'رقم', date: 'تاريخ',
        datetime: 'تاريخ ووقت', time: 'وقت', select: 'قائمة ثابتة',
        lookup: 'قائمة من البيانات', checkbox: 'نعم / لا' },
};

const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '8px 11px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block', fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: 4,
};

// ─── A dropdown's option list, typed one per line ────────────────────────────

const joinOptions = (options) => (options || []).map((o) => o.label ?? o.value ?? '').join('\n');

// Blank lines are dropped and labels trimmed, so what's stored is always clean.
// Existing options are reused by label, so editing one line never re-keys the
// others — a value already saved against an option keeps pointing at it.
const parseOptions = (text, existing) =>
  String(text).split('\n').map((line) => line.trim()).filter(Boolean)
    .map((label) => (existing || []).find((o) => o.label === label)
                    || { value: keyFromLabel(label) || label, label });

/**
 * The textarea holds the raw text while you type, rather than being re-derived
 * from `options` on every keystroke.
 *
 * That derivation is why Enter did nothing: pressing it added a trailing blank
 * line, `parseOptions` dropped it, and the value handed back to the textarea was
 * the text without the newline — so the caret could never reach the next line.
 * Options still update on every keystroke; only the display text is local.
 */
function OptionsField({ options, onChange, isAr }) {
  const [text, setText] = React.useState(() => joinOptions(options));
  // The last text WE pushed up, normalised. Anything else arriving on the prop
  // came from outside (prefilling an existing service) and should replace what's
  // in the box; our own keystrokes must not.
  const pushed = React.useRef(joinOptions(options));

  React.useEffect(() => {
    const incoming = joinOptions(options);
    if (incoming !== pushed.current) {
      pushed.current = incoming;
      setText(incoming);
    }
  }, [options]);

  return (
    <textarea
      rows={3}
      style={{ ...inputStyle, resize: 'vertical' }}
      value={text}
      placeholder={isAr ? 'سيدان\nليموزين' : 'Sedan\nLimousine'}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const parsed = parseOptions(raw, options);
        pushed.current = joinOptions(parsed);
        onChange(parsed);
      }}
    />
  );
}

/** "Lounge Name" -> "loungeName". Keys are the stable machine identifier that
 *  stored values are keyed by, so they're derived once from the label and then
 *  left alone — renaming a label must not orphan existing values. */
export function keyFromLabel(label) {
  const words = (label || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}


// ─── Constraints ─────────────────────────────────────────────────────────────
// Mirrors ServiceFormSchema.ConstraintErrors on the server, which re-checks
// every one of these on save. Here they exist to fail early and in place.

function toDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** min/max the calendar should enforce for a date field. */
export function dateBounds(field, values, eventStart, eventEnd) {
  if (field.type !== 'date' && field.type !== 'datetime') return {};
  const out = {};
  if (field.withinEventDates) {
    out.min = eventStart || undefined;
    out.max = eventEnd || undefined;
  }
  // "after X" narrows the floor further — you cannot land before you took off.
  if (field.afterField) {
    const other = toDateOrNull((values || {})[field.afterField]);
    if (other) {
      const iso = field.type === 'datetime' ? other.toISOString().slice(0, 16) : other.toISOString().slice(0, 10);
      if (!out.min || iso > out.min) out.min = iso;
    }
  }
  return out;
}

// Tightens a date field's bounds to the nights the event actually holds. ISO
// 'YYYY-MM-DD' compares lexicographically, so plain string min/max is correct.
function narrowToStay(bounds, stay) {
  if (!stay) return bounds;
  const out = { ...bounds };
  if (stay.min && (!out.min || stay.min > out.min)) out.min = stay.min;
  if (stay.max && (!out.max || stay.max < out.max)) out.max = stay.max;
  return out;
}

/** One message for a single field, or null. */
export function fieldError(field, values, eventStart, eventEnd) {
  const v = values || {};
  const raw = v[field.key];
  if (raw == null || String(raw).trim() === '') return null;

  if (field.type === 'number') {
    const n = Number(raw);
    if (Number.isNaN(n)) return 'Must be a number';
    if (field.min != null && n < field.min) return `Must be at least ${field.min}`;
    if (field.max != null && n > field.max) return `Must be at most ${field.max}`;
  }

  if (field.type === 'text' || field.type === 'textarea') {
    const len = String(raw).trim().length;
    if (field.minLength && len < field.minLength) return `At least ${field.minLength} characters`;
    if (field.maxLength && len > field.maxLength) return `At most ${field.maxLength} characters`;
  }

  if (field.type === 'date' || field.type === 'datetime') {
    const when = toDateOrNull(raw);
    if (!when) return 'Not a valid date';
    if (field.afterField) {
      const other = toDateOrNull(v[field.afterField]);
      if (other && when < other) return 'Must be later than the previous date';
    }
    if (field.withinEventDates) {
      if (eventStart && toDateOrNull(eventStart) && when < toDateOrNull(eventStart)) return 'Before the event starts';
      if (eventEnd && toDateOrNull(eventEnd) && when > new Date(`${eventEnd}T23:59:59`)) return 'After the event ends';
    }
  }

  return null;
}

/** Every constraint message across the visible sections. */
export function formErrors(form, values, eventStart, eventEnd) {
  return visibleSections(form, values)
    .flatMap((s) => s.fields || [])
    .map((f) => {
      const e = fieldError(f, values, eventStart, eventEnd);
      return e ? `${f.label || f.key}: ${e}` : null;
    })
    .filter(Boolean);
}

// ─── Admin: define a service's fields ────────────────────────────────────────

export function FieldSchemaBuilder({ fields, onChange, lang }) {
  const isAr = lang === 'ar';
  const types = TYPE_LABELS[isAr ? 'ar' : 'en'];
  const list = fields || [];

  const update = (i, patch) => onChange(list.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  const remove = (i) => onChange(list.filter((_, idx) => idx !== i));
  const add = () => onChange([...list, { key: '', label: '', labelAr: '', type: 'text', required: false, options: [] }]);
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {list.length === 0 && (
        <div style={{
          padding: '18px 14px', textAlign: 'center', borderRadius: 10,
          border: '1px dashed var(--glass-border)', background: 'var(--surface-soft-2)',
          fontSize: 12.5, color: 'var(--ink-faint)',
        }}>
          {isAr
            ? 'لا حقول — أضف حقلاً ليطلب هذه الخدمة معلومات إضافية'
            : 'No fields yet — add one if this service needs extra details (e.g. "Lounge Name")'}
        </div>
      )}

      {list.map((f, i) => (
        <div key={i} style={{
          padding: 12, borderRadius: 10, background: 'var(--surface-soft-2)',
          border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10.5, color: 'var(--ink-faint)', fontFamily: 'var(--mono)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <span style={{ flex: 1 }} />
            <button type="button" className="action-menu-trigger" title={isAr ? 'أعلى' : 'Move up'}
              disabled={i === 0} onClick={() => move(i, -1)}
              style={i === 0 ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}>
              <Icon name="chevronDown" size={13} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <button type="button" className="action-menu-trigger" title={isAr ? 'أسفل' : 'Move down'}
              disabled={i === list.length - 1} onClick={() => move(i, 1)}
              style={i === list.length - 1 ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}>
              <Icon name="chevronDown" size={13} />
            </button>
            <button type="button" className="action-menu-trigger" title={isAr ? 'حذف' : 'Remove'}
              onClick={() => remove(i)} style={{ color: 'var(--danger)' }}>
              <Icon name="trash" size={13} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>{isAr ? 'التسمية' : 'Label'} *</label>
              <input
                style={inputStyle}
                value={f.label || ''}
                placeholder={isAr ? 'مثال: اسم الصالة' : 'e.g. Lounge Name'}
                onChange={(e) => {
                  const label = e.target.value;
                  // Only auto-derive the key while it still matches the old label,
                  // so a hand-edited key is never silently overwritten.
                  const autoKey = !f.key || f.key === keyFromLabel(f.label);
                  update(i, autoKey ? { label, key: keyFromLabel(label) } : { label });
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>{isAr ? 'النوع' : 'Type'}</label>
              <Select
                value={f.type || 'text'}
                onChange={(v) => update(i, {
                  type: v || 'text',
                  options: v === 'select' ? (f.options || []) : [],
                  sourceKey: v === 'lookup' ? (f.sourceKey || '') : null,
                })}
                options={FIELD_TYPES.map((t) => ({ value: t, label: types[t] }))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>{isAr ? 'التسمية بالعربية' : 'Arabic label'}</label>
              <input style={inputStyle} value={f.labelAr || ''} dir="rtl"
                onChange={(e) => update(i, { labelAr: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>{isAr ? 'المُعرِّف' : 'Key'}</label>
              <input style={{ ...inputStyle, fontFamily: 'var(--mono)', fontSize: 12 }}
                value={f.key || ''}
                onChange={(e) => update(i, { key: e.target.value.trim() })} />
            </div>
          </div>

          {f.type === 'lookup' && (
            <div>
              <label style={labelStyle}>{isAr ? 'المصدر' : 'Options from'} *</label>
              <select
                style={{ ...inputStyle, padding: '7px 10px' }}
                value={f.sourceKey || ''}
                onChange={(e) => update(i, { sourceKey: e.target.value })}
              >
                <option value="">{isAr ? '— اختر —' : '— Select —'}</option>
                {LOOKUP_SOURCE_KEYS.map((k) => (
                  <option key={k} value={k}>{lookupSourceLabel(k, isAr)}</option>
                ))}
              </select>
              <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginTop: 4 }}>
                {isAr
                  ? 'تُحفظ القيمة كمعرّف، لذا لا تتأثر الحجوزات عند إعادة التسمية.'
                  : 'Stores the record\'s id, so renaming it later will not affect saved bookings.'}
              </div>
            </div>
          )}

          {f.type === 'select' && (
            <div>
              <label style={labelStyle}>{isAr ? 'الخيارات (سطر لكل خيار)' : 'Options (one per line)'} *</label>
              <OptionsField
                options={f.options}
                onChange={(options) => update(i, { options })}
                isAr={isAr}
              />
            </div>
          )}

          {/* Optional rules. Kept to a short fixed list on purpose — each is one
              control that produces a sentence the person filling the form can
              act on, rather than an expression language nobody will maintain. */}
          {(f.type === 'number') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={labelStyle}>{isAr ? 'أقل قيمة' : 'Min value'}</label>
                <input type="number" style={inputStyle} value={f.min ?? ''}
                  onChange={(e) => update(i, { min: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
              <div>
                <label style={labelStyle}>{isAr ? 'أكبر قيمة' : 'Max value'}</label>
                <input type="number" style={inputStyle} value={f.max ?? ''}
                  onChange={(e) => update(i, { max: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
            </div>
          )}

          {(f.type === 'text' || f.type === 'textarea') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={labelStyle}>{isAr ? 'أقل عدد أحرف' : 'Min length'}</label>
                <input type="number" style={inputStyle} value={f.minLength ?? ''}
                  onChange={(e) => update(i, { minLength: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
              <div>
                <label style={labelStyle}>{isAr ? 'أكبر عدد أحرف' : 'Max length'}</label>
                <input type="number" style={inputStyle} value={f.maxLength ?? ''}
                  onChange={(e) => update(i, { maxLength: e.target.value === '' ? null : Number(e.target.value) })} />
              </div>
            </div>
          )}

          {(f.type === 'date' || f.type === 'datetime') && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={labelStyle}>{isAr ? 'يجب أن يكون بعد' : 'Must be after'}</label>
                <select
                  style={{ ...inputStyle, padding: '7px 10px' }}
                  value={f.afterField || ''}
                  onChange={(e) => update(i, { afterField: e.target.value || null })}
                >
                  <option value="">{isAr ? '— لا شيء —' : '— No rule —'}</option>
                  {list
                    .filter((o, oi) => oi !== i && (o.type === 'date' || o.type === 'datetime') && o.key)
                    .map((o) => <option key={o.key} value={o.key}>{o.label || o.key}</option>)}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer', paddingTop: 18 }}>
                <input type="checkbox" checked={!!f.withinEventDates}
                  onChange={(e) => update(i, { withinEventDates: e.target.checked })}
                  style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                {isAr ? 'ضمن تواريخ الفعالية' : 'Within event dates'}
              </label>
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!f.required}
              onChange={(e) => update(i, { required: e.target.checked })}
              style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
            {isAr ? 'مطلوب' : 'Required'}
          </label>
        </div>
      ))}

      <button type="button" className="btn" onClick={add} style={{ alignSelf: 'flex-start' }}>
        <Icon name="plus" size={13} /> {isAr ? 'إضافة حقل' : 'Add field'}
      </button>
    </div>
  );
}

// ─── Fill in the values for a set of field definitions ───────────────────────

export function DynamicFieldInputs({
  fields, values, onChange, lang, eventStart, eventEnd,
  // Scoping for event-dependent lookups, and the held-room window for date
  // fields — both supplied by DynamicFormInputs, both optional.
  lookupCtx, stay,
}) {
  const isAr = lang === 'ar';
  const list = fields || [];
  const v = values || {};

  if (list.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
        {isAr ? 'لا حقول لهذه الخدمة' : 'This service has no extra fields'}
      </div>
    );
  }

  const set = (key, val) => onChange({ ...v, [key]: val });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
      {list.map((f) => {
        const label = (isAr ? f.labelAr : null) || f.label || f.key;
        const val = v[f.key] ?? '';
        // The calendar itself refuses out-of-range days, so a bad date is
        // usually unpickable rather than merely rejected after the fact.
        // Held-room nights narrow a plain `date` further. Left off `datetime` on
        // purpose: its bounds carry a time part, and room inventory is per night —
        // mixing the two formats would compare 'YYYY-MM-DD' against
        // 'YYYY-MM-DDTHH:mm'. Stay dates are `date` fields in practice.
        const bounds = f.type === 'date' ? narrowToStay(dateBounds(f, v, eventStart, eventEnd), stay)
                                         : dateBounds(f, v, eventStart, eventEnd);
        const err = fieldError(f, v, eventStart, eventEnd);
        return (
          <div key={f.key}>
            <label style={labelStyle}>{label}{f.required ? ' *' : ''}</label>

            {f.type === 'textarea' && (
              <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} value={val}
                onChange={(e) => set(f.key, e.target.value)} />
            )}

            {f.type === 'lookup' && (
              <LookupSelect
                field={f}
                value={val}
                onChange={(x) => set(f.key, x || '')}
                isAr={isAr}
                ctx={lookupCtx}
              />
            )}

            {f.type === 'select' && (
              <Select
                value={val}
                onChange={(x) => set(f.key, x || '')}
                options={(f.options || []).map((o) => ({ value: o.value, label: (isAr ? o.labelAr : null) || o.label || o.value }))}
                placeholder={isAr ? '— اختر —' : '— Select —'}
                isClearable={!f.required}
              />
            )}

            {f.type === 'date' && (
              <DateField
                value={val}
                onChange={(d) => set(f.key, d || '')}
                clearable={!f.required}
                minDate={bounds.min}
                maxDate={bounds.max}
                excludeDates={stay?.fullDates}
              />
            )}

            {f.type === 'datetime' && (
              <DateField
                value={val}
                onChange={(d) => set(f.key, d || '')}
                showTime
                clearable={!f.required}
                minDate={bounds.min}
                maxDate={bounds.max}
              />
            )}

            {f.type === 'time' && (
              <input type="time" style={inputStyle} value={val}
                onChange={(e) => set(f.key, e.target.value)} />
            )}

            {f.type === 'checkbox' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer', paddingTop: 4 }}>
                <input type="checkbox" checked={val === 'true'}
                  onChange={(e) => set(f.key, e.target.checked ? 'true' : 'false')}
                  style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                {isAr ? 'نعم' : 'Yes'}
              </label>
            )}

            {(f.type === 'text' || f.type === 'number' || !f.type) && (
              <input
                type={f.type === 'number' ? 'number' : 'text'}
                style={err ? { ...inputStyle, borderColor: 'var(--danger)' } : inputStyle}
                value={val}
                min={f.type === 'number' && f.min != null ? f.min : undefined}
                max={f.type === 'number' && f.max != null ? f.max : undefined}
                maxLength={f.maxLength || undefined}
                placeholder={f.placeholder || undefined}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}

            {(f.helpText || err) && (
              <div style={{ fontSize: 10.5, marginTop: 4, color: err ? 'var(--danger)' : 'var(--ink-faint)' }}>
                {err || f.helpText}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


/**
 * A dropdown backed by an existing lookup table. Options are fetched once per
 * source and shared across fields (From and To are both airports), so a form
 * with several lookup fields still makes one request per table.
 *
 * `ctx` scopes the event-dependent sources — hotels to the event's contracts,
 * room types to the hotel picked on this form. Its parts are the effect's deps
 * rather than the object itself, so re-rendering on every keystroke doesn't
 * refetch.
 */
function LookupSelect({ field, value, onChange, isAr, ctx }) {
  const [options, setOptions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const eventId = ctx?.eventId || '';
  const hotelId = ctx?.hotelId || '';

  React.useEffect(() => {
    if (!field.sourceKey) return;
    let cancelled = false;
    setLoading(true);
    loadLookupOptions(field.sourceKey, { eventId, hotelId })
      .then((o) => { if (!cancelled) setOptions(o); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [field.sourceKey, eventId, hotelId]);

  if (!field.sourceKey) {
    return (
      <div style={{ fontSize: 11.5, color: 'var(--danger)' }}>
        {isAr ? 'لم يتم ضبط مصدر لهذا الحقل' : 'No source configured for this field'}
      </div>
    );
  }

  return (
    <Select
      value={value}
      onChange={(x) => onChange(x || '')}
      options={options}
      isClearable={!field.required}
      placeholder={loading
        ? (isAr ? 'جارٍ التحميل…' : 'Loading…')
        : (isAr ? '— اختر —' : '— Select —')}
    />
  );
}

// ─── Admin: define a whole form, as sections of fields ───────────────────────

/**
 * `form` is { sections: [...] }. A service always has at least one section;
 * single-section forms render without visible section chrome so a simple
 * service does not look bureaucratic.
 */
export function FormSchemaBuilder({ form, onChange, lang }) {
  const isAr = lang === 'ar';
  const sections = form?.sections?.length ? form.sections : [];

  const setSections = (next) => onChange({ ...(form || {}), sections: next });

  const updateSection = (i, patch) =>
    setSections(sections.map((sec, idx) => (idx === i ? { ...sec, ...patch } : sec)));

  const addSection = () =>
    setSections([...sections, { key: `section${sections.length + 1}`, label: '', labelAr: '', fields: [] }]);

  const removeSection = (i) => setSections(sections.filter((_, idx) => idx !== i));

  const moveSection = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    setSections(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {sections.length === 0 && (
        <div style={{
          padding: '14px 16px', borderRadius: 10, fontSize: 12.5, color: 'var(--ink-mute)',
          border: '1px dashed var(--glass-border)', textAlign: 'center',
        }}>
          {isAr
            ? 'لا يوجد نموذج بعد — أضف قسماً للبدء.'
            : 'No form yet — add a section to start.'}
        </div>
      )}

      {sections.map((sec, i) => (
        <div key={i} style={{
          border: '1px solid var(--glass-border)', borderRadius: 12, padding: 12,
          background: 'var(--surface-soft-2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <input
              style={{ ...inputStyle, fontWeight: 600, flex: 1 }}
              value={sec.label || ''}
              placeholder={isAr ? 'اسم القسم، مثل: الذهاب' : 'Section name, e.g. Outbound'}
              onChange={(e) => updateSection(i, {
                label: e.target.value,
                key: sec.key || keyFromLabel(e.target.value) || `section${i + 1}`,
              })}
            />
            <button type="button" className="icon-btn" title={isAr ? 'أعلى' : 'Move up'}
              onClick={() => moveSection(i, -1)} disabled={i === 0}>↑</button>
            <button type="button" className="icon-btn" title={isAr ? 'أسفل' : 'Move down'}
              onClick={() => moveSection(i, 1)} disabled={i === sections.length - 1}>↓</button>
            <button type="button" className="icon-btn" title={isAr ? 'حذف القسم' : 'Delete section'}
              style={{ color: 'var(--danger)' }} onClick={() => removeSection(i)}>
              <Icon name="trash" size={13} />
            </button>
          </div>

          <SectionCondition
            section={sec}
            allSections={sections}
            index={i}
            onChange={(visibleWhen) => updateSection(i, { visibleWhen })}
            isAr={isAr}
          />

          <FieldSchemaBuilder
            fields={sec.fields || []}
            onChange={(fields) => updateSection(i, { fields })}
            lang={lang}
          />
        </div>
      ))}

      <button type="button" className="btn" onClick={addSection} style={{ alignSelf: 'flex-start' }}>
        <Icon name="plus" size={13} /> {isAr ? 'إضافة قسم' : 'Add section'}
      </button>
    </div>
  );
}


/**
 * "Show this section only when <field> is <values>". Only dropdown fields from
 * EARLIER sections can drive it — a later field would not be answered yet, and
 * a non-dropdown has no fixed set of values to pick from.
 */
function SectionCondition({ section, allSections, index, onChange, isAr }) {
  const candidates = allSections
    .slice(0, index)
    .flatMap((s) => (s.fields || []).filter((f) => f.type === 'select' && (f.options || []).length));

  if (candidates.length === 0) return null;

  const cond = section.visibleWhen || null;
  const driver = candidates.find((f) => f.key === cond?.field) || null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      marginBottom: 10, padding: '8px 10px', borderRadius: 8,
      background: 'var(--surface-soft-3)', border: '1px dashed var(--glass-border)',
    }}>
      <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>
        {isAr ? 'أظهر هذا القسم عندما' : 'Show this section when'}
      </span>

      <select
        style={{ ...inputStyle, width: 'auto', padding: '5px 8px', fontSize: 12 }}
        value={cond?.field || ''}
        onChange={(e) => onChange(e.target.value ? { field: e.target.value, values: [] } : null)}
      >
        <option value="">{isAr ? 'دائماً' : 'Always'}</option>
        {candidates.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>

      {driver && (
        <>
          <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>{isAr ? 'يساوي' : 'is'}</span>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {driver.options.map((o) => {
              const on = (cond.values || []).includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  className="chip"
                  style={{
                    cursor: 'pointer', fontSize: 11,
                    background: on ? 'var(--accent-soft)' : 'var(--bg-1)',
                    color: on ? 'var(--accent)' : 'var(--ink-mute)',
                    borderColor: on ? 'var(--accent)' : 'var(--glass-border)',
                  }}
                  onClick={() => onChange({
                    field: cond.field,
                    values: on
                      ? cond.values.filter((v) => v !== o.value)
                      : [...(cond.values || []), o.value],
                  })}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Fill in a whole form ────────────────────────────────────────────────────

export function DynamicFormInputs({ form, values, onChange, lang, eventStart, eventEnd, eventId }) {
  const isAr = lang === 'ar';
  // Recomputed on every change so toggling the controlling field shows and
  // hides its dependent sections immediately.
  const sections = visibleSections(form, values);

  // Which field holds the hotel / room type is *detected* from the lookup source
  // it draws on, not configured — a form has one hotel field in practice, and one
  // less thing for an admin to wire up wrong. Same approach as the route strip in
  // ServiceOpsView (docs/service-levels-v2.md §9).
  const hotelId = values?.[fieldKeyBySource(form, 'hotels')] || '';
  const roomTypeId = values?.[fieldKeyBySource(form, 'roomTypes')] || '';

  // Rooms held for that hotel + type: bounds the date pickers to the held window
  // and greys out nights with nothing left. Unmanaged (nothing held) → null, so
  // a form with no accommodation fields is unaffected.
  const rooms = useRoomAvailability({ eventId, hotelId, roomTypeId });
  const stay = rooms.managed
    ? { min: rooms.window?.min, max: rooms.window?.max, fullDates: rooms.fullDates }
    : null;

  if (sections.length === 0) {
    return (
      <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
        {isAr ? 'لا يوجد نموذج لهذه الخدمة' : 'This service has no form configured'}
      </div>
    );
  }

  const single = sections.length === 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {sections.map((sec, i) => (
        <div key={sec.key || i}>
          {/* A one-section form needs no heading — the dialog title already says
              which service this is. */}
          {!single && (sec.label || sec.labelAr) && (
            <div style={{
              fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase',
              letterSpacing: '0.1em', marginBottom: 8, paddingBottom: 5,
              borderBottom: '1px solid var(--glass-border)',
            }}>
              {(isAr ? sec.labelAr : null) || sec.label}
            </div>
          )}
          <DynamicFieldInputs
            fields={sec.fields || []}
            values={values}
            onChange={onChange}
            lang={lang}
            eventStart={eventStart}
            eventEnd={eventEnd}
            lookupCtx={{ eventId, hotelId }}
            stay={stay}
          />
        </div>
      ))}
    </div>
  );
}

/** Every field across every section, in render order. */
export function allFormFields(form) {
  return (form?.sections || []).flatMap((s) => s.fields || []);
}

/** Key of the first lookup field drawing on `sourceKey`, or '' if the form has
 *  none. How a dependent lookup finds what it depends on without configuration. */
export function fieldKeyBySource(form, sourceKey) {
  const hit = allFormFields(form).find((f) => f.type === 'lookup' && f.sourceKey === sourceKey);
  return hit?.key || '';
}

/**
 * A section with a `visibleWhen` shows only while another field holds one of
 * the listed values — e.g. the Outbound leg for trip type outbound or return.
 * Mirrors ServiceFormSchema.IsSectionVisible on the server, which re-checks it.
 */
export function isSectionVisible(section, values) {
  const c = section?.visibleWhen;
  if (!c?.field || !(c.values || []).length) return true;
  const actual = String((values || {})[c.field] ?? '').toLowerCase();
  return c.values.some((v) => String(v).toLowerCase() === actual);
}

export function visibleSections(form, values) {
  return (form?.sections || []).filter((s) => isSectionVisible(s, values));
}

/**
 * Labels of required fields left blank — empty means the form may be completed.
 * Hidden sections are skipped: an inbound-only booking must not be blocked by
 * the outbound leg's required fields.
 */
export function missingRequired(form, values) {
  const v = values || {};
  return visibleSections(form, v)
    .flatMap((s) => s.fields || [])
    .filter((f) => f.required)
    .filter((f) => !String(v[f.key] ?? '').trim())
    .map((f) => f.label || f.key);
}
