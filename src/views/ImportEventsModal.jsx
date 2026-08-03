import React, { useRef, useState } from 'react';
import Modal from '../components/ui/Modal';
import { Icon } from '../components/Icons';
import toast from '../lib/toast';
import { getEventImportTemplate, importEvents } from '../api/services/eventService';

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

const STALE_CATEGORIES = new Set(['stale_venue', 'stale_type']);

// Bulk-import events from the Excel template. Two distinct failure surfaces:
// 1. A dedicated "your template looks outdated" popup — only for rows that
//    failed because a Venue/Type value no longer exists (or never did) —
//    since that's a template problem, not a data problem, and the fix is
//    always the same: re-export and redo just those rows.
// 2. The ordinary per-row results table — every row, pass or fail, with the
//    reason for any failure (including the stale ones, so nothing's hidden).
export default function ImportEventsModal({ open, onClose, lang, onImported }) {
  const isAr = lang === 'ar';
  const fileInputRef = useRef(null);

  const [downloading, setDownloading] = useState(false);
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [showStalePopup, setShowStalePopup] = useState(false);

  function reset() {
    setFile(null);
    setResult(null);
    setShowStalePopup(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleClose() {
    reset();
    onClose?.();
  }

  async function handleDownloadTemplate() {
    setDownloading(true);
    try {
      const blob = await getEventImportTemplate();
      downloadBlob(blob, 'events-import-template.xlsx');
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر تحميل القالب' : 'Could not download the template');
    } finally {
      setDownloading(false);
    }
  }

  function handlePickFile(e) {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setResult(null); }
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    try {
      const res = await importEvents(file);
      setResult(res);
      if (res.rows?.some(r => STALE_CATEGORIES.has(r.errorCategory))) setShowStalePopup(true);
      if (res.imported > 0) onImported?.();
      if (res.failed === 0) {
        toast.success(isAr ? `تم استيراد ${res.imported} فعالية` : `Imported ${res.imported} event${res.imported === 1 ? '' : 's'}`);
      } else {
        toast.warning(isAr
          ? `تم استيراد ${res.imported} من ${res.total} — فشل ${res.failed}`
          : `Imported ${res.imported} of ${res.total} — ${res.failed} failed`);
      }
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر استيراد الملف' : 'Could not import the file');
    } finally {
      setImporting(false);
    }
  }

  const staleValues = result
    ? [...new Set(result.rows.filter(r => STALE_CATEGORIES.has(r.errorCategory)).map(r => r.error))]
    : [];

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title={isAr ? 'استيراد فعاليات' : 'Import Events'}
        subtitle={isAr ? 'استورد عدة فعاليات دفعة واحدة من ملف إكسل' : 'Bulk-create events from an Excel file'}
        width={600}
        footer={
          <>
            <button className="btn" onClick={handleClose}>{isAr ? 'إغلاق' : 'Close'}</button>
            <button className="btn primary" onClick={handleImport} disabled={!file || importing}>
              <Icon name="upload" size={13}/>
              {importing ? (isAr ? 'جارٍ الاستيراد…' : 'Importing…') : (isAr ? 'استيراد' : 'Import')}
            </button>
          </>
        }
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)', borderRadius: 10,
        }}>
          <Icon name="download" size={16} style={{ color: 'var(--accent)', flexShrink: 0 }}/>
          <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-mute)' }}>
            {isAr
              ? 'ابدأ دائماً بتحميل قالب جديد — الأماكن والأنواع في القائمة المنسدلة تعكس ما هو موجود في المنصة الآن.'
              : 'Always start with a fresh template — the Venue/Type dropdowns reflect what currently exists in the portal.'}
          </div>
          <button className="btn" style={{ flexShrink: 0, fontSize: 12 }} onClick={handleDownloadTemplate} disabled={downloading}>
            <Icon name="download" size={13}/> {downloading ? (isAr ? 'جارٍ التحميل…' : 'Downloading…') : (isAr ? 'تحميل القالب' : 'Download Template')}
          </button>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
            {isAr ? 'ملف الاستيراد' : 'Import File'}
          </label>
          <div style={{ position: 'relative' }}>
            <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handlePickFile}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', zIndex: 1 }}/>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none',
              background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '9px 12px',
            }}>
              <Icon name="upload" size={13} style={{ color: 'var(--ink-mute)', flexShrink: 0 }}/>
              <span style={{ fontSize: 12, color: file ? 'var(--accent)' : 'var(--ink-mute)' }}>
                {file ? file.name : (isAr ? 'اختر ملف .xlsx…' : 'Choose a .xlsx file…')}
              </span>
            </div>
          </div>
        </div>

        {result && (
          <div>
            <div style={{ display: 'flex', gap: 14, marginBottom: 8, fontSize: 12 }}>
              <span style={{ color: 'var(--ink-mute)' }}>{isAr ? 'الإجمالي' : 'Total'} <strong style={{ color: 'var(--ink)' }}>{result.total}</strong></span>
              <span style={{ color: 'var(--accent)' }}>{isAr ? 'تم الاستيراد' : 'Imported'} <strong>{result.imported}</strong></span>
              <span style={{ color: result.failed ? '#e08a7e' : 'var(--ink-mute)' }}>{isAr ? 'فشل' : 'Failed'} <strong>{result.failed}</strong></span>
            </div>
            <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: 8 }}>
              {result.rows.map((r) => (
                <div key={r.row} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', fontSize: 12,
                  borderBottom: '1px solid var(--glass-border)',
                }}>
                  <Icon name={r.success ? 'check' : 'close'} size={13}
                    style={{ color: r.success ? 'var(--accent)' : '#e08a7e', flexShrink: 0, marginTop: 1 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>
                      {isAr ? `صف ${r.row}` : `Row ${r.row}`}{r.title ? ` — ${r.title}` : ''}
                    </div>
                    {!r.success && <div style={{ color: '#e08a7e', marginTop: 2 }}>{r.error}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* Dedicated "outdated template" popup — only for stale Venue/Type
          values, separate from the ordinary per-row results above. */}
      <Modal
        open={showStalePopup}
        onClose={() => setShowStalePopup(false)}
        title={isAr ? 'القالب قديم' : 'Your template looks outdated'}
        width={480}
        footer={
          <>
            <button className="btn" onClick={() => setShowStalePopup(false)}>{isAr ? 'حسناً' : 'Got it'}</button>
            <button className="btn primary" onClick={handleDownloadTemplate} disabled={downloading}>
              <Icon name="download" size={13}/> {isAr ? 'تحميل قالب جديد' : 'Download Fresh Template'}
            </button>
          </>
        }
      >
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 10 }}>
          {isAr
            ? 'بعض قيم "المكان" أو "النوع" في ملفك لم تعد موجودة (أو لم توجد قط) في المنصة. تم تخطي هذه الصفوف فقط — بقية الصفوف الصالحة تم استيرادها. نزّل قالباً جديداً وأعد تعبئة هذه الصفوف.'
            : 'Some Venue/Type values in your file no longer exist (or never did) in the portal. Only those rows were skipped — every other valid row still imported. Download a fresh template and redo just those rows.'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {staleValues.map((v, i) => (
            <div key={i} style={{
              fontSize: 12, padding: '7px 10px', borderRadius: 7,
              background: 'rgba(224,138,126,0.1)', border: '1px solid rgba(224,138,126,0.3)', color: '#e08a7e',
            }}>{v}</div>
          ))}
        </div>
      </Modal>
    </>
  );
}
