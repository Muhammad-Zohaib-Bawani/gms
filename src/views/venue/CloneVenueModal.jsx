import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { Icon } from '../../components/Icons';
import ImageField from '../../components/ui/ImageField';
import LocationPickerModal from '../../components/ui/LocationPickerModal';
import { getVenue, getVenueTypes } from '../../api/services/venueService';
import { VENUE_CATEGORY_OPTIONS as CATEGORY_OPTIONS } from './venueHelpers';

const EMPTY_GUID = '00000000-0000-0000-0000-000000000000';

const SWATCHES = ['#8d0134', '#e0c47e', '#e05252', '#16a34a', '#2563eb', '#7c3aed', '#db2777', '#ea7c1e'];

const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13,
};
const errorBorder = { ...inputStyle, border: '1px solid #e05050' };
const labelStyle = { display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 };

function locationToForm(loc) {
  if (!loc) return null;
  return {
    id: loc.id, address: loc.address, type: loc.type, latitude: loc.latitude, longitude: loc.longitude,
    label: loc.address || `${Number(loc.latitude).toFixed(5)}, ${Number(loc.longitude).toFixed(5)}`,
  };
}

// Prefills every editable venue field (name, type, categories, color,
// location, image) from the source venue — the layout itself (blocks/seats)
// is cloned server-side from whichever box is currently open in the editor,
// with no event/session attached (see useVenueEditor.cloneCurrentVenue).
export default function CloneVenueModal({ open, onClose, lang, sourceVenueId, saving, onSubmit }) {
  const isAr = lang === 'ar';

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(null);
  const [types, setTypes] = useState([]);
  const [errors, setErrors] = useState({});
  const [showLocation, setShowLocation] = useState(false);

  useEffect(() => {
    if (!open || !sourceVenueId) return;
    setLoading(true);
    setErrors({});
    Promise.all([getVenue(sourceVenueId), getVenueTypes().catch(() => [])])
      .then(([v, t]) => {
        setTypes(t || []);
        setForm({
          name: v?.venueName ? (isAr ? `نسخة من ${v.venueName}` : `Copy of ${v.venueName}`) : '',
          typeId: v?.venueType && v.venueType !== EMPTY_GUID ? v.venueType : '',
          categories: v?.category || [],
          color: v?.color || '',
          location: locationToForm(v?.location),
          imageUrl: v?.imageUrl || '',
        });
      })
      .catch(() => setForm({ name: '', typeId: '', categories: [], color: '', location: null, imageUrl: '' }))
      .finally(() => setLoading(false));
  }, [open, sourceVenueId, isAr]);

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const typeOptions = useMemo(
    () => types.map(t => ({ value: t.id, label: (isAr ? (t.nameAr || t.name) : t.name) })),
    [types, isAr],
  );
  const categoryOptions = useMemo(
    () => CATEGORY_OPTIONS.map(c => ({ value: c.value, label: isAr ? c.label.ar : c.label.en })),
    [isAr],
  );

  function handleSave() {
    if (!form.name.trim()) { setErrors({ name: true }); return; }
    onSubmit({
      venueName: form.name.trim(),
      venueType: form.typeId || EMPTY_GUID,
      category: form.categories,
      color: form.color || null,
      locationId: form.location?.id || null,
      imageUrl: form.imageUrl || null,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAr ? 'نسخ المكان' : 'Clone Venue'}
      subtitle={isAr ? 'ينسخ المخطط الحالي إلى مكان جديد ومستقل — بدون فعالية مرتبطة بعد' : 'Copies the current layout into a new, independent venue — no event attached yet'}
      width={520}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={saving}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button className="btn primary" onClick={handleSave} disabled={saving || loading || !form}>
            <Icon name="copy" size={13}/>
            {saving ? (isAr ? 'جارٍ النسخ…' : 'Cloning…') : (isAr ? 'نسخ' : 'Clone')}
          </button>
        </>
      }
    >
      {loading || !form ? (
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', padding: '12px 0' }}>
          {isAr ? 'جارٍ التحميل…' : 'Loading…'}
        </div>
      ) : (
        <>
          <div>
            <label style={labelStyle}>{isAr ? 'اسم المكان الجديد' : 'New Venue Name'} *</label>
            <input
              value={form.name}
              onChange={e => { setF('name', e.target.value); setErrors({}); }}
              style={errors.name ? errorBorder : inputStyle}
            />
            {errors.name && <div style={{ fontSize: 11, color: '#e05050', marginTop: 3 }}>{isAr ? 'مطلوب' : 'Required'}</div>}
          </div>

          <div>
            <label style={labelStyle}>{isAr ? 'نوع المكان' : 'Venue Type'}</label>
            <Select
              value={form.typeId}
              onChange={v => setF('typeId', v || '')}
              options={typeOptions}
              placeholder={isAr ? '— اختر —' : '— Select —'}
              isClearable
            />
          </div>

          <div>
            <label style={labelStyle}>{isAr ? 'الفئات' : 'Categories'}</label>
            <Select
              isMulti
              value={form.categories}
              onChange={v => setF('categories', v || [])}
              options={categoryOptions}
              placeholder={isAr ? '— اختر —' : '— Select —'}
            />
          </div>

          <div>
            <label style={labelStyle}>{isAr ? 'اللون' : 'Color'}</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {SWATCHES.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setF('color', form.color === c ? '' : c)}
                  style={{
                    width: 26, height: 26, borderRadius: 7, background: c, cursor: 'pointer',
                    border: form.color === c ? '2px solid var(--ink)' : '2px solid transparent',
                    outline: form.color === c ? '1px solid var(--ink)' : 'none',
                  }}
                />
              ))}
              {form.color && (
                <button type="button" className="btn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => setF('color', '')}>
                  {isAr ? 'بلا لون' : 'Clear'}
                </button>
              )}
            </div>
          </div>

          <div>
            <label style={labelStyle}>{isAr ? 'الموقع (اختياري)' : 'Location (optional)'}</label>
            {form.location ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button type="button" className="btn" style={{ flex: 1, justifyContent: 'flex-start', fontSize: 12 }} onClick={() => setShowLocation(true)}>
                  <Icon name="venue" size={13}/> {form.location.label}
                </button>
                <button type="button" className="btn" style={{ color: '#e05050', borderColor: 'rgba(224,80,80,0.4)', padding: '6px' }}
                  onClick={() => setF('location', null)}>
                  <Icon name="close" size={13}/>
                </button>
              </div>
            ) : (
              <button type="button" className="btn" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={() => setShowLocation(true)}>
                <Icon name="venue" size={13}/> {isAr ? 'اختر موقعاً على الخريطة' : 'Pick a location on the map'}
              </button>
            )}
          </div>

          <div>
            <label style={labelStyle}>{isAr ? 'صورة المكان (اختياري)' : 'Venue image (optional)'}</label>
            <ImageField value={form.imageUrl} onChange={v => setF('imageUrl', v)} isAr={isAr}/>
          </div>

          <LocationPickerModal
            open={showLocation}
            onClose={() => setShowLocation(false)}
            lang={lang}
            location={form.location}
            onSelect={(loc) => { setF('location', loc); setShowLocation(false); }}
          />
        </>
      )}
    </Modal>
  );
}
