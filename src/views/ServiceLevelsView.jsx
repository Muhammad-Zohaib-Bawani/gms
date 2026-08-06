// Per-event guest grades, replacing the old hardcoded tier list. A level is a
// bundle: pick which Services it includes, fill in each service's dynamic field
// VALUES once, and every guest on the level inherits them.
//
// Also carries the required-guest-fields rule that
// the guest form enforces — overridably, for anyone with
// ServiceLevels.OverrideRules.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '../components/Icons';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import { ServiceLevelChip } from '../components/UI';
import { useAuth } from '../auth/AuthContext';
import toast from '../lib/toast';
import {
  getServices,
  getServiceLevels, createServiceLevel, updateServiceLevel, deleteServiceLevel,
} from '../api/services/serviceCatalogService';

// Mirrors Core.Constants.GuestRequirableFields.
const REQUIRABLE_FIELDS = [
  { key: 'email', en: 'Email', ar: 'البريد الإلكتروني' },
  { key: 'nationalityId', en: 'Nationality', ar: 'الجنسية' },
  { key: 'organizationId', en: 'Organization', ar: 'المؤسسة' },
  { key: 'photoUrl', en: 'Photo', ar: 'الصورة' },
  { key: 'arrivalDate', en: 'Arrival date', ar: 'تاريخ الوصول' },
  { key: 'departureDate', en: 'Departure date', ar: 'تاريخ المغادرة' },
];

const PRESET_COLORS = ['#e0b864', '#a78bda', '#8d0134', '#5abf6e', 'var(--danger)', '#4a9edd', '#9CA3AF'];

