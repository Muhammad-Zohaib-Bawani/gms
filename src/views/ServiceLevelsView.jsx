// Per-event guest grades, replacing the old hardcoded tier list. A level is a
// bundle: pick which Services it includes, fill in each service's dynamic field
// VALUES once, and every guest on the level inherits them.
//
// Also carries the assignment rules (capacity cap, required guest fields) that
// the guest form enforces — overridably, for anyone with
// ServiceLevels.OverrideRules.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '../components/Icons';
import Modal from '../components/ui/Modal';
import Select from '../components/ui/Select';
import { ServiceLevelChip } from '../components/UI';
import { DynamicFieldInputs } from '../components/ui/DynamicFields';
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
  sortOrder: 0, capacity: '', requiredGuestFields: [], services: [],
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
    color: 'اللون', order: 'الترتيب', capacity: 'السعة',
    capacityHint: 'اتركه فارغاً لسعة غير محدودة',
    included: 'الخدمات المضمّنة', rules: 'القواعد',
    requiredFields: 'حقول مطلوبة للضيف',
    requiredHint: 'لا يمكن إضافة ضيف لهذا المستوى قبل تعبئة هذه الحقول (يمكن تجاوزها بصلاحية).',
    guests: 'ضيوف', noEvent: 'يرجى اختيار فعالية أولاً لعرض مستويات الخدمة.',
    empty: 'لا توجد مستويات بعد', emptyHint: 'أضف أول مستوى خدمة لتصنيف الضيوف',
    save: 'حفظ', cancel: 'إلغاء', saving: 'جارٍ الحفظ…',
    addTitle: 'إضافة مستوى خدمة', editTitle: 'تعديل مستوى الخدمة',
    noServices: 'لا توجد خدمات في هذه الفعالية بعد — أضفها من صفحة الخدمات أولاً.',
    pickServices: 'اختر الخدمات', unlimited: 'غير محدود',
    delTitle: 'حذف المستوى', delBody: (n) => `هل أنت متأكد من حذف "${n}"؟`,
    atCapacity: 'ممتلئ', overCapacity: 'تجاوز السعة',
    noneIncluded: 'لا خدمات مضمّنة',
  } : {
    title: 'Service Levels', sub: 'This event\'s guest grades — each bundles services and carries its own rules',
    add: 'Add Level', edit: 'Edit', del: 'Delete',
    name: 'Name', nameAr: 'Arabic name', code: 'Code', desc: 'Description',
    color: 'Colour', order: 'Order', capacity: 'Capacity',
    capacityHint: 'Leave blank for unlimited',
    included: 'Included services', rules: 'Rules',
    requiredFields: 'Required guest fields',
    requiredHint: 'A guest can\'t be placed on this level until these are filled in (overridable with permission).',
    guests: 'guests', noEvent: 'Select an active event to manage its service levels.',
    empty: 'No service levels yet', emptyHint: 'Add your first level to start grading guests',
    save: 'Save', cancel: 'Cancel', saving: 'Saving…',
    addTitle: 'Add Service Level', editTitle: 'Edit Service Level',
    noServices: 'This event has no services yet — add some on the Services page first.',
    pickServices: 'Select services', unlimited: 'Unlimited',
    delTitle: 'Delete Service Level', delBody: (n) => `Are you sure you want to delete "${n}"?`,
    atCapacity: 'Full', overCapacity: 'Over capacity',
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
        getServiceLevels(activeEventId).catch(() => []),
        getServices(activeEventId).catch(() => []),
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
      capacity: level.capacity ?? '',
      requiredGuestFields: level.requiredGuestFields || [],
      services: (level.services || []).map((s) => ({ serviceId: s.serviceId, values: { ...(s.values || {}) } })),
    });
    setErrors({});
    setShowForm(true);
  }

  const toggleService = (serviceId) => {
    const existing = form.services.find((s) => s.serviceId === serviceId);
    setF('services', existing
      ? form.services.filter((s) => s.serviceId !== serviceId)
      : [...form.services, { serviceId, values: {} }]);
  };

  const setServiceValues = (serviceId, values) =>
    setF('services', form.services.map((s) => (s.serviceId === serviceId ? { ...s, values } : s)));

  const toggleRequiredField = (key) => {
    const has = form.requiredGuestFields.includes(key);
    setF('requiredGuestFields', has
      ? form.requiredGuestFields.filter((k) => k !== key)
      : [...form.requiredGuestFields, key]);
  };

  async function handleSave() {
    const errs = {};
    if (!form.name.trim()) errs.name = isAr ? 'الاسم مطلوب' : 'Name is required';
    if (form.capacity !== '' && !(Number(form.capacity) >= 0))
      errs.capacity = isAr ? 'رقم غير صالح' : 'Must be a positive number';

    // Same required-value check the backend runs, surfaced inline.
    for (const sel of form.services) {
      const svc = services.find((s) => s.id === sel.serviceId);
      if (!svc) continue;
      const missing = (svc.fields || []).find((f) => f.required && !String(sel.values?.[f.key] ?? '').trim());
      if (missing) {
        errs.services = `${svc.name}: "${(isAr ? missing.labelAr : null) || missing.label}" ${isAr ? 'مطلوب' : 'is required'}`;
        break;
      }
    }

    if (Object.keys(errs).length) { setErrors(errs); return; }

    const body = {
      name: form.name.trim(),
      nameAr: form.nameAr.trim() || null,
      code: form.code.trim() || null,
      description: form.description.trim() || null,
      color: form.color || null,
      sortOrder: Number(form.sortOrder) || 0,
      capacity: form.capacity === '' ? null : Number(form.capacity),
      requiredGuestFields: form.requiredGuestFields,
      services: form.services,
    };

    setSaving(true);
    try {
      const res = editing
        ? await updateServiceLevel(activeEventId, editing.id, body)
        : await createServiceLevel(activeEventId, body);
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
      await deleteServiceLevel(activeEventId, toDelete.id);
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
            const full = level.capacity != null && level.guestCount >= level.capacity;
            const over = level.capacity != null && level.guestCount > level.capacity;
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

                  {/* Headcount / capacity */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{STR.guests}</span>
                      <span style={{ fontSize: 12, fontFamily: 'var(--mono)', color: over ? 'var(--danger)' : full ? '#e0c47e' : 'var(--ink)' }}>
                        {level.guestCount}{level.capacity != null ? ` / ${level.capacity}` : ''}
                        {level.capacity == null && (
                          <span style={{ color: 'var(--ink-faint)', fontSize: 10.5 }}> · {STR.unlimited}</span>
                        )}
                      </span>
                    </div>
                    {level.capacity != null && (
                      <div style={{ height: 5, borderRadius: 10, background: 'var(--surface-soft-3)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 10,
                          width: `${Math.min(100, (level.guestCount / Math.max(1, level.capacity)) * 100)}%`,
                          background: over ? 'var(--danger)' : full ? '#e0c47e' : (level.color || 'var(--accent)'),
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    )}
                    {(full || over) && (
                      <div style={{ fontSize: 10.5, color: over ? 'var(--danger)' : '#e0c47e', marginTop: 4 }}>
                        {over ? STR.overCapacity : STR.atCapacity}
                      </div>
                    )}
                  </div>

                  {/* Included services + their configured values */}
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                      {STR.included}
                    </div>
                    {(level.services || []).length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--ink-faint)', fontStyle: 'italic' }}>{STR.noneIncluded}</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {level.services.map((s) => (
                          <div key={s.serviceId} style={{
                            padding: '8px 10px', borderRadius: 8,
                            background: 'var(--surface-soft-2)', border: '1px solid var(--glass-border)',
                          }}>
                            <div style={{ fontSize: 12.5, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Icon name="check" size={11} style={{ color: '#5abf6e' }} />
                              {(isAr ? s.serviceNameAr : null) || s.serviceName}
                            </div>
                            {Object.keys(s.values || {}).length > 0 && (
                              <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {(s.fields || []).filter((f) => s.values?.[f.key]).map((f) => (
                                  <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11 }}>
                                    <span style={{ color: 'var(--ink-mute)' }}>{(isAr ? f.labelAr : null) || f.label}</span>
                                    <span style={{ color: 'var(--ink)', fontWeight: 500, textAlign: isAr ? 'left' : 'right' }}>
                                      {s.values[f.key]}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Rules */}
                  {(level.requiredGuestFields || []).length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                        {STR.requiredFields}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {level.requiredGuestFields.map((k) => (
                          <span key={k} className="chip" style={{ fontSize: 10.5 }}>{requiredFieldLabel(k)}</span>
                        ))}
                      </div>
                    </div>
                  )}
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
            <label style={labelStyle}>{STR.capacity}</label>
            <input type="number" min="0" style={errors.capacity ? errorStyle : inputStyle} value={form.capacity}
              placeholder={STR.unlimited}
              onChange={(e) => setF('capacity', e.target.value)} />
            <div style={{ fontSize: 10.5, color: errors.capacity ? '#e05050' : 'var(--ink-faint)', marginTop: 3 }}>
              {errors.capacity || STR.capacityHint}
            </div>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {services.map((svc) => {
                  const selected = form.services.find((s) => s.serviceId === svc.id);
                  return (
                    <div key={svc.id} style={{
                      borderRadius: 10, border: `1px solid ${selected ? 'var(--accent)' : 'var(--glass-border)'}`,
                      background: selected ? 'rgba(141,1,52,0.06)' : 'var(--surface-soft-2)',
                      overflow: 'hidden',
                    }}>
                      <label style={{
                        display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', cursor: 'pointer',
                      }}>
                        <input type="checkbox" checked={!!selected}
                          onChange={() => toggleService(svc.id)}
                          style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                        <span style={{ fontSize: 13, fontWeight: selected ? 600 : 400, flex: 1 }}>
                          {(isAr ? svc.nameAr : null) || svc.name}
                        </span>
                        {(svc.fields || []).length > 0 && (
                          <span style={{ fontSize: 10.5, color: 'var(--ink-faint)' }}>
                            {svc.fields.length} {isAr ? 'حقل' : svc.fields.length === 1 ? 'field' : 'fields'}
                          </span>
                        )}
                      </label>

                      {selected && (svc.fields || []).length > 0 && (
                        <div style={{ padding: '0 12px 12px', borderTop: '1px solid var(--glass-border)', paddingTop: 10 }}>
                          <DynamicFieldInputs
                            fields={svc.fields}
                            values={selected.values}
                            onChange={(vals) => setServiceValues(svc.id, vals)}
                            lang={lang}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
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
