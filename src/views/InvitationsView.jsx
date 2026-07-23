import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Icon } from '../components/Icons';
import DataTable from '../components/ui/DataTable';
import Select from '../components/ui/Select';
import toast from '../lib/toast';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../api/services/invitationTemplateService';

const TEMPLATE_COLORS = ['#1aaec4', '#e0b864', '#a78bda', '#5abf6e', '#e08a7e', '#0a3947'];
const TIERS = ['VVIP', 'VIP', 'Speaker', 'Delegate', 'Press', 'Observer'];
const LANG_OPTIONS = [
  { value: 'en',   label: 'EN (English)' },
  { value: 'ar',   label: 'AR (العربية)' },
  { value: 'both', label: 'EN / AR' },
];
const LANG_LABELS = { en: 'EN', ar: 'AR', both: 'EN/AR' };
const TIER_OPTIONS = TIERS.map(t => ({ value: t, label: t }));
const VARIABLES = ['{{GuestName}}', '{{EventName}}', '{{EventDate}}', '{{Venue}}'];

const EMPTY_FORM = {
  name: '', nameAr: '', language: 'en',
  subject: '', subjectAr: '', body: '', bodyAr: '',
  color: TEMPLATE_COLORS[0], targetTiers: [],
};

// Static — safe to hoist out of the component so they aren't recreated (and
// diffed as "changed") on every render.
const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)',
  border: '1px solid var(--glass-border)', borderRadius: 8,
  padding: '8px 12px', color: 'var(--ink)', fontSize: 13,
};
const errorBorder = { ...inputStyle, borderColor: '#e05050' };
const errMsg = { fontSize: 11, color: '#e05050', marginTop: 3 };
const monoInputStyle = { ...inputStyle, fontFamily: 'var(--mono)', fontSize: 12.5 };

function validate(form) {
  const errors = {};
  if (!form.name.trim())    errors.name    = true;
  if (!form.subject.trim()) errors.subject = true;
  if (form.language !== 'en' && !form.subjectAr.trim()) errors.subjectAr = true;
  return errors;
}

// ── Module-level components ───────────────────────────────────────────────
// These used to be declared INSIDE InvitationsView's render body, which meant
// React saw a brand-new component type on every re-render and remounted the
// whole subtree — including every <input>/<textarea> DOM node — wiping focus
// after a single keystroke. Hoisting them here (so their identity is stable
// across renders) fixes that; anything they need from the parent (isAr, t)
// comes in as props instead of a closure.

function FieldLabel({ children }) {
  return (
    <label style={{ display: 'block', fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>
      {children}
    </label>
  );
}

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {TEMPLATE_COLORS.map(c => (
        <div
          key={c}
          onClick={() => onChange(c)}
          style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', outline: value === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
        />
      ))}
    </div>
  );
}

// Inserts an HTML snippet into a body textarea at the current cursor position
// (falls back to appending if the field isn't focused/no selection is known),
// then restores focus so typing can continue right after the inserted text.
function useBodyInserter(value, onChange) {
  const ref = useRef(null);
  function insert(snippet) {
    const el = ref.current;
    const current = value || '';
    if (!el) { onChange(current + snippet); return; }
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? start;
    const next = current.slice(0, start) + snippet + current.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  }
  return [ref, insert];
}

function ButtonInserter({ isAr, t, color, onInsert }) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');

  function handleInsert() {
    const btnLabel = label.trim() || (isAr ? 'انقر هنا' : 'Click here');
    const btnUrl = url.trim() || '{{ActionUrl}}';
    const html = `<a href="${btnUrl}" style="display:inline-block;padding:10px 22px;background:${color || '#1aaec4'};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-family:sans-serif;">${btnLabel}</a>`;
    onInsert(html);
    setLabel(''); setUrl('');
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        style={{ ...monoInputStyle, width: 130 }}
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder={t.buttonLabelPh}
      />
      <input
        style={{ ...monoInputStyle, width: 160 }}
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder={t.buttonUrlPh}
      />
      <button type="button" className="btn" style={{ padding: '5px 10px', fontSize: 11.5 }} onClick={handleInsert}>
        <Icon name="plus" size={11}/> {t.insertButton}
      </button>
    </div>
  );
}

