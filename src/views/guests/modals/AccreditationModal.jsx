import React from 'react';
import Modal from '../../../components/ui/Modal';
import { Icon } from '../../../components/Icons';
import { fmtNum } from '../../../i18n/translations';

export default function AccreditationModal({ open, onClose, count, lang, onConfirm }) {
  const isAr = lang === 'ar';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAr ? 'إصدار الاعتماد' : 'Issue Accreditation'}
      width={400}
      footer={
        <>
          <button className="btn" onClick={onClose}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button className="btn primary" onClick={onConfirm}>
            <Icon name="badge" size={13}/>
            {isAr ? 'إصدار' : 'Issue'}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--ink-dim)' }}>
        {isAr
          ? `سيتم إصدار الاعتماد لـ ${fmtNum(count, lang)} ضيف. هل تريد المتابعة؟`
          : `Issue accreditation for ${fmtNum(count, lang)} selected guest${count > 1 ? 's' : ''}. Proceed?`
        }
      </p>
    </Modal>
  );
}