const EMPTY_FORM = {
  name: '', nameAr: '', code: '', description: '', color: PRESET_COLORS[0],
  sortOrder: 0, requiredGuestFields: [], serviceIds: [],
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

export default function ServiceLevelsView({ lang, activeEventId }) {
  const isAr = lang === 'ar';
  const { can } = useAuth();
  const canManage = can('ServiceLevels.Manage');

  const STR = isAr ? {
    title: 'مستويات الخدمة', sub: 'درجات الضيوف لهذه الفعالية — كل مستوى يجمع خدمات وقواعد',
    add: 'إضافة مستوى', edit: 'تعديل', del: 'حذف',
    name: 'الاسم', nameAr: 'الاسم بالعربية', code: 'الرمز', desc: 'الوصف',
    color: 'اللون', order: 'الترتيب',
    included: 'الخدمات المضمّنة', rules: 'القواعد',
    requiredFields: 'حقول مطلوبة للضيف',
    requiredHint: 'لا يمكن إضافة ضيف لهذا المستوى قبل تعبئة هذه الحقول (يمكن تجاوزها بصلاحية).',
    guests: 'ضيوف', noEvent: 'يرجى اختيار فعالية أولاً لعرض مستويات الخدمة.',
    empty: 'لا توجد مستويات بعد', emptyHint: 'أضف أول مستوى خدمة لتصنيف الضيوف',
    save: 'حفظ', cancel: 'إلغاء', saving: 'جارٍ الحفظ…',
    addTitle: 'إضافة مستوى خدمة', editTitle: 'تعديل مستوى الخدمة',
    noServices: 'لا توجد خدمات في هذه الفعالية بعد — أضفها من صفحة الخدمات أولاً.',
    pickServices: 'اختر الخدمات',
    delTitle: 'حذف المستوى', delBody: (n) => `هل أنت متأكد من حذف "${n}"؟`,
    noneIncluded: 'لا خدمات مضمّنة',
  } : {
    title: 'Service Levels', sub: 'This event\'s guest grades — each bundles services and carries its own rules',
    add: 'Add Level', edit: 'Edit', del: 'Delete',
    name: 'Name', nameAr: 'Arabic name', code: 'Code', desc: 'Description',
    color: 'Colour', order: 'Order',
    included: 'Included services', rules: 'Rules',
    requiredFields: 'Required guest fields',
    requiredHint: 'A guest can\'t be placed on this level until these are filled in (overridable with permission).',
    guests: 'guests', noEvent: 'Select an active event to manage its service levels.',
    empty: 'No service levels yet', emptyHint: 'Add your first level to start grading guests',
    save: 'Save', cancel: 'Cancel', saving: 'Saving…',
    addTitle: 'Add Service Level', editTitle: 'Edit Service Level',
    noServices: 'This event has no services yet — add some on the Services page first.',
    pickServices: 'Select services',
    delTitle: 'Delete Service Level', delBody: (n) => `Are you sure you want to delete "${n}"?`,
    noneIncluded: 'No services included',
  };

  const [levels, setLevels] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!activeEventId) { setLevels([]); setServices([]); return; }
    setLoading(true);
    try {
      const [lv, sv] = await Promise.all([
        getServiceLevels(true).catch(() => []),
        getServices(false).catch(() => []),
      ]);
      setLevels(lv || []);
      setServices(sv || []);
    } finally {
      setLoading(false);
    }
  }, [activeEventId]);

  useEffect(() => { load(); }, [load]);

  const setF = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: null }));
  };

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sortOrder: levels.length + 1, color: PRESET_COLORS[levels.length % PRESET_COLORS.length] });
    setErrors({});
    setShowForm(true);
  }

  function openEdit(level) {
    setEditing(level);
    setForm({
      name: level.name || '',
      nameAr: level.nameAr || '',
      code: level.code || '',
      description: level.description || '',
      color: level.color || PRESET_COLORS[0],
      sortOrder: level.sortOrder ?? 0,
      requiredGuestFields: level.requiredGuestFields || [],
      // Already ordered by SortOrder from the API; that order IS the sequence.
      serviceIds: (level.services || []).map((s) => s.serviceId),
    });
    setErrors({});
    setShowForm(true);
  }

  const toggleService = (serviceId) => {
    setF('serviceIds', form.serviceIds.includes(serviceId)
      ? form.serviceIds.filter((id) => id !== serviceId)
      : [...form.serviceIds, serviceId]);
  };

  // Order matters: on a Fixed event this is the sequence guests must complete
  // the services in, so it is reorderable rather than implicit.
  const moveService = (index, dir) => {
    const next = [...form.serviceIds];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setF('serviceIds', next);
  };

  const toggleRequiredField = (key) => {
    const has = form.requiredGuestFields.includes(key);
    setF('requiredGuestFields', has
      ? form.requiredGuestFields.filter((k) => k !== key)
      : [...form.requiredGuestFields, key]);
  };

  async function handleSave() {
    const errs = {};
    if (!form.name.trim()) errs.name = isAr ? 'الاسم مطلوب' : 'Name is required';

    if (Object.keys(errs).length) { setErrors(errs); return; }

    const body = {
      name: form.name.trim(),
      nameAr: form.nameAr.trim() || null,
      code: form.code.trim() || null,
      description: form.description.trim() || null,
      color: form.color || null,
      sortOrder: Number(form.sortOrder) || 0,
      requiredGuestFields: form.requiredGuestFields,
      serviceIds: form.serviceIds,
    };

    setSaving(true);
    try {
      const res = editing
        ? await updateServiceLevel(editing.id, body)
        : await createServiceLevel(body);
      toast.success(isAr ? 'تم الحفظ' : (editing ? 'Service level updated' : 'Service level added'));
      setShowForm(false);
      load();
      return res;
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحفظ' : 'Could not save the service level');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteServiceLevel(toDelete.id);
      toast.success(isAr ? 'تم الحذف' : 'Service level deleted');
      setToDelete(null);
      load();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحذف' : 'Could not delete the service level');
    } finally {
      setDeleting(false);
    }
  }

  const requiredFieldLabel = (key) => {
    const f = REQUIRABLE_FIELDS.find((x) => x.key === key);
    return f ? (isAr ? f.ar : f.en) : key;
  };

  const sorted = useMemo(
    () => [...levels].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)),
    [levels],
  );

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
      ) : loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>
          {isAr ? 'جارٍ التحميل…' : 'Loading…'}
        </div>
      ) : sorted.length === 0 ? (
        <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <Icon name="badge" size={26} style={{ color: 'var(--ink-faint)' }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10 }}>{STR.empty}</div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-mute)', marginTop: 4 }}>{STR.emptyHint}</div>
          {canManage && (
            <button className="btn primary" style={{ marginTop: 16 }} onClick={openAdd}>
              <Icon name="plus" size={14} /> {STR.add}
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {sorted.map((level) => {
            return (
              <div key={level.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 4, background: level.color || 'var(--ink-mute)' }} />
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                    <div style={{ minWidth: 0 }}>
                      <ServiceLevelChip name={level.name} nameAr={level.nameAr} color={level.color} lang={lang} size={12} />
                      {level.description && (
                        <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 6 }}>{level.description}</div>
                      )}
                    </div>
                    {canManage && (
                      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                        <button className="action-menu-trigger" title={STR.edit} onClick={() => openEdit(level)}>
                          <Icon name="edit" size={13} />
                        </button>
                        <button className="action-menu-trigger" title={STR.del} style={{ color: 'var(--danger)' }}
                          onClick={() => setToDelete(level)}>
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{STR.guests}</span>
                    <span style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>{level.guestCount}</span>
                  </div>

                  {/* Included services, in completion order */}
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                      {STR.included}
                    </div>
                    {(level.services || []).length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>{STR.noneIncluded}</div>
                    ) : (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                        {level.services.map((s, i) => (
                          <React.Fragment key={s.serviceId}>
                            {i > 0 && <Icon name="chevronRight" size={11} style={{ color: 'var(--ink-faint)' }} />}
                            <span className="chip" style={{ fontSize: 10.5 }}>
                              {(isAr ? s.nameAr : null) || s.name}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / edit ─────────────────────────────────────────────────────── */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? STR.editTitle : STR.addTitle}
        width={600}
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
              placeholder={isAr ? 'مثال: ذهبي' : 'e.g. Gold'}
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

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>{STR.order}</label>
            <input type="number" style={inputStyle} value={form.sortOrder}
              onChange={(e) => setF('sortOrder', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>{STR.color}</label>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingTop: 4 }}>
              {PRESET_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setF('color', c)}
                  title={c}
                  style={{
                    width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: form.color === c ? '2px solid var(--ink)' : '1px solid var(--glass-border)',
                    padding: 0,
                  }} />
              ))}
            </div>
          </div>
        </div>

        {/* Included services */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--glass-border)' }}>
          <label style={labelStyle}>{STR.included}</label>
          {services.length === 0 ? (
            <div style={{
              padding: '12px 14px', borderRadius: 8, fontSize: 12.5, color: '#e0c47e',
              background: 'rgba(224,196,126,0.12)', border: '1px solid rgba(224,196,126,0.4)',
            }}>
              <Icon name="alert" size={13} /> {STR.noServices}
            </div>
          ) : (
            <>
              {errors.services && (
                <div style={{ fontSize: 11.5, color: '#e05050', marginBottom: 8 }}>{errors.services}</div>
              )}
              {/* Chosen services first, in sequence, then the rest to add.
                  On a Fixed event this order is what guests must follow. */}
              {form.serviceIds.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {form.serviceIds.map((id, i) => {
                    const svc = services.find((x) => x.id === id);
                    if (!svc) return null;
                    return (
                      <div key={id} style={{
                        display: 'flex', alignItems: 'center', gap: 9, padding: '9px 11px',
                        borderRadius: 10, border: '1px solid var(--accent)',
                        background: 'var(--accent-soft)',
                      }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 700,
                          background: 'var(--accent)', color: '#fff',
                        }}>{i + 1}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>
                          {(isAr ? svc.nameAr : null) || svc.name}
                        </span>
                        <button type="button" className="icon-btn" onClick={() => moveService(i, -1)}
                          disabled={i === 0} title={isAr ? 'أعلى' : 'Move up'}>↑</button>
                        <button type="button" className="icon-btn" onClick={() => moveService(i, 1)}
                          disabled={i === form.serviceIds.length - 1} title={isAr ? 'أسفل' : 'Move down'}>↓</button>
                        <button type="button" className="icon-btn" style={{ color: 'var(--danger)' }}
                          onClick={() => toggleService(id)} title={isAr ? 'إزالة' : 'Remove'}>
                          <Icon name="close" size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {services.filter((svc) => !form.serviceIds.includes(svc.id)).map((svc) => (
                  <button
                    key={svc.id}
                    type="button"
                    className="btn"
                    style={{ fontSize: 12 }}
                    onClick={() => toggleService(svc.id)}
                  >
                    <Icon name="plus" size={12} /> {(isAr ? svc.nameAr : null) || svc.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Rules */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--glass-border)' }}>
          <label style={labelStyle}>{STR.requiredFields}</label>
          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginBottom: 10 }}>{STR.requiredHint}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {REQUIRABLE_FIELDS.map((f) => {
              const on = form.requiredGuestFields.includes(f.key);
              return (
                <button key={f.key} type="button" onClick={() => toggleRequiredField(f.key)}
                  className="chip"
                  style={{
                    cursor: 'pointer', fontSize: 11.5,
                    color: on ? 'var(--accent)' : 'var(--ink-mute)',
                    background: on ? 'rgba(141,1,52,0.12)' : 'var(--surface-soft-3)',
                    borderColor: on ? 'rgba(141,1,52,0.45)' : 'var(--glass-border)',
                  }}>
                  {on && <Icon name="check" size={10} />}
                  {isAr ? f.ar : f.en}
                </button>
              );
            })}
          </div>
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
        {toDelete?.guestCount > 0 && (
          <div style={{
            marginTop: 12, padding: '10px 12px', borderRadius: 8, fontSize: 12.5, color: 'var(--danger)',
            background: 'var(--danger-bg)', border: '1px solid var(--danger-border)',
          }}>
            <Icon name="alert" size={13} />{' '}
            {isAr
              ? `${toDelete.guestCount} ضيف على هذا المستوى — أعد تعيينهم أولاً.`
              : `${toDelete.guestCount} guest${toDelete.guestCount === 1 ? ' is' : 's are'} on this level — reassign them first.`}
          </div>
        )}
      </Modal>
    </div>
  );
}
