import React, { useState, useMemo } from 'react';
import { toArDigits } from '../i18n/translations.js';
import { Avatar } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';
import { GUESTS } from '../data/mockData.js';

const TIERS = ['VVIP', 'VIP', 'Speaker', 'Delegate', 'Press', 'Observer'];

const TIER_COLOR = {
  VVIP: '#e0b864', VIP: '#a78bda', Speaker: 'var(--accent)',
  Delegate: '#5abf6e', Press: '#e08a7e', Observer: 'var(--ink-mute)',
};

export default function AccreditationView({ lang }) {
  const isAr = lang === 'ar';
  const ad = s => isAr ? toArDigits(String(s)) : String(s);

  const STR = isAr ? {
    title: 'الاعتماد', sub: 'إصدار وإدارة بطاقات الاعتماد للضيوف',
    total: 'إجمالي الضيوف', issued: 'صدر الاعتماد', pending: 'قيد الانتظار',
    rate: 'نسبة الإصدار', searchPlaceholder: 'بحث عن ضيف أو جهة…',
    filterAll: 'الكل', filterIssued: 'صادر', filterPending: 'قيد الانتظار',
    tierAll: 'جميع الفئات', guest: 'الضيف', org: 'الجهة', tier: 'الفئة',
    arrival: 'تاريخ الوصول', status: 'الاعتماد', actions: 'إجراءات',
    issue: 'إصدار', revoke: 'سحب', issueSelected: 'إصدار المحدد',
    revokeSelected: 'سحب المحدد', selected: 'محدد',
    issueAll: 'إصدار الكل', clearSel: 'إلغاء التحديد',
    badgeIssued: 'صادر', badgePending: 'قيد الانتظار',
    noResults: 'لا توجد نتائج', country: 'الدولة', role: 'الدور',
    previewTitle: 'معاينة بطاقة الاعتماد',
    close: 'إغلاق', printBadge: 'طباعة البطاقة',
    badgeNo: 'رقم الاعتماد', forum: 'منتدى الدوحة 23',
  } : {
    title: 'Accreditation', sub: 'Issue and manage accreditation badges for guests',
    total: 'Total guests', issued: 'Badges issued', pending: 'Pending',
    rate: 'Issue rate', searchPlaceholder: 'Search guest or organisation…',
    filterAll: 'All', filterIssued: 'Issued', filterPending: 'Pending',
    tierAll: 'All tiers', guest: 'Guest', org: 'Organisation', tier: 'Tier',
    arrival: 'Arrival', status: 'Accreditation', actions: 'Actions',
    issue: 'Issue', revoke: 'Revoke', issueSelected: 'Issue selected',
    revokeSelected: 'Revoke selected', selected: 'selected',
    issueAll: 'Issue all pending', clearSel: 'Clear selection',
    badgeIssued: 'Issued', badgePending: 'Pending',
    noResults: 'No results', country: 'Country', role: 'Role',
    previewTitle: 'Accreditation Badge Preview',
    close: 'Close', printBadge: 'Print badge',
    badgeNo: 'Badge No.', forum: '23rd Doha Forum',
  };

  // Local accreditation state so user can issue/revoke
  const [accrMap, setAccrMap] = useState(() =>
    Object.fromEntries(GUESTS.map(g => [g.id, g.accreditation]))
  );

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [sel, setSel] = useState(new Set());
  const [previewGuest, setPreviewGuest] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'cards'

  const filtered = useMemo(() => GUESTS.filter(g => {
    const accr = accrMap[g.id];
    const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.org.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || accr === statusFilter;
    const matchTier = tierFilter === 'all' || g.tier === tierFilter;
    return matchSearch && matchStatus && matchTier;
  }), [search, statusFilter, tierFilter, accrMap]);

  const totalIssued = Object.values(accrMap).filter(v => v === 'issued').length;
  const totalPending = Object.values(accrMap).filter(v => v === 'pending').length;
  const issueRate = Math.round((totalIssued / GUESTS.length) * 100);

  function setAccr(id, val) {
    setAccrMap(prev => ({ ...prev, [id]: val }));
  }

  function bulkSet(val) {
    setAccrMap(prev => {
      const next = { ...prev };
      sel.forEach(id => { next[id] = val; });
      return next;
    });
    setSel(new Set());
  }

  function issueAllPending() {
    setAccrMap(prev => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, 'issued'])));
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
    { label: STR.total,   value: ad(GUESTS.length), icon: 'guests',  color: 'var(--ink)' },
    { label: STR.issued,  value: ad(totalIssued),   icon: 'badge',   color: 'var(--accent)' },
    { label: STR.pending, value: ad(totalPending),  icon: 'clock',   color: '#e0b864' },
    { label: STR.rate,    value: `${ad(issueRate)}%`, icon: 'chart', color: '#5abf6e' },
  ];

  const chipStyle = issued => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: issued ? 'rgba(26,174,196,0.15)' : 'rgba(224,184,100,0.15)',
    color: issued ? 'var(--accent)' : '#e0b864',
    border: `1px solid ${issued ? 'rgba(26,174,196,0.3)' : 'rgba(224,184,100,0.3)'}`,
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

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 18 }}>
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
            {ad(totalIssued)} / {ad(GUESTS.length)} — {ad(issueRate)}%
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
          {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 10, background: 'rgba(26,174,196,0.1)', border: '1px solid rgba(26,174,196,0.25)', marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>
            {ad(sel.size)} {STR.selected}
          </span>
          <div style={{ flex: 1 }}/>
          <button className="btn primary" style={{ fontSize: 12 }} onClick={() => bulkSet('issued')}>
            <Icon name="badge" size={13}/> {STR.issueSelected}
          </button>
          <button className="btn" style={{ fontSize: 12, color: '#e08a7e', borderColor: 'rgba(224,138,126,0.3)' }} onClick={() => bulkSet('pending')}>
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
                <th>{STR.tier}</th>
                <th>{STR.arrival}</th>
                <th>{STR.status}</th>
                <th>{STR.actions}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => {
                const accr = accrMap[g.id];
                const isIssued = accr === 'issued';
                const isChecked = sel.has(g.id);
                return (
                  <tr key={g.id} style={{ background: isChecked ? 'rgba(26,174,196,0.05)' : undefined }}>
                    <td style={{ paddingRight: 0 }}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleSel(g.id)}
                        style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}/>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Avatar initials={g.initials} size={30} tier={g.tier}/>
                        <div>
                          <button onClick={() => setPreviewGuest(g)}
                            style={{ fontSize: 13, fontWeight: 500, background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer', padding: 0, textAlign: isAr ? 'right' : 'left' }}>
                            {g.name}
                          </button>
                          <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{g.role} · {g.country}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--ink-mute)', maxWidth: 160 }}>
                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.org}</div>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, fontWeight: 600, color: TIER_COLOR[g.tier] || 'var(--ink-mute)' }}>
                        {g.tier}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink-mute)' }}>{g.arrival}</td>
                    <td>
                      <span style={chipStyle(isIssued)}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isIssued ? 'var(--accent)' : '#e0b864', flexShrink: 0 }}/>
                        {isIssued ? STR.badgeIssued : STR.badgePending}
                      </span>
                    </td>
                    <td>
                      {isIssued ? (
                        <button className="btn" style={{ fontSize: 11, color: '#e08a7e', borderColor: 'rgba(224,138,126,0.25)', padding: '4px 12px' }}
                          onClick={() => setAccr(g.id, 'pending')}>
                          <Icon name="x" size={12}/> {STR.revoke}
                        </button>
                      ) : (
                        <button className="btn primary" style={{ fontSize: 11, padding: '4px 12px' }}
                          onClick={() => setAccr(g.id, 'issued')}>
                          <Icon name="badge" size={12}/> {STR.issue}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
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
              const accr = accrMap[g.id];
              const isIssued = accr === 'issued';
              const tierCol = TIER_COLOR[g.tier] || 'var(--ink-mute)';
              return (
                <div key={g.id} className="card" style={{ padding: 0, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onClick={() => setPreviewGuest(g)}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.18)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}>
                  {/* Tier colour strip */}
                  <div style={{ height: 5, background: tierCol }}/>
                  {/* Card body */}
                  <div style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <Avatar initials={g.initials} size={38} tier={g.tier}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.role}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.org}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', marginBottom: 10 }}>{g.country} · {g.arrival}</div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: tierCol }}>{g.tier}</span>
                      <span style={chipStyle(isIssued)}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: isIssued ? 'var(--accent)' : '#e0b864' }}/>
                        {isIssued ? STR.badgeIssued : STR.badgePending}
                      </span>
                    </div>
                  </div>
                  {/* Footer action */}
                  <div style={{ padding: '8px 16px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'flex-end' }}
                    onClick={e => e.stopPropagation()}>
                    {isIssued ? (
                      <button className="btn" style={{ fontSize: 10.5, color: '#e08a7e', borderColor: 'rgba(224,138,126,0.25)', padding: '3px 10px' }}
                        onClick={() => setAccr(g.id, 'pending')}>
                        <Icon name="x" size={11}/> {STR.revoke}
                      </button>
                    ) : (
                      <button className="btn primary" style={{ fontSize: 10.5, padding: '3px 10px' }}
                        onClick={() => setAccr(g.id, 'issued')}>
                        <Icon name="badge" size={11}/> {STR.issue}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Badge preview modal */}
      {previewGuest && (() => {
        const accr = accrMap[previewGuest.id];
        const isIssued = accr === 'issued';
        const tierCol = TIER_COLOR[previewGuest.tier] || 'var(--ink-mute)';
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="card glass" style={{ width: 440, padding: 0, overflow: 'hidden' }}>
              {/* Modal header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{STR.previewTitle}</span>
                <button className="icon-btn" onClick={() => setPreviewGuest(null)}><Icon name="close" size={14}/></button>
              </div>

              {/* Badge card design */}
              <div style={{ padding: '24px 32px' }}>
                <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--glass-border)', background: 'var(--surface-soft-2)' }}>
                  {/* Badge top strip */}
                  <div style={{ height: 8, background: tierCol }}/>
                  {/* Badge body */}
                  <div style={{ padding: '20px 24px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
                      <Avatar initials={previewGuest.initials} size={56} tier={previewGuest.tier}/>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}>{previewGuest.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginBottom: 2 }}>{previewGuest.role}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{previewGuest.org}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: tierCol, background: `${tierCol}18`, border: `1px solid ${tierCol}44`, borderRadius: 20, padding: '3px 12px' }}>
                        {previewGuest.tier}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--ink-mute)', padding: '3px 10px', borderRadius: 20, background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)' }}>
                        {previewGuest.country}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', marginBottom: 18 }}>
                      {[
                        [isAr ? 'رقم الاعتماد' : 'Badge No.', previewGuest.id],
                        [isAr ? 'رقم الرحلة' : 'Flight', previewGuest.flight],
                        [isAr ? 'تاريخ الوصول' : 'Arrival', previewGuest.arrival],
                        [isAr ? 'الفندق' : 'Hotel', previewGuest.hotel],
                      ].map(([lbl, val]) => (
                        <div key={lbl}>
                          <div style={{ fontSize: 9.5, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 1 }}>{lbl}</div>
                          <div style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 500 }}>{val || '—'}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid var(--glass-border)' }}>
                      <div style={{ fontSize: 10, color: 'var(--ink-faint)', fontStyle: 'italic' }}>
                        {STR.forum} · Dec 7–9, 2025
                      </div>
                      <span style={chipStyle(isIssued)}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isIssued ? 'var(--accent)' : '#e0b864' }}/>
                        {isIssued ? STR.badgeIssued : STR.badgePending}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal footer */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setPreviewGuest(null)}>{STR.close}</button>
                {isIssued ? (
                  <button className="btn" style={{ color: '#e08a7e', borderColor: 'rgba(224,138,126,0.3)' }}
                    onClick={() => { setAccr(previewGuest.id, 'pending'); setPreviewGuest(null); }}>
                    <Icon name="x" size={13}/> {STR.revoke}
                  </button>
                ) : (
                  <button className="btn primary"
                    onClick={() => { setAccr(previewGuest.id, 'issued'); setPreviewGuest(null); }}>
                    <Icon name="badge" size={13}/> {STR.issue}
                  </button>
                )}
                <button className="btn" onClick={() => window.print()}>
                  <Icon name="download" size={13}/> {STR.printBadge}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
