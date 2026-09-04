import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../../../components/Icons';
import ImportBatchResults from '../../../components/ui/ImportBatchResults';
import toast from '../../../lib/toast';
import useImportBatchPoll from '../../../lib/useImportBatchPoll';
import { importGuests, getGuestImportBatch, getGuestImportTemplate } from '../../../api/services/guestService';

// Embeddable body of the Excel bulk-import flow — used as the "Import Guest"
// tab inside GuestModal (previously its own standalone ImportModal). The
// upload only kicks off a Hangfire job (StartGuestsImportAsync) and returns a
// batch id — parsing/insert runs in the background, so the user can close
// this and keep working; a notification fires when it's done, deep-linking
// back here via `?importBatch=` (see GuestsView / GuestModal).
//
// The template itself is generated server-side per event (BuildGuestImportTemplateAsync)
// with real Excel data validation — Guest Type/Organization/Nationality/Service
// Level are dropdown-only, dates are calendar-validated against this event's own
// range, and Accreditation Required is a TRUE/FALSE dropdown — so there's nothing
// left here to hardcode; a stale template is rejected by the backend with a
// message asking for a fresh one.
export default function ImportGuestsPanel({ activeEventId, lang, onImported, initialBatchId }) {
  const isAr    = lang === 'ar';
  const navigate = useNavigate();
  const fileRef = useRef();
  const notifiedRef = useRef(false);

  const [file,     setFile]     = useState(null);
  const [dragging, setDragging] = useState(false);
  const [starting, setStarting] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [batchId,  setBatchId]  = useState(initialBatchId || null);

  const status = useImportBatchPoll(batchId, getGuestImportBatch);

  useEffect(() => {
    if (initialBatchId) { setBatchId(initialBatchId); notifiedRef.current = true; }
  }, [initialBatchId]);

  useEffect(() => {
    if (!status || notifiedRef.current) return;
    if (status.status !== 'completed' && status.status !== 'failed') return;
    notifiedRef.current = true;

    if (status.imported > 0) onImported?.();

    if (status.status === 'failed') {
      toast.error(status.errorMessage || (isAr ? 'فشل الاستيراد' : 'Import failed'));
    } else if (status.failed === 0) {
      toast.success(isAr ? `تم استيراد ${status.imported} مندوب` : `Imported ${status.imported} delegate${status.imported === 1 ? '' : 's'}`);
    } else {
      toast.warning(isAr
        ? `تم استيراد ${status.imported} من ${status.total} — فشل ${status.failed}`
        : `Imported ${status.imported} of ${status.total} — ${status.failed} failed`);
    }
  }, [status, isAr, onImported]);

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (f) { setFile(f); setBatchId(null); notifiedRef.current = false; }
  }

  async function handleImport() {
    if (!file || !activeEventId) return;
    setStarting(true);
    try {
      const res = await importGuests(activeEventId, file);
      setBatchId(res.batchId);
      toast.success(isAr ? 'بدأ الاستيراد في الخلفية' : 'Import started in the background');
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر بدء الاستيراد' : 'Could not start the import');
    } finally {
      setStarting(false);
    }
  }

  async function handleDownloadTemplate() {
    if (!activeEventId) return;
    setDownloadingTemplate(true);
    try {
      const blob = await getGuestImportTemplate(activeEventId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'delegate-import-template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر تحميل القالب' : 'Could not download the template');
    } finally {
      setDownloadingTemplate(false);
    }
  }

  const isProcessing = batchId && status && status.status !== 'completed' && status.status !== 'failed';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!batchId && (
        <>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--glass-border)'}`,
              borderRadius: 12, padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
              background: dragging ? 'hsl(var(--brand-hsl) / 0.08)' : 'var(--surface-soft-2)',
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
                  {isAr ? 'اسحب ملف Excel هنا' : 'Drag & drop an Excel file'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                  {isAr ? 'أو انقر للاختيار' : 'or click to browse'}
                </div>
              </>
            )}
            <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleDrop}/>
          </div>

          <button
            type="button"
            className="btn"
            style={{ alignSelf: 'flex-start', fontSize: 12 }}
            disabled={!activeEventId || downloadingTemplate}
            onClick={(e) => { e.stopPropagation(); handleDownloadTemplate(); }}
          >
            <Icon name="download" size={13}/>
            {downloadingTemplate
              ? (isAr ? 'جارٍ التحميل…' : 'Downloading…')
              : (isAr ? 'تحميل قالب Excel' : 'Download Excel template')}
          </button>

          <div className="alert alert-info" style={{ fontSize: 12.5 }}>
            <Icon name="alert" size={14} />
            <div>
              {isAr ? 'الحقول المطلوبة: الاسم الأول، الاسم الأخير، والبريد الإلكتروني.' : 'Required fields: First Name, Last Name and Email.'}
              {' '}
              {isAr ? 'إذا حددت مستوى خدمة، يمكن إضافة خدماته لكل مندوب لاحقاً من صفحة' : "If you assign a Service Level, its services can be added per delegate afterwards from the"}
              {' '}
              <a href="/travel" onClick={(e) => { e.preventDefault(); navigate('/travel'); }} style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                {isAr ? 'السفر والخدمات اللوجستية' : 'Services'}
              </a>
              {isAr ? '.' : ' page.'}
            </div>
          </div>

          <button className="btn primary" disabled={!file || starting} onClick={handleImport} style={{ alignSelf: 'flex-end' }}>
            <Icon name="upload" size={13}/>
            {starting ? (isAr ? 'جارٍ البدء…' : 'Starting…') : (isAr ? 'استيراد' : 'Import')}
          </button>
        </>
      )}

      {isProcessing && (
        <div style={{ fontSize: 12, color: 'var(--ink-mute)', fontStyle: 'italic' }}>
          {isAr
            ? 'يمكنك إغلاق هذه النافذة والانتقال إلى صفحات أخرى — سيتم إشعارك عند الانتهاء.'
            : "You can close this and go do other things — we'll notify you when it's done."}
        </div>
      )}

      <ImportBatchResults status={status} isAr={isAr}/>
    </div>
  );
}
