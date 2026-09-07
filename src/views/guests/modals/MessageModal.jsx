import React, { useState } from 'react';
import Modal from '../../../components/ui/Modal';
import { Icon } from '../../../components/Icons';
import { fmtNum } from '../../../i18n/translations';
import { startConversationWithGuest } from '../../../api/services/supportChatService';
import toast from '../../../lib/toast';

// One support-chat conversation per selected guest — same endpoint the
// Guests page's single-row "Message" action deep-links to, just looped here
// instead of leaving the admin portal. Sequential so one slow/failed send
// doesn't drop the rest (Promise.all would reject the whole batch on the
// first failure).
//
// Addressed by PERSON (`personId`), not by participation: a guest has one
// support thread across every event they attend, so selecting the same human on
// two events would still be one conversation.
export default function MessageModal({ open, onClose, guests = [], lang, onSent }) {
  const isAr = lang === 'ar';
  const count = guests.length;
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    let sent = 0;
    const failed = [];
    for (const g of guests) {
      try {
        await startConversationWithGuest(g.personId, { body: text });
        sent += 1;
      } catch {
        failed.push(g.fullName || g.name || g.personId);
      }
    }
    setSending(false);
    setBody('');
    onClose();
    onSent?.({ sent, failed });
    if (failed.length === 0) {
      toast.success(
        isAr ? `تم إرسال الرسالة إلى ${fmtNum(sent, lang)} ضيف` : `Message sent to ${sent} guest${sent === 1 ? '' : 's'}`,
      );
    } else {
      toast.warning(
        isAr
          ? `تم الإرسال إلى ${fmtNum(sent, lang)} من ${fmtNum(count, lang)} — تعذّر الإرسال لـ ${failed.length}`
          : `Sent to ${sent} of ${count} — ${failed.length} failed`,
      );
    }
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
      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 6 }}>
        {isAr
          ? 'يبدأ هذا محادثة دعم مع كل ضيف على حدة — يمكن للضيف الرد من تطبيق VIP.'
          : 'This starts (or continues) a support chat with each guest — they can reply from the VIP app.'}
      </div>
    </Modal>
  );
}
