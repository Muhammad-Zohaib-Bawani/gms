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
import toast from '../../lib/toast';
import { uploadImageFile } from '../../api/services/uploadService';

// ── Config ──────────────────────────────────────────────────────────────────
// Every placeholder the send path substitutes, in the same order the backend
// registry lists them (Core/Constants/EmailTemplatePurposes.cs → and the `vars`
// dictionary in Infrastructure/Services/Guest.cs, which is what actually runs).
// Add here only in step with that dictionary — an advertised token the send path
// doesn't replace reaches the guest as literal "{{Whatever}}".
export const TEMPLATE_VARIABLES = [
  { token: '{{GuestName}}', label: { en: 'Full name, with title', ar: 'الاسم الكامل مع اللقب' } },
  { token: '{{FirstName}}', label: { en: 'First name', ar: 'الاسم الأول' } },
  { token: '{{LastName}}', label: { en: 'Last name', ar: 'اسم العائلة' } },
  { token: '{{EventName}}', label: { en: 'Event title', ar: 'اسم الفعالية' } },
  { token: '{{EventDate}}', label: { en: 'Event start date', ar: 'تاريخ البداية' } },
  { token: '{{Venue}}', label: { en: 'Venue name', ar: 'المكان' } },
  { token: '{{Organization}}', label: { en: "Guest's organization", ar: 'جهة الضيف' } },
  { token: '{{ServiceLevel}}', label: { en: 'Service level / grade', ar: 'مستوى الخدمة' } },
  { token: '{{InviteLink}}', label: { en: "The guest's RSVP link", ar: 'رابط الرد' } },
];

export const FONT_OPTIONS = [
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Tahoma, sans-serif', label: 'Tahoma' },
  { value: 'Verdana, sans-serif', label: 'Verdana' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: "'Times New Roman', serif", label: 'Times New Roman' },
  { value: "'Courier New', monospace", label: 'Courier New' },
  { value: "'Loew Next Arabic', Arial, sans-serif", label: 'Loew Next Arabic' },
];
export const FONT_SIZE_OPTIONS = ['12', '13', '14', '15', '16', '18', '20', '24', '28', '32'];

export const DEFAULT_DESIGN = {
  bg: '#ffffff',
  bgImage: '',
  font: FONT_OPTIONS[0].value, // Arial (email-safe default)
  fontSize: 15,
  textColor: '#1a1a1a',
  buttonLabel: 'View Invitation & Respond',
  buttonColor: '#8d0134',
  buttonTextColor: '#ffffff',
  align: 'left',
};

/**
 * A browser normalises `style.fontFamily` when it round-trips through the DOM —
 * `'Loew Next Arabic', Arial` comes back as `"Loew Next Arabic", Arial`. TipTap
 * stores whatever the DOM reports, so a raw === against our option values never
 * matches and the font <select> snaps back to "Font" even though the style was
 * applied. Compare on a canonical form instead.
 */
