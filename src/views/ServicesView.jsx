// Per-event service catalog. A "Service" is one offerable thing (Lounge Access,
// Airport Transfer) that Service Levels bundle together — each defining its own
// dynamic fields, so the schema isn't fixed.
//
// This is NOT the Travel & Logistics module (flights/hotels/transfers), and NOT
// the guest's `allowedServices` VIP-app self-request permissions.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '../components/Icons';
import Modal from '../components/ui/Modal';
import DataTable from '../components/ui/DataTable';
import ActionMenu from '../components/ui/ActionMenu';
import { FormSchemaBuilder, keyFromLabel, allFormFields } from '../components/ui/DynamicFields';
import { useAuth } from '../auth/AuthContext';
import toast from '../lib/toast';
import {
  getServices, createService, updateService, deleteService,
} from '../api/services/serviceCatalogService';

const EMPTY_FORM = {
  name: '', nameAr: '', description: '', icon: '', sortOrder: 0, isActive: true,
  form: { sections: [] },
};

const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box',
};
const errorStyle = { ...inputStyle, border: '1px solid #e05050' };
const labelStyle = {
  display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase',
  letterSpacing: '0.12em', marginBottom: 5,
};
const sectionLabel = {
  display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase',
  letterSpacing: '0.12em', margin: '4px 0 8px',
};

