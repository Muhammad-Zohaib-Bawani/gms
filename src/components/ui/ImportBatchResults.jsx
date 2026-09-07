import React from 'react';
import { Icon } from '../Icons';

// Shared "live progress + per-row results" panel for background bulk imports
// (Events, Guests) — status comes from useImportBatchPoll.
export default function ImportBatchResults({ status, isAr }) {
  if (!status) return null;
  const isTerminal = status.status === 'completed' || status.status === 'failed';
  const isFailed = status.status === 'failed';

  return (
    <div>
      {!isTerminal && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--ink-mute)', marginBottom: 8 }}>
          <Icon name="refresh" size={13}/>
          {status.status === 'queued'
            ? (isAr ? 'في قائمة الانتظار…' : 'Queued…')
            : (isAr ? 'جارٍ المعالجة…' : 'Processing…')}
        </div>
      )}

      {isFailed && (
        <div style={{ fontSize: 12, color: 'var(--danger)', padding: '8px 10px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, marginBottom: 8 }}>
          {status.errorMessage}
        </div>
      )}

      {!isFailed && isTerminal && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 8, fontSize: 12 }}>
          <span style={{ color: 'var(--ink-mute)' }}>{isAr ? 'الإجمالي' : 'Total'} <strong style={{ color: 'var(--ink)' }}>{status.total}</strong></span>
          <span style={{ color: 'var(--accent)' }}>{isAr ? 'تم الاستيراد' : 'Imported'} <strong>{status.imported}</strong></span>
          <span style={{ color: status.failed ? 'var(--danger)' : 'var(--ink-mute)' }}>{isAr ? 'فشل' : 'Failed'} <strong>{status.failed}</strong></span>
        </div>
      )}

      {status.rows?.length > 0 && (
        <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: 8 }}>
          {status.rows.map((r) => (
            <div key={r.row} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', fontSize: 12,
              borderBottom: '1px solid var(--glass-border)',
            }}>
              <Icon name={r.success ? 'check' : 'close'} size={13}
                style={{ color: r.success ? 'var(--accent)' : 'var(--danger)', flexShrink: 0, marginTop: 1 }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>
                  {isAr ? `صف ${r.row}` : `Row ${r.row}`}{r.title ? ` — ${r.title}` : ''}
                </div>
                {!r.success && <div style={{ color: 'var(--danger)', marginTop: 2 }}>{r.error}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
