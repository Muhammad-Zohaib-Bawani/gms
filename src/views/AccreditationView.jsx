import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { toArDigits } from '../i18n/translations.js';
import { Avatar, ServiceLevelChip } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';
import FlagIcon from '../components/FlagIcon.jsx';
import ActionMenu from '../components/ui/ActionMenu';
import toast from '../lib/toast';
import { listGuests, issueAccreditation, revokeAccreditation } from '../api/services/guestService';
import { getGuestEnums } from '../api/services/lookupService';
import { getEvent } from '../api/services/eventService';
import AccreditationCardModal from './accreditation/AccreditationCardModal';

const TIER_COLOR = {
  vvip: '#e0b864', vip: '#a78bda', speaker: 'var(--accent)',
  delegate: '#5abf6e', press: 'var(--danger)', observer: 'var(--ink-mute)',
};

export default function AccreditationView({ lang, activeEventId }) {
  const isAr = lang === 'ar';
  const ad = s => isAr ? toArDigits(String(s)) : String(s);

  const STR = isAr ? {
    title: 'الاعتماد', sub: 'إصدار وإدارة بطاقات الاعتماد للضيوف الذين يتطلبون اعتمادًا',
    total: 'يتطلب اعتماد', issued: 'صدر الاعتماد', pending: 'قيد الانتظار',
    rate: 'نسبة الإصدار', searchPlaceholder: 'بحث عن ضيف أو جهة…',
    filterAll: 'الكل', filterIssued: 'صادر', filterPending: 'قيد الانتظار',
    tierAll: 'جميع الفئات', guest: 'الضيف', org: 'الجهة', serviceLevel: 'الفئة',
    arrival: 'تاريخ الوصول', status: 'الاعتماد', actions: 'إجراءات',
    issue: 'إصدار', revoke: 'سحب', viewCard: 'عرض البطاقة', issueSelected: 'إصدار المحدد',
    revokeSelected: 'سحب المحدد', selected: 'محدد',
    issueAll: 'إصدار الكل', clearSel: 'إلغاء التحديد',
    badgeIssued: 'صادر', badgePending: 'قيد الانتظار',
    noResults: 'لا يوجد ضيوف يتطلبون اعتمادًا', country: 'الدولة', role: 'الدور',
    previewTitle: 'معاينة بطاقة الاعتماد',
    close: 'إغلاق', printBadge: 'طباعة البطاقة',
    badgeNo: 'رقم الاعتماد',
    noEvent: 'يرجى اختيار فعالية أولاً لعرض الاعتماد.',
    notAccepted: 'يجب أن يقبل الضيف الدعوة أولاً قبل إصدار الاعتماد',
    notAcceptedToast: 'لا يمكن إصدار الاعتماد قبل قبول الضيف للدعوة',
    skippedNotAccepted: (n) => `تم تخطي ${ad(n)} ضيف لم يقبلوا الدعوة بعد`,
  } : {
    title: 'Accreditation', sub: 'Issue and manage accreditation badges for guests who require one',
    total: 'Require accreditation', issued: 'Badges issued', pending: 'Pending',
    rate: 'Issue rate', searchPlaceholder: 'Search guest or organisation…',
    filterAll: 'All', filterIssued: 'Issued', filterPending: 'Pending',
    serviceLevelAll: 'All service levels', guest: 'Guest', org: 'Organisation', serviceLevel: 'Service Level',
    arrival: 'Arrival', status: 'Accreditation', actions: 'Actions',
    issue: 'Issue', revoke: 'Revoke', viewCard: 'View card', issueSelected: 'Issue selected',
    revokeSelected: 'Revoke selected', selected: 'selected',
    issueAll: 'Issue all pending', clearSel: 'Clear selection',
    badgeIssued: 'Issued', badgePending: 'Pending',
    noResults: 'No guests require accreditation', country: 'Country', role: 'Role',
    previewTitle: 'Accreditation Badge Preview',
    close: 'Close', printBadge: 'Print badge',
    badgeNo: 'Badge No.',
    noEvent: 'Select an active event to view accreditation.',
    notAccepted: 'Guest must accept the invitation before accreditation can be issued',
    notAcceptedToast: 'Cannot issue accreditation until the guest has accepted their invitation',
    skippedNotAccepted: (n) => `Skipped ${n} guest${n !== 1 ? 's' : ''} who haven't accepted their invitation yet`,
  };

  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [enums, setEnums] = useState({});
  const [busyIds, setBusyIds] = useState(new Set());

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [sel, setSel] = useState(new Set());
  const [cardGuest, setCardGuest] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'cards'
  const [activeEvent, setActiveEvent] = useState(null);

  useEffect(() => { getGuestEnums().then(setEnums).catch(() => {}); }, []);

  useEffect(() => {
    if (!activeEventId) { setActiveEvent(null); return; }
    getEvent(activeEventId).then(setActiveEvent).catch(() => setActiveEvent(null));
  }, [activeEventId]);

  const loadGuests = useCallback(async () => {
    if (!activeEventId) { setGuests([]); return; }
    setLoading(true);
    try {
      const r = await listGuests({ eventId: activeEventId, pageSize: 500 });
      setGuests((r?.items || []).filter(g => g.accreditationRequired));
    } catch {
      // keep previous list
    } finally {
      setLoading(false);
    }
  }, [activeEventId]);

  useEffect(() => { loadGuests(); }, [loadGuests]);

  const tierOpts = enums?.GuestTier || [];

  const filtered = useMemo(() => guests.filter(g => {
    const isIssued = g.accreditationStatus === 'issued';
    const matchSearch = !search
      || g.fullName?.toLowerCase().includes(search.toLowerCase())
      || g.organization?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || (statusFilter === 'issued' ? isIssued : !isIssued);
    const matchTier = tierFilter === 'all' || g.tier === tierFilter;
    return matchSearch && matchStatus && matchTier;
  }), [guests, search, statusFilter, tierFilter]);

  const totalIssued = guests.filter(g => g.accreditationStatus === 'issued').length;
  const totalPending = guests.length - totalIssued;
  const issueRate = guests.length ? Math.round((totalIssued / guests.length) * 100) : 0;

  function withBusy(id, fn) {
    setBusyIds(prev => new Set(prev).add(id));
    return fn().finally(() => setBusyIds(prev => { const n = new Set(prev); n.delete(id); return n; }));
  }

  function setLocalStatus(id, status) {
    setGuests(prev => prev.map(g => g.id === id ? { ...g, accreditationStatus: status } : g));
  }

  // Accreditation can't be issued until the guest has actually accepted their
  // invitation — issuing it earlier would badge someone who never confirmed
  // they're attending.
  const canIssue = g => g.invitationStatus === 'accepted';

  async function issue(id) {
    const g = guests.find(x => x.id === id);
    if (g && !canIssue(g)) {
      toast.error(STR.notAcceptedToast);
      return;
    }
    return withBusy(id, () => issueAccreditation(id))
      .then(() => { setLocalStatus(id, 'issued'); toast.success(isAr ? 'تم إصدار الاعتماد' : 'Accreditation issued'); })
      .catch(err => toast.fromError(err, isAr ? 'تعذر إصدار الاعتماد' : 'Failed to issue accreditation'));
  }

  async function revoke(id) {
    return withBusy(id, () => revokeAccreditation(id))
      .then(() => { setLocalStatus(id, 'not_issued'); toast.success(isAr ? 'تم سحب الاعتماد' : 'Accreditation revoked'); })
      .catch(err => toast.fromError(err, isAr ? 'تعذر سحب الاعتماد' : 'Failed to revoke accreditation'));
  }

  async function bulkSet(action) {
    const ids = Array.from(sel);
    setSel(new Set());
    if (action !== 'issue') {
      await Promise.all(ids.map(id => revoke(id)));
      return;
    }
    const idSet = new Set(ids);
    const targeted = guests.filter(g => idSet.has(g.id));
    const eligible = targeted.filter(canIssue);
    const skipped = targeted.length - eligible.length;
    await Promise.all(eligible.map(g => issue(g.id)));
    if (skipped > 0) toast.error(STR.skippedNotAccepted(skipped));
  }

  async function issueAllPending() {
    const pending = filtered.filter(g => g.accreditationStatus !== 'issued');
    const eligible = pending.filter(canIssue);
    const skipped = pending.length - eligible.length;
    await Promise.all(eligible.map(g => issue(g.id)));
    if (skipped > 0) toast.error(STR.skippedNotAccepted(skipped));
  }

  function toggleSel(id) {
    setSel(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleAll() {
    if (sel.size === filtered.length) { setSel(new Set()); }
    else { setSel(new Set(filtered.map(g => g.id))); }
  }

  const allSelected = filtered.length > 0 && sel.size === filtered.length;
  const someSelected = sel.size > 0;

  const kpis = [
    { label: STR.total,   value: ad(guests.length),  icon: 'guests',  color: 'var(--ink)' },
    { label: STR.issued,  value: ad(totalIssued),    icon: 'badge',   color: 'var(--ok)' },
    { label: STR.pending, value: ad(totalPending),   icon: 'clock',   color: '#e0b864' },
    { label: STR.rate,    value: `${ad(issueRate)}%`, icon: 'reports', color: '#5abf6e' },
  ];

  // Issued reads as green everywhere (chips, dots) — matches the same
  // success tokens used for "Accepted"/"Confirmed" elsewhere in the app.
  const chipStyle = issued => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: issued ? 'var(--ok-bg)' : 'rgba(224,184,100,0.15)',
    color: issued ? 'var(--ok)' : '#e0b864',
    border: `1px solid ${issued ? 'var(--ok-border)' : 'rgba(224,184,100,0.3)'}`,
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title}</h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={issueAllPending} disabled={totalPending === 0}>
            <Icon name="badge" size={14}/> {STR.issueAll}
          </button>
        </div>
      </div>

      {!activeEventId ? (
        <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 10, background: 'rgba(224,196,126,0.1)', border: '1px solid rgba(224,196,126,0.3)', fontSize: 13, color: '#e0c47e' }}>
          <Icon name="info" size={14}/> {STR.noEvent}
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
            {kpis.map(k => (
              <div key={k.label} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--surface-soft-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={k.icon} size={18} style={{ color: k.color }}/>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 2 }}>{k.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="card" style={{ padding: '12px 18px', marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{isAr ? 'تقدم الإصدار' : 'Issue progress'}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
                {ad(totalIssued)} / {ad(guests.length)} — {ad(issueRate)}%
              </span>
            </div>
            <div style={{ height: 7, borderRadius: 10, background: 'var(--surface-soft-3)', overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 10, width: `${issueRate}%`, background: 'linear-gradient(90deg, var(--accent), #5abf6e)', transition: 'width 0.4s ease' }}/>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 14 }}>
            <button className={`tab${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')}>
              <Icon name="guests" size={13}/> {isAr ? 'قائمة' : 'List'}
            </button>
            <button className={`tab${viewMode === 'cards' ? ' active' : ''}`} onClick={() => setViewMode('cards')}>
              <Icon name="badge" size={13}/> {isAr ? 'بطاقات' : 'Cards'}
            </button>
          </div>

          {/* Filters */}
          <div className="filter-bar" style={{ marginBottom: 12 }}>
            <div style={{ flex: 1, position: 'relative', minWidth: 200 }}>
              <Icon name="search" size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-mute)', pointerEvents: 'none' }}/>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={STR.searchPlaceholder}
                style={{ width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)', borderRadius: 10, padding: '8px 12px 8px 34px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}/>
            </div>
            <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">{STR.filterAll}</option>
              <option value="issued">{STR.filterIssued}</option>
              <option value="pending">{STR.filterPending}</option>
            </select>
            <select className="select" value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
              <option value="all">{STR.tierAll}</option>
              {tierOpts.map(t => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </div>

          {/* Bulk action bar */}
          {someSelected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'rgba(141, 1, 52,0.1)', border: '1px solid rgba(141, 1, 52,0.25)', marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>
                {ad(sel.size)} {STR.selected}
              </span>
              <div style={{ flex: 1 }}/>
              <button className="btn primary" style={{ fontSize: 12 }} onClick={() => bulkSet('issue')}>
                <Icon name="badge" size={13}/> {STR.issueSelected}
              </button>
              <button className="btn" style={{ fontSize: 12, color: 'var(--danger)', borderColor: 'var(--danger-border)' }} onClick={() => bulkSet('revoke')}>
                <Icon name="x" size={13}/> {STR.revokeSelected}
              </button>
              <button className="btn" style={{ fontSize: 12 }} onClick={() => setSel(new Set())}>
                {STR.clearSel}
              </button>
            </div>
          )}

          {/* List view */}
          {viewMode === 'list' && (
            <div className="card" style={{ padding: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 36, paddingRight: 0 }}>
                      <input type="checkbox" checked={allSelected} onChange={toggleAll}
                        style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}/>
                    </th>
                    <th>{STR.guest}</th>
                    <th>{STR.org}</th>
                    <th>{STR.serviceLevel}</th>
                    {/* <th>{STR.arrival}</th> */}
                    <th>{STR.status}</th>
                    <th>{STR.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: '32px', fontSize: 13 }}>…</td></tr>
                  )}
                  {!loading && filtered.map(g => {
                    const isIssued = g.accreditationStatus === 'issued';
                    const isChecked = sel.has(g.id);
                    const busy = busyIds.has(g.id);
                    const initials = ((g.firstName?.[0] || '') + (g.lastName?.[0] || '')).toUpperCase();
                    return (
                      <tr key={g.id} style={{ background: isChecked ? 'rgba(141, 1, 52,0.05)' : undefined }}>
                        <td style={{ paddingRight: 0 }}>
                          <input type="checkbox" checked={isChecked} onChange={() => toggleSel(g.id)}
                            style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}/>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                            <Avatar initials={initials} size={30} tier={g.tier} src={g.photoUrl}/>
                            <div>
                              <button onClick={() => setCardGuest(g)}
                                style={{ fontSize: 13, fontWeight: 500, background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer', padding: 0, textAlign: isAr ? 'right' : 'left' }}>
                                {g.fullName}
                              </button>
                              <div style={{ fontSize: 11, color: 'var(--ink-mute)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                {g.guestType} · <FlagIcon code={g.nationalityCode} size={12} /> {g.nationalityName}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--ink-mute)', maxWidth: 160 }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.organization}</div>
                        </td>
                        <td><ServiceLevelChip name={g.serviceLevelName} nameAr={g.serviceLevelNameAr} color={g.serviceLevelColor} lang={lang}/></td>
                        {/* <td style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>{g.arrivalDate || '—'}</td> */}
                        <td>
                          <span style={chipStyle(isIssued)}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: isIssued ? 'var(--ok)' : '#e0b864', flexShrink: 0 }}/>
                            {isIssued ? STR.badgeIssued : STR.badgePending}
                          </span>
                        </td>
                        <td>
                          <ActionMenu items={[
                            isIssued && { label: STR.viewCard, icon: 'badge', onClick: () => setCardGuest(g) },
                            isIssued
                              ? { label: STR.revoke, icon: 'x', danger: true, disabled: busy, onClick: () => revoke(g.id) }
                              : { label: STR.issue, icon: 'badge', disabled: busy || !canIssue(g), onClick: () => issue(g.id) },
                          ]}/>
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--ink-faint)', padding: '32px', fontSize: 13 }}>
                        {STR.noResults}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Cards view */}
          {viewMode === 'cards' && (
            filtered.length === 0 ? (
              <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--ink-faint)', fontSize: 13 }}>
                {STR.noResults}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
                {filtered.map(g => {
                  const isIssued = g.accreditationStatus === 'issued';
                  const busy = busyIds.has(g.id);
                  const tierCol = TIER_COLOR[g.tier] || 'var(--ink-mute)';
                  const initials = ((g.firstName?.[0] || '') + (g.lastName?.[0] || '')).toUpperCase();
                  return (
                    <div key={g.id} className="card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                      onClick={() => setCardGuest(g)}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                      <div style={{ height: 5, background: tierCol }}/>
                      <div style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <Avatar initials={initials} size={38} tier={g.tier} src={g.photoUrl}/>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.fullName}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.guestType}</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.organization}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
                          <FlagIcon code={g.nationalityCode} size={12} /> {g.nationalityName} · {g.arrivalDate || '—'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <ServiceLevelChip name={g.serviceLevelName} nameAr={g.serviceLevelNameAr} color={g.serviceLevelColor} lang={lang}/>
                          <span style={chipStyle(isIssued)}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: isIssued ? 'var(--ok)' : '#e0b864' }}/>
                            {isIssued ? STR.badgeIssued : STR.badgePending}
                          </span>
                        </div>
                      </div>
                      <div style={{ padding: '6px 10px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end' }}
                        onClick={e => e.stopPropagation()}>
                        <ActionMenu items={[
                          isIssued && { label: STR.viewCard, icon: 'badge', onClick: () => setCardGuest(g) },
                          isIssued
                            ? { label: STR.revoke, icon: 'x', danger: true, disabled: busy, onClick: () => revoke(g.id) }
                            : { label: STR.issue, icon: 'badge', disabled: busy || !canIssue(g), onClick: () => issue(g.id) },
                        ]}/>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </>
      )}

      {/* Accreditation card — the click target for both a guest's name (list
          view) and their card (cards view), issued or not; the card itself
          shows an empty-QR "not issued yet" state when it isn't. */}
      <AccreditationCardModal
        open={!!cardGuest}
        guest={cardGuest}
        event={activeEvent}
        lang={lang}
        onClose={() => setCardGuest(null)}
        busy={cardGuest ? busyIds.has(cardGuest.id) : false}
        canIssue={cardGuest ? canIssue(cardGuest) : true}
        notAcceptedTitle={STR.notAccepted}
        onIssue={cardGuest ? () => issue(cardGuest.id) : undefined}
        onRevoke={cardGuest ? () => revoke(cardGuest.id) : undefined}
      />
    </div>
  );
}