const canonFont = (v) => (v || '').replace(/["']/g, '').replace(/\s*,\s*/g, ',').trim().toLowerCase();

/** The option value whose font matches what the editor reports, if any. */
export function matchFontOption(reported) {
  const c = canonFont(reported);
  if (!c) return '';
  return FONT_OPTIONS.find(f => canonFont(f.value) === c)?.value || '';
}
/**
 * Blob URLs are STORED bare but DISPLAYED signed.
 *
 * Public access is disabled on the storage account, so a bare blob URL returns
 * 409 — an uploaded image must keep its SAS token to render at all. But tokens
 * expire, so persisting one means the image dies within hours; the API's
 * BlobSasMiddleware re-signs bare blob URLs on every JSON response precisely so
 * the database never holds a token.
 *
 * Hence: the editor keeps the signed URL the upload returned, and the token is
 * stripped only on the way out (see `emit`). On reload the middleware signs it
 * again. Stripping at upload time is what made images invisible.
 */
const BLOB_URL_WITH_QUERY = /(https?:\/\/[^"'\s]*\.blob\.core\.windows\.net\/[^"'\s?]+)\?[^"'\s]*/gi;
export const stripBlobTokens = (html) => (html || '').replace(BLOB_URL_WITH_QUERY, '$1');

// Wrap the editor's inner HTML in an email-ready container carrying the design.
// This is what the backend stores in Body and sends to guests.
export function wrapEmailHtml(cfg, innerHtml) {
  const bg = cfg.bgImage
    ? `background-image:url('${cfg.bgImage}');background-size:cover;background-position:center;`
    : `background:${cfg.bg};`;
  // A wrapped image floats, and a float adds nothing to its parent's height, so
  // one at the end of the body would hang outside the coloured card. A trailing
  // clear costs nothing and works in Outlook, where `overflow:hidden` doesn't.
  const clear = '<div style="clear:both;font-size:0;line-height:0;">&nbsp;</div>';
  return (
    `<div style="${bg}font-family:${cfg.font};font-size:${cfg.fontSize}px;color:${cfg.textColor};` +
    `padding:28px 30px;line-height:1.7;text-align:${cfg.align};border-radius:12px;">${innerHtml}${clear}</div>`
  );
}

/**
 * Body as it should appear in the preview modal.
 *
 * Placeholders are shown AS placeholders rather than filled with invented sample
 * data — a preview reading "Doha Forum 2026" invites the reader to check the
 * wrong thing (is that the right event?) instead of the right one (is the
 * variable in the right place?).
 */
export function previewHtml(body) {
  const withInertLink = (body || '').split('{{InviteLink}}').join('#');
  // Tokens inside a tag (href, alt, style) are left alone — wrapping them in a
  // <span> there would corrupt the attribute rather than decorate anything.
  return withInertLink.replace(
    /(<[^>]*>)|(\{\{\s*[A-Za-z0-9_]+\s*\}\})/g,
    (match, tag, token) => (tag ? tag : (
      `<span style="background:rgba(141,1,52,0.08);color:#8d0134;border:1px dashed rgba(141,1,52,0.35);` +
      `border-radius:4px;padding:0 4px;font-size:0.92em;">${token}</span>`
    )),
  );
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

/**
 * Per-paragraph direction, so a mostly-English template can carry an Arabic
 * passage without the whole template being duplicated in Arabic.
 *
 * Deliberately sets only `direction` and not `text-align`: TextAlign owns
 * text-align, and both writing into the same style property would mean whichever
 * merged last silently wins. With direction alone, alignment falls to `start`,
 * which is what RTL text wants anyway.
 */
const TextDirection = Extension.create({
  name: 'textDirection',
  addOptions() { return { types: ['paragraph', 'heading'] }; },
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        dir: {
          default: null,
          parseHTML: el => el.getAttribute('dir') || null,
          renderHTML: attrs => (attrs.dir ? { dir: attrs.dir, style: `direction:${attrs.dir}` } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      // Mirrors TextAlign's shape: types not present in the selection report
      // false, but the ones that are present have already been updated.
      setTextDirection: dir => ({ commands }) =>
        this.options.types
          .map(type => commands.updateAttributes(type, { dir }))
          .every(Boolean),
    };
  },
});

/**
 * The stock Image node carries only src/alt/title, which is why a placed image
 * couldn't be resized or made to fit. These four attributes each render their
 * own `style` fragment; TipTap's mergeAttributes merges style property-wise, so
 * they compose instead of overwriting one another.
 *
 * Inline styles also beat the editor stylesheet's `img { max-width:100%;
 * height:auto }`, so an explicit size holds inside the editor too.
 */
const SizedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: el => el.style.width || el.getAttribute('width') || null,
        renderHTML: a => (a.width ? { style: `width:${a.width};max-width:100%` } : {}),
      },
      height: {
        default: null,
        parseHTML: el => el.style.height || el.getAttribute('height') || null,
        renderHTML: a => (a.height ? { style: `height:${a.height}` } : {}),
      },
      fit: {
        default: null,
        parseHTML: el => el.style.objectFit || null,
        // object-fit only means anything once a height is pinned, hence the
        // height control sitting next to it in the toolbar.
        renderHTML: a => (a.fit ? { style: `object-fit:${a.fit}` } : {}),
      },
      // Lets text run alongside a small image instead of the image claiming a
      // whole row. `float` rather than flex/grid or a wrapper table: it's one of
      // the few layout properties Outlook's Word engine actually honours, and it
      // needs no change to the surrounding document structure — the paragraph
      // after the image simply wraps around it, in the editor and in the email.
      wrap: {
        default: null,
        parseHTML: el => el.getAttribute('data-wrap') || el.style.cssFloat || null,
        renderHTML: (a) => {
          if (!a.wrap) return {};
          const side = a.wrap === 'right' ? 'right' : 'left';
          const gap = side === 'left' ? 'margin:0 16px 10px 0' : 'margin:0 0 10px 16px';
          return { 'data-wrap': side, style: `float:${side};${gap}` };
        },
      },
      align: {
        default: null,
        parseHTML: el => el.getAttribute('data-align') || null,
        renderHTML: (a) => {
          // A float already positions the image, and `display:block` plus auto
          // margins would fight it — wrap wins where both are set.
          if (!a.align || a.wrap) return {};
          const margins = a.align === 'center' ? 'margin-left:auto;margin-right:auto'
            : a.align === 'right' ? 'margin-left:auto;margin-right:0'
              : 'margin-left:0;margin-right:auto';
          return { 'data-align': a.align, style: `display:block;${margins}` };
        },
      },
    };
  },

  /**
   * Word-style drag handles on the selected image.
   *
   * A node view is editor-only — `renderHTML` above still produces the single
   * plain <img> that goes into the email, so none of this wrapper or its handles
   * reach a recipient.
   *
   * Written against the DOM rather than as a React node view: it's one element
   * plus eight handles driven by pointer events, and a React tree re-rendering on
   * every pointermove would fight the direct style writes that keep the drag
   * smooth.
   */
  addNodeView() {
    return ({ node, editor, getPos }) => {
      let current = node;

      const wrapper = document.createElement('div');
      wrapper.className = 'gms-img-wrap';
      const img = document.createElement('img');
      wrapper.appendChild(img);

      // Corners keep the aspect ratio, edges stretch one axis — the same split
      // Word uses, and the reason the handle carries its kind.
      const HANDLES = [
        ['nw', 'corner'], ['n', 'v'], ['ne', 'corner'], ['e', 'h'],
        ['se', 'corner'], ['s', 'v'], ['sw', 'corner'], ['w', 'h'],
      ];
      const badge = document.createElement('span');
      badge.className = 'gms-img-size';
      wrapper.appendChild(badge);

      /**
       * Width lives on the WRAPPER and the image fills it. A percentage on the
       * image inside a shrink-to-fit wrapper would resolve against a width the
       * image itself determines, so it collapses; this keeps px and % alike
       * predictable, and makes the handles line up with the visible box.
       */
      function apply(n) {
        img.setAttribute('src', n.attrs.src || '');
        if (n.attrs.alt) img.setAttribute('alt', n.attrs.alt); else img.removeAttribute('alt');
        if (n.attrs.title) img.setAttribute('title', n.attrs.title); else img.removeAttribute('title');

        wrapper.style.cssText = '';
        wrapper.style.width = n.attrs.width || '';
        img.style.width = n.attrs.width ? '100%' : '';
        img.style.height = n.attrs.height || '';
        img.style.objectFit = n.attrs.fit || '';

        if (n.attrs.wrap) {
          const side = n.attrs.wrap === 'right' ? 'right' : 'left';
          wrapper.style.float = side;
          wrapper.style.margin = side === 'left' ? '0 16px 10px 0' : '0 0 10px 16px';
        } else if (n.attrs.align) {
          wrapper.style.display = 'block';
          wrapper.style.marginLeft = n.attrs.align === 'left' ? '0' : 'auto';
          wrapper.style.marginRight = n.attrs.align === 'right' ? '0' : 'auto';
        }
      }
      apply(current);

      let drag = null;
      const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

      function onMove(e) {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        // Dragging a west/north handle moves the pointer opposite to growth.
        const sx = drag.dir.includes('w') ? -1 : 1;
        const sy = drag.dir.includes('n') ? -1 : 1;

        let w = drag.w;
        let h = drag.h;
        if (drag.kind === 'corner') {
          w = clamp(drag.w + dx * sx, MIN_IMAGE_PX, drag.maxW);
          h = Math.round(w / drag.ratio);
        } else if (drag.kind === 'h') {
          w = clamp(drag.w + dx * sx, MIN_IMAGE_PX, drag.maxW);
        } else {
          h = Math.max(MIN_IMAGE_PX, drag.h + dy * sy);
        }

        drag.next = { w: Math.round(w), h: Math.round(h) };
        wrapper.style.width = `${drag.next.w}px`;
        img.style.width = '100%';
        if (drag.kind !== 'h') img.style.height = `${drag.next.h}px`;
        badge.textContent = `${drag.next.w} × ${drag.next.h}`;
      }

      function onUp() {
        window.removeEventListener('pointermove', onMove);
        wrapper.classList.remove('is-resizing');
        const finished = drag;
        drag = null;
        if (!finished?.next) return;

        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos == null) return;

        // One transaction at the end, not one per pointermove: the live feedback
        // is the direct style write above, so the undo stack gets a single step
        // for the whole gesture instead of a hundred.
        //
        // Dragged to (near) the container edge → store width:100% with no pinned
        // height, not an absolute px. A percentage fills whatever box it lands in
        // — the editor, the preview, a narrow mobile client — and keeps the
        // natural aspect ratio, where a frozen px would overflow the moment the
        // box is narrower than the editor it was sized in. A width-changing drag
        // ('corner'/'h'), not a pure height drag ('v'), is what can reach full.
        const full = finished.kind !== 'v' && finished.next.w >= drag.maxW - FULL_WIDTH_SNAP_PX;
        const attrs = { ...current.attrs };
        if (full) {
          attrs.width = '100%';
          attrs.height = null;
        } else {
          attrs.width = `${finished.next.w}px`;
          if (finished.kind !== 'h') attrs.height = `${finished.next.h}px`;
        }
        editor.view.dispatch(editor.view.state.tr.setNodeMarkup(pos, undefined, attrs));
      }

      HANDLES.forEach(([dir, kind]) => {
        const handle = document.createElement('span');
        handle.className = `gms-img-handle gms-img-handle--${dir}`;
        handle.dataset.dir = dir;
        handle.draggable = false;
        handle.addEventListener('pointerdown', (e) => {
          // Without this the node's own draggable takes over and ProseMirror
          // starts a drag-and-drop of the image instead of a resize.
          e.preventDefault();
          e.stopPropagation();
          const rect = img.getBoundingClientRect();
          const avail = wrapper.parentElement?.getBoundingClientRect().width;
          drag = {
            dir,
            kind,
            x: e.clientX,
            y: e.clientY,
            w: rect.width,
            h: rect.height,
            ratio: rect.width / Math.max(1, rect.height),
            maxW: avail || rect.width * 4,
          };
          badge.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
          wrapper.classList.add('is-resizing');
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp, { once: true });
        });
        wrapper.appendChild(handle);
      });

      return {
        dom: wrapper,
        update(updated) {
          if (updated.type.name !== current.type.name) return false;
          current = updated;
          // A live drag owns the inline styles; re-applying mid-gesture would
          // snap the image back to its last committed size on every keystroke
          // elsewhere in the document.
          if (!drag) apply(updated);
          return true;
        },
        // Handle gestures are ours; everything else stays ProseMirror's.
        stopEvent: (e) => e.target instanceof Element
          && e.target.classList.contains('gms-img-handle'),
        // The drag writes inline styles straight onto the DOM, which would
        // otherwise look like external tampering and force a re-render.
        ignoreMutation: () => true,
        destroy() {
          window.removeEventListener('pointermove', onMove);
        },
      };
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
const selStyle = {
  height: 30, borderRadius: 7, border: '1px solid var(--glass-border)',
  background: 'var(--surface-soft-2)', color: 'var(--ink-dim)', fontSize: 12, padding: '0 6px',
};
const sep = () => <span style={{ width: 1, height: 20, background: 'var(--glass-border)', margin: '0 2px' }} />;

/** Floor for a drag-resize, in px — below this the handles overlap each other. */
const MIN_IMAGE_PX = 32;

/**
 * How close to the container edge (px) a resize must land to snap to width:100%.
 * A small margin so a deliberate full-width drag records as a responsive 100%
 * rather than an absolute px one pixel short of the box.
 */
const FULL_WIDTH_SNAP_PX = 8;

/** Shown only while an image is selected — fit, text wrap, alignment. */
function ImageBar({ editor, isAr }) {
  const attrs = editor.getAttributes('image');
  const set = (patch) => editor.chain().focus().updateAttributes('image', patch).run();
  const lbl = { fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' };
  const cell = { display: 'flex', flexDirection: 'column', gap: 3 };

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', padding: 10,
      border: '1px solid var(--gc-accent)', borderRadius: 8, background: 'var(--accent-soft)',
    }}>
      <div style={{ ...cell, gap: 1 }}>
        <span style={{ ...lbl, color: 'var(--accent-ink)' }}>{isAr ? 'الصورة المحددة' : 'Selected image'}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
          {isAr ? 'يؤثر على هذه الصورة فقط' : 'affects this image only'}
        </span>
      </div>
      {/* No numeric Width/Height boxes — the drag handles cover sizing. */}
      <div style={cell}>
        <span style={lbl}>{isAr ? 'الملاءمة' : 'Fit'}</span>
        <select
          style={selStyle}
          value={attrs.fit || ''}
          onChange={(e) => {
            const fit = e.target.value || null;
            // Without a height there is no box to fit into, so pin a sensible
            // one rather than letting the setting appear to do nothing.
            set(fit && !attrs.height ? { fit, height: '220px' } : { fit });
          }}
          title={isAr ? 'يحتاج ارتفاعًا محددًا' : 'Needs a fixed height to take effect'}
        >
          <option value="">{isAr ? 'بدون' : 'None'}</option>
          <option value="cover">Cover ({isAr ? 'قص' : 'crop'})</option>
          <option value="contain">Contain ({isAr ? 'كامل' : 'whole image'})</option>
          <option value="fill">Fill ({isAr ? 'تمديد' : 'stretch'})</option>
        </select>
      </div>
      <div style={cell}>
        <span style={lbl}>{isAr ? 'التفاف النص' : 'Text wrap'}</span>
        <select
          style={selStyle}
          value={attrs.wrap || ''}
          onChange={(e) => {
            const wrap = e.target.value || null;
            // A full-width floated image leaves no room for the text to sit in,
            // so it would look identical to no wrap at all. Narrow it on the way
            // in; the handles can take it back out afterwards.
            const needsRoom = wrap && (!attrs.width || attrs.width === '100%');
            set(needsRoom ? { wrap, width: '40%' } : { wrap });
          }}
          title={isAr ? 'اجعل النص يلتف بجانب الصورة' : 'Let text run alongside the image'}
        >
          <option value="">{isAr ? 'بدون (سطر كامل)' : 'None (own row)'}</option>
          <option value="left">{isAr ? 'صورة يسار، نص يمين' : 'Image left, text right'}</option>
          <option value="right">{isAr ? 'صورة يمين، نص يسار' : 'Image right, text left'}</option>
        </select>
      </div>
      <div style={cell}>
        <span style={lbl}>{isAr ? 'المحاذاة' : 'Align'}</span>
        {/* Dimmed and inert while wrapping: the float already positions the
            image, so alignment has nothing left to decide. */}
        <div style={{ display: 'flex', gap: 4, opacity: attrs.wrap ? 0.45 : 1 }}>
          {[['left', '⇤'], ['center', '≡'], ['right', '⇥']].map(([a, glyph]) => (
            <button key={a} type="button" title={a} disabled={!!attrs.wrap}
              style={{ ...tbBtnStyle(attrs.align === a), cursor: attrs.wrap ? 'not-allowed' : 'pointer' }}
              onMouseDown={e => { e.preventDefault(); if (!attrs.wrap) set({ align: a }); }}>{glyph}</button>
          ))}
        </div>
      </div>
      <button type="button" className="btn" style={{ height: 30, fontSize: 12, marginInlineStart: 'auto' }}
        onMouseDown={e => {
          e.preventDefault();
          set({ width: null, height: null, fit: null, align: null, wrap: null });
        }}>
        {isAr ? 'إعادة تعيين' : 'Reset'}
      </button>
    </div>
  );
}

