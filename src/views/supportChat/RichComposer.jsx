// Reply composer for the support chat thread: multi-line text (Enter sends,
// Shift+Enter newlines) plus one image and one generic-file attachment slot
// (8 MB cap, matches the single AttachmentUrl/AttachmentType column on
// SupportMessage).
//
// Body is sent as PLAIN TEXT. The formatting toolbar is gone on purpose — every
// reader of a message body (portal thread, guest app, driver app, notification
// preview) renders it as text, so markup only ever showed up as literal tags.
import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Icon } from '../../components/Icons';
import toast from '../../lib/toast';
import { uploadImageFile, stripSasToken } from '../../api/services/uploadService';

export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB, per spec

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// `onSend({ body, attachmentUrl, attachmentType })` — return `false` to keep the
// draft (e.g. the send failed); anything else clears the composer.
export default function RichComposer({ isAr, placeholder, disabled, sending, onSend }) {
  const [attachment, setAttachment] = useState(null); // { file, kind, previewUrl, uploading, uploadedUrl }
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Both refs so the editor's key-handler (bound once, at construction) always
  // calls the *current* render's handleSend/attachment rather than a stale one.
  const sendRef = useRef(() => {});
  const attachmentRef = useRef(attachment);
  attachmentRef.current = attachment;

  const editor = useEditor({
    extensions: [
      // Text only — no heading/marks worth offering when the body is plain text.
      StarterKit.configure({ heading: false }),
      Placeholder.configure({ placeholder: placeholder || '' }),
    ],
    content: '',
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendRef.current();
          return true;
        }
        return false;
      },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // constructed once — see the refs above for why that's safe

  useEffect(() => { editor?.setEditable(!disabled); }, [disabled, editor]);
  useEffect(() => () => { editor?.destroy(); }, [editor]);

  async function handlePickFile(e, kind) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error(isAr ? 'الحد الأقصى لحجم الملف 8 ميغابايت' : 'File size limit is 8 MB');
      return;
    }
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    const previewUrl = kind === 'image' ? URL.createObjectURL(file) : null;
    setAttachment({ file, kind, previewUrl, uploading: true, uploadedUrl: null });
    try {
      const signedUrl = await uploadImageFile(file);
      setAttachment((prev) => (prev && prev.file === file ? { ...prev, uploading: false, uploadedUrl: stripSasToken(signedUrl) } : prev));
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر رفع الملف' : 'Could not upload the file');
      setAttachment(null);
    }
  }

  function removeAttachment() {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    setAttachment(null);
  }

  const isEmpty = !editor || editor.isEmpty;
  const attachmentReady = attachment && !attachment.uploading && attachment.uploadedUrl;
  const attachmentBusy = attachment && attachment.uploading;
  const canSend = !disabled && !sending && !attachmentBusy && (!isEmpty || attachmentReady);

  async function handleSend() {
    if (!canSend) return;
    const current = attachmentRef.current;
    const payload = {
      // Plain text, not getHTML(): the body is stored and rendered as text
      // everywhere (portal thread, guest app, driver app, notification preview),
      // so HTML would just show up as literal <p> tags in the apps.
      body: isEmpty ? '' : editor.getText({ blockSeparator: '\n' }).trim(),
      attachmentUrl: current?.uploadedUrl || null,
      attachmentType: current ? (current.file.type || 'application/octet-stream') : null,
    };
    const result = await onSend(payload);
    if (result !== false) {
      editor?.commands.clearContent(true);
      removeAttachment();
    }
  }
  sendRef.current = handleSend;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {attachment && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
          background: 'var(--surface-soft-3)', borderRadius: 8, border: '1px solid var(--glass-border)', width: 'fit-content',
        }}>
          {attachment.kind === 'image' && attachment.previewUrl ? (
            <img src={attachment.previewUrl} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />
          ) : (
            <Icon name="doc" size={16} style={{ color: 'var(--ink-mute)' }} />
          )}
          <div style={{ fontSize: 12 }}>
            <div style={{ fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {attachment.file.name}
            </div>
            <div style={{ color: 'var(--ink-faint)', fontSize: 10.5 }}>
              {attachment.uploading ? (isAr ? 'جارٍ الرفع…' : 'Uploading…') : fmtBytes(attachment.file.size)}
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={removeAttachment} style={{ marginInlineStart: 4 }}>
            <Icon name="close" size={12} />
          </button>
        </div>
      )}

      <div style={{ border: '1px solid var(--glass-border)', borderRadius: 10, background: 'var(--surface-soft-3)', overflow: 'hidden' }}>
        <div className="chat-composer-editor" style={{ padding: '8px 12px', maxHeight: 140, overflowY: 'auto', fontSize: 13.5, color: 'var(--ink)' }}>
          <EditorContent editor={editor} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderTop: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" className="icon-btn" title={isAr ? 'إرفاق صورة' : 'Attach image'} onClick={() => imageInputRef.current?.click()} disabled={disabled}>
              <Icon name="image" size={15} />
            </button>
            <button type="button" className="icon-btn" title={isAr ? 'إرفاق ملف' : 'Attach file'} onClick={() => fileInputRef.current?.click()} disabled={disabled}>
              <Icon name="doc" size={15} />
            </button>
            <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={(e) => handlePickFile(e, 'image')} />
            <input ref={fileInputRef} type="file" hidden onChange={(e) => handlePickFile(e, 'file')} />
          </div>
          <button
            type="button" className="btn primary" onClick={handleSend} disabled={!canSend}
            style={{ height: 32, width: 32, padding: 0, justifyContent: 'center' }}
            title={isAr ? 'إرسال' : 'Send'}
          >
            <Icon name="send" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