export default function ServicesView({ lang, activeEventId }) {
  const isAr = lang === 'ar';
  const { can } = useAuth();
  const canManage = can('Services.Manage');

  const STR = isAr ? {
    title: 'الخدمات', sub: 'كتالوج الخدمات لهذه الفعالية — تُجمَّع في مستويات الخدمة',
    add: 'إضافة خدمة', edit: 'تعديل', del: 'حذف',
    name: 'الاسم', nameAr: 'الاسم بالعربية', desc: 'الوصف', order: 'الترتيب',
    fields: 'الحقول', usedBy: 'مستويات',
    noEvent: 'يرجى اختيار فعالية أولاً لعرض الخدمات.',
    empty: 'لا توجد خدمات بعد',
    save: 'حفظ', cancel: 'إلغاء', saving: 'جارٍ الحفظ…',
    addTitle: 'إضافة خدمة', editTitle: 'تعديل الخدمة',
    fieldsHint: 'ما المعلومات التي تحتاجها هذه الخدمة؟ تُملأ القيم لكل مستوى خدمة.',
    delTitle: 'حذف الخدمة', delBody: (n) => `هل أنت متأكد من حذف "${n}"؟`,
    delUsed: (c) => `هذه الخدمة مستخدمة في ${c} مستوى — سيتم إزالتها منها.`,
    noFields: 'لا حقول',
  } : {
    title: 'Services', sub: 'This event\'s service catalog — bundled together into Service Levels',
    add: 'Add Service', edit: 'Edit', del: 'Delete',
    name: 'Name', nameAr: 'Arabic name', desc: 'Description', order: 'Order',
    fields: 'Fields', usedBy: 'Levels',
    noEvent: 'Select an active event to manage its services.',
    empty: 'No services yet',
    save: 'Save', cancel: 'Cancel', saving: 'Saving…',
    addTitle: 'Add Service', editTitle: 'Edit Service',
    fieldsHint: 'What details does this service need? Values get filled in per service level.',
    delTitle: 'Delete Service', delBody: (n) => `Are you sure you want to delete "${n}"?`,
    delUsed: (c) => `It's used by ${c} service level${c === 1 ? '' : 's'} and will be removed from ${c === 1 ? 'it' : 'them'}.`,
    noFields: 'No fields',
  };

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!activeEventId) { setRows([]); return; }
    setLoading(true);
    try { setRows((await getServices(true)) || []); }
    catch { setRows([]); }
    finally { setLoading(false); }
  }, [activeEventId]);

  useEffect(() => { load(); }, [load]);

  const setF = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: null }));
  };

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sortOrder: rows.length + 1 });
    setErrors({});
    setShowForm(true);
  }

  function openEdit(row) {
    setEditing(row);
    setForm({
      name: row.name || '',
      nameAr: row.nameAr || '',
      description: row.description || '',
      icon: row.icon || '',
      sortOrder: row.sortOrder ?? 0,
      isActive: row.isActive !== false,
      form: { sections: (row.form?.sections || []).map((sec) => ({
        ...sec,
        fields: (sec.fields || []).map((f) => ({ ...f, options: f.options || [] })),
      })) },
    });
    setErrors({});
    setShowForm(true);
  }

  async function handleSave() {
    const errs = {};
    if (!form.name.trim()) errs.name = isAr ? 'الاسم مطلوب' : 'Name is required';

    // Mirrors ServiceFormSchema.ValidateForm so the user sees the problem
    // inline instead of as a generic API error.
    const sections = (form.form?.sections || []).map((sec) => ({
      ...sec,
      key: (sec.key || keyFromLabel(sec.label) || '').trim(),
      label: (sec.label || '').trim(),
      fields: (sec.fields || []).map((f) => ({
        ...f,
        key: (f.key || keyFromLabel(f.label)).trim(),
        label: (f.label || '').trim(),
      })),
    }));

    if (sections.length === 0) {
      errs.fields = isAr ? 'أضف قسماً واحداً على الأقل' : 'Add at least one section';
    }

    const namelessSection = sections.find((sec) => !sec.label);
    if (!errs.fields && namelessSection)
      errs.fields = isAr ? 'كل قسم يحتاج اسماً' : 'Every section needs a name';

    const emptySection = sections.find((sec) => sec.fields.length === 0);
    if (!errs.fields && emptySection)
      errs.fields = isAr
        ? `القسم "${emptySection.label}" لا يحتوي على حقول`
        : `Section "${emptySection.label}" has no fields`;

    const fields = sections.flatMap((sec) => sec.fields);

    const badField = fields.find((f) => !f.key || !f.label);
    if (!errs.fields && badField) errs.fields = isAr ? 'كل حقل يحتاج تسمية' : 'Every field needs a label';

    const emptySelect = fields.find((f) => f.type === 'select' && (f.options || []).length === 0);
    if (!errs.fields && emptySelect)
      errs.fields = isAr
        ? `الحقل "${emptySelect.label}" قائمة — يحتاج خياراً واحداً على الأقل`
        : `"${emptySelect.label}" is a dropdown, so it needs at least one option`;

    // Unique across the whole form, not per section: values are stored flat, so
    // two sections sharing a key would overwrite each other.
    const keys = fields.map((f) => f.key.toLowerCase());
    const dupe = keys.find((k, i) => keys.indexOf(k) !== i);
    if (!errs.fields && dupe)
      errs.fields = isAr
        ? `مُعرِّف مكرر "${dupe}" — يجب أن تكون المعرفات فريدة في النموذج كله`
        : `Duplicate field key "${dupe}" — keys must be unique across the whole form`;

    if (Object.keys(errs).length) { setErrors(errs); return; }

    const body = {
      name: form.name.trim(),
      nameAr: form.nameAr.trim() || null,
      description: form.description.trim() || null,
      icon: form.icon?.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      isActive: form.isActive !== false,
      form: { sections },
    };

    setSaving(true);
    try {
      if (editing) {
        await updateService(editing.id, body);
        toast.success(isAr ? 'تم التحديث' : 'Service updated');
      } else {
        await createService(body);
        toast.success(isAr ? 'تمت الإضافة' : 'Service added');
      }
      setShowForm(false);
      load();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحفظ' : 'Could not save the service');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await deleteService(toDelete.id);
      toast.success(res?.message || (isAr ? 'تم الحذف' : 'Service deleted'));
      setToDelete(null);
      load();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحذف' : 'Could not delete the service');
    } finally {
      setDeleting(false);
    }
  }

  const columns = useMemo(() => {
    const cols = [
      {
        id: 'name', header: STR.name, accessorKey: 'name',
        cell: ({ row: { original: r } }) => (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{isAr ? (r.nameAr || r.name) : r.name}</div>
            {r.description && (
              <div style={{ fontSize: 11, color: 'var(--ink-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>
                {r.description}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'fields', header: STR.fields, enableSorting: false,
        cell: ({ row: { original: r } }) => {
          const fields = allFormFields(r.form);
          if (fields.length === 0)
            return <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{STR.noFields}</span>;
          return (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {fields.slice(0, 3).map((f) => (
                <span key={f.key} className="chip" style={{ fontSize: 10.5 }}>
                  {(isAr ? f.labelAr : null) || f.label}{f.required ? ' *' : ''}
                </span>
              ))}
              {fields.length > 3 && (
                <span style={{ fontSize: 11, color: 'var(--ink-mute)', alignSelf: 'center' }}>
                  +{fields.length - 3}
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: 'usedBy', header: STR.usedBy, accessorKey: 'usedByLevelCount', size: 90,
        cell: ({ getValue }) => (
          <span style={{ fontSize: 12, color: getValue() ? 'var(--ink)' : 'var(--ink-faint)' }}>
            {getValue() || 0}
          </span>
        ),
      },
      { id: 'sortOrder', header: STR.order, accessorKey: 'sortOrder', size: 80,
        cell: ({ getValue }) => <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>{getValue() ?? 0}</span> },
    ];

    if (canManage) {
      cols.push({
        id: 'actions', header: '', size: 50, enableSorting: false, enableGlobalFilter: false,
        cell: ({ row: { original: r } }) => (
          <ActionMenu items={[
            { label: STR.edit, icon: 'edit', onClick: () => openEdit(r) },
            { label: STR.del, icon: 'trash', danger: true, onClick: () => setToDelete(r) },
          ]} />
        ),
      });
    }
    return cols;
  }, [STR, isAr, canManage, rows.length]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title}</h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
        {canManage && activeEventId && (
          <div className="page-actions">
            <button className="btn primary" onClick={openAdd}>
              <Icon name="plus" size={14} /> {STR.add}
            </button>
          </div>
        )}
      </div>

      {!activeEventId ? (
        <div style={{
          padding: '10px 16px', borderRadius: 10, fontSize: 13, color: '#e0c47e',
          background: 'rgba(224,196,126,0.1)', border: '1px solid rgba(224,196,126,0.3)',
        }}>
          <Icon name="alert" size={14} /> {STR.noEvent}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <DataTable
            columns={columns}
            data={rows}
            loading={loading}
            showSearch
            pageSize={10}
            searchPlaceholder={isAr ? 'بحث…' : 'Search services…'}
            emptyText={STR.empty}
          />
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? STR.editTitle : STR.addTitle}
        width={560}
        footer={
          <>
            <button className="btn" onClick={() => setShowForm(false)} disabled={saving}>{STR.cancel}</button>
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              <Icon name="check" size={13} /> {saving ? STR.saving : STR.save}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>{STR.name} *</label>
            <input style={errors.name ? errorStyle : inputStyle} value={form.name}
              placeholder={isAr ? 'مثال: دخول الصالة' : 'e.g. Lounge Access'}
              onChange={(e) => setF('name', e.target.value)} />
            {errors.name && <div style={{ fontSize: 11, color: '#e05050', marginTop: 3 }}>{errors.name}</div>}
          </div>
          <div>
            <label style={labelStyle}>{STR.nameAr}</label>
            <input style={inputStyle} value={form.nameAr} dir="rtl"
              onChange={(e) => setF('nameAr', e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={labelStyle}>{STR.desc}</label>
          <textarea rows={2} style={{ ...inputStyle, resize: 'vertical' }} value={form.description}
            onChange={(e) => setF('description', e.target.value)} />
        </div>

        <div style={{ marginTop: 12, maxWidth: 140 }}>
          <label style={labelStyle}>{STR.order}</label>
          <input type="number" style={inputStyle} value={form.sortOrder}
            onChange={(e) => setF('sortOrder', e.target.value)} />
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--glass-border)' }}>
          <label style={sectionLabel}>{STR.fields}</label>
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 10 }}>{STR.fieldsHint}</div>
          {errors.fields && (
            <div style={{ fontSize: 11.5, color: '#e05050', marginBottom: 8 }}>{errors.fields}</div>
          )}
          <FormSchemaBuilder
            form={form.form}
            onChange={(next) => setF('form', next)}
            lang={lang}
          />
        </div>
      </Modal>

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={STR.delTitle}
        width={420}
        footer={
          <>
            <button className="btn" onClick={() => setToDelete(null)} disabled={deleting}>{STR.cancel}</button>
            <button className="btn primary" style={{ background: '#b82a2a', borderColor: '#b82a2a' }}
              onClick={handleDelete} disabled={deleting}>
              <Icon name="trash" size={13} /> {deleting ? (isAr ? 'جارٍ الحذف…' : 'Deleting…') : STR.del}
            </button>
          </>
        }
      >
        <p style={{ color: 'var(--ink-dim)', fontSize: 13, margin: 0 }}>
          {toDelete && STR.delBody(isAr ? (toDelete.nameAr || toDelete.name) : toDelete.name)}
        </p>
        {toDelete?.usedByLevelCount > 0 && (
          <div style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 8, fontSize: 12.5, color: '#e0c47e',
            background: 'rgba(224,196,126,0.12)', border: '1px solid rgba(224,196,126,0.4)',
          }}>
            <Icon name="alert" size={13} /> {STR.delUsed(toDelete.usedByLevelCount)}
          </div>
        )}
      </Modal>
    </div>
  );
}