function Toolbar({ editor, design, isAr }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const rerender = () => force(n => n + 1);
    editor.on('selectionUpdate', rerender);
    editor.on('transaction', rerender);
    return () => { editor.off('selectionUpdate', rerender); editor.off('transaction', rerender); };
  }, [editor]);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  if (!editor) return null;

  const Btn = ({ on, active, title, children }) => (
    <button type="button" title={title} style={tbBtnStyle(active)}
      onMouseDown={e => { e.preventDefault(); on(); }}>{children}</button>
  );

  // Uploaded to blob storage rather than inlined as a data URI: Gmail and
  // Outlook both strip base64 <img> in received mail, so an inlined image looks
  // right in the editor and arrives broken.
  //
  // The signed URL goes in as-is — stripping the token here is what made the
  // image invisible, since the bare URL 409s. See stripBlobTokens.
  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImageFile(file);
      if (!url) throw new Error('Upload returned no URL');
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر تحميل الصورة' : 'Could not upload the image');
    } finally {
      setUploading(false);
    }
  };

  const curFontSize = editor.getAttributes('textStyle').fontSize?.replace('px', '') || '';
  const curFont = matchFontOption(editor.getAttributes('textStyle').fontFamily);
  const isRtl = editor.isActive('paragraph', { dir: 'rtl' }) || editor.isActive('heading', { dir: 'rtl' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        {/* Per-paragraph RTL, for an Arabic passage inside an English template. */}
        <Btn
          active={isRtl}
          title={isAr ? 'اتجاه النص من اليمين لليسار' : 'Right-to-left paragraph (for Arabic text)'}
          on={() => editor.chain().focus().setTextDirection(isRtl ? null : 'rtl').run()}
        >
          <span style={{ fontSize: 11, fontWeight: 700 }}>{isRtl ? 'RTL' : 'LTR'}</span>
        </Btn>
        {sep()}
        {/* Font family */}
        <select value={curFont} title="Font"
          onChange={e => (e.target.value
            ? editor.chain().focus().setFontFamily(e.target.value).run()
            : editor.chain().focus().unsetFontFamily().run())}
          style={selStyle}>
          <option value="">Font</option>
          {FONT_OPTIONS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
        </select>
        {/* Font size */}
        <select value={curFontSize} title="Font size"
          onChange={e => e.target.value && editor.chain().focus().setFontSize(`${e.target.value}px`).run()}
          style={selStyle}>
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
        <Btn title={isAr ? 'إدراج صورة' : 'Insert image'} on={() => !uploading && fileRef.current?.click()}>
          {uploading ? '…' : '🖼'}
        </Btn>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />
        {sep()}
        <button type="button" title="Insert the guest RSVP button at the cursor"
          style={{ ...tbBtnStyle(false), background: 'var(--accent)', color: '#fff', fontWeight: 600, padding: '0 12px' }}
          onMouseDown={e => { e.preventDefault(); editor.chain().focus().insertInviteButton({
            label: design.buttonLabel, bg: design.buttonColor, color: design.buttonTextColor }).run(); }}>
          + {isAr ? 'زر الدعوة' : 'Invite button'}
        </button>
      </div>
      {/* Keyed per image so switching selection doesn't carry state across. */}
      {editor.isActive('image') && (
        <ImageBar key={editor.getAttributes('image').src} editor={editor} isAr={isAr} />
      )}
    </div>
  );
}

// ── Design bar ───────────────────────────────────────────────────────────────
function DesignBar({ design, setDesign, isAr }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setDesign(d => ({ ...d, [k]: v }));

  const onBgImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImageFile(file);
      if (!url) throw new Error('Upload returned no URL');
      // Signed URL for display; the token is stripped when the design is
      // persisted (see emit).
      set('bgImage', url);
      // A background image and a flat colour are mutually exclusive, and the
      // colour is what was painting over it here.
      set('bg', 'transparent');
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر تحميل الصورة' : 'Could not upload the image');
    } finally {
      setUploading(false);
    }
  };

  const cell = { display: 'flex', flexDirection: 'column', gap: 4 };
  const lbl = { fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' };
  const swatch = { width: 32, height: 30, border: '1px solid var(--glass-border)', borderRadius: 7, padding: 0, background: 'none', cursor: 'pointer' };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end',
      padding: 10, border: '1px solid var(--glass-border)', borderRadius: 8, background: 'var(--surface-soft)' }}>
      <div style={cell}>
        <span style={lbl}>{isAr ? 'الخلفية' : 'Background'}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            type="color"
            // A colour input can't represent "none", so it falls back to white
            // while the actual value stays transparent until something is picked.
            value={/^#[0-9a-f]{6}$/i.test(design.bg) ? design.bg : '#ffffff'}
            onChange={e => { set('bg', e.target.value); set('bgImage', ''); }}
            style={swatch}
          />
          <button
            type="button"
            className="btn ghost"
            title={isAr ? 'بدون خلفية' : 'No background colour'}
            style={{
              padding: '0 9px', height: 30, fontSize: 11,
              ...(design.bg === 'transparent' ? { borderColor: 'var(--gc-accent)', color: 'var(--accent-ink)' } : null),
            }}
            onClick={() => set('bg', 'transparent')}
          >
            {isAr ? 'شفاف' : 'None'}
          </button>
        </div>
      </div>
      <div style={cell}>
        <span style={lbl}>{isAr ? 'صورة الخلفية' : 'BG image'}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" className="btn" style={{ padding: '0 10px', height: 30, fontSize: 12 }}
            disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? '…' : (isAr ? 'رفع' : 'Upload')}
          </button>
          {design.bgImage && (
            <button type="button" className="btn ghost" style={{ padding: '0 8px', height: 30, fontSize: 12 }} onClick={() => set('bgImage', '')}>✕</button>
          )}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onBgImage} />
        </div>
      </div>
      <div style={cell}>
        <span style={lbl}>{isAr ? 'الخط' : 'Base font'}</span>
        <select value={design.font} onChange={e => set('font', e.target.value)} style={selStyle}>
          {FONT_OPTIONS.map(f => <option key={f.label} value={f.value}>{f.label}</option>)}
        </select>
      </div>
      <div style={cell}>
        <span style={lbl}>{isAr ? 'الحجم' : 'Base size'}</span>
        <select value={String(design.fontSize)} onChange={e => set('fontSize', Number(e.target.value))} style={selStyle}>
          {FONT_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}px</option>)}
        </select>
      </div>
      <div style={cell}>
        <span style={lbl}>{isAr ? 'زر: التسمية' : 'Button label'}</span>
        <input value={design.buttonLabel} onChange={e => set('buttonLabel', e.target.value)}
          style={{ ...selStyle, width: 190 }} />
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
      TextDirection,
      Link.configure({ openOnClick: false, autolink: true }),
      SizedImage.configure({ inline: false, allowBase64: true }),
      InviteButton,
    ],
    content: initial.content || '<p>Dear {{GuestName}},</p><p></p>',
    onUpdate: ({ editor }) => emit(editor, designRef.current),
  });

  const emit = useCallback((ed, cfg) => {
    if (!ed || !onChange) return;
    const signedInner = ed.getHTML();
    const inner = stripBlobTokens(signedInner);
    const storedCfg = { ...cfg, bgImage: stripBlobTokens(cfg.bgImage) };
    onChange({
      body: wrapEmailHtml(storedCfg, inner),
      designConfig: JSON.stringify({ ...storedCfg, content: inner }),
      displayBody: wrapEmailHtml(cfg, signedInner),
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
      <Toolbar editor={editor} design={design} isAr={isAr} />
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
            <span key={v.token} className="chip" title={isAr ? v.label.ar : v.label.en}
              style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11 }}
              onMouseDown={e => { e.preventDefault(); editor && editor.chain().focus().insertContent(v.token).run(); }}>
              <span className="dot" style={{ background: 'var(--accent)' }} />{v.token}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Preview modal ────────────────────────────────────────────────────────────

/**
 * The email as an inbox would show it. Chrome is deliberately Gmail-shaped —
 * the point of a preview is recognising "this is what lands in their inbox",
 * and a neutral bordered box doesn't carry that.
 */
export function EmailPreviewModal({ open, onClose, subject, body, isAr }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const html = previewHtml(body);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 760, maxWidth: '96vw', maxHeight: '92vh', background: '#fff', borderRadius: 12,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
        }}
      >
        {/* Window bar — ours, not Gmail's */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
          borderBottom: '1px solid #e8e8e8', background: '#f7f7f8', flexShrink: 0,
        }}>
          <strong style={{ fontSize: 13, color: '#202124' }}>
            {isAr ? 'معاينة البريد' : 'Email preview'}
          </strong>
          <span style={{ fontSize: 11, color: '#5f6368' }}>
            {isAr ? 'المتغيرات معروضة كما هي — تُستبدل عند الإرسال'
              : 'variables shown as-is — each is replaced per guest at send time'}
          </span>
          <button
            type="button" onClick={onClose} aria-label="Close"
            style={{
              marginInlineStart: 'auto', width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
              border: '1px solid #dadce0', background: '#fff', color: '#5f6368', fontSize: 15, lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Gmail-ish message chrome */}
        <div style={{ overflowY: 'auto', flex: 1, background: '#fff' }}>
          <div style={{ padding: '20px 24px 0' }}>
            <div style={{ fontSize: 20, color: '#202124', fontWeight: 400, lineHeight: 1.4 }}>
              {subject || (isAr ? '(بدون موضوع)' : '(no subject)')}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 18 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: '#8d0134', color: '#fff',
                display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 600, flexShrink: 0,
              }}>
                G
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, color: '#202124' }}>
                  <strong style={{ fontWeight: 600 }}>GMS Events</strong>
                  <span style={{ color: '#5f6368' }}> &lt;no-reply@gms.qa&gt;</span>
                </div>
                <div style={{ fontSize: 12, color: '#5f6368', marginTop: 1 }}>
                  {isAr ? 'إلى: {{GuestName}}' : 'to {{GuestName}}'}
                </div>
              </div>
              
            </div>
          </div>

          <div style={{ padding: '20px 24px 28px', color: '#202124' }}>
            {body
              ? (

                <iframe
                  title={isAr ? 'معاينة البريد' : 'Email preview'}
                  srcDoc={html}
                  sandbox=""
                  style={{ width: '100%', minHeight: 420, border: 0, display: 'block', background: '#fff' }}
                />
              )
              : (
                <div style={{ color: '#9aa0a6', fontSize: 13, padding: '48px 0', textAlign: 'center' }}>
                  {isAr ? 'لا يوجد محتوى بعد.' : 'Nothing to preview yet.'}
                </div>
              )}
          </div>
        </div>

        <div style={{
          padding: '12px 16px', borderTop: '1px solid #e8e8e8', background: '#f7f7f8',
          display: 'flex', justifyContent: 'flex-end', flexShrink: 0,
        }}>
          <button
            type="button" onClick={onClose}
            style={{
              padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              border: 'none', background: '#8d0134', color: '#fff',
            }}
          >
            {isAr ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
