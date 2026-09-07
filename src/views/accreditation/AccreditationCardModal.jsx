// Full accreditation-card viewer — this is now THE view for a guest's
// accreditation on click, issued or not (see AccreditationView), not just a
// "View Card" action on already-issued guests. Issue/Revoke are optional so
// this stays usable as a pure viewer wherever the caller doesn't need them.
import React from 'react';
import { Icon } from '../../components/Icons';
import AccreditationCard from './AccreditationCard';

export default function AccreditationCardModal({
  open, guest, event, lang, onClose,
  onIssue, onRevoke, canIssue = true, busy = false, notAcceptedTitle,
}) {
  const isAr = lang === 'ar';
  if (!open || !guest) return null;
  const issued = guest.accreditationStatus === 'issued';

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}
      onClick={onClose}
    >
      <div
        className="modal-solid"
        style={{ borderRadius: 20, padding: '28px 28px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {isAr ? 'بطاقة الاعتماد' : 'Accreditation Card'}
          </span>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14}/></button>
        </div>

        <AccreditationCard
          guest={guest}
          event={event}
          lang={lang}
          issued={issued}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {issued
            ? onRevoke && (
              <button className="btn" disabled={busy} style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }} onClick={onRevoke}>
                <Icon name="x" size={13}/> {isAr ? 'سحب' : 'Revoke'}
              </button>
            )
            : onIssue && (
              <button className="btn primary" disabled={busy || !canIssue}
                title={!canIssue ? notAcceptedTitle : undefined}
                style={canIssue ? undefined : { opacity: 0.4, cursor: 'not-allowed' }}
                onClick={onIssue}>
                <Icon name="badge" size={13}/> {isAr ? 'إصدار' : 'Issue'}
              </button>
            )}
          <button className="btn" onClick={() => window.print()}>
            <Icon name="download" size={13}/> {isAr ? 'طباعة البطاقة' : 'Print card'}
          </button>
        </div>
      </div>
    </div>
  );
}
