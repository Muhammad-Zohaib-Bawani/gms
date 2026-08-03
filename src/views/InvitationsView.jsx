import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Icon } from '../components/Icons';
import DataTable from '../components/ui/DataTable';
import ActionMenu from '../components/ui/ActionMenu';
import Select from '../components/ui/Select';
import toast from '../lib/toast';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../api/services/invitationTemplateService';
import EmailTemplateBuilder, { EmailPreview } from './invitations/EmailTemplateBuilder';

const TEMPLATE_COLORS = ['#8d0134', '#e0b864', '#a78bda', '#5abf6e', 'var(--danger)', '#5e0022'];
const TIERS = ['VVIP', 'VIP', 'Speaker', 'Delegate', 'Press', 'Observer'];
const LANG_OPTIONS = [
  { value: 'en',   label: 'EN (English)' },
  { value: 'ar',   label: 'AR (العربية)' },
  { value: 'both', label: 'EN / AR' },
];
const LANG_LABELS = { en: 'EN', ar: 'AR', both: 'EN/AR' };
const TIER_OPTIONS = TIERS.map(t => ({ value: t, label: t }));

// Merge fields the backend interpolates into the body. Clicking one inserts it
// at the textarea caret (see TemplateForm.insertVariable).
const TEMPLATE_VARIABLES = ['{{GuestName}}', '{{EventName}}', '{{EventDate}}', '{{Venue}}'];

const BODY_TYPE_OPTIONS_EN = [
  { value: 'text', label: 'Plain text' },
  { value: 'html', label: 'Raw HTML' },
];
const BODY_TYPE_OPTIONS_AR = [
  { value: 'text', label: 'نص عادي' },
  { value: 'html', label: 'HTML خام' },
];

const EMPTY_FORM = {
  name: '', nameAr: '', language: 'en',
  subject: '', subjectAr: '', body: '', bodyAr: '',
  bodyType: 'html', designConfig: '',
  color: TEMPLATE_COLORS[0], targetTiers: [],
};

function validate(form) {
  const errors = {};
  if (!form.name.trim())    errors.name    = true;
  if (!form.subject.trim()) errors.subject = true;
  if (form.language !== 'en' && !form.subjectAr.trim()) errors.subjectAr = true;
  return errors;
}

const inputStyleBase = {
  width: '100%', background: 'var(--surface-soft-3)',
  border: '1px solid var(--glass-border)', borderRadius: 8,
  padding: '8px 12px', color: 'var(--ink)', fontSize: 13,
};
const errMsgStyle = { fontSize: 11, color: '#e05050', marginTop: 3 };

// ── Moved OUTSIDE the main component so they don't get recreated on every render ──

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

