import { useState } from 'react';
import { Icon } from '../../components/Icons';
import { uploadImageFile } from '../../api/services/uploadService';
import { toast } from '../../lib/toast';

export default function LogoInput({ label, value, onChange, isAr }) {
  const [mode, setMode] = useState('url');
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  // Uploads straight to blob storage and stores the returned URL — the form
  // never carries base64. The SAS token stays on for the preview and is
  // stripped in toEventRequest before the URL is persisted.
  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      onChange(await uploadImageFile(file));
      setUploaded(true);
      setMode('upload');
    } catch (err) {
      toast.fromError(err, isAr ? 'فشل تحميل الصورة' : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</label>
      <div style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
        {['upload', 'url'].map(m => (
          <button key={m} type="button" onClick={() => setMode(m)}
            style={{ padding: '3px 10px', borderRadius: 6, fontSize: 11, border: `1px solid ${mode === m ? 'var(--accent)' : 'var(--glass-border)'}`, background: mode === m ? 'rgba(141, 1, 52,0.12)' : 'var(--surface-soft-3)', color: mode === m ? 'var(--accent)' : 'var(--ink-mute)', cursor: 'pointer' }}>
            {m === 'upload' ? (isAr ? 'رفع ملف' : 'Upload') : 'URL'}
          </button>
        ))}
        {value && (
          <button type="button" onClick={() => { onChange(''); setUploaded(false); }}
            style={{ marginInlineStart: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--ink-mute)', padding: '3px 6px' }}>
            {isAr ? 'إزالة' : 'Remove'}
          </button>
        )}
      </div>
      {mode === 'upload' ? (
        <div style={{ position: 'relative' }}>
          <input type="file" accept="image/*" onChange={handleFile} disabled={uploading}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', zIndex: 1 }}/>
          <div className="ev-field-input" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none', height: 38 }}>
            <Icon name="upload" size={13} style={{ color: 'var(--ink-mute)', flexShrink: 0 }}/>
            <span style={{ fontSize: 12, color: uploaded ? 'var(--accent)' : 'var(--ink-mute)' }}>
              {uploading ? (isAr ? 'جارٍ الرفع…' : 'Uploading…')
                : uploaded ? (isAr ? 'تم الرفع ✓' : 'File uploaded ✓')
                : (isAr ? 'اختر ملفاً…' : 'Choose image file…')}
            </span>
          </div>
        </div>
      ) : (
        <input type="url" className="ev-field-input" value={value || ''}
          onChange={e => onChange(e.target.value)} placeholder="https://…"/>
      )}
      {value && (
        <div style={{ marginTop: 6, height: 36, width: 80, borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--surface-soft-3)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }}>
          <img src={value} alt="" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none'; }}/>
        </div>
      )}
    </div>
  );
}
