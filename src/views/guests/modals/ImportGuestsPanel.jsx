import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '../../../components/Icons';
import ImportBatchResults from '../../../components/ui/ImportBatchResults';
import toast from '../../../lib/toast';
import useImportBatchPoll from '../../../lib/useImportBatchPoll';
import { importGuests, getGuestImportBatch } from '../../../api/services/guestService';

// Embeddable body of the CSV bulk-import flow — used as the "Import Guest"
// tab inside GuestModal (previously its own standalone ImportModal). The
// upload only kicks off a Hangfire job (StartGuestsImportAsync) and returns a
// batch id — parsing/insert runs in the background, so the user can close
// this and keep working; a notification fires when it's done, deep-linking
// back here via `?importBatch=` (see GuestsView / GuestModal).
export default function ImportGuestsPanel({ activeEventId, lang, onImported, initialBatchId }) {
  const isAr    = lang === 'ar';
  const fileRef = useRef();
  const notifiedRef = useRef(false);

  const [file,     setFile]     = useState(null);
  const [dragging, setDragging] = useState(false);
  const [starting, setStarting] = useState(false);
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
      toast.success(isAr ? `تم استيراد ${status.imported} ضيف` : `Imported ${status.imported} guest${status.imported === 1 ? '' : 's'}`);
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