function TemplateForm({ form, setField, errors, isAr, STR, bodyTypeOptions }) {
  const showAr = form.language !== 'en';
  const inputStyle = inputStyleBase;
  const errorBorder = { ...inputStyleBase, borderColor: '#e05050' };
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10 }}>
        <div>
          <FieldLabel>{STR.name} *</FieldLabel>
          <input
            style={errors.name ? errorBorder : inputStyle}
            value={form.name}
            onChange={e => setField('name', e.target.value)}
            placeholder={isAr ? 'مثال: دعوة رسمية' : 'e.g. Official Invite'}
          />
          {errors.name && <div style={errMsgStyle}>{STR.required}</div>}
        </div>
        <div>
          <FieldLabel>{STR.language}</FieldLabel>
          <Select
            value={form.language}
            onChange={v => setField('language', v)}
            options={LANG_OPTIONS}
            placeholder={STR.selectPlaceholder}
          />
        </div>
      </div>

      {showAr && (
        <div>
          <FieldLabel>{STR.nameAr}</FieldLabel>
          <input style={inputStyle} value={form.nameAr || ''} onChange={e => setField('nameAr', e.target.value)} dir="rtl" placeholder="مثال: دعوة رسمية"/>
        </div>
      )}

      <div>
        <FieldLabel>{STR.subject} *</FieldLabel>
        <input
          style={errors.subject ? errorBorder : inputStyle}
          value={form.subject}
          onChange={e => setField('subject', e.target.value)}
          placeholder={isAr ? 'موضوع الدعوة' : 'Invitation subject'}
        />
        {errors.subject && <div style={errMsgStyle}>{STR.required}</div>}
      </div>

      {showAr && (
        <div>
          <FieldLabel>{STR.subjectAr} *</FieldLabel>
          <input
            style={errors.subjectAr ? errorBorder : inputStyle}
            value={form.subjectAr || ''}
            onChange={e => setField('subjectAr', e.target.value)}
            dir="rtl"
            placeholder="موضوع الدعوة"
          />
          {errors.subjectAr && <div style={errMsgStyle}>{STR.required}</div>}
        </div>
      )}

      <div>
        <FieldLabel>{STR.body}</FieldLabel>
        <EmailTemplateBuilder
          value={{ body: form.body, designConfig: form.designConfig }}
          onChange={({ body, designConfig }) => { setField('body', body); setField('designConfig', designConfig); }}
          isAr={isAr}
        />
      </div>

      {showAr && (
        <div>
          <FieldLabel>{STR.bodyAr}</FieldLabel>
          <textarea
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: form.bodyType === 'html' ? 'var(--mono)' : 'inherit' }}
            value={form.bodyAr || ''}
            onChange={e => setField('bodyAr', e.target.value)}
            dir="rtl"
            placeholder={form.bodyType === 'html' ? '<p>عزيزي {{GuestName}}،</p>' : 'عزيزي {{GuestName}}،'}
          />
        </div>
      )}

      <div>
        <FieldLabel>{STR.color}</FieldLabel>
        <ColorPicker value={form.color} onChange={v => setField('color', v)}/>
      </div>

      <div>
        <FieldLabel>{STR.targetTiers}</FieldLabel>
        <Select
          isMulti
          value={form.targetTiers || []}
          onChange={v => setField('targetTiers', v)}
          options={TIER_OPTIONS}
          placeholder={STR.selectPlaceholder}
          isClearable
        />
      </div>
    </>
  );
}

// ── Main component ──

