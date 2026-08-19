import React, { useState } from 'react';
import { Icon } from '../Icons';
import toast from '../../lib/toast';
import { uploadImageFile } from '../../api/services/uploadService';

const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box',
};

// Single optional image: upload straight to blob storage, store the returned
// URL. Shared by AddVenueModal / VenuesView — same pattern as LookupsView's
// local ImageField and EventsView's LogoInput.
export default function ImageField({ value, onChange, isAr }) {
  const [uploading, setUploading] = useState(false);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try { onChange(await uploadImageFile(file)); }
    catch (err) { toast.fromError(err, isAr ? 'فشل تحميل الصورة' : 'Failed to upload image'); }
    finally { setUploading(false); }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', flex: 1 }}>
        <input type="file" accept="image/*" onChange={pick} disabled={uploading}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', zIndex: 1 }}/>
        <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
          <Icon name="upload" size={13} style={{ color: 'var(--ink-mute)', flexShrink: 0 }}/>
          <span style={{ fontSize: 12, color: value ? 'var(--accent)' : 'var(--ink-mute)' }}>
            {uploading ? (isAr ? 'جارٍ الرفع…' : 'Uploading…')
              : value ? (isAr ? 'تم الرفع ✓' : 'Uploaded ✓')
              : (isAr ? 'اختر صورة…' : 'Choose image…')}
          </span>
        </div>
      </div>
      {value && (
        <>
          <img src={value} alt="" style={{ width: 46, height: 34, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--glass-border)' }}
            onError={e => { e.target.style.display = 'none'; }}/>
          <button type="button" onClick={() => onChange('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ink-mute)' }}>
            {isAr ? 'إزالة' : 'Remove'}
          </button>
        </>
      )}
    </div>
  );
}
