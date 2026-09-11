import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Icon } from '../components/Icons';
import DataTable from '../components/ui/DataTable';
import ActionMenu from '../components/ui/ActionMenu';
import { useAccess } from '../auth/AccessContext';
import Select from '../components/ui/Select';
import toast from '../lib/toast';
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../api/services/invitationTemplateService';
import EmailTemplateBuilder, { EmailPreviewModal } from './invitations/EmailTemplateBuilder';

const TEMPLATE_COLORS = ['#00627b', '#e0b864', '#a78bda', '#5abf6e', 'var(--danger)', '#004151'];
const TIERS = ['VVIP', 'VIP', 'Speaker', 'Delegate', 'Press', 'Observer'];
const TIER_OPTIONS = TIERS.map(t => ({ value: t, label: t }));

// The variable palette lives in EmailTemplateBuilder, next to the editor that
// inserts the tokens — see TEMPLATE_VARIABLES there. Kept in one place because
// the list has to match the send path's substitution dictionary exactly.

// `language` stays in the shape because the API and the templates table still
// carry it, but the form no longer asks: templates are authored in English and
// an Arabic passage is a per-paragraph RTL toggle inside the body.
const EMPTY_FORM = {
  name: '', nameAr: '', language: 'en',
  subject: '', subjectAr: '', body: '', bodyAr: '',
  bodyType: 'html', designConfig: '',
  displayBody: '',
  // color: TEMPLATE_COLORS[0], targetTiers: [],
};

