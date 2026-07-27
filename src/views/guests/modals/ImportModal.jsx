import React, { useState, useRef } from 'react';
import Modal from '../../../components/ui/Modal';
import { Icon } from '../../../components/Icons';
import toast from '../../../lib/toast';
import { importGuests } from '../../../api/services/guestService';

export default function ImportModal({ open, onClose, activeEventId, lang, onImported }) {
  const isAr    = lang === 'ar';
  const fileRef = useRef();
  const [file,      setFile]      = useState(null);
  const [dragging,  setDragging]  = useState(false);
  const [importing, setImporting] = useState(false);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (f) setFile(f);
  }

  function handleClose() {
    setFile(null);
    setDragging(false);
    onClose();
  }

  async function handleImport() {
    if (!file || !activeEventId) return;
    setImporting(true);
    try {
      const result = await importGuests(activeEventId, file);
      onImported?.();
      handleClose();
      const imported = result?.imported ?? '?';
      const skipped  = result?.skipped  ?? 0;
      toast.success(
        isAr
          ? `تم استيراد ${imported} ضيف${skipped > 0 ? `، تم تخطي ${skipped}` : ''}`
          : `Imported ${imported} guest${skipped > 0 ? `, skipped ${skipped}` : ''}`
      );
    } catch {
      toast.error(isAr ? 'فشل الاستيراد' : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isAr ? 'استيراد CSV' : 'Import CSV'}
      width={460}
      footer={
        <>
          <button className="btn" onClick={handleClose}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button className="btn primary" disabled={!file || importing} onClick={handleImport}>
            <Icon name="upload" size={13}/>
            {importing ? (isAr ? 'جارٍ الاستيراد…' : 'Importing…') : (isAr ? 'استيراد' : 'Import')}
          </button>
        </>
      }
    >
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--glass-border)'}`,
          borderRadius: 12, padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
          background: dragging ? 'rgba(141, 1, 52,0.08)' : 'var(--surface-soft-2)',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <Icon name="upload" size={24} style={{ color: 'var(--accent)', display: 'block', margin: '0 auto 10px' }}/>
        {file ? (
          <>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{file.name}</div>
            <div style={{ fontSize: 12, color: 'var(--accent)' }}>{isAr ? 'جاهز للاستيراد' : 'Ready to import'}</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
              {isAr ? 'اسحب ملف CSV هنا' : 'Drag & drop a CSV file'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
              {isAr ? 'أو انقر للاختيار' : 'or click to browse'}
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleDrop}/>
      </div>

      <div style={{ fontSize: 12, color: 'var(--ink-mute)', background: 'var(--surface-soft-2)', borderRadius: 8, padding: '10px 12px' }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{isAr ? 'تنسيق CSV المطلوب:' : 'Expected CSV format:'}</div>
        <code style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--mono)' }}>
          FirstName, LastName, Email, GuestType, Organization, Nationality, Tier, ArrivalDate, DepartureDate, AccreditationRequired
        </code>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-faint)' }}>
          {isAr
            ? 'الاسم الأول والأخير مطلوبان فقط — البقية اختيارية. Nationality تُطابق بالاسم أو الرمز، وAccreditationRequired تقبل true/yes/required.'
            : 'Only First/Last name are required — everything else is optional. Nationality is matched by name or code; AccreditationRequired accepts true/yes/required.'}
        </div>
      </div>
    </Modal>
  );
}
