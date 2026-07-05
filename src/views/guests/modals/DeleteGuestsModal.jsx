import React, { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import { Icon } from '../../../components/Icons';
import toast from '../../../lib/toast';
import { deleteSelectedGuests } from '../../../api/services/guestService';
import { fmtNum } from '../../../i18n/translations';

export default function DeleteGuestsModal({ open, onClose, selectedGuests, activeEventId, lang, onDeleted }) {
  const isAr = lang === 'ar';
  const count = selectedGuests.length;
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteSelectedGuests(activeEventId, selectedGuests.map(g => g.id));
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
          ? `هل أنت متأكد من حذف ${fmtNum(count, lang)} ضيف؟ لا يمكن التراجع.`
          : `Are you sure you want to delete ${count} selected guest${count !== 1 ? 's' : ''}? This cannot be undone.`
        }
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 180, overflowY: 'auto' }}>
        {selectedGuests.slice(0, 8).map(g => (
          <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 8, background: 'var(--surface-soft-2)', fontSize: 13 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e05050', flexShrink: 0 }}/>
            <span style={{ fontWeight: 500 }}>{g.fullName}</span>
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
