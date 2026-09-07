// Lightweight guest-profile editor — the same field set as the drawer's own
// "Edit profile" popup in App.jsx (GuestDrawer), reused here for the Guest
// Detail page's Personal Info card. Deliberately narrow: name, guest type,
// organization, nationality, photo, accreditation — not the full multi-step
// GuestModal wizard, and not Tier/Arrival/Departure (legacy/out of scope here;
// Tier now just mirrors the guest's ServiceLevel, and travel dates live on
// the Services cards instead).
import React, { useState, useEffect } from 'react';
import { Icon } from '../../../components/Icons';
import Select from '../../../components/ui/Select';
import { nationalityOptionLabel } from '../../../components/FlagIcon';
import toast from '../../../lib/toast';
import { updateGuest, getGuestEnums } from '../../../api/services/guestService';
import { getNationalities } from '../../../api/services/nationalityService';
import { uploadImageFile, stripSasToken } from '../../../api/services/uploadService';

const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box',
};
const labelStyle = {
  display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase',
  letterSpacing: '0.1em', marginBottom: 4,
};

function toForm(g) {
  return {
    firstName: g?.firstName || '',
    lastName: g?.lastName || '',
    guestType: g?.guestType || 'delegate',
    organization: g?.organization || '',
    nationalityId: g?.nationalityId || '',
    photoUrl: g?.photoUrl || '',
    accreditationRequired: !!g?.accreditationRequired,
  };
}

export default function GuestProfileEditModal({ open, guest, lang, onClose, onSaved }) {
  const isAr = lang === 'ar';
  const [form, setForm] = useState(() => toForm(guest));
  const [enums, setEnums] = useState({});
  const [nationalities, setNationalities] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(toForm(guest));
    getGuestEnums().then(setEnums).catch(() => {});
    getNationalities().then(setNationalities).catch(() => setNationalities([]));
  }, [open, guest]);

  if (!open) return null;

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const guestTypeOpts = (enums?.GuestType || []).map((gt) => ({
    value: gt.code,
    label: (isAr ? gt.nameAr : null) || gt.name,
  }));
  const nationalityOpts = nationalities.map((n) => ({
    value: n.id,
    label: n.name,
    code: n.code,
  }));

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      setField('photoUrl', await uploadImageFile(file));
    } catch (err) {
      toast.fromError(err, isAr ? 'فشل تحميل الصورة' : 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error(isAr ? 'الاسم الأول والأخير مطلوبان' : 'First and last name are required');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateGuest(guest.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        // Read-only here — the sign-in identity, unaffected by this form.
        email: guest.email || null,
        guestType: form.guestType,
        organization: form.organization || null,
        // The update endpoint resolves organizationId fresh and overwrites
        // OrganizationId/Organization from it — omitting it here nulled out
        // the guest's linked organization on every save from this form.
        organizationId: guest.organizationId || null,
        nationalityId: form.nationalityId || null,
        // Not editable in this form — carried over unchanged. Omitting
        // serviceLevelId in particular cleared the guest's assigned service
        // level (and with it their whole services checklist) on every save.
        serviceLevelId: guest.serviceLevelId || null,
        overrideServiceLevelRules: !!guest.serviceLevelRulesOverridden,
        serviceLevelOverrideReason: guest.serviceLevelOverrideReason || null,
        tier: guest.tier,
        arrivalDate: guest.arrivalDate || null,
        departureDate: guest.departureDate || null,
        photoUrl: stripSasToken(form.photoUrl) || null,
        accreditationRequired: form.accreditationRequired,
        invitationTemplateId: guest.invitationTemplateId || null,
        sessionIds: guest.sessionIds || [],
      });
      toast.success(isAr ? 'تم الحفظ' : 'Saved');
      onSaved?.(updated);
      onClose();
    } catch (err) {
      toast.fromError(err, isAr ? 'حدث خطأ أثناء الحفظ' : 'Error saving the profile');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}
      onClick={onClose}>
      <div className="card glass modal-solid" style={{ width: 460, maxWidth: '92vw', padding: 0, maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>{isAr ? 'تعديل الملف الشخصي' : 'Edit Profile'}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>

        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 76, height: 76, borderRadius: '50%', overflow: 'hidden', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)', display: 'grid', placeItems: 'center' }}>
                {form.photoUrl ? (
                  <img src={form.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Icon name="image" size={24} style={{ color: 'var(--ink-faint)' }} />
                )}
              </div>
              <label style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: '50%', background: 'var(--accent)', display: 'grid', placeItems: 'center', cursor: uploading ? 'default' : 'pointer', border: '2px solid var(--bg)', opacity: uploading ? 0.6 : 1 }}>
                <Icon name="upload" size={11} style={{ color: '#fff' }} />
                <input type="file" accept="image/*" onChange={handlePhoto} disabled={uploading} style={{ display: 'none' }} />
              </label>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
              {uploading ? (isAr ? 'جارٍ الرفع…' : 'Uploading…') : (isAr ? 'اختياري' : 'Optional')}
            </div>
            {form.photoUrl && !uploading && (
              <button onClick={() => setField('photoUrl', '')}
                style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                {isAr ? 'إزالة الصورة' : 'Remove photo'}
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>{isAr ? 'الاسم الأول' : 'First Name'} *</label>
              <input style={inputStyle} value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>{isAr ? 'الاسم الأخير' : 'Last Name'} *</label>
              <input style={inputStyle} value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>{isAr ? 'البريد الإلكتروني' : 'Email'}</label>
            <input style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} value={guest?.email || ''} disabled readOnly />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>{isAr ? 'نوع الضيف' : 'Guest Type'}</label>
              <Select value={form.guestType} onChange={(v) => setField('guestType', v)} options={guestTypeOpts}
                placeholder={isAr ? '— اختر —' : '— Select —'} />
            </div>
            <div>
              <label style={labelStyle}>{isAr ? 'المؤسسة' : 'Organization'}</label>
              <input style={inputStyle} value={form.organization} onChange={(e) => setField('organization', e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>{isAr ? 'الجنسية' : 'Nationality'}</label>
            <Select value={form.nationalityId} onChange={(v) => setField('nationalityId', v)} options={nationalityOpts}
              formatOptionLabel={nationalityOptionLabel}
              placeholder={isAr ? '— اختر —' : '— Select —'} isClearable />
          </div>

          <div>
            <label style={{ ...labelStyle, marginBottom: 8 }}>{isAr ? 'الاعتماد' : 'Accreditation'}</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { value: false, label: isAr ? 'غير مطلوب' : 'Not required' },
                { value: true, label: isAr ? 'مطلوب' : 'Required' },
              ].map((opt) => (
                <div key={String(opt.value)} onClick={() => setField('accreditationRequired', opt.value)}
                  style={{
                    flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', fontSize: 13,
                    fontWeight: form.accreditationRequired === opt.value ? 600 : 400,
                    border: `1px solid ${form.accreditationRequired === opt.value ? 'var(--accent)' : 'var(--glass-border)'}`,
                    background: form.accreditationRequired === opt.value ? 'rgba(141, 1, 52,0.12)' : 'var(--surface-soft-2)',
                  }}>
                  {opt.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={saving}>{isAr ? 'إلغاء' : 'Cancel'}</button>
          <button className="btn primary" onClick={handleSave} disabled={saving}>
            <Icon name="check" size={13} /> {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  );
}
