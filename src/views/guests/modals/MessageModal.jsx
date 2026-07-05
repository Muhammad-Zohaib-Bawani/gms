import React, { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import { Icon } from '../../../components/Icons';
import { fmtNum } from '../../../i18n/translations';

export default function MessageModal({ open, onClose, count, lang, onSent }) {
  const isAr = lang === 'ar';
  const [body, setBody]     = useState('');
  const [sending, setSending] = useState(false);

  function handleSend() {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setBody('');
      onSent?.();
      onClose();
    }, 800);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAr ? 'إرسال رسالة' : 'Send Message'}
      subtitle={isAr ? `إلى ${fmtNum(count, lang)} ضيف` : `To ${fmtNum(count, lang)} guest${count > 1 ? 's' : ''}`}
      width={480}
      footer={
        <>
          <button className="btn" onClick={onClose}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button className="btn primary" onClick={handleSend} disabled={!body.trim() || sending}>
            <Icon name="message" size={13}/>
            {sending ? (isAr ? 'جارٍ الإرسال…' : 'Sending…') : (isAr ? 'إرسال' : 'Send')}
          </button>
        </>
      }
    >
      <textarea
        rows={5}
        placeholder={isAr ? 'اكتب رسالتك هنا…' : 'Type your message here…'}
        value={body}
        onChange={e => setBody(e.target.value)}
        style={{ width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '8px 12px', color: 'var(--ink)', fontSize: 13, resize: 'vertical' }}
      />
    </Modal>
  );
}
