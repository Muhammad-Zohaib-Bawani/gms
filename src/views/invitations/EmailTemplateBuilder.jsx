import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Extension, Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { brandHex } from '../../lib/brandColor';

// ── Config ──────────────────────────────────────────────────────────────────
export const TEMPLATE_VARIABLES = ['{{GuestName}}', '{{EventName}}', '{{EventDate}}', '{{Venue}}'];

export const SAMPLE_DATA = {
  '{{GuestName}}': 'H.E. Marcelo Reyes',
  '{{EventName}}': 'Doha Forum',
  '{{EventDate}}': '07 Dec 2025',
  '{{Venue}}': 'Sheraton Grand, Doha',
  '{{FirstName}}': 'Marcelo',
  '{{LastName}}': 'Reyes',
};

export const FONT_OPTIONS = [
  { value: "'Loew Next Arabic', Arial, sans-serif", label: 'Loew Next Arabic' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: "'Courier New', monospace", label: 'Courier New' },
  { value: 'Tahoma, sans-serif', label: 'Tahoma' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
];
export const FONT_SIZE_OPTIONS = ['12', '13', '14', '15', '16', '18', '20', '24', '28', '32'];

export const DEFAULT_DESIGN = {
  bg: '#ffffff',
  bgImage: '',
  font: FONT_OPTIONS[1].value, // Arial (email-safe default)
  fontSize: 15,
  textColor: '#1a1a1a',
  buttonLabel: 'View Invitation & Respond',
  buttonColor: brandHex(),  // email HTML needs a real hex, not var()
  buttonTextColor: '#ffffff',
  align: 'left',
};

// Wrap the editor's inner HTML in an email-ready container carrying the design.
// This is what the backend stores in Body and sends to guests.
export function wrapEmailHtml(cfg, innerHtml) {
  const bg = cfg.bgImage
    ? `background-image:url('${cfg.bgImage}');background-size:cover;background-position:center;`
    : `background:${cfg.bg};`;
  return (
    `<div style="${bg}font-family:${cfg.font};font-size:${cfg.fontSize}px;color:${cfg.textColor};` +
    `padding:28px 30px;line-height:1.7;text-align:${cfg.align};border-radius:12px;">${innerHtml}</div>`
  );
}

export function substituteVars(html, sample = SAMPLE_DATA) {
  let out = html || '';
  for (const [k, v] of Object.entries(sample)) out = out.split(k).join(v);
  // Preview only: show the invite button as a real (inert) link.
  out = out.split('{{InviteLink}}').join('#');
  return out;
}

export function parseDesign(designConfig) {
  if (!designConfig) return null;
  try { return typeof designConfig === 'string' ? JSON.parse(designConfig) : designConfig; }
  catch { return null; }
}

// ── Custom TipTap extensions ─────────────────────────────────────────────────

// Font size via a textStyle attribute (no official v2 extension).
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() { return { types: ['textStyle'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: el => el.style.fontSize || null,
          renderHTML: attrs => (attrs.fontSize ? { style: `font-size:${attrs.fontSize}` } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      setFontSize: size => ({ chain }) => chain().setMark('textStyle', { fontSize: size }).run(),
    };
  },
});

// Placeable invite button. Serializes to an <a href="{{InviteLink}}"> that the
// backend swaps for each guest's tokenized RSVP URL at send time.
const InviteButton = Node.create({
  name: 'inviteButton',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      label: { default: DEFAULT_DESIGN.buttonLabel },
      bg: { default: DEFAULT_DESIGN.buttonColor },
      color: { default: DEFAULT_DESIGN.buttonTextColor },
    };
  },
  parseHTML() {
    return [{
      tag: 'a[data-invite-button]',
      getAttrs: el => ({
        label: el.textContent || DEFAULT_DESIGN.buttonLabel,
        bg: el.style.background || el.style.backgroundColor || DEFAULT_DESIGN.buttonColor,
        color: el.style.color || DEFAULT_DESIGN.buttonTextColor,
      }),
    }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const { label, bg, color } = node.attrs;
    return ['a', mergeAttributes(HTMLAttributes, {
      href: '{{InviteLink}}',
      'data-invite-button': 'true',
      style: `display:block;width:fit-content;margin:24px auto;padding:14px 32px;background:${bg};` +
             `color:${color};text-decoration:none;border-radius:10px;font-weight:600;text-align:center;`,
    }), label];
  },
  addCommands() {
    return {
      insertInviteButton: (attrs = {}) => ({ commands }) => commands.insertContent({ type: this.name, attrs }),
    };
  },
});

// ── Toolbar ──────────────────────────────────────────────────────────────────
const tbBtnStyle = (active) => ({
  minWidth: 30, height: 30, padding: '0 8px', borderRadius: 7, cursor: 'pointer',
  border: '1px solid var(--glass-border)', fontSize: 13, lineHeight: 1,
  background: active ? 'var(--accent)' : 'var(--surface-soft-2)',
  color: active ? '#fff' : 'var(--ink-dim)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
});
const sep = () => <span style={{ width: 1, height: 20, background: 'var(--glass-border)', margin: '0 2px' }} />;

