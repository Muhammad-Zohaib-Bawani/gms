import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { getTranslations, fmtNum } from '../i18n/translations';
import { Avatar, StatusChip, TierChip } from '../components/UI';
import { Icon } from '../components/Icons';
import DataTable from '../components/ui/DataTable';
import Select from '../components/ui/Select';
import DateField from '../components/ui/DateField';
import toast from '../lib/toast';
import { listGuests, createGuest } from '../api/services/guestService';
import { getNationalities } from '../api/services/nationalityService';
import { getTemplates } from '../api/services/invitationTemplateService';
import { listSessions } from '../api/services/eventService';

const GUEST_TYPES = ['dignitary','delegate','media','staff','vip','observer'];
const TIERS       = ['VVIP','VIP','Speaker','Delegate','Press','Observer'];

const EMPTY_GUEST = {
  firstName: '', lastName: '', email: '', guestType: 'delegate',
  organization: '', nationalityId: '',
  tier: 'Delegate', invitationStatus: 'not_sent',
  arrivalDate: '', flightNumber: '', hotel: '', accreditationStatus: 'not_issued',
};

export default function GuestsView({ onOpenGuest, lang, activeEventId }) {
  const t    = getTranslations(lang);
  const isAr = lang === 'ar';
  const fmtN = (n) => fmtNum(n, lang);

  // ── data ──────────────────────────────────────────────────────────────────
  const [guests,        setGuests]        = useState([]);
  const [nationalities, setNationalities] = useState([]);
  const [templates,     setTemplates]     = useState([]);
  const [sessions,      setSessions]      = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [saving,        setSaving]        = useState(false);

  // ── filter / selection ────────────────────────────────────────────────────
  const [query,          setQuery]          = useState('');
  const [tierFilter,     setTierFilter]     = useState('All');
  const [statusFilter,   setStatusFilter]   = useState('All');
  const [selectedGuests, setSelectedGuests] = useState([]);
  const [selResetKey,    setSelResetKey]    = useState(0);

  // ── new guest wizard ──────────────────────────────────────────────────────
  const [showNewGuest,       setShowNewGuest]       = useState(false);
  const [newStep,            setNewStep]            = useState(1);
  const [newGuest,           setNewGuest]           = useState(EMPTY_GUEST);
  const [step1Errors,        setStep1Errors]        = useState({});
  const [newGuestTemplateId, setNewGuestTemplateId] = useState(null);
  const [newGuestSessions,   setNewGuestSessions]   = useState(new Set());

  // ── other modals ──────────────────────────────────────────────────────────
  const [showMessageModal,  setShowMessageModal]  = useState(false);
  const [messageBody,       setMessageBody]       = useState('');
  const [messageSent,       setMessageSent]       = useState(false);
  const [showAccredConfirm, setShowAccredConfirm] = useState(false);
  const [showImportModal,   setShowImportModal]   = useState(false);
  const [importFile,        setImportFile]        = useState(null);
  const [importDragging,    setImportDragging]    = useState(false);
  const fileRef = useRef();

  // ── invite wizard ─────────────────────────────────────────────────────────
  const [showInviteWizard, setShowInviteWizard] = useState(false);
  const [inviteStep,       setInviteStep]       = useState(1);
  const [inviteRecipients, setInviteRecipients] = useState([]);
  const [inviteTemplateId, setInviteTemplateId] = useState(null);
  const [inviteChannels,   setInviteChannels]   = useState(new Set(['Email']));
  const [inviteSessions,   setInviteSessions]   = useState(new Set());
  const [inviteTiming,     setInviteTiming]     = useState('now');
  const [inviteDate,       setInviteDate]       = useState('');
  const [inviteTime,       setInviteTime]       = useState('09:00');
  const [inviteSending,    setInviteSending]    = useState(false);
  const [inviteDone,       setInviteDone]       = useState(false);

  // ── derived ───────────────────────────────────────────────────────────────
  const selCount = selectedGuests.length;

  function clearSelection() { setSelResetKey(k => k + 1); }

  // ── load reference data ───────────────────────────────────────────────────
  useEffect(() => {
    getNationalities().then(r => setNationalities(r || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeEventId) { setTemplates([]); setSessions([]); return; }
    getTemplates(activeEventId).then(r => setTemplates(r || [])).catch(() => {});
    listSessions(activeEventId).then(r => setSessions(r || [])).catch(() => {});
  }, [activeEventId]);

  const loadGuests = useCallback(async () => {
    if (!activeEventId) return;
    setLoading(true);
    try {
      const r = await listGuests({ eventId: activeEventId, pageSize: 200, search: query || undefined });
      setGuests(r?.items || []);
    } catch {
      // keep previous list
    } finally {
      setLoading(false);
    }
  }, [activeEventId, query]);

  useEffect(() => { loadGuests(); }, [loadGuests]);

  const filtered = guests.filter(g => {
    if (tierFilter !== 'All' && g.tier !== tierFilter) return false;
    if (statusFilter !== 'All' && g.invitationStatus !== statusFilter) return false;
    return true;
  });

  // ── select options ────────────────────────────────────────────────────────
  const tierFilterOpts = useMemo(() => [
    { value: 'All', label: isAr ? 'كل الفئات' : 'All Tiers' },
    ...TIERS.map(t => ({ value: t, label: t })),
  ], [isAr]);

  const statusFilterOpts = useMemo(() => [
    { value: 'All',       label: isAr ? 'كل الحالات' : 'All Statuses' },
    { value: 'not_sent',  label: isAr ? 'لم يُرسل' : 'Not Sent' },
    { value: 'sent',      label: isAr ? 'مُرسل' : 'Sent' },
    { value: 'opened',    label: isAr ? 'مفتوح' : 'Opened' },
    { value: 'accepted',  label: isAr ? 'مقبول' : 'Accepted' },
    { value: 'declined',  label: isAr ? 'مرفوض' : 'Declined' },
  ], [isAr]);

  const guestTypeOpts = useMemo(() =>
    GUEST_TYPES.map(gt => ({ value: gt, label: gt.charAt(0).toUpperCase() + gt.slice(1) })),
  []);

  const nationalityOpts = useMemo(() =>
    nationalities.map(n => ({ value: n.id, label: `${n.flag} ${isAr ? n.nameAr : n.name}` })),
  [nationalities, isAr]);

  // ── guest table columns ───────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      id: 'guest',
      header: isAr ? 'الضيف' : 'Guest',
      accessorKey: 'fullName',
      cell: ({ row: { original: g } }) => {
        const initials = ((g.firstName?.[0] || '') + (g.lastName?.[0] || '')).toUpperCase();
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}
            onClick={e => { e.stopPropagation(); onOpenGuest?.(g); }}>
            <Avatar initials={initials} size={32} tier={g.tier}/>
            <div>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{g.fullName}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{g.guestType} · {g.organization}</div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'tier',
      header: isAr ? 'الفئة' : 'Tier',
      accessorKey: 'tier',
      size: 100,
      cell: ({ getValue }) => <TierChip tier={getValue()} lang={lang}/>,
    },
    {
      id: 'nationality',
      header: isAr ? 'الجنسية' : 'Nationality',
      accessorKey: 'nationalityName',
      size: 130,
      cell: ({ row: { original: g } }) => (
        <span style={{ fontSize: 12 }}>{g.nationalityFlag} {g.nationalityName}</span>
      ),
    },
    {
      id: 'inviteStatus',
      header: isAr ? 'حالة الدعوة' : 'Invite Status',
      accessorKey: 'invitationStatus',
      size: 120,
      cell: ({ getValue }) => <StatusChip status={getValue()} lang={lang}/>,
    },
    {
      id: 'arrival',
      header: isAr ? 'تاريخ الوصول' : 'Arrival',
      accessorKey: 'arrivalDate',
      size: 105,
      cell: ({ getValue }) => (
        <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{getValue() || '—'}</span>
      ),
    },
    {
      id: 'hotel',
      header: isAr ? 'الفندق' : 'Hotel',
      accessorKey: 'hotel',
      cell: ({ getValue }) => <span style={{ fontSize: 12 }}>{getValue() || '—'}</span>,
    },
    {
      id: 'accreditation',
      header: isAr ? 'الاعتماد' : 'Accreditation',
      accessorKey: 'accreditationStatus',
      size: 110,
      enableSorting: false,
      cell: ({ getValue }) => {
        const issued = getValue() === 'issued';
        return (
          <span className={`chip ${issued ? 'confirmed' : 'pending'}`}>
            <span className="dot"/>
            {issued ? (isAr ? 'صادر' : 'Issued') : (isAr ? 'معلق' : 'Pending')}
          </span>
        );
      },
    },
  ], [isAr, lang, onOpenGuest]);

  // ── wizard ────────────────────────────────────────────────────────────────
  function openNewGuest() {
    setNewGuest(EMPTY_GUEST);
    setNewGuestTemplateId(null);
    setNewGuestSessions(new Set());
    setStep1Errors({});
    setNewStep(1);
    setShowNewGuest(true);
  }

  function closeNewGuest() { setShowNewGuest(false); }

  function handleNextStep() {
    if (newStep === 1) {
      const errs = {};
      if (!newGuest.firstName.trim()) errs.firstName = true;
      if (!newGuest.lastName.trim())  errs.lastName  = true;
      if (Object.keys(errs).length) { setStep1Errors(errs); return; }
    }
    setNewStep(newStep + 1);
  }

  async function saveNewGuest() {
    if (!newGuest.firstName || !newGuest.lastName) return;
    setSaving(true);
    try {
      await createGuest({
        firstName:            newGuest.firstName.trim(),
        lastName:             newGuest.lastName.trim(),
        email:                newGuest.email || null,
        eventId:              activeEventId,
        guestType:            newGuest.guestType,
        organization:         newGuest.organization || null,
        nationalityId:        newGuest.nationalityId || null,
        tier:                 newGuest.tier,
        invitationStatus:     newGuest.invitationStatus,
        arrivalDate:          newGuest.arrivalDate || null,
        flightNumber:         newGuest.flightNumber || null,
        hotel:                newGuest.hotel || null,
        accreditationStatus:  newGuest.accreditationStatus,
        invitationTemplateId: newGuestTemplateId || null,
        sessionIds:           Array.from(newGuestSessions),
      });
      await loadGuests();
      closeNewGuest();
      toast.success(newGuestTemplateId
        ? (isAr ? 'تمت إضافة الضيف وإرسال الدعوة ✓' : 'Guest added & invitation sent')
        : (isAr ? 'تمت إضافة الضيف بنجاح' : 'Guest added successfully'));
    } catch {
      toast.error(isAr ? 'حدث خطأ أثناء إضافة الضيف' : 'Error adding guest. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function openInviteWizard() {
    setInviteRecipients(selectedGuests.map(g => g.id));
    setInviteStep(1);
    setInviteTemplateId(templates[0]?.id || null);
    setInviteChannels(new Set(['Email']));
    setInviteSessions(new Set());
    setInviteTiming('now');
    setInviteSending(false);
    setInviteDone(false);
    setShowInviteWizard(true);
  }

  function toggleChannel(ch) {
    setInviteChannels(prev => {
      const n = new Set(prev);
      if (n.has(ch)) { if (n.size > 1) n.delete(ch); } else n.add(ch);
      return n;
    });
  }

  function handleSendInvitations() {
    setInviteSending(true);
    setTimeout(() => {
      setInviteDone(true);
      setInviteSending(false);
      setTimeout(() => {
        setShowInviteWizard(false);
        clearSelection();
        const n = inviteRecipients.length;
        toast.success(isAr ? `تم إرسال الدعوة إلى ${n} ضيف` : `Invitation sent to ${n} guest${n !== 1 ? 's' : ''}`);
      }, 1200);
    }, 900);
  }

  function handleSendMessage() {
    setMessageSent(true);
    setTimeout(() => {
      setShowMessageModal(false);
      setMessageSent(false);
      setMessageBody('');
      clearSelection();
      toast.success(isAr ? `تم إرسال الرسالة إلى ${selCount} ضيف` : `Message sent to ${selCount} guest${selCount > 1 ? 's' : ''}`);
    }, 800);
  }

  function handleIssueAccred() {
    setShowAccredConfirm(false);
    clearSelection();
    toast.success(isAr ? 'تم إصدار الاعتماد' : 'Accreditation issued');
  }

  function handleImport() {
    setShowImportModal(false);
    setImportFile(null);
    toast.success(isAr ? 'تم استيراد البيانات بنجاح' : 'Import completed successfully');
  }

  function handleExport() {
    const cols = ['Name','Email','Nationality','Tier','Invitation Status','Hotel','Accreditation'];
    const rows = filtered.map(g => [
      g.fullName, g.email, g.nationalityName, g.tier,
      g.invitationStatus, g.hotel, g.accreditationStatus
    ].map(v => `"${v || ''}"`).join(','));
    const csv = [cols.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'guests.csv';
    a.click();
  }

  function handleFileDrop(e) {
    e.preventDefault();
    setImportDragging(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (file) setImportFile(file);
  }

  const stepLabels = isAr
    ? ['المعلومات الشخصية','الفئة والحالة','السفر والإقامة','الدعوة']
    : ['Personal Info','Tier & Status','Travel & Stay','Invitation'];

  const inputStyle = {
    width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
    borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13,
  };
  const errorBorder = { ...inputStyle, border: '1px solid #e05050' };
  const errMsg = { fontSize: 11, color: '#e05050', marginTop: 3 };

  const ng    = newGuest;
  const setNg = (k, v) => setNewGuest(prev => ({ ...prev, [k]: v }));

  const fieldLabel = (text) => (
    <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 5 }}>
      {text}
    </label>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.guests?.title?.[0] || 'Guest'} <em>{t.guests?.title?.[1] || 'Management'}</em></h1>
          <div className="page-sub">{filtered.length} guest{filtered.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="page-actions">
          {selCount > 0 && (
            <>
              <button className="btn primary" onClick={openInviteWizard}><Icon name="invitation" size={14}/> {isAr ? `إرسال دعوة (${fmtN(selCount)})` : `Send Invitation (${fmtN(selCount)})`}</button>
              <button className="btn" onClick={() => setShowMessageModal(true)}><Icon name="message" size={14}/> {t.common?.message || 'Message'} ({fmtN(selCount)})</button>
              <button className="btn" onClick={() => setShowAccredConfirm(true)}><Icon name="badge" size={14}/> {t.common?.issueAccreditation || 'Issue Accreditation'}</button>
            </>
          )}
          <button className="btn" onClick={() => setShowImportModal(true)}><Icon name="upload" size={14}/> {isAr ? 'استيراد' : 'Import'}</button>
          <button className="btn" onClick={handleExport}><Icon name="download" size={14}/> {isAr ? 'تصدير' : 'Export'}</button>
          <button className="btn primary" onClick={openNewGuest} disabled={!activeEventId}>
            <Icon name="plus" size={14}/> {isAr ? 'ضيف جديد' : 'Add Guest'}
          </button>
        </div>
      </div>

      {!activeEventId && (
        <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 10, background: 'rgba(224,196,126,0.1)', border: '1px solid rgba(224,196,126,0.3)', fontSize: 13, color: '#e0c47e' }}>
          <Icon name="info" size={14}/> {isAr ? 'يرجى اختيار فعالية أولاً لعرض الضيوف.' : 'Select an active event to view and manage guests.'}
        </div>
      )}

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search" style={{ flex: 1, maxWidth: 320 }}>
          <Icon name="search" size={14}/>
          <input placeholder={isAr ? 'بحث عن ضيف…' : 'Search guests…'} value={query} onChange={e => setQuery(e.target.value)}/>
        </div>
        <div style={{ minWidth: 150 }}>
          <Select
            value={tierFilter}
            onChange={v => setTierFilter(v || 'All')}
            options={tierFilterOpts}
            placeholder={isAr ? 'الفئة' : 'Tier'}
          />
        </div>
        <div style={{ minWidth: 165 }}>
          <Select
            value={statusFilter}
            onChange={v => setStatusFilter(v || 'All')}
            options={statusFilterOpts}
            placeholder={isAr ? 'الحالة' : 'Status'}
          />
        </div>
        <span style={{ fontSize: 12, color: 'var(--ink-mute)', whiteSpace: 'nowrap' }}>
          {fmtN(filtered.length)} {isAr ? 'من' : 'of'} {fmtN(guests.length)}
        </span>
        {selCount > 0 && <span style={{ fontSize: 12, color: 'var(--accent)' }}>{fmtN(selCount)} {isAr ? 'محدد' : 'selected'}</span>}
      </div>

      {/* Guest table */}
      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={columns}
          data={filtered}
          loading={loading}
          emptyText={activeEventId ? (isAr ? 'لا يوجد ضيوف بعد' : 'No guests yet') : (isAr ? 'اختر فعالية أولاً' : 'Select an event first')}
          showSearch={false}
          pageSize={20}
          enableRowSelection
          onSelectionChange={setSelectedGuests}
          selectionResetKey={selResetKey}
          getRowId={g => g.id}
        />
      </div>

      {/* ── ADD GUEST MODAL ───────────────────────────────────────────────── */}
      {showNewGuest && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
          onClick={e => { if (e.target === e.currentTarget) closeNewGuest(); }}>
          <div className="card glass" style={{ width: 560, maxWidth: '94vw', height: 680, maxHeight: '92vh', padding: 0, display: 'flex', flexDirection: 'column' }}>

            {/* Header + step indicators */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{isAr ? 'ضيف جديد' : 'Add New Guest'}</h3>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {stepLabels.map((label, i) => {
                    const s = i + 1;
                    const done = newStep > s, active = newStep === s;
                    return (
                      <React.Fragment key={i}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
                            background: done ? 'var(--accent-deep)' : active ? 'var(--accent)' : 'var(--surface-soft-4)',
                            color: done || active ? '#fff' : 'var(--ink-mute)' }}>
                            {done ? <Icon name="check" size={11}/> : s}
                          </div>
                          <span style={{ fontSize: 11.5, whiteSpace: 'nowrap', color: active ? 'var(--accent)' : done ? 'var(--ink-dim)' : 'var(--ink-mute)', fontWeight: active ? 600 : 400 }}>{label}</span>
                        </div>
                        {i < stepLabels.length - 1 && <div style={{ width: 18, height: 1, background: done ? 'var(--accent-deep)' : 'var(--glass-border)', margin: '0 5px', flexShrink: 0 }}/>}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
              <button className="icon-btn" style={{ marginTop: 2, flexShrink: 0 }} onClick={closeNewGuest}><Icon name="close" size={14}/></button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* STEP 1 — Personal Info */}
              {newStep === 1 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                      { label: isAr ? 'الاسم الأول' : 'First Name', key: 'firstName', ph: isAr ? 'مثال: خالد' : 'e.g. Khalid' },
                      { label: isAr ? 'الاسم الأخير' : 'Last Name',  key: 'lastName',  ph: isAr ? 'مثال: المنصوري' : 'e.g. Al-Mansouri' },
                    ].map(f => (
                      <div key={f.key}>
                        {fieldLabel(`${f.label} *`)}
                        <input
                          placeholder={f.ph}
                          value={ng[f.key]}
                          onChange={e => { setNg(f.key, e.target.value); setStep1Errors(p => ({ ...p, [f.key]: false })); }}
                          style={step1Errors[f.key] ? errorBorder : inputStyle}
                        />
                        {step1Errors[f.key] && <div style={errMsg}>{isAr ? 'مطلوب' : 'Required'}</div>}
                      </div>
                    ))}
                  </div>
                  <div>
                    {fieldLabel(isAr ? 'البريد الإلكتروني' : 'Email')}
                    <input type="email" placeholder="name@organization.com" value={ng.email} onChange={e => setNg('email', e.target.value)} style={inputStyle}/>
                  </div>
                  <div>
                    {fieldLabel(isAr ? 'نوع الضيف' : 'Guest Type')}
                    <Select
                      value={ng.guestType}
                      onChange={v => setNg('guestType', v)}
                      options={guestTypeOpts}
                    />
                  </div>
                  <div>
                    {fieldLabel(isAr ? 'المؤسسة' : 'Organization')}
                    <input placeholder={isAr ? 'مثال: وزارة الخارجية' : 'e.g. Ministry of Foreign Affairs'} value={ng.organization} onChange={e => setNg('organization', e.target.value)} style={inputStyle}/>
                  </div>
                  <div>
                    {fieldLabel(isAr ? 'الجنسية' : 'Nationality')}
                    <Select
                      value={ng.nationalityId}
                      onChange={v => setNg('nationalityId', v)}
                      options={nationalityOpts}
                      placeholder={isAr ? '— اختر —' : '— Select —'}
                      isClearable
                    />
                  </div>
                </>
              )}

              {/* STEP 2 — Tier & Status */}
              {newStep === 2 && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>{isAr ? 'الفئة' : 'Tier'}</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      {TIERS.map(tier => (
                        <div key={tier} onClick={() => setNg('tier', tier)}
                          style={{ padding: '12px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                            border: `1px solid ${ng.tier === tier ? 'var(--accent)' : 'var(--glass-border)'}`,
                            background: ng.tier === tier ? 'rgba(26,174,196,0.12)' : 'var(--surface-soft-2)',
                            fontSize: 13, fontWeight: ng.tier === tier ? 600 : 400 }}>
                          {tier}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>{isAr ? 'حالة الدعوة' : 'Invitation Status'}</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { val: 'not_sent', color: 'var(--ink-mute)' },
                        { val: 'sent',     color: 'var(--accent)' },
                        { val: 'accepted', color: '#4caf50' },
                      ].map(({ val, color }) => (
                        <div key={val} onClick={() => setNg('invitationStatus', val)}
                          style={{ padding: '11px 14px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                            border: `1px solid ${ng.invitationStatus === val ? 'var(--accent)' : 'var(--glass-border)'}`,
                            background: ng.invitationStatus === val ? 'rgba(26,174,196,0.12)' : 'var(--surface-soft-2)' }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }}/>
                          <span style={{ fontSize: 13, textTransform: 'capitalize', fontWeight: ng.invitationStatus === val ? 600 : 400 }}>{val.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* STEP 3 — Travel & Stay */}
              {newStep === 3 && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      {fieldLabel(isAr ? 'تاريخ الوصول' : 'Arrival Date')}
                      <DateField
                        value={ng.arrivalDate}
                        onChange={v => setNg('arrivalDate', v)}
                        placeholder={isAr ? 'YYYY-MM-DD' : 'YYYY-MM-DD'}
                      />
                    </div>
                    <div>
                      {fieldLabel(isAr ? 'رقم الرحلة' : 'Flight No.')}
                      <input placeholder="QR 512" value={ng.flightNumber} onChange={e => setNg('flightNumber', e.target.value)} style={inputStyle}/>
                    </div>
                  </div>
                  <div>
                    {fieldLabel(isAr ? 'الفندق' : 'Hotel')}
                    <input placeholder={isAr ? 'مثال: شيراتون الدوحة' : 'e.g. Sheraton Grand Doha'} value={ng.hotel} onChange={e => setNg('hotel', e.target.value)} style={inputStyle}/>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>{isAr ? 'الاعتماد' : 'Accreditation'}</label>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {['not_issued','issued'].map(s => (
                        <div key={s} onClick={() => setNg('accreditationStatus', s)}
                          style={{ flex: 1, padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                            border: `1px solid ${ng.accreditationStatus === s ? 'var(--accent)' : 'var(--glass-border)'}`,
                            background: ng.accreditationStatus === s ? 'rgba(26,174,196,0.12)' : 'var(--surface-soft-2)',
                            fontSize: 13, textTransform: 'capitalize', fontWeight: ng.accreditationStatus === s ? 600 : 400 }}>
                          {s.replace('_', ' ')}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* STEP 4 — Invitation & Sessions */}
              {newStep === 4 && (
                <>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <label style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                        {isAr ? 'قالب الدعوة (اختياري)' : 'Invitation Template (optional)'}
                      </label>
                      <span style={{ fontSize: 11, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                        {isAr ? 'أنشئ القوالب من وحدة الدعوة' : 'Manage templates in Invitation lifecycle'}
                      </span>
                    </div>
                    {!ng.email && (
                      <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(224,196,126,0.1)', border: '1px solid rgba(224,196,126,0.3)', fontSize: 12, color: '#e0c47e' }}>
                        {isAr ? 'لا يوجد بريد إلكتروني — لن يتم إرسال الدعوة' : "No email entered — invitation won't be sent"}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                      <div onClick={() => setNewGuestTemplateId(null)}
                        style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                          border: `1px solid ${!newGuestTemplateId ? 'var(--accent)' : 'var(--glass-border)'}`,
                          background: !newGuestTemplateId ? 'rgba(26,174,196,0.1)' : 'var(--surface-soft-2)' }}>
                        <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${!newGuestTemplateId ? 'var(--accent)' : 'var(--glass-border)'}`, background: !newGuestTemplateId ? 'var(--accent)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          {!newGuestTemplateId && <Icon name="check" size={10} style={{ color: '#fff' }}/>}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: !newGuestTemplateId ? 600 : 400 }}>{isAr ? 'بدون دعوة' : 'No invitation'}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{isAr ? 'إضافة الضيف فقط' : 'Add guest only, no email sent'}</div>
                        </div>
                      </div>
                      {templates.map(tmpl => (
                        <div key={tmpl.id} onClick={() => setNewGuestTemplateId(tmpl.id)}
                          style={{ padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                            border: `1px solid ${newGuestTemplateId === tmpl.id ? (tmpl.color || 'var(--accent)') : 'var(--glass-border)'}`,
                            background: newGuestTemplateId === tmpl.id ? (tmpl.color || 'var(--accent)') + '18' : 'var(--surface-soft-2)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: '50%', background: tmpl.color || 'var(--accent)', flexShrink: 0 }}/>
                            <span style={{ fontSize: 13, fontWeight: newGuestTemplateId === tmpl.id ? 600 : 400 }}>{isAr ? (tmpl.nameAr || tmpl.name) : tmpl.name}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>{tmpl.language}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginLeft: 18, marginTop: 3, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {isAr ? (tmpl.subjectAr || tmpl.subject) : tmpl.subject}
                          </div>
                        </div>
                      ))}
                      {templates.length === 0 && (
                        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--surface-soft-2)', border: '1px dashed var(--glass-border)', fontSize: 12, color: 'var(--ink-mute)', textAlign: 'center' }}>
                          {isAr ? 'لا توجد قوالب — أنشئها من وحدة "دورة حياة الدعوة"' : 'No templates — create them in the Invitation lifecycle module'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <label style={{ fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                        {isAr ? 'الجلسات (اختياري)' : 'Sessions (optional)'}
                      </label>
                      {sessions.length > 0 && (
                        <button onClick={() => setNewGuestSessions(prev => prev.size === sessions.length ? new Set() : new Set(sessions.map(s => s.id)))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--accent)', padding: 0 }}>
                          {newGuestSessions.size === sessions.length ? (isAr ? 'إلغاء الكل' : 'Deselect all') : (isAr ? 'تحديد الكل' : 'Select all')}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {sessions.map(s => {
                        const checked = newGuestSessions.has(s.id);
                        return (
                          <div key={s.id} onClick={() => setNewGuestSessions(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; })}
                            style={{ padding: '8px 12px', borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 10,
                              border: `1px solid ${checked ? 'var(--accent)' : 'var(--glass-border)'}`,
                              background: checked ? 'rgba(26,174,196,0.08)' : 'var(--surface-soft-2)' }}>
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
              <button className="btn" onClick={() => newStep > 1 ? setNewStep(newStep - 1) : closeNewGuest()}>
                {newStep > 1 ? <><Icon name="arrowLeft" size={13}/> {isAr ? 'السابق' : 'Back'}</> : (isAr ? 'إلغاء' : 'Cancel')}
              </button>
              {newStep < 4 ? (
                <button className="btn primary" onClick={handleNextStep}>
                  {isAr ? 'التالي' : 'Next'} <Icon name="arrow" size={13}/>
                </button>
              ) : (
                <button className="btn primary" onClick={saveNewGuest} disabled={!ng.firstName || !ng.lastName || saving}>
                  <Icon name="check" size={13}/>
                  {saving ? (isAr ? 'جارٍ الحفظ…' : 'Saving…') : newGuestTemplateId ? (isAr ? 'إضافة وإرسال دعوة' : 'Add & Send Invite') : (isAr ? 'إضافة الضيف' : 'Add Guest')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MESSAGE MODAL */}
      {showMessageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card glass" style={{ width: 480, maxWidth: '90vw', padding: 0 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>{isAr ? 'إرسال رسالة' : 'Send Message'}</h3>
                <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 4 }}>{isAr ? `إلى ${fmtN(selCount)} ضيف` : `To ${fmtN(selCount)} guest${selCount > 1 ? 's' : ''}`}</div>
              </div>
              <button className="icon-btn" onClick={() => setShowMessageModal(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <textarea rows={5} placeholder={isAr ? 'اكتب رسالتك هنا…' : 'Type your message here…'} value={messageBody} onChange={e => setMessageBody(e.target.value)}
                style={{ width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '8px 12px', color: 'var(--ink)', fontSize: 13, resize: 'vertical' }}/>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowMessageModal(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button className="btn primary" onClick={handleSendMessage} disabled={!messageBody.trim() || messageSent}>
                <Icon name="message" size={13}/> {messageSent ? (isAr ? 'جارٍ الإرسال…' : 'Sending…') : (isAr ? 'إرسال' : 'Send')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCREDITATION CONFIRM */}
      {showAccredConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card glass" style={{ width: 400, maxWidth: '90vw', padding: 0 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{isAr ? 'إصدار الاعتماد' : 'Issue Accreditation'}</h3>
              <button className="icon-btn" onClick={() => setShowAccredConfirm(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <p style={{ color: 'var(--ink-dim)', marginBottom: 0 }}>
                {isAr ? `سيتم إصدار الاعتماد لـ ${fmtN(selCount)} ضيف.` : `Issue accreditation for ${fmtN(selCount)} selected guest${selCount > 1 ? 's' : ''}. Proceed?`}
              </p>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => setShowAccredConfirm(false)}>{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button className="btn primary" onClick={handleIssueAccred}><Icon name="badge" size={13}/> {isAr ? 'إصدار' : 'Issue'}</button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card glass" style={{ width: 460, maxWidth: '90vw', padding: 0 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{isAr ? 'استيراد CSV' : 'Import CSV'}</h3>
              <button className="icon-btn" onClick={() => setShowImportModal(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: '20px 22px' }}>
              <div onDragOver={e => { e.preventDefault(); setImportDragging(true); }} onDragLeave={() => setImportDragging(false)} onDrop={handleFileDrop} onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${importDragging ? 'var(--accent)' : 'var(--glass-border)'}`, borderRadius: 12, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: importDragging ? 'rgba(26,174,196,0.08)' : 'var(--surface-soft-2)' }}>
                <Icon name="upload" size={24} style={{ color: 'var(--accent)', display: 'block', margin: '0 auto 10px' }}/>
                {importFile ? (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{importFile.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--accent)' }}>{isAr ? 'جاهز للاستيراد' : 'Ready to import'}</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{isAr ? 'اسحب ملف CSV هنا' : 'Drag & drop a CSV file'}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{isAr ? 'أو انقر للاختيار' : 'or click to browse'}</div>
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileDrop}/>
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn" onClick={() => { setShowImportModal(false); setImportFile(null); }}>{isAr ? 'إلغاء' : 'Cancel'}</button>
              <button className="btn primary" disabled={!importFile} onClick={handleImport}><Icon name="upload" size={13}/> {isAr ? 'استيراد' : 'Import'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
