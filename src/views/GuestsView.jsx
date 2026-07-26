import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getTranslations, fmtNum } from '../i18n/translations';
import { Avatar, StatusChip, TierChip } from '../components/UI';
import { Icon } from '../components/Icons';
import DataTable from '../components/ui/DataTable';
import Select from '../components/ui/Select';
import toast from '../lib/toast';
import { listGuests } from '../api/services/guestService';
import { getNationalities } from '../api/services/nationalityService';
import { getTemplates } from '../api/services/invitationTemplateService';
import { listSessions, getEvent } from '../api/services/eventService';
import { getGuestEnums } from '../api/services/lookupService';

import GuestModal         from './guests/modals/GuestModal';
import MessageModal       from './guests/modals/MessageModal';
import AccreditationModal from './guests/modals/AccreditationModal';
import DeleteGuestsModal  from './guests/modals/DeleteGuestsModal';
import ImportModal        from './guests/modals/ImportModal';

const TIERS = ['vvip','vip','Speaker','Delegate','press','Observer'];

export default function GuestsView({ onOpenGuest, lang, activeEventId }) {
  const t    = getTranslations(lang);
  const isAr = lang === 'ar';
  const fmtN = (n) => fmtNum(n, lang);

  // ── data ──────────────────────────────────────────────────────────────────
  const [guests,        setGuests]        = useState([]);
  const [nationalities, setNationalities] = useState([]);
  const [templates,     setTemplates]     = useState([]);
  const [sessions,      setSessions]      = useState([]);
  const [activeEvent,   setActiveEvent]   = useState(null);
  const [guestEnums,    setGuestEnums]    = useState({});
  const [loading,       setLoading]       = useState(false);

  // ── filter / selection ────────────────────────────────────────────────────
  const [query,          setQuery]          = useState('');
  const [tierFilter,     setTierFilter]     = useState('All');
  const [statusFilter,   setStatusFilter]   = useState('All');
  const [selectedGuests, setSelectedGuests] = useState([]);
  const [selResetKey,    setSelResetKey]    = useState(0);

  // ── modal open states ─────────────────────────────────────────────────────
  const [showAddGuest,    setShowAddGuest]    = useState(false);
  const [editGuest,       setEditGuest]       = useState(null);
  const [showMessage,     setShowMessage]     = useState(false);
  const [showAccred,      setShowAccred]      = useState(false);
  const [showDeleteGuests,setShowDeleteGuests]= useState(false);
  const [showImport,      setShowImport]      = useState(false);

  const selCount = selectedGuests.length;
  const clearSelection = () => setSelResetKey(k => k + 1);

  // ── load reference data ───────────────────────────────────────────────────
  useEffect(() => {
    getNationalities().then(r => setNationalities(r || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeEventId) { setTemplates([]); setSessions([]); setActiveEvent(null); return; }
    getTemplates(activeEventId).then(r => setTemplates(r || [])).catch(() => {});
    listSessions(activeEventId).then(r => setSessions(r || [])).catch(() => {});
    getEvent(activeEventId).then(setActiveEvent).catch(() => setActiveEvent(null));
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

  // ── client-side filters ───────────────────────────────────────────────────
  const filtered = useMemo(() => guests.filter(g => {
    if (tierFilter !== 'All' && g.tier !== tierFilter) return false;
    if (statusFilter !== 'All' && g.invitationStatus !== statusFilter) return false;
    return true;
  }), [guests, tierFilter, statusFilter]);

  // ── select options ────────────────────────────────────────────────────────
  const tierFilterOpts = useMemo(() => [
    { value: 'All', label: isAr ? 'كل الفئات' : 'All Tiers' },
    ...TIERS.map(t => ({ value: t, label: t })),
  ], [isAr]);

  const statusFilterOpts = useMemo(() => [
    { value: 'All',      label: isAr ? 'كل الحالات' : 'All Statuses' },
    { value: 'not_sent', label: isAr ? 'لم يُرسل'   : 'Not Sent' },
    { value: 'sent',     label: isAr ? 'مُرسل'      : 'Sent' },
    { value: 'opened',   label: isAr ? 'مفتوح'      : 'Opened' },
    { value: 'accepted', label: isAr ? 'مقبول'      : 'Accepted' },
    { value: 'declined', label: isAr ? 'مرفوض'      : 'Declined' },
  ], [isAr]);

  // ── table columns ─────────────────────────────────────────────────────────
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
      cell: ({ row: { original: g } }) => <span style={{ fontSize: 12 }}>{g.nationalityFlag} {g.nationalityName}</span>,
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
      cell: ({ getValue }) => <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{getValue() || '—'}</span>,
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
    {
      id: 'edit',
      size: 40,
      enableSorting: false,
      cell: ({ row: { original: g } }) => (
        <button className="btn" onClick={e => { e.stopPropagation(); setEditGuest(g); }}>
          <Icon name="edit" size={14}/>
        </button>
      ),
    },
    {
      id: 'delete',
      size: 40,
      enableSorting: false,
      cell: ({ row: { original: g } }) => (
        <button className="btn" style={{ color: '#e05050', borderColor: 'rgba(224,80,80,0.4)' }}
          onClick={e => { e.stopPropagation(); setSelectedGuests([g]); setShowDeleteGuests(true); }}>
          <Icon name="trash" size={12}/>
        </button>
      ),
    },
  ], [isAr, lang, onOpenGuest]);

  // ── bulk action callbacks ─────────────────────────────────────────────────
  function handleExport() {
    const cols = ['Name','Email','Nationality','Tier','Invitation Status','Hotel','Accreditation'];
    const rows = filtered.map(g =>
      [g.fullName, g.email, g.nationalityName, g.tier, g.invitationStatus, g.hotel, g.accreditationStatus]
        .map(v => `"${v || ''}"`).join(',')
    );
    const csv = [cols.join(','), ...rows].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'guests.csv';
    a.click();
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.guests?.title?.[0] || 'Guest'} <em>{t.guests?.title?.[1] || 'Management'}</em></h1>
          <div className="page-sub">{fmtN(filtered.length)} guest{filtered.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="page-actions">
          {selCount > 0 && (
            <>
              <button className="btn primary" onClick={() => setShowMessage(true)}>
                <Icon name="message" size={14}/> {t.common?.message || 'Message'} ({fmtN(selCount)})
              </button>
              <button className="btn" onClick={() => setShowAccred(true)}>
                <Icon name="badge" size={14}/> {t.common?.issueAccreditation || 'Issue Accreditation'}
              </button>
              <button className="btn" style={{ color: '#e05050', borderColor: 'rgba(224,80,80,0.4)' }} onClick={() => setShowDeleteGuests(true)}>
                <Icon name="trash" size={14}/> {isAr ? `حذف (${fmtN(selCount)})` : `Delete (${fmtN(selCount)})`}
              </button>
            </>
          )}
          <button className="btn" onClick={() => setShowImport(true)}>
            <Icon name="upload" size={14}/> {isAr ? 'استيراد' : 'Import'}
          </button>
          <button className="btn" onClick={handleExport}>
            <Icon name="download" size={14}/> {isAr ? 'تصدير' : 'Export'}
          </button>
          <button className="btn primary" onClick={() => setShowAddGuest(true)} disabled={!activeEventId}>
            <Icon name="plus" size={14}/> {isAr ? 'ضيف جديد' : 'Add Guest'}
          </button>
        </div>
      </div>

      {/* No event warning */}
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
          <Select value={tierFilter} onChange={v => setTierFilter(v || 'All')} options={tierFilterOpts} placeholder={isAr ? 'الفئة' : 'Tier'}/>
        </div>
        <div style={{ minWidth: 165 }}>
          <Select value={statusFilter} onChange={v => setStatusFilter(v || 'All')} options={statusFilterOpts} placeholder={isAr ? 'الحالة' : 'Status'}/>
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

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <GuestModal
        open={showAddGuest}
        onClose={() => setShowAddGuest(false)}
        guest={null}
        activeEventId={activeEventId}
        eventStartDate={activeEvent?.startDate}
        eventEndDate={activeEvent?.endDate}
        nationalities={nationalities}
        templates={templates}
        sessions={sessions}
        lang={lang}
        onSaved={loadGuests}
      />

      <GuestModal
        open={!!editGuest}
        onClose={() => setEditGuest(null)}
        guest={editGuest}
        activeEventId={activeEventId}
        eventStartDate={activeEvent?.startDate}
        eventEndDate={activeEvent?.endDate}
        nationalities={nationalities}
        templates={templates}
        sessions={sessions}
        lang={lang}
        onSaved={loadGuests}
      />

      <MessageModal
        open={showMessage}
        onClose={() => setShowMessage(false)}
        count={selCount}
        lang={lang}
        onSent={() => {
          clearSelection();
          toast.success(isAr ? `تم إرسال الرسالة إلى ${fmtN(selCount)} ضيف` : `Message sent to ${selCount} guest${selCount > 1 ? 's' : ''}`);
        }}
      />

      <AccreditationModal
        open={showAccred}
        onClose={() => setShowAccred(false)}
        count={selCount}
        lang={lang}
        onConfirm={() => {
          setShowAccred(false);
          clearSelection();
          toast.success(isAr ? 'تم إصدار الاعتماد' : 'Accreditation issued');
        }}
      />

      <DeleteGuestsModal
        open={showDeleteGuests}
        onClose={() => setShowDeleteGuests(false)}
        selectedGuests={selectedGuests}
        activeEventId={activeEventId}
        lang={lang}
        onDeleted={() => { clearSelection(); loadGuests(); }}
      />

      <ImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        activeEventId={activeEventId}
        lang={lang}
        onImported={loadGuests}
      />
    </div>
  );
}
