// Full accreditation-card viewer — opened from the "View Card" action on an
// issued guest. Kept separate from AccreditationView's quick-glance preview
// modal (which still handles issue/revoke); this one is purely the card.
import React from 'react';
import { Icon } from '../../components/Icons';
import AccreditationCard from './AccreditationCard';

export default function AccreditationCardModal({ open, guest, event, lang, onClose }) {
  const isAr = lang === 'ar';
  if (!open || !guest) return null;

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
          issued={guest.accreditationStatus === 'issued'}
        />

        <button className="btn" style={{ marginTop: 16 }} onClick={() => window.print()}>
          <Icon name="download" size={13}/> {isAr ? 'طباعة البطاقة' : 'Print card'}
        </button>
      </div>
    </div>
  );
}