function Toolbar({ editor, design, setDesign, isAr }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const rerender = () => force(n => n + 1);
    editor.on('selectionUpdate', rerender);
    editor.on('transaction', rerender);
    return () => { editor.off('selectionUpdate', rerender); editor.off('transaction', rerender); };
  }, [editor]);
  const fileRef = useRef(null);
  if (!editor) return null;

  const Btn = ({ on, active, title, children }) => (
    <button type="button" title={title} style={tbBtnStyle(active)}
      onMouseDown={e => { e.preventDefault(); on(); }}>{children}</button>
  );

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => editor.chain().focus().setImage({ src: reader.result }).run();
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const curFontSize = editor.getAttributes('textStyle').fontSize?.replace('px', '') || '';
  const curFont = editor.getAttributes('textStyle').fontFamily || '';

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center',
      padding: 8, border: '1px solid var(--glass-border)', borderRadius: 8, background: 'var(--surface-soft)' }}>
      <Btn on={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><b>B</b></Btn>
      <Btn on={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><i>I</i></Btn>
      <Btn on={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><u>U</u></Btn>
      {sep()}
      <Btn on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading">H</Btn>
      <Btn on={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">• ≡</Btn>
      <Btn on={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">1.</Btn>
      {sep()}
      <Btn on={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">⇤</Btn>
      <Btn on={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">≡</Btn>
      <Btn on={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">⇥</Btn>
      {sep()}
      {/* Font family */}
      <select value={curFont} title="Font"
        onChange={e => e.target.value
          ? editor.chain().focus().setFontFamily(e.target.value).run()
          : editor.chain().focus().unsetFontFamily().run()}
        style={{ height: 30, borderRadius: 7, border: '1px solid var(--glass-border)', background: 'var(--surface-soft-2)', color: 'var(--ink-dim)', fontSize: 12, padding: '0 6px' }}>
        <option value="">Font</option>
        {FONT_OPTIONS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
      </select>
      {/* Font size */}
      <select value={curFontSize} title="Font size"
        onChange={e => e.target.value && editor.chain().focus().setFontSize(`${e.target.value}px`).run()}
        style={{ height: 30, borderRadius: 7, border: '1px solid var(--glass-border)', background: 'var(--surface-soft-2)', color: 'var(--ink-dim)', fontSize: 12, padding: '0 6px' }}>
        <option value="">Size</option>
        {FONT_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {/* Text color */}
      <label title="Text color" style={{ ...tbBtnStyle(false), position: 'relative', overflow: 'hidden' }}>
        A
        <span style={{ position: 'absolute', bottom: 3, left: 6, right: 6, height: 3, background: editor.getAttributes('textStyle').color || 'var(--ink)' }} />
        <input type="color" onChange={e => editor.chain().focus().setColor(e.target.value).run()}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
      </label>
      {sep()}
      <Btn title="Insert link" on={() => {
        const url = window.prompt(isAr ? 'الرابط:' : 'Link URL:');
        if (url) editor.chain().focus().setLink({ href: url }).run();
        else editor.chain().focus().unsetLink().run();
      }}>🔗</Btn>
      <Btn title="Insert image" on={() => fileRef.current?.click()}>🖼</Btn>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
      {sep()}
      <button type="button" title="Insert the delegate RSVP button at the cursor"
        style={{ ...tbBtnStyle(false), background: 'var(--accent)', color: '#fff', fontWeight: 600, padding: '0 12px' }}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().insertInviteButton({
          label: design.buttonLabel, bg: design.buttonColor, color: design.buttonTextColor }).run(); }}>
        + {isAr ? 'زر الدعوة' : 'Invite button'}
      </button>
    </div>
  );
}

// ── Design bar ───────────────────────────────────────────────────────────────
function DesignBar({ design, setDesign, isAr }) {
  const fileRef = useRef(null);
  const set = (k, v) => setDesign(d => ({ ...d, [k]: v }));
  const onBgImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => set('bgImage', r.result);
    r.readAsDataURL(file);
    e.target.value = '';
  };
  const cell = { display: 'flex', flexDirection: 'column', gap: 4 };
  const lbl = { fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' };
  const swatch = { width: 32, height: 30, border: '1px solid var(--glass-border)', borderRadius: 7, padding: 0, background: 'none', cursor: 'pointer' };
  const sel = { height: 30, borderRadius: 7, border: '1px solid var(--glass-border)', background: 'var(--surface-soft-2)', color: 'var(--ink-dim)', fontSize: 12, padding: '0 6px' };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end',
      padding: 10, border: '1px solid var(--glass-border)', borderRadius: 8, background: 'var(--surface-soft)' }}>
      <div style={cell}>
        <span style={lbl}>{isAr ? 'الخلفية' : 'Background'}</span>
        <input type="color" value={design.bg} onChange={e => { set('bg', e.target.value); set('bgImage', ''); }} style={swatch} />
      </div>
      <div style={cell}>
        <span style={lbl}>{isAr ? 'صورة الخلفية' : 'BG image'}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" className="btn" style={{ padding: '0 10px', height: 30, fontSize: 12 }} onClick={() => fileRef.current?.click()}>
            {isAr ? 'رفع' : 'Upload'}
          </button>
          {design.bgImage && (
            <button type="button" className="btn ghost" style={{ padding: '0 8px', height: 30, fontSize: 12 }} onClick={() => set('bgImage', '')}>✕</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onBgImage} />
        </div>
      </div>
      <div style={cell}>
        <span style={lbl}>{isAr ? 'الخط' : 'Base font'}</span>
        <select value={design.font} onChange={e => set('font', e.target.value)} style={sel}>
          {FONT_OPTIONS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div style={cell}>
        <span style={lbl}>{isAr ? 'الحجم' : 'Base size'}</span>
        <select value={String(design.fontSize)} onChange={e => set('fontSize', Number(e.target.value))} style={sel}>
          {FONT_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}px</option>)}
        </select>
      </div>
      <div style={cell}>
        <span style={lbl}>{isAr ? 'زر: التسمية' : 'Button label'}</span>
        <input value={design.buttonLabel} onChange={e => set('buttonLabel', e.target.value)}
          style={{ ...sel, width: 190 }} />
      </div>
      <div style={cell}>
        <span style={lbl}>{isAr ? 'زر: اللون' : 'Button color'}</span>
        <input type="color" value={design.buttonColor} onChange={e => set('buttonColor', e.target.value)} style={swatch} />
      </div>
    </div>
  );
}

// ── Main builder ─────────────────────────────────────────────────────────────
export default function EmailTemplateBuilder({ value, onChange, isAr }) {
  const initial = useMemo(() => {
    const cfg = parseDesign(value?.designConfig);
    return {
      design: { ...DEFAULT_DESIGN, ...(cfg || {}) },
      content: cfg?.content ?? value?.body ?? '',
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // seed once
  const [design, setDesign] = useState(initial.design);
  const designRef = useRef(design);
  designRef.current = design;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: false, allowBase64: true }),
      InviteButton,
    ],
    content: initial.content || `<p>${isAr ? 'عزيزي {{GuestName}}،' : 'Dear {{GuestName}},'}</p><p></p>`,
    onUpdate: ({ editor }) => emit(editor, designRef.current),
  });

  const emit = useCallback((ed, cfg) => {
    if (!ed || !onChange) return;
    const inner = ed.getHTML();
    onChange({
      body: wrapEmailHtml(cfg, inner),
      designConfig: JSON.stringify({ ...cfg, content: inner }),
    });
  }, [onChange]);

  // Re-emit when design (bg/font/etc.) changes.
  useEffect(() => { if (editor) emit(editor, design); }, [design]); // eslint-disable-line

  const editableStyle = {
    background: design.bgImage ? `center/cover no-repeat url('${design.bgImage}')` : design.bg,
    fontFamily: design.font, fontSize: design.fontSize, color: design.textColor,
    textAlign: design.align, minHeight: 220, padding: '18px 20px', borderRadius: 10,
    border: '1px solid var(--glass-border)', lineHeight: 1.7,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <DesignBar design={design} setDesign={setDesign} isAr={isAr} />
      <Toolbar editor={editor} design={design} setDesign={setDesign} isAr={isAr} />
      <div className="tt-surface" style={editableStyle}>
        <EditorContent editor={editor} />
      </div>
      {/* Variables — insert at caret */}
      <div>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {isAr ? 'المتغيرات' : 'Variables'}
          <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--ink-faint)', marginInlineStart: 6 }}>
            · {isAr ? 'انقر للإدراج عند المؤشر' : 'click to insert at cursor'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TEMPLATE_VARIABLES.map(v => (
            <span key={v} className="chip" style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11 }}
              onMouseDown={e => { e.preventDefault(); editor && editor.chain().focus().insertContent(v).run(); }}>
              <span className="dot" style={{ background: 'var(--accent)' }} />{v}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Live preview (right column) ──────────────────────────────────────────────
export function EmailPreview({ body, subject, isAr }) {
  const html = substituteVars(body || '');
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--glass-border)', background: '#fff' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.08)', background: '#faf6f7' }}>
        <div style={{ fontSize: 10.5, color: '#8a8a8a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{isAr ? 'الموضوع' : 'Subject'}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginTop: 2 }}>
          {subject || (isAr ? 'سطر الموضوع…' : 'Subject line…')}
        </div>
      </div>
      <div style={{ padding: 16, maxHeight: 560, overflowY: 'auto' }}>
        {body
          ? <div dangerouslySetInnerHTML={{ __html: html }} />
          : <div style={{ color: '#9aa', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>{isAr ? 'ابدأ التصميم…' : 'Start designing…'}</div>}
      </div>
    </div>
  );
}