function TemplateForm({ form, setField, errors, isAr, t }) {
  const showAr = form.language !== 'en';
  const [bodyRef, insertIntoBody] = useBodyInserter(form.body, v => setField('body', v));
  const [bodyArRef, insertIntoBodyAr] = useBodyInserter(form.bodyAr, v => setField('bodyAr', v));

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
        <div>
          <FieldLabel>{t.name} *</FieldLabel>
          <input
            style={errors.name ? errorBorder : inputStyle}
            value={form.name}
            onChange={e => setField('name', e.target.value)}
            placeholder={isAr ? 'مثال: دعوة رسمية' : 'e.g. Official Invite'}
          />
          {errors.name && <div style={errMsg}>{t.required}</div>}
        </div>
        <div>
          <FieldLabel>{t.language}</FieldLabel>
          <Select
            value={form.language}
            onChange={v => setField('language', v)}
            options={LANG_OPTIONS}
            placeholder={t.selectPlaceholder}
          />
        </div>
      </div>

      {showAr && (
        <div>
          <FieldLabel>{t.nameAr}</FieldLabel>
          <input style={inputStyle} value={form.nameAr || ''} onChange={e => setField('nameAr', e.target.value)} dir="rtl" placeholder="مثال: دعوة رسمية"/>
        </div>
      )}

      <div>
        <FieldLabel>{t.subject} *</FieldLabel>
        <input
          style={errors.subject ? errorBorder : inputStyle}
          value={form.subject}
          onChange={e => setField('subject', e.target.value)}
          placeholder={isAr ? 'موضوع الدعوة' : 'Invitation subject'}
        />
        {errors.subject && <div style={errMsg}>{t.required}</div>}
      </div>

      {showAr && (
        <div>
          <FieldLabel>{t.subjectAr} *</FieldLabel>
          <input
            style={errors.subjectAr ? errorBorder : inputStyle}
            value={form.subjectAr || ''}
            onChange={e => setField('subjectAr', e.target.value)}
            dir="rtl"
            placeholder="موضوع الدعوة"
          />
          {errors.subjectAr && <div style={errMsg}>{t.required}</div>}
        </div>
      )}

      <div>
        <FieldLabel>{t.body}</FieldLabel>
        <textarea
          ref={bodyRef}
          rows={7}
          style={{ ...monoInputStyle, resize: 'vertical' }}
          value={form.body || ''}
          onChange={e => setField('body', e.target.value)}
          placeholder={isAr ? '<p>عزيزي {{GuestName}}،</p>' : '<p>Dear {{GuestName}},</p>'}
          spellCheck={false}
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {VARIABLES.map(v => (
              <span key={v} className="chip" style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11 }} onClick={() => insertIntoBody(v)}>
                <span className="dot" style={{ background: 'var(--accent)' }}/>{v}
              </span>
            ))}
          </div>
          <ButtonInserter isAr={isAr} t={t} color={form.color} onInsert={insertIntoBody}/>
        </div>
      </div>

      {showAr && (
        <div>
          <FieldLabel>{t.bodyAr}</FieldLabel>
          <textarea
            ref={bodyArRef}
            rows={5}
            style={{ ...monoInputStyle, resize: 'vertical' }}
            value={form.bodyAr || ''}
            onChange={e => setField('bodyAr', e.target.value)}
            dir="rtl"
            placeholder="<p>عزيزي {{GuestName}}،</p>"
            spellCheck={false}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {VARIABLES.map(v => (
                <span key={v} className="chip" style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11 }} onClick={() => insertIntoBodyAr(v)}>
                  <span className="dot" style={{ background: 'var(--accent)' }}/>{v}
                </span>
              ))}
            </div>
            <ButtonInserter isAr={isAr} t={t} color={form.color} onInsert={insertIntoBodyAr}/>
          </div>
        </div>
      )}

      <div>
        <FieldLabel>{t.color}</FieldLabel>
        <ColorPicker value={form.color} onChange={v => setField('color', v)}/>
      </div>

      <div>
        <FieldLabel>{t.targetTiers}</FieldLabel>
        <Select
          isMulti
          value={form.targetTiers || []}
          onChange={v => setField('targetTiers', v)}
          options={TIER_OPTIONS}
          placeholder={t.selectPlaceholder}
          isClearable
        />
      </div>
    </>
  );
}

function htmlPreviewDoc(bodyHtml, dir) {
  return `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"/></head>` +
    `<body style="margin:0;padding:20px;font-family:sans-serif;color:#222;background:#fff;">` +
    `${bodyHtml || ''}</body></html>`;
}

// ── Main view ──────────────────────────────────────────────────────────────

