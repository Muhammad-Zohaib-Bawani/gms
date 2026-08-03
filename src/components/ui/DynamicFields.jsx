// Two halves of the dynamic-field story for the per-event Services catalog:
//
//   <FieldSchemaBuilder>  — admin DEFINES a service's fields (key/label/type/…)
//   <DynamicFieldInputs>  — someone FILLS those fields in (on a Service Level)
//
// Field definition shape matches Core.Constants.ServiceFieldDefinition exactly:
//   { key, label, labelAr, type, required, options[] }
import React from 'react';
import { Icon } from '../Icons';
import Select from './Select';
import DateField from './DateField';

export const FIELD_TYPES = ['text', 'textarea', 'number', 'date', 'select', 'checkbox'];

const TYPE_LABELS = {
  en: { text: 'Text', textarea: 'Long text', number: 'Number', date: 'Date', select: 'Dropdown', checkbox: 'Yes / No' },
  ar: { text: 'نص', textarea: 'نص طويل', number: 'رقم', date: 'تاريخ', select: 'قائمة', checkbox: 'نعم / لا' },
};

const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '8px 11px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block', fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: 4,
};

/** "Lounge Name" -> "loungeName". Keys are the stable machine identifier that
 *  stored values are keyed by, so they're derived once from the label and then
 *  left alone — renaming a label must not orphan existing values. */
export function keyFromLabel(label) {
  const words = (label || '').trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join('');
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
                onChange={(v) => update(i, { type: v || 'text', options: v === 'select' ? (f.options || []) : [] })}
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

          {f.type === 'select' && (
            <div>
              <label style={labelStyle}>{isAr ? 'الخيارات (سطر لكل خيار)' : 'Options (one per line)'} *</label>
              <textarea
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
                value={(f.options || []).join('\n')}
                placeholder={isAr ? 'سيدان\nليموزين' : 'Sedan\nLimousine'}
                onChange={(e) => update(i, { options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
              />
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

export function DynamicFieldInputs({ fields, values, onChange, lang }) {
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
        return (
          <div key={f.key}>
            <label style={labelStyle}>{label}{f.required ? ' *' : ''}</label>

            {f.type === 'textarea' && (
              <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} value={val}
                onChange={(e) => set(f.key, e.target.value)} />
            )}

            {f.type === 'select' && (
              <Select
                value={val}
                onChange={(x) => set(f.key, x || '')}
                options={(f.options || []).map((o) => ({ value: o, label: o }))}
                placeholder={isAr ? '— اختر —' : '— Select —'}
                isClearable={!f.required}
              />
            )}

            {f.type === 'date' && (
              <DateField value={val} onChange={(d) => set(f.key, d || '')} />
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
                style={inputStyle}
                value={val}
                onChange={(e) => set(f.key, e.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
