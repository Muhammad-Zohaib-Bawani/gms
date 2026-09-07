import React, { useEffect, useRef, useState } from 'react';
import Modal from '../components/ui/Modal';
import { Icon } from '../components/Icons';
import ImportBatchResults from '../components/ui/ImportBatchResults';
import toast from '../lib/toast';
import useImportBatchPoll from '../lib/useImportBatchPoll';
import { getEventImportTemplate, importEvents, getEventImportBatch } from '../api/services/eventService';

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

const STALE_CATEGORIES = new Set(['stale_venue', 'stale_type']);

// Bulk-import events from the Excel template. The upload only kicks off a
// Hangfire job (StartEventsImportAsync) and returns a batch id — the actual
// parsing/insert runs in the background, so the user can close this modal
// and keep working; a notification (bell icon) fires when it's done, deep-
// linking back here via `?importBatch=` (see EventsView).
//
// Two distinct failure surfaces once results come in:
// 1. A dedicated "your template looks outdated" popup — only for rows that
//    failed because a Venue/Type value no longer exists (or never did).
// 2. The ordinary per-row results table — every row, pass or fail.
export default function ImportEventsModal({ open, onClose, lang, onImported, initialBatchId }) {
  const isAr = lang === 'ar';
  const fileInputRef = useRef(null);
  const notifiedRef = useRef(false);

  const [downloading, setDownloading] = useState(false);
  const [file, setFile] = useState(null);
  const [starting, setStarting] = useState(false);
  const [batchId, setBatchId] = useState(null);
  const [showStalePopup, setShowStalePopup] = useState(false);

  const status = useImportBatchPoll(batchId, getEventImportBatch);

  // Reopened from a notification deep-link — jump straight to results.
  useEffect(() => {
    if (open && initialBatchId) { setBatchId(initialBatchId); notifiedRef.current = true; }
  }, [open, initialBatchId]);

  useEffect(() => {
    if (!status || notifiedRef.current) return;
    if (status.status !== 'completed' && status.status !== 'failed') return;
    notifiedRef.current = true;

    if (status.rows?.some(r => STALE_CATEGORIES.has(r.errorCategory))) setShowStalePopup(true);
    if (status.imported > 0) onImported?.();

    if (status.status === 'failed') {
      toast.error(status.errorMessage || (isAr ? 'فشل الاستيراد' : 'Import failed'));
    } else if (status.failed === 0) {
      toast.success(isAr ? `تم استيراد ${status.imported} فعالية` : `Imported ${status.imported} event${status.imported === 1 ? '' : 's'}`);
    } else {
      toast.warning(isAr
        ? `تم استيراد ${status.imported} من ${status.total} — فشل ${status.failed}`
        : `Imported ${status.imported} of ${status.total} — ${status.failed} failed`);
    }
  }, [status, isAr, onImported]);

  function reset() {
    setFile(null);
    setBatchId(null);
    setShowStalePopup(false);
    notifiedRef.current = false;
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
    if (f) { setFile(f); setBatchId(null); notifiedRef.current = false; }
  }

  async function handleStartImport() {
    if (!file) return;
    setStarting(true);
    try {
      const res = await importEvents(file);
      setBatchId(res.batchId);
      toast.success(isAr ? 'بدأ الاستيراد في الخلفية' : 'Import started in the background');
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر بدء الاستيراد' : 'Could not start the import');
    } finally {
      setStarting(false);
    }
  }

  const staleValues = status
    ? [...new Set((status.rows || []).filter(r => STALE_CATEGORIES.has(r.errorCategory)).map(r => r.error))]
    : [];
  const isProcessing = batchId && status && status.status !== 'completed' && status.status !== 'failed';

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
            {!batchId && (
              <button className="btn primary" onClick={handleStartImport} disabled={!file || starting}>
                <Icon name="upload" size={13}/>
                {starting ? (isAr ? 'جارٍ البدء…' : 'Starting…') : (isAr ? 'استيراد' : 'Import')}
              </button>
            )}
          </>
        }
      >
        {!batchId && (
          <>
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
          </>
        )}

        {isProcessing && (
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
            {isAr
              ? 'يمكنك إغلاق هذه النافذة والانتقال إلى صفحات أخرى — سيتم إشعارك عند الانتهاء.'
              : "You can close this - we'll notify you when import is done."}
          </div>
        )}

        <ImportBatchResults status={status} isAr={isAr}/>
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
              background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)',
            }}>{v}</div>
          ))}
        </div>
      </Modal>
    </>
  );
}