export default function InvitationsView({ lang, activeEventId }) {
  const isAr = lang === 'ar';

  const STR = isAr ? {
    pageTitle: ['دورة حياة', 'الدعوة'],
    pageSub: 'تصميم · أتمتة · متابعة الإرسال عبر القنوات',
    newTemplate: 'قالب جديد',
    tabs: { templates: 'القوالب', builder: 'المُنشئ' },
    edit: 'تعديل', delete: 'حذف', cancel: 'إلغاء',
    create: 'إنشاء القالب', loading: 'جارٍ التحميل…',
    noTemplates: 'لا توجد قوالب — أنشئ قالبًا جديدًا من تبويب "المُنشئ"',
    noEvent: 'الرجاء اختيار حدث أولًا',
    name: 'اسم القالب', nameAr: 'الاسم (عربي)', language: 'اللغة',
    subject: 'سطر الموضوع', subjectAr: 'الموضوع (عربي)',
    body: 'نص الرسالة (HTML)', bodyAr: 'النص (عربي، HTML)',
    color: 'اللون', targetTiers: 'الفئات المستهدفة',
    saveChanges: 'حفظ التغييرات', editTitle: 'تعديل القالب',
    deleteTitle: 'تأكيد الحذف',
    deleteMsg: 'هل أنت متأكد من حذف هذا القالب؟ لا يمكن التراجع.',
    confirmDelete: 'حذف', livePreview: 'معاينة مباشرة',
    builderSaved: 'تم إنشاء القالب بنجاح',
    editSaved: 'تم تحديث القالب', deletedMsg: 'تم حذف القالب',
    required: 'هذا الحقل مطلوب',
    templatesHeader: 'القوالب',
    colLang: 'اللغة', colSubject: 'الموضوع', colTiers: 'الفئات',
    selectPlaceholder: '— اختر —',
    insertButton: 'إدراج زر', buttonLabelPh: 'نص الزر', buttonUrlPh: 'الرابط أو {{ActionUrl}}',
  } : {
    pageTitle: ['Invitation', 'lifecycle'],
    pageSub: 'Design · automate · track delivery across channels',
    newTemplate: 'New template',
    tabs: { templates: 'Templates', builder: 'Builder' },
    edit: 'Edit', delete: 'Delete', cancel: 'Cancel',
    create: 'Create template', loading: 'Loading…',
    noTemplates: 'No templates yet — create one from the Builder tab',
    noEvent: 'Please select an event first',
    name: 'Template name', nameAr: 'Name (AR)', language: 'Language',
    subject: 'Subject line', subjectAr: 'Subject (AR)',
    body: 'Body (HTML)', bodyAr: 'Body (AR, HTML)',
    color: 'Color', targetTiers: 'Target tiers',
    saveChanges: 'Save changes', editTitle: 'Edit Template',
    deleteTitle: 'Confirm Delete',
    deleteMsg: 'Are you sure you want to delete this template? This cannot be undone.',
    confirmDelete: 'Delete', livePreview: 'Live preview',
    builderSaved: 'Template created successfully',
    editSaved: 'Template updated', deletedMsg: 'Template deleted',
    required: 'This field is required',
    templatesHeader: 'Templates',
    colLang: 'Language', colSubject: 'Subject', colTiers: 'Tiers',
    selectPlaceholder: '— Select —',
    insertButton: 'Insert button', buttonLabelPh: 'Button text', buttonUrlPh: 'URL or {{ActionUrl}}',
  };

  // ── state ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  const [builder, setBuilder] = useState(EMPTY_FORM);
  const [builderErrors, setBuilderErrors] = useState({});
  const [building, setBuilding] = useState(false);

  const [editTmpl, setEditTmpl] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editErrors, setEditErrors] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTmpl, setDeleteTmpl] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // ── data ───────────────────────────────────────────────────────────────────
  const loadTemplates = useCallback(() => {
    if (!activeEventId) { setTemplates([]); return; }
    setLoading(true);
    getTemplates(activeEventId)
      .then(r => setTemplates(r || []))
      .catch(() => toast.error(isAr ? 'تعذّر تحميل القوالب' : 'Failed to load templates'))
      .finally(() => setLoading(false));
  }, [activeEventId, isAr]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // ── builder helpers ────────────────────────────────────────────────────────
  const setB = (k, v) => setBuilder(p => ({ ...p, [k]: v }));

  async function handleCreate() {
    if (!activeEventId) { toast.error(STR.noEvent); return; }
    const errors = validate(builder);
    if (Object.keys(errors).length) { setBuilderErrors(errors); return; }
    setBuilding(true);
    try {
      await createTemplate({
        eventId:    activeEventId,
        name:       builder.name.trim(),
        nameAr:     builder.nameAr.trim() || null,
        language:   builder.language,
        subject:    builder.subject.trim(),
        subjectAr:  builder.subjectAr.trim() || null,
        body:       builder.body.trim() || null,
        bodyAr:     builder.bodyAr.trim() || null,
        color:      builder.color,
        targetTiers: builder.targetTiers,
      });
      loadTemplates();
      setBuilder(EMPTY_FORM);
      setBuilderErrors({});
      setTab('templates');
      toast.success(STR.builderSaved);
    } catch {
      toast.error(isAr ? 'حدث خطأ أثناء الإنشاء' : 'Error creating template');
    } finally {
      setBuilding(false);
    }
  }

  // ── edit helpers ───────────────────────────────────────────────────────────
  const openEdit = useCallback((tmpl) => {
    setEditForm({
      name:        tmpl.name || '',
      nameAr:      tmpl.nameAr || '',
      language:    tmpl.language || 'en',
      subject:     tmpl.subject || '',
      subjectAr:   tmpl.subjectAr || '',
      body:        tmpl.body || '',
      bodyAr:      tmpl.bodyAr || '',
      color:       tmpl.color || TEMPLATE_COLORS[0],
      targetTiers: tmpl.targetTiers || [],
    });
    setEditErrors({});
    setEditTmpl(tmpl);
  }, []);

  const setEf = (k, v) => setEditForm(p => ({ ...p, [k]: v }));

  async function handleSaveEdit() {
    const errors = validate(editForm);
    if (Object.keys(errors).length) { setEditErrors(errors); return; }
    setEditSaving(true);
    try {
      await updateTemplate(editTmpl.id, {
        name:        editForm.name.trim(),
        nameAr:      editForm.nameAr.trim() || null,
        language:    editForm.language,
        subject:     editForm.subject.trim(),
        subjectAr:   editForm.subjectAr.trim() || null,
        body:        editForm.body.trim() || null,
        bodyAr:      editForm.bodyAr.trim() || null,
        color:       editForm.color,
        targetTiers: editForm.targetTiers,
      });
      loadTemplates();
      setEditTmpl(null);
      toast.success(STR.editSaved);
    } catch {
      toast.error(isAr ? 'حدث خطأ أثناء الحفظ' : 'Error saving changes');
    } finally {
      setEditSaving(false);
    }
  }

  // ── delete ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTemplate(deleteTmpl.id);
      loadTemplates();
      setDeleteTmpl(null);
      toast.success(STR.deletedMsg);
    } catch {
      toast.error(isAr ? 'حدث خطأ أثناء الحذف' : 'Error deleting template');
    } finally {
      setDeleting(false);
    }
  }

  // ── table columns ──────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      id: 'name',
      header: STR.templatesHeader,
      accessorKey: 'name',
      cell: ({ row: { original: t } }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color || 'var(--accent)', flexShrink: 0 }}/>
          <span style={{ fontWeight: 500 }}>{isAr ? (t.nameAr || t.name) : t.name}</span>
        </div>
      ),
    },
    {
      id: 'language',
      header: STR.colLang,
      accessorKey: 'language',
      size: 90,
      cell: ({ getValue }) => (
        <span className="chip" style={{ fontSize: 11 }}>{LANG_LABELS[getValue()] || getValue()}</span>
      ),
    },
    {
      id: 'subject',
      header: STR.colSubject,
      accessorKey: 'subject',
      cell: ({ row: { original: t } }) => (
        <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
          {isAr ? (t.subjectAr || t.subject) : t.subject}
        </span>
      ),
    },
    {
      id: 'tiers',
      header: STR.colTiers,
      enableSorting: false,
      size: 180,
      cell: ({ row: { original: t } }) =>
        t.targetTiers?.length > 0 ? (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {t.targetTiers.slice(0, 3).map(tier => (
              <span key={tier} className="chip" style={{ fontSize: 10.5 }}>{tier}</span>
            ))}
            {t.targetTiers.length > 3 && (
              <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>+{t.targetTiers.length - 3}</span>
            )}
          </div>
        ) : <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>—</span>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      size: 140,
      cell: ({ row: { original: t } }) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button
            className="btn ghost"
            style={{ padding: '4px 10px', fontSize: 12 }}
            onClick={e => { e.stopPropagation(); openEdit(t); }}
          >
            <Icon name="edit" size={12}/> {STR.edit}
          </button>
          <button
            className="btn ghost"
            style={{ padding: '4px 10px', fontSize: 12, color: '#e05050' }}
            onClick={e => { e.stopPropagation(); setDeleteTmpl(t); }}
          >
            <Icon name="trash" size={12}/> {STR.delete}
          </button>
        </div>
      ),
    },
  ], [isAr, STR, openEdit]);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.pageTitle[0]} <em>{STR.pageTitle[1]}</em></h1>
          <div className="page-sub">{STR.pageSub}</div>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => setTab('builder')}>
            <Icon name="plus" size={14}/> {STR.newTemplate}
          </button>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {Object.entries(STR.tabs).map(([k, v]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{v}</button>
        ))}
      </div>

      {/* ── TEMPLATES ── */}
      {tab === 'templates' && (
        <div className="card" style={{ padding: 0 }}>
          <DataTable
            columns={columns}
            data={templates}
            loading={loading}
            emptyText={STR.noTemplates}
            searchPlaceholder={isAr ? 'بحث…' : 'Search templates…'}
            pageSize={20}
          />
        </div>
      )}

      {/* ── BUILDER ── */}
      {tab === 'builder' && (
        <div className="cols-2-narrow">
          <div className="card">
            <div className="card-head">
              <h3>{isAr ? 'قالب جديد' : 'New Template'}</h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <TemplateForm
                form={builder}
                setField={(k, v) => { setB(k, v); setBuilderErrors(e => ({ ...e, [k]: false })); }}
                errors={builderErrors}
                isAr={isAr}
                t={STR}
              />
            </div>
            <div className="card-foot">
              <button className="btn primary" onClick={handleCreate} disabled={building}>
                <Icon name="check" size={13}/> {building ? '…' : STR.create}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>{STR.livePreview}</h3>
              <span className="chip">
                <span className="dot" style={{ background: builder.color }}/>
                {LANG_LABELS[builder.language] || builder.language}
              </span>
            </div>
            <div className="card-body">
              <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: '14px 14px 18px', borderInlineStart: `4px solid ${builder.color}` }}>
                {builder.name && (
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 4px' }}>
                    {builder.name}
                  </div>
                )}
                <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13, padding: '0 4px' }}>
                  {builder.subject || (isAr ? 'سطر الموضوع…' : 'Subject line…')}
                </div>
                <iframe
                  title="email-preview-en"
                  srcDoc={htmlPreviewDoc(builder.body, 'ltr')}
                  style={{ width: '100%', height: 260, border: '1px solid var(--glass-border)', borderRadius: 8, background: '#fff' }}
                  sandbox=""
                />
                {builder.language !== 'en' && (
                  <iframe
                    title="email-preview-ar"
                    srcDoc={htmlPreviewDoc(builder.bodyAr, 'rtl')}
                    style={{ width: '100%', height: 220, border: '1px solid var(--glass-border)', borderRadius: 8, background: '#fff', marginTop: 10 }}
                    sandbox=""
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT MODAL ── */}
      {editTmpl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card glass" style={{ width: 560, maxWidth: '92vw', padding: 0, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <h3 style={{ margin: 0 }}>{STR.editTitle}: <em>{editTmpl.name}</em></h3>
              <button className="icon-btn" onClick={() => setEditTmpl(null)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>
              <TemplateForm
                form={editForm}
                setField={(k, v) => { setEf(k, v); setEditErrors(e => ({ ...e, [k]: false })); }}
                errors={editErrors}
                isAr={isAr}
                t={STR}
              />
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
              <button className="btn" onClick={() => setEditTmpl(null)}>{STR.cancel}</button>
              <button className="btn primary" onClick={handleSaveEdit} disabled={editSaving}>
                <Icon name="check" size={13}/> {editSaving ? '…' : STR.saveChanges}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteTmpl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card glass" style={{ width: 420, maxWidth: '90vw', padding: 0 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{STR.deleteTitle}</h3>
              <button className="icon-btn" onClick={() => setDeleteTmpl(null)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <p style={{ color: 'var(--ink-dim)', marginBottom: 12 }}>{STR.deleteMsg}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, background: 'var(--surface-soft-2)' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: deleteTmpl.color || 'var(--accent)', flexShrink: 0 }}/>
                <span style={{ fontWeight: 500 }}>{deleteTmpl.name}</span>
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setDeleteTmpl(null)}>{STR.cancel}</button>
              <button
                className="btn primary"
                style={{ background: '#b82a2a', borderColor: '#b82a2a' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                <Icon name="close" size={13}/> {deleting ? '…' : STR.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