export default function InvitationsView({ lang, activeEventId }) {
  const isAr = lang === 'ar';

  const STR = isAr ? {
    pageTitle: ['دورة حياة', 'الدعوة'],
    pageSub: 'تصميم · أتمتة · متابعة الإرسال عبر القنوات',
    newTemplate: 'قالب جديد',
    tabs: { templates: 'القوالب', queue: 'طابور مجدول', builder: 'المُنشئ' },
    edit: 'تعديل', delete: 'حذف', cancel: 'إلغاء',
    create: 'إنشاء القالب', loading: 'جارٍ التحميل…',
    noTemplates: 'لا توجد قوالب — أنشئ قالبًا جديدًا من تبويب "المُنشئ"',
    noEvent: 'الرجاء اختيار حدث أولًا',
    name: 'اسم القالب', nameAr: 'الاسم (عربي)', language: 'اللغة',
    subject: 'سطر الموضوع', subjectAr: 'الموضوع (عربي)',
    body: 'نص الرسالة', bodyAr: 'النص (عربي)',
    bodyType: 'نوع المحتوى',
    color: 'اللون', targetTiers: 'الفئات المستهدفة',
    saveChanges: 'حفظ التغييرات', editTitle: 'تعديل القالب',
    deleteTitle: 'تأكيد الحذف',
    deleteMsg: 'هل أنت متأكد من حذف هذا القالب؟ لا يمكن التراجع.',
    confirmDelete: 'حذف', livePreview: 'معاينة مباشرة',
    builderSaved: 'تم إنشاء القالب بنجاح',
    editSaved: 'تم تحديث القالب', deletedMsg: 'تم حذف القالب',
    required: 'هذا الحقل مطلوب',
    queueTitle: 'طابور مجدول',
    queueNote: 'جدولة إرسال الدعوات وتتبع الحالة — قادمًا قريبًا.',
    templatesHeader: 'القوالب',
    colLang: 'اللغة', colSubject: 'الموضوع', colTiers: 'الفئات',
    variables: 'متغيرات',
    selectPlaceholder: '— اختر —',
  } : {
    pageTitle: ['Invitations', ''],
    pageSub: 'Design · automate · track delivery across channels',
    newTemplate: 'New template',
    tabs: { templates: 'Templates', builder: 'Builder' },
    edit: 'Edit', delete: 'Delete', cancel: 'Cancel',
    create: 'Create template', loading: 'Loading…',
    noTemplates: 'No templates yet — create one from the Builder tab',
    noEvent: 'Please select an event first',
    name: 'Template name', nameAr: 'Name (AR)', language: 'Language',
    subject: 'Subject line', subjectAr: 'Subject (AR)',
    body: 'Body', bodyAr: 'Body (AR)',
    bodyType: 'Content type',
    color: 'Color', targetTiers: 'Target tiers',
    saveChanges: 'Save changes', editTitle: 'Edit Template',
    deleteTitle: 'Confirm Delete',
    deleteMsg: 'Are you sure you want to delete this template? This cannot be undone.',
    confirmDelete: 'Delete', livePreview: 'Live preview',
    builderSaved: 'Template created successfully',
    editSaved: 'Template updated', deletedMsg: 'Template deleted',
    required: 'This field is required',
    queueTitle: 'Scheduled queue',
    queueNote: 'Scheduled sending and delivery tracking — coming soon.',
    templatesHeader: 'Templates',
    colLang: 'Language', colSubject: 'Subject', colTiers: 'Tiers',
    variables: 'Variables',
    selectPlaceholder: '— Select —',
  };

  const BODY_TYPE_OPTIONS = isAr ? BODY_TYPE_OPTIONS_AR : BODY_TYPE_OPTIONS_EN;

  // ── state ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  const [builder, setBuilder] = useState(EMPTY_FORM);
  const [builderErrors, setBuilderErrors] = useState({});
  const [building, setBuilding] = useState(false);
  const [builderKey, setBuilderKey] = useState(0); // bump to remount the editor (reset) after create

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
        designConfig: builder.designConfig || null,
        color:      builder.color,
        targetTiers: builder.targetTiers,
      });
      loadTemplates();
      setBuilder(EMPTY_FORM);
      setBuilderErrors({});
      setBuilderKey(k => k + 1);
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
      designConfig: tmpl.designConfig || '',
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
        designConfig: editForm.designConfig || null,
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
      size: 60,
      cell: ({ row: { original: t } }) => (
        <ActionMenu
          items={[
            { label: STR.edit, icon: 'edit', onClick: () => openEdit(t) },
            { label: STR.delete, icon: 'trash', danger: true, onClick: () => setDeleteTmpl(t) },
          ]}
        />
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

      {tab === 'builder' && (
        <div className="cols-2-narrow">
          <div className="card">
            <div className="card-head">
              <h3>{isAr ? 'قالب جديد' : 'New Template'}</h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <TemplateForm
                key={builderKey}
                form={builder}
                setField={(k, v) => { setB(k, v); setBuilderErrors(e => ({ ...e, [k]: false })); }}
                errors={builderErrors}
                isAr={isAr}
                STR={STR}
                bodyTypeOptions={BODY_TYPE_OPTIONS}
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
              <div style={{ display: 'flex', gap: 6 }}>
                <span className="chip">
                  <span className="dot" style={{ background: builder.color }}/>
                  {LANG_LABELS[builder.language] || builder.language}
                </span>
              </div>
            </div>
            <div className="card-body">
              <EmailPreview body={builder.body} subject={builder.subject} isAr={isAr} />
            </div>
          </div>
        </div>
      )}

      {tab === 'queue' && (
        <div className="card" style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>📬</div>
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 15 }}>{STR.queueTitle}</div>
          <div style={{ fontSize: 13, color: 'var(--ink-mute)', maxWidth: 340, margin: '0 auto' }}>{STR.queueNote}</div>
        </div>
      )}

      {editTmpl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card glass modal-solid" style={{ width: 560, maxWidth: '92vw', padding: 0, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
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
                STR={STR}
                bodyTypeOptions={BODY_TYPE_OPTIONS}
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

      {deleteTmpl && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card glass modal-solid" style={{ width: 420, maxWidth: '90vw', padding: 0 }}>
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