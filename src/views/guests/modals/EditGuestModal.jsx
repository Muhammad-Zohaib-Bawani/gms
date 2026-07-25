import React, { useState, useMemo, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Icon } from '../../../components/Icons';
import Select from '../../../components/ui/Select';
import DateField from '../../../components/ui/DateField';
import toast from '../../../lib/toast';
import { updateGuest, getGuestEnums } from '../../../api/services/guestService';
import { getTravelLookups, getGuestTravel, saveGuestTravel } from '../../../api/services/travelService';
import TravelAccordion, {
  EMPTY_TRAVEL,
  hydrateTravel,
  anyTravelEnabled,
  buildTravelPayload,
  validateTravel,
} from './TravelAccordion';

const GUEST_TYPES = ['dignitary', 'delegate', 'media', 'staff', 'vip', 'observer'];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const overlayStyle = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.55)',
  backdropFilter: 'blur(3px)',
  zIndex: 1100,
};

const contentStyle = {
  position: 'fixed', inset: 0, margin: 'auto',
  width: 560, maxWidth: '94vw', height: 680, maxHeight: '92vh',
  zIndex: 1101,
  display: 'flex', flexDirection: 'column',
  background: 'var(--glass-bg, rgba(10,28,36,0.92))',
  backdropFilter: 'blur(20px)',
  border: '1px solid var(--glass-border)',
  borderRadius: 16,
  boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
  outline: 'none',
};

function guestToForm(g) {
  return {
    firstName:           g.firstName           || '',
    lastName:            g.lastName            || '',
    email:               g.email               || '',
    guestType:           g.guestType           || 'delegate',
    organization:        g.organization        || '',
    nationalityId:       g.nationalityId       || '',
    tier:                g.tier                || 'delegate',
    invitationStatus:    g.invitationStatus    || 'not_sent',
    arrivalDate:         g.arrivalDate         || '',
    departureDate:       g.departureDate       || '',
    accreditationStatus: g.accreditationStatus || 'not_issued',
  };
}

export default function EditGuestModal({ open, onClose, guest, nationalities, templates, sessions, lang, onSaved }) {
  const isAr = lang === 'ar';

  const [step,          setStep]          = useState(1);
  const [form,          setForm]          = useState(() => guestToForm(guest || {}));
  const [templateId,    setTemplateId]    = useState(guest?.invitationTemplateId || null);
  const [guestSessions, setGuestSessions] = useState(new Set(guest?.sessionIds || []));
  const [step1Errors,   setStep1Errors]   = useState({});
  const [saving,        setSaving]        = useState(false);
  const [enums,         setEnums]         = useState({});
  const [travel,        setTravel]        = useState(EMPTY_TRAVEL);
  const [travelLookups, setTravelLookups] = useState({});

  // Sync form when guest prop changes (e.g. opening a different guest)
  useEffect(() => {
    if (!guest) return;
    setForm(guestToForm(guest));
    setTemplateId(guest.invitationTemplateId || null);
    setGuestSessions(new Set(guest.sessionIds || []));
    setStep(1);
    setStep1Errors({});
    // Prefill travel; sections that come back non-null are marked enabled.
    setTravel(EMPTY_TRAVEL);
    getGuestTravel(guest.id)
      .then(data => setTravel(hydrateTravel(data)))
      .catch(() => setTravel(EMPTY_TRAVEL));
  }, [guest?.id]);

  useEffect(() => {
    getGuestEnums().then(setEnums);
  }, []);
  useEffect(() => {
    getTravelLookups().then(setTravelLookups).catch(() => setTravelLookups({}));
  }, []);

  const setF = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function setArrivalDate(v) {
    setForm(p => ({
      ...p,
      arrivalDate: v,
      departureDate: p.departureDate && v && p.departureDate < v ? '' : p.departureDate,
    }));
  }

  function handleClose() {
    setStep(1);
    setStep1Errors({});
    onClose();
  }

  function handleNext() {
    if (step === 1) {
      const errs = {};
      if (!form.firstName.trim()) errs.firstName = true;
      if (!form.lastName.trim())  errs.lastName  = true;
      if (Object.keys(errs).length) { setStep1Errors(errs); return; }
    }
    setStep(s => s + 1);
  }

  async function handleSave() {
    const travelErr = validateTravel(travel, isAr);
    if (travelErr) {
      toast.error(travelErr);
      return;
    }
    setSaving(true);
    try {
      await updateGuest(guest.id, {
        firstName:           form.firstName.trim(),
        lastName:            form.lastName.trim(),
        email:               form.email || null,
        guestType:           form.guestType,
        organization:        form.organization || null,
        nationalityId:       form.nationalityId || null,
        tier:                form.tier,
        arrivalDate:         form.arrivalDate || null,
        departureDate:       form.departureDate || null,
        invitationTemplateId: templateId || null,
        sessionIds:          Array.from(guestSessions),
      });
      // Persist the enabled travel sections against the same guest.
      if (guest?.id && anyTravelEnabled(travel)) {
        try {
          await saveGuestTravel(guest.id, buildTravelPayload(travel));
        } catch {
          toast.error(isAr ? 'تم تحديث الضيف لكن تعذّر حفظ بيانات السفر' : 'Guest updated, but travel details failed to save');
        }
      }
      onSaved?.();
      handleClose();
      toast.success(isAr ? 'تم تحديث بيانات الضيف' : 'Guest updated successfully');
    } catch {
      toast.error(isAr ? 'حدث خطأ أثناء تحديث الضيف' : 'Error updating guest');
    } finally {
      setSaving(false);
    }
  }

  const guestTypeOpts = useMemo(() =>
    GUEST_TYPES.map(gt => ({ value: gt, label: gt.charAt(0).toUpperCase() + gt.slice(1) })), []);

  const nationalityOpts = useMemo(() =>
    nationalities.map(n => ({ value: n.id, label: `${n.flag} ${isAr ? n.nameAr : n.name}` })),
  [nationalities, isAr]);

  const stepLabels = isAr
    ? ['المعلومات الشخصية', 'الفئة والإقامة', 'السفر والإقامة', 'الدعوة']
    : ['Personal Info', 'Tier and Stay', 'Travel & Stay', 'Invitation'];

  const inputStyle = {
    width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
    borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13,
  };
  const errorBorder = { ...inputStyle, border: '1px solid #e05050' };
  const errMsg      = { fontSize: 11, color: '#e05050', marginTop: 3 };

  function FieldLabel({ children }) {
    return (
      <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 }}>
        {children}
      </label>
    );
  }

  if (!guest) return null;

  return (
    <Dialog.Root open={open} onOpenChange={o => !o && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle}/>
        <Dialog.Content
          style={contentStyle}
          onInteractOutside={e => e.preventDefault()}
          onFocusOutside={e => e.preventDefault()}
        >
          {/* Header */}
          <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
            <div>
              <Dialog.Title style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 600 }}>
                {isAr ? 'تعديل الضيف' : 'Edit Guest'}
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ink-mute)', marginLeft: 8 }}>
                  {guest.fullName}
                </span>
              </Dialog.Title>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {stepLabels.map((label, i) => {
                  const s = i + 1, done = step > s, active = step === s;
                  return (
                    <React.Fragment key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
                          background: done ? 'var(--accent-deep)' : active ? 'var(--accent)' : 'var(--surface-soft-4)',
                          color: done || active ? '#fff' : 'var(--ink-mute)' }}>
                          {done ? <Icon name="check" size={11}/> : s}
                        </div>
                        <span style={{ fontSize: 11.5, whiteSpace: 'nowrap', color: active ? 'var(--accent)' : done ? 'var(--ink-dim)' : 'var(--ink-mute)', fontWeight: active ? 600 : 400 }}>
                          {label}
                        </span>
                      </div>
                      {i < stepLabels.length - 1 && (
                        <div style={{ width: 18, height: 1, background: done ? 'var(--accent-deep)' : 'var(--glass-border)', margin: '0 5px', flexShrink: 0 }}/>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="icon-btn" style={{ marginTop: 2, flexShrink: 0 }}><Icon name="close" size={14}/></button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* STEP 1 — Personal Info */}
            {step === 1 && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: isAr ? 'الاسم الأول' : 'First Name', key: 'firstName', ph: '' },
                    { label: isAr ? 'الاسم الأخير' : 'Last Name',  key: 'lastName',  ph: '' },
                  ].map(f => (
                    <div key={f.key}>
                      <FieldLabel>{f.label} *</FieldLabel>
                      <input
                        value={form[f.key]}
                        onChange={e => { setF(f.key, e.target.value); setStep1Errors(p => ({ ...p, [f.key]: false })); }}
                        style={step1Errors[f.key] ? errorBorder : inputStyle}
                      />
                      {step1Errors[f.key] && <div style={errMsg}>{isAr ? 'مطلوب' : 'Required'}</div>}
                    </div>
                  ))}
                </div>
                <div>
                  <FieldLabel>{isAr ? 'البريد الإلكتروني' : 'Email'}</FieldLabel>
                  <input type="email" value={form.email} onChange={e => setF('email', e.target.value)} style={inputStyle}/>
                </div>
                <div>
                  <FieldLabel>{isAr ? 'نوع الضيف' : 'Guest Type'}</FieldLabel>
                  <Select value={form.guestType} onChange={v => setF('guestType', v)} options={guestTypeOpts}/>
                </div>
                <div>
                  <FieldLabel>{isAr ? 'المؤسسة' : 'Organization'}</FieldLabel>
                  <input value={form.organization} onChange={e => setF('organization', e.target.value)} style={inputStyle}/>
                </div>
                <div>
                  <FieldLabel>{isAr ? 'الجنسية' : 'Nationality'}</FieldLabel>
                  <Select value={form.nationalityId} onChange={v => setF('nationalityId', v)} options={nationalityOpts} placeholder={isAr ? '— اختر —' : '— Select —'} isClearable/>
                </div>
              </>
            )}

            {/* STEP 2 — Tier and Stay */}
            {step === 2 && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>{isAr ? 'الفئة' : 'Tier'}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {enums?.GuestTier?.map(tier => (
                      <div key={tier.code} onClick={() => setF('tier', tier.code)}
                        style={{ padding: '12px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                          border: `1px solid ${form.tier === tier.code ? 'var(--accent)' : 'var(--glass-border)'}`,
                          background: form.tier === tier.code ? 'rgba(141, 1, 52,0.12)' : 'var(--surface-soft-2)',
                          fontSize: 13, fontWeight: form.tier === tier.code ? 600 : 400 }}>
                        {tier.name}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>{isAr ? 'الاعتماد' : 'Accreditation'}</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {enums?.GuestAccreditationStatus?.filter(s => s.code !== 'revoked').map(s => (
                      <div key={s.code} onClick={() => setF('accreditationStatus', s.code)}
                        style={{ flex: 1, padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                          border: `1px solid ${form.accreditationStatus === s.code ? 'var(--accent)' : 'var(--glass-border)'}`,
                          background: form.accreditationStatus === s.code ? 'rgba(141, 1, 52,0.12)' : 'var(--surface-soft-2)',
                          fontSize: 13, textTransform: 'capitalize', fontWeight: form.accreditationStatus === s.code ? 600 : 400 }}>
                        {isAr ? s.nameAr : s.name}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* STEP 3 — Travel & Stay */}
            {step === 3 && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <FieldLabel>{isAr ? 'تاريخ الوصول' : 'Arrival Date'}</FieldLabel>
                    <DateField value={form.arrivalDate} onChange={setArrivalDate} minDate={todayIso()} placeholder="YYYY-MM-DD"/>
                  </div>
                  <div>
                    <FieldLabel>{isAr ? 'تاريخ المغادرة' : 'Departure Date'}</FieldLabel>
                    <DateField value={form.departureDate} onChange={v => setF('departureDate', v)} minDate={form.arrivalDate || todayIso()} placeholder="YYYY-MM-DD"/>
                  </div>
                </div>
                <TravelAccordion
                  travel={travel}
                  onChange={setTravel}
                  lookups={travelLookups}
                  isAr={isAr}
                />
              </>
            )}

            {/* STEP 4 — Invitation & Sessions */}
            {step === 4 && (
              <>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <label style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      {isAr ? 'قالب الدعوة (اختياري)' : 'Invitation Template (optional)'}
                    </label>
                  </div>
                  {!form.email && (
                    <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(224,196,126,0.1)', border: '1px solid rgba(224,196,126,0.3)', fontSize: 12, color: '#e0c47e' }}>
                      {isAr ? 'لا يوجد بريد إلكتروني — لن يتم إرسال الدعوة' : "No email — invitation won't be sent"}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div onClick={() => setTemplateId(null)}
                      style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                        border: `1px solid ${!templateId ? 'var(--accent)' : 'var(--glass-border)'}`,
                        background: !templateId ? 'rgba(141, 1, 52,0.1)' : 'var(--surface-soft-2)' }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${!templateId ? 'var(--accent)' : 'var(--glass-border)'}`, background: !templateId ? 'var(--accent)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        {!templateId && <Icon name="check" size={10} style={{ color: '#fff' }}/>}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: !templateId ? 600 : 400 }}>{isAr ? 'بدون دعوة' : 'No invitation'}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{isAr ? 'إضافة الضيف فقط' : 'No email sent'}</div>
                      </div>
                    </div>
                    {templates.map(tmpl => (
                      <div key={tmpl.id} onClick={() => setTemplateId(tmpl.id)}
                        style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                          border: `1px solid ${templateId === tmpl.id ? (tmpl.color || 'var(--accent)') : 'var(--glass-border)'}`,
                          background: templateId === tmpl.id ? (tmpl.color || 'var(--accent)') + '18' : 'var(--surface-soft-2)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: tmpl.color || 'var(--accent)', flexShrink: 0 }}/>
                          <span style={{ fontSize: 13, fontWeight: templateId === tmpl.id ? 600 : 400 }}>{isAr ? (tmpl.nameAr || tmpl.name) : tmpl.name}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>{tmpl.language}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginLeft: 18, marginTop: 3, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isAr ? (tmpl.subjectAr || tmpl.subject) : tmpl.subject}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <label style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      {isAr ? 'الجلسات (اختياري)' : 'Sessions (optional)'}
                    </label>
                    {sessions.length > 0 && (
                      <button onClick={() => setGuestSessions(prev => prev.size === sessions.length ? new Set() : new Set(sessions.map(s => s.id)))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--accent)', padding: 0 }}>
                        {guestSessions.size === sessions.length ? (isAr ? 'إلغاء الكل' : 'Deselect all') : (isAr ? 'تحديد الكل' : 'Select all')}
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {sessions.map(s => {
                      const checked = guestSessions.has(s.id);
                      return (
                        <div key={s.id} onClick={() => setGuestSessions(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                          style={{ padding: '8px 12px', borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10,
                            border: `1px solid ${checked ? 'var(--accent)' : 'var(--glass-border)'}`,
                            background: checked ? 'rgba(141, 1, 52,0.08)' : 'var(--surface-soft-2)' }}>
                          <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? 'var(--accent)' : 'var(--glass-border)'}`, background: checked ? 'var(--accent)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0, marginTop: 1 }}>
                            {checked && <Icon name="check" size={9} style={{ color: '#fff' }}/>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: checked ? 500 : 400 }}>{s.title}</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{ fontFamily: 'var(--mono)' }}>{s.date} · {s.time}</span>
                              {(s.venueName || s.room) ? ` · ${[s.venueName, s.room].filter(Boolean).join(' · ')}` : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {sessions.length === 0 && (
                      <div style={{ padding: '12px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 12, border: '1px dashed var(--glass-border)', borderRadius: 9 }}>
                        {isAr ? 'لا توجد جلسات لهذه الفعالية' : 'No sessions for this event yet'}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '14px 24px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', gap: 8, flexShrink: 0 }}>
            <button className="btn" onClick={() => step > 1 ? setStep(s => s - 1) : handleClose()}>
              {step > 1 ? <><Icon name="arrowLeft" size={13}/> {isAr ? 'السابق' : 'Back'}</> : (isAr ? 'إلغاء' : 'Cancel')}
            </button>
            {step < 4 ? (
              <button className="btn primary" onClick={handleNext}>
                {isAr ? 'التالي' : 'Next'} <Icon name="arrow" size={13}/>
              </button>
            ) : (
              <button className="btn primary" onClick={handleSave} disabled={saving}>
                <Icon name="check" size={13}/>
                {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