function validate(form) {
  const errors = {};
  if (!form.name.trim())    errors.name    = true;
  if (!form.subject.trim()) errors.subject = true;
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

// Templates are authored in English only. An Arabic passage inside one is a
// per-paragraph RTL toggle in the editor toolbar, not a second template.
function TemplateForm({ form, setField, errors, isAr, STR }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const inputStyle = inputStyleBase;
  const errorBorder = { ...inputStyleBase, borderColor: '#e05050' };
  return (
    <>
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
        <FieldLabel>{STR.subject} *</FieldLabel>
        <input
          style={errors.subject ? errorBorder : inputStyle}
          value={form.subject}
          onChange={e => setField('subject', e.target.value)}
          placeholder={isAr ? 'موضوع الدعوة' : 'Invitation subject'}
        />
        {errors.subject && <div style={errMsgStyle}>{STR.required}</div>}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
          <FieldLabel>{STR.body}</FieldLabel>
          {/* Preview on demand rather than a permanent side-by-side column: it
              gives the editor the full width, and the modal can show the email
              at its real width instead of squeezed into half the card. */}
          <button
            type="button"
            className="btn"
            style={{ marginInlineStart: 'auto', marginBottom: 5, fontSize: 12 }}
            onClick={() => setPreviewOpen(true)}
          >
            <Icon name="expand" size={12} /> {STR.previewEmail}
          </button>
        </div>
        <EmailTemplateBuilder
          value={{ body: form.body, designConfig: form.designConfig }}
          onChange={({ body, designConfig, displayBody }) => {
            setField('body', body);
            setField('designConfig', designConfig);
            setField('displayBody', displayBody);
          }}
          isAr={isAr}
        />
      </div>

      <EmailPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        subject={form.subject}
        // `displayBody` keeps the blob SAS tokens so uploaded images render;
        // `body` is stored bare and its images would 409 here.
        body={form.displayBody || form.body}
        isAr={isAr}
      />

      {/* <div>
        <FieldLabel>{STR.color}</FieldLabel>
        <ColorPicker value={form.color} onChange={v => setField('color', v)}/>
      </div> */}

      {/* <div>
        <FieldLabel>{STR.targetTiers}</FieldLabel>
        <Select
          isMulti
          value={form.targetTiers || []}
          onChange={v => setField('targetTiers', v)}
          options={TIER_OPTIONS}
          placeholder={STR.selectPlaceholder}
          isClearable
        />
      </div> */}
    </>
  );
}

// ── Main component ──

export default function InvitationsView({ lang, activeEventId }) {
  const { canWrite } = useAccess();
  const canManage = canWrite('template-builder');
  const isAr = lang === 'ar';

  // Tab key -> icon. The labels themselves are translated, so the icon
  // cannot be derived from them.
  const TAB_ICONS = { templates: 'doc', queue: 'clock', builder: 'edit' };

  const STR = isAr ? {
    pageTitle: ['دورة حياة', 'الدعوة'],
    pageSub: 'تصميم · أتمتة · متابعة الإرسال عبر القنوات',
    newTemplate: 'قالب جديد',
    tabs: { templates: 'القوالب', queue: 'طابور مجدول', builder: 'المُنشئ' },
    edit: 'تعديل', delete: 'حذف', cancel: 'إلغاء', view: 'عرض',
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
    confirmDelete: 'حذف', livePreview: 'معاينة مباشرة', previewEmail: 'معاينة البريد',
    builderSaved: 'تم إنشاء القالب بنجاح',
    editSaved: 'تم تحديث القالب', deletedMsg: 'تم حذف القالب',
    required: 'هذا الحقل مطلوب',
    queueTitle: 'طابور مجدول',
    queueNote: 'جدولة إرسال الدعوات وتتبع الحالة — قادمًا قريبًا.',
    templatesHeader: 'القوالب',
    colSubject: 'الموضوع', colTiers: 'الفئات',
    variables: 'متغيرات',
    selectPlaceholder: '— اختر —',
  } : {
    pageTitle: ['Invitation templates', ''],
    pageSub: 'Design · automate · track delivery across channels',
    newTemplate: 'New template',
    tabs: { templates: 'Templates', builder: 'Builder' },
    edit: 'Edit', delete: 'Delete', cancel: 'Cancel', view: 'View',
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
    confirmDelete: 'Delete', livePreview: 'Live preview', previewEmail: 'Preview email',
    builderSaved: 'Template created successfully',
    editSaved: 'Template updated', deletedMsg: 'Template deleted',
    required: 'This field is required',
    queueTitle: 'Scheduled queue',
    queueNote: 'Scheduled sending and delivery tracking — coming soon.',
    templatesHeader: 'Templates',
    colSubject: 'Subject', colTiers: 'Tiers',
    variables: 'Variables',
    selectPlaceholder: '— Select —',
  };

  // ── state ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('templates');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);

  const [builder, setBuilder] = useState(EMPTY_FORM);
  const [builderErrors, setBuilderErrors] = useState({});
  const [building, setBuilding] = useState(false);
  const [builderKey, setBuilderKey] = useState(0); // bump to remount the editor (reset) after create

  // Editing happens in the Builder tab, not a modal — `editTmpl` is just which
  // template the builder is currently bound to (null = creating a new one), so
  // there's one form and one editor instance rather than two of each.
  const [editTmpl, setEditTmpl] = useState(null);
  const [viewTmpl, setViewTmpl] = useState(null);

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
        // color:      builder.color,
        // targetTiers: builder.targetTiers,
      });
      loadTemplates();
      resetBuilder();
      setTab('templates');
      toast.success(STR.builderSaved);
    } catch (err) {
      toast.fromError(err, isAr ? 'حدث خطأ أثناء الإنشاء' : 'Error creating template');
    } finally {
      setBuilding(false);
    }
  }

  // ── edit helpers ───────────────────────────────────────────────────────────
  // Loads a template into the Builder tab. `builderKey` must be bumped: the
  // editor seeds its TipTap document once on mount (see EmailTemplateBuilder's
  // `initial` useMemo), so without a remount it would keep showing whatever was
  // in it before.
  const openEdit = useCallback((tmpl) => {
    setBuilder({
      ...EMPTY_FORM,
      name:        tmpl.name || '',
      nameAr:      tmpl.nameAr || '',
      language:    tmpl.language || 'en',
      subject:     tmpl.subject || '',
      subjectAr:   tmpl.subjectAr || '',
      body:        tmpl.body || '',
      bodyAr:      tmpl.bodyAr || '',
      designConfig: tmpl.designConfig || '',
      // color:       tmpl.color || TEMPLATE_COLORS[0],
      // targetTiers: tmpl.targetTiers || [],
    });
    setBuilderErrors({});
    setBuilderKey(k => k + 1);
    setEditTmpl(tmpl);
    setTab('builder');
  }, []);

  /** Back to a blank builder — after a save, or on "New template". */
  const resetBuilder = useCallback(() => {
    setBuilder(EMPTY_FORM);
    setBuilderErrors({});
    setBuilderKey(k => k + 1);
    setEditTmpl(null);
  }, []);

  async function handleSaveEdit() {
    const errors = validate(builder);
    if (Object.keys(errors).length) { setBuilderErrors(errors); return; }
    setBuilding(true);
    try {
      await updateTemplate(editTmpl.id, {
        name:        builder.name.trim(),
        nameAr:      builder.nameAr.trim() || null,
        language:    builder.language,
        subject:     builder.subject.trim(),
        subjectAr:   builder.subjectAr.trim() || null,
        body:        builder.body.trim() || null,
        bodyAr:      builder.bodyAr.trim() || null,
        designConfig: builder.designConfig || null,
        // color:       builder.color,
        // targetTiers: builder.targetTiers,
      });
      loadTemplates();
      resetBuilder();
      setTab('templates');
      toast.success(STR.editSaved);
    } catch (err) {
      toast.fromError(err, isAr ? 'حدث خطأ أثناء الحفظ' : 'Error saving changes');
    } finally {
      setBuilding(false);
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
    } catch (err) {
      toast.fromError(err, isAr ? 'حدث خطأ أثناء الحذف' : 'Error deleting template');
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
      id: 'subject',
      header: STR.colSubject,
      accessorKey: 'subject',
      cell: ({ row: { original: t } }) => (
        <span style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
          {isAr ? (t.subjectAr || t.subject) : t.subject}
        </span>
      ),
    },
    // {
    //   id: 'tiers',
    //   header: STR.colTiers,
    //   enableSorting: false,
    //   size: 180,
    //   cell: ({ row: { original: t } }) =>
    //     t.targetTiers?.length > 0 ? (
    //       <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
    //         {t.targetTiers.slice(0, 3).map(tier => (
    //           <span key={tier} className="chip" style={{ fontSize: 10.5 }}>{tier}</span>
    //         ))}
    //         {t.targetTiers.length > 3 && (
    //           <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>+{t.targetTiers.length - 3}</span>
    //         )}
    //       </div>
    //     ) : <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>—</span>,
    // },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      size: 60,
      cell: ({ row: { original: t } }) => (
        <ActionMenu
          items={[
            // Read-only, so it stays available without write access.
            { label: STR.view, icon: 'expand', onClick: () => setViewTmpl(t) },
            ...(canManage ? [
              { label: STR.edit, icon: 'edit', onClick: () => openEdit(t) },
              { label: STR.delete, icon: 'trash', danger: true, onClick: () => setDeleteTmpl(t) },
            ] : []),
          ]}
        />
      ),
    },
  ], [isAr, STR, openEdit, canManage]);

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.pageTitle[0]} <em>{STR.pageTitle[1]}</em></h1>
          <div className="page-sub">{STR.pageSub}</div>
        </div>
        <div className="page-actions">
          {canManage && (
            // Clears any template the builder was editing, so "New template"
            // never lands on a half-loaded existing one.
            <button className="btn primary" onClick={() => { resetBuilder(); setTab('builder'); }}>
              <Icon name="plus" size={14}/> {STR.newTemplate}
            </button>
          )}
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {Object.entries(STR.tabs).map(([k, v]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            {TAB_ICONS[k] && <Icon name={TAB_ICONS[k]} size={13} />}{v}
          </button>
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

      {/* One full-width card. The old side-by-side preview column is now the
          "Preview email" button inside the form, which gives the editor the whole
          width and shows the email at its real size in the modal. */}
      {/* Serves both create and edit — `editTmpl` decides which. One editor
          instance means the toolbar, image controls and preview behave
          identically either way, instead of a second copy inside a modal. */}
      {tab === 'builder' && (
        <div className="card">
          <div className="card-head">
            <h3>
              {editTmpl
                ? <>{STR.editTitle}: <em>{editTmpl.name}</em></>
                : (isAr ? 'قالب جديد' : 'New Template')}
            </h3>
            {editTmpl && (
              <button className="btn" onClick={resetBuilder}>
                <Icon name="plus" size={12}/> {STR.newTemplate}
              </button>
            )}
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <TemplateForm
              key={builderKey}
              form={builder}
              setField={(k, v) => { setB(k, v); setBuilderErrors(e => ({ ...e, [k]: false })); }}
              errors={builderErrors}
              isAr={isAr}
              STR={STR}
            />
          </div>
          <div className="card-foot" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {editTmpl && (
              <button className="btn" onClick={() => { resetBuilder(); setTab('templates'); }}>
                {STR.cancel}
              </button>
            )}
            <button
              className="btn primary"
              onClick={editTmpl ? handleSaveEdit : handleCreate}
              disabled={building}
            >
              <Icon name="check" size={13}/>
              {building ? '…' : (editTmpl ? STR.saveChanges : STR.create)}
            </button>
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

      {/* Read-only view. Same modal the builder previews with, so "View" shows
          the template exactly as the guest will receive it — variables included,
          since a stored template has no guest to resolve them against. */}
      <EmailPreviewModal
        open={!!viewTmpl}
        onClose={() => setViewTmpl(null)}
        subject={viewTmpl?.subject}
        body={viewTmpl?.body}
        isAr={isAr}
      />

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