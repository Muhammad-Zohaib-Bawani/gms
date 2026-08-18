import React, { useState, useEffect } from 'react';
import Modal from '../../../components/ui/Modal';
import { Icon } from '../../../components/Icons';
import toast from '../../../lib/toast';
import { deleteSelectedGuests } from '../../../api/services/guestService';
import { getGuestSeatAssignments } from '../../../api/services/seatingService';
import { fmtNum } from '../../../i18n/translations';

// `selectedEventGuests` are GuestResponse rows — deleting removes their
// PARTICIPATION in `activeEventId` (by eventGuestId), not the person, who stays
// on whatever other events they're attending.
export default function DeleteGuestsModal({ open, onClose, selectedEventGuests, activeEventId, lang, onDeleted }) {
  const isAr = lang === 'ar';
  const count = selectedEventGuests.length;
  const [deleting, setDeleting] = useState(false);
  // eventGuestId -> [{ eventTitle, sessionTitle, seatCode }]
  const [seatsByEventGuest, setSeatsByEventGuest] = useState({});

  // Checked every time the modal opens for a (possibly different) selection —
  // purely informational: the backend already frees a guest's seat(s)
  // automatically when the guest is deleted (see Guest.DeleteGuestByIdAsync),
  // this just lets the admin know before confirming.
  useEffect(() => {
    if (!open) { setSeatsByEventGuest({}); return; }
    let cancelled = false;
    Promise.all(selectedEventGuests.map(g =>
      getGuestSeatAssignments(g.id).then(rows => [g.id, rows || []]).catch(() => [g.id, []]),
    )).then(pairs => {
      if (cancelled) return;
      const map = {};
      pairs.forEach(([id, rows]) => { if (rows.length) map[id] = rows; });
      setSeatsByEventGuest(map);
    });
    return () => { cancelled = true; };
  }, [open, selectedEventGuests]);

  const seatedEventGuests = selectedEventGuests.filter(g => seatsByEventGuest[g.id]?.length);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteSelectedGuests(activeEventId, selectedEventGuests.map(g => g.id)); // g.id = eventGuestId
      onDeleted();
      onClose();
      toast.success(
        isAr
          ? `تم حذف ${fmtNum(count, lang)} ضيف`
          : `${count} guest${count !== 1 ? 's' : ''} deleted`
      );
    } catch {
      toast.error(isAr ? 'حدث خطأ أثناء الحذف' : 'Error deleting guests');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAr ? 'تأكيد الحذف' : 'Delete Guests'}
      width={420}
      footer={
        <>
          <button className="btn" onClick={onClose}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button
            className="btn primary"
            style={{ background: '#b82a2a', borderColor: '#b82a2a' }}
            onClick={handleDelete}
            disabled={deleting}
          >
            <Icon name="close" size={13}/>
            {deleting ? (isAr ? 'جارٍ الحذف…' : 'Deleting…') : (isAr ? 'حذف' : 'Delete')}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--ink-dim)', marginBottom: 12 }}>
        {isAr
          ? `هل أنت متأكد من حذف ${fmtNum(count, lang)} ضيف؟ سيتم أيضًا حذف الخدمات المرتبطة به (الطيران، الإقامة، النقل). لا يمكن التراجع عن هذا الإجراء.`
          : `Are you sure you want to delete ${count} selected guest${count !== 1 ? 's' : ''}? This will also delete their associated services (flight, accommodation, transport). This cannot be undone.`
        }
      </p>

      {seatedEventGuests.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12,
          padding: '10px 12px', borderRadius: 10,
          background: 'rgba(224,192,126,0.12)', border: '1px solid rgba(224,192,126,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#e0c47e', fontWeight: 600, fontSize: 12.5 }}>
            <Icon name="alert" size={14}/>
            {isAr ? 'تنبيه: مقعد مخصص' : 'Heads up: seat assigned'}
          </div>
          {seatedEventGuests.map(g => (
            <div key={g.id} style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>
              {isAr ? (
                <>
                  <b>{g.fullName}</b> مُخصَّص له/لها مقعد بالفعل
                  {' — '}
                  {seatsByEventGuest[g.id].map((s, i) => (
                    <span key={i}>
                      {i > 0 && '، '}
                      {s.eventTitle}{s.sessionTitle ? ` · ${s.sessionTitle}` : ''} · {isAr ? 'مقعد' : 'Seat'} {s.seatCode}
                    </span>
                  ))}
                  . هل أنت متأكد أنك تريد حذف هذا الضيف؟ بحذف هذا الضيف سيصبح المقعد متاحًا تلقائيًا لتخصيصه لضيف آخر.
                </>
              ) : (
                <>
                  <b>{g.fullName}</b> is already assigned to a seat
                  {' — '}
                  {seatsByEventGuest[g.id].map((s, i) => (
                    <span key={i}>
                      {i > 0 && ', '}
                      {s.eventTitle}{s.sessionTitle ? ` · ${s.sessionTitle}` : ''} · Seat {s.seatCode}
                    </span>
                  ))}
                  . Are you sure you want to delete this guest? By deleting this guest, the seat will automatically become available to assign to another guest.
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 180, overflowY: 'auto' }}>
        {selectedEventGuests.slice(0, 8).map(g => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--surface-soft-2)', fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e05050', flexShrink: 0 }}/>
            <span style={{ fontWeight: 500 }}>{g.fullName}</span>
            {seatsByEventGuest[g.id]?.length > 0 && (
              <span className="chip pending" style={{ fontSize: 10 }}>
                <Icon name="seating" size={10}/> {isAr ? 'مقعد' : 'Seated'}
              </span>
            )}
            {g.tier && <span className="chip" style={{ fontSize: 10.5, marginLeft: 'auto' }}>{g.tier}</span>}
          </div>
        ))}
        {count > 8 && (
          <div style={{ fontSize: 12, color: 'var(--ink-mute)', textAlign: 'center', padding: '4px 0' }}>
            {isAr ? `و${fmtNum(count - 8, lang)} آخرين…` : `…and ${count - 8} more`}
          </div>
        )}
      </div>
    </Modal>
  );
}
