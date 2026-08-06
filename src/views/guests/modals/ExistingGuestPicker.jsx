import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../components/Icons';
import { Avatar, StatusChip } from '../../../components/UI';
import Select from '../../../components/ui/Select';
import { getGuestsFromOtherEvents } from '../../../api/services/guestService';
import { getServiceLevels } from '../../../api/services/serviceCatalogService';

const rowKey = (row) => `${row.id}::${row.eventId}`;

const checkboxStyle = { width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--accent)' };

// "Existing Guest" tab — one flat, always-visible table (no nested modal, no
// empty-state placeholder). Search across every OTHER event system-wide (one
// row per past booking, not deduped by person). Ticking the leftmost
// checkbox is what marks a guest for inclusion in this batch; only selected
// rows get editable Tier / Accreditation / per-session cells (unselected
// rows are dimmed and inert). Each session the event has gets its OWN
// column with its own checkbox — a guest can be checked into several
// sessions at once — and every such column (plus Accreditation) has a
// header checkbox that bulk-applies to every currently-selected row, so you
// don't have to click the same box guest-by-guest. Selections persist across
// searches/pages via a row cache, keyed by (guest id, source event id).
// Nothing is created until "Confirm & Add" — this stays purely client-side
// until then.
export default function ExistingGuestPicker({
  activeEventId, lang, sessions, enums, templates, saving, onSubmit,
}) {
  const isAr = lang === 'ar';

  const [phase, setPhase] = useState('table'); // 'table' | 'invitation'
  const [invitationTemplateId, setInvitationTemplateId] = useState(null);

  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [rowCache, setRowCache] = useState(new Map()); // key -> row, accumulates across pages/searches
  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selected, setSelected] = useState(new Set());
  const [rowLevel, setRowLevel] = useState({});
  const [levels, setLevels] = useState([]);
  const [rowSessions, setRowSessions] = useState(new Map()); // key -> Set<sessionId>
  const [rowAccred, setRowAccred] = useState(new Map()); // key -> bool

  useEffect(() => { setPageNumber(1); }, [search]);

  useEffect(() => {
    if (!activeEventId) return;
    let cancelled = false;
    setLoading(true);
    const debounce = setTimeout(() => {
      getGuestsFromOtherEvents({ currentEventId: activeEventId, search, pageNumber, pageSize: 20 })
        .then((r) => {
          if (cancelled) return;
          const items = r?.items || [];
          setRows(items);
          setTotalCount(r?.totalCount ?? 0);
          setRowCache((prev) => {
            const next = new Map(prev);
            items.forEach((row) => next.set(rowKey(row), row));
            return next;
          });
        })
        .catch(() => { if (!cancelled) { setRows([]); setTotalCount(0); } })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 300);
    return () => { cancelled = true; clearTimeout(debounce); };
  }, [activeEventId, search, pageNumber]);

  // Service levels replace the old free-text Tier column — a guest is placed
  // on a real level, the same as the New Guest wizard, rather than a string.
  useEffect(() => {
    getServiceLevels(false).then(setLevels).catch(() => setLevels([]));
  }, []);

  const levelOpts = useMemo(
    () => (levels || []).map((l) => ({ value: l.id, label: (isAr ? l.nameAr : null) || l.name })),
    [levels, isAr],
  );

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(rowKey(r)));

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) rows.forEach((r) => next.delete(rowKey(r)));
      else rows.forEach((r) => next.add(rowKey(r)));
      return next;
    });
  }

  function toggleRowSelected(key) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleRowSession(key, sessionId) {
    setRowSessions((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(key) || []);
      set.has(sessionId) ? set.delete(sessionId) : set.add(sessionId);
      next.set(key, set);
      return next;
    });
  }

  function toggleRowAccred(key) {
    setRowAccred((prev) => {
      const next = new Map(prev);
      next.set(key, !next.get(key));
      return next;
    });
  }

  // Header checkboxes apply to every currently-selected row — if all of them
  // already have this value, the header click clears it from all; otherwise
  // it sets it on all.
  function sessionHeaderChecked(sessionId) {
    return selected.size > 0 && Array.from(selected).every((key) => rowSessions.get(key)?.has(sessionId));
  }
  function toggleSessionForSelected(sessionId) {
    if (selected.size === 0) return;
    const allChecked = sessionHeaderChecked(sessionId);
    setRowSessions((prev) => {
      const next = new Map(prev);
      selected.forEach((key) => {
        const set = new Set(next.get(key) || []);
        allChecked ? set.delete(sessionId) : set.add(sessionId);
        next.set(key, set);
      });
      return next;
    });
  }
  function accredHeaderChecked() {
    return selected.size > 0 && Array.from(selected).every((key) => !!rowAccred.get(key));
  }
  function toggleAccredForSelected() {
    if (selected.size === 0) return;
    const allChecked = accredHeaderChecked();
    setRowAccred((prev) => {
      const next = new Map(prev);
      selected.forEach((key) => next.set(key, !allChecked));
      return next;
    });
  }

  const canPrev = pageNumber > 1;
  const canNext = pageNumber * 20 < totalCount;

  function handleConfirm() {
    const entries = Array.from(selected).map((key) => {
      const row = rowCache.get(key);
      return {
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        guestType: row.guestType,
        organizationId: row.organizationId,
        nationalityId: row.nationalityId,
        photoUrl: row.photoUrl,
        serviceLevelId: rowLevel[key] ?? row.serviceLevelId ?? null,
        sessionIds: Array.from(rowSessions.get(key) || []),
        accreditationRequired: !!rowAccred.get(key),
      };
    }).filter(Boolean);
    onSubmit(entries, invitationTemplateId);
  }

  // ── Invitation step (after Review & Add) ─────────────────────────────────
  if (phase === 'invitation') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, flex: 1, minHeight: 0 }}>
        <div style={{ fontSize: 12.5, color: 'var(--ink-mute)' }}>
          {isAr
            ? `اختر قالب دعوة واحد لجميع الضيوف المضافين (${selected.size})`
            : `Choose one invitation template for all ${selected.size} guest${selected.size === 1 ? '' : 's'} being added`}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div
            onClick={() => setInvitationTemplateId(null)}
            style={{
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: 12,
              border: `1px solid ${!invitationTemplateId ? 'var(--accent)' : 'var(--glass-border)'}`,
              background: !invitationTemplateId ? 'rgba(26,174,196,0.1)' : 'var(--surface-soft-2)',
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: 5,
              border: `2px solid ${!invitationTemplateId ? 'var(--accent)' : 'var(--glass-border)'}`,
              background: !invitationTemplateId ? 'var(--accent)' : 'transparent',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              {!invitationTemplateId && <Icon name="check" size={10} style={{ color: '#fff' }}/>}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: !invitationTemplateId ? 600 : 400 }}>
                {isAr ? 'بدون دعوة' : 'No invitation'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                {isAr ? 'إضافة الضيوف فقط' : 'No email sent (automatically accepted)'}
              </div>
            </div>
          </div>
          {(templates || []).map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => setInvitationTemplateId(tmpl.id)}
              style={{
                padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1px solid ${invitationTemplateId === tmpl.id ? (tmpl.color || 'var(--accent)') : 'var(--glass-border)'}`,
                background: invitationTemplateId === tmpl.id ? `${tmpl.color || 'var(--accent)'}18` : 'var(--surface-soft-2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: tmpl.color || 'var(--accent)', flexShrink: 0 }}/>
                <span style={{ fontSize: 13, fontWeight: invitationTemplateId === tmpl.id ? 600 : 400 }}>
                  {isAr ? tmpl.nameAr || tmpl.name : tmpl.name}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <button className="btn" onClick={() => setPhase('table')}>
            <Icon name="arrowLeft" size={13}/> {isAr ? 'رجوع' : 'Back'}
          </button>
          <button className="btn primary" onClick={handleConfirm} disabled={saving}>
            <Icon name="check" size={13}/>
            {saving
              ? (isAr ? 'جارٍ الإضافة…' : 'Adding…')
              : (isAr ? `تأكيد وإضافة (${selected.size})` : `Confirm & Add (${selected.size})`)}
          </button>
        </div>
      </div>
    );
  }

  // ── Table step (default) ──────────────────────────────────────────────────
  const thStyle = {
    padding: '9px 10px', textAlign: 'left', color: 'var(--ink-mute)', fontWeight: 600,
    fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>
      <div className="search" style={{ width: '100%' }}>
        <Icon name="search" size={14}/>
        <input
          placeholder={isAr ? 'بحث بالاسم أو البريد أو المؤسسة…' : 'Search by name, email, or organization…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--glass-border)', borderRadius: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: 'var(--surface-soft-3)', zIndex: 1 }}>
              <th style={{ ...thStyle, width: 34, textAlign: 'center' }}>
                <input type="checkbox" style={checkboxStyle} checked={allVisibleSelected} onChange={toggleAllVisible}/>
              </th>
              <th style={thStyle}>{isAr ? 'الضيف' : 'Guest'}</th>
              <th style={{ ...thStyle, width: 170 }}>{isAr ? 'مستوى الخدمة' : 'Service Level'}</th>
              {/* <th style={thStyle}>{isAr ? 'الجنسية' : 'Nationality'}</th>
              <th style={thStyle}>{isAr ? 'الدعوة' : 'Invite'}</th> */}
              <th style={{ ...thStyle, textAlign: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <span>{isAr ? 'الاعتماد' : 'Accreditation'}</span>
                  <input
                    type="checkbox" style={checkboxStyle}
                    checked={accredHeaderChecked()} disabled={selected.size === 0}
                    onChange={toggleAccredForSelected}
                    title={isAr ? 'تطبيق على الكل المحدد' : 'Apply to all selected'}
                  />
                </div>
              </th>
              {(sessions || []).map((s) => (
                <th key={s.id} style={{ ...thStyle, textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', }} title={s.title}>{s.title}</span>
                    <input
                      type="checkbox" style={checkboxStyle}
                      checked={sessionHeaderChecked(s.id)} disabled={selected.size === 0}
                      onChange={() => toggleSessionForSelected(s.id)}
                      title={isAr ? 'تطبيق على الكل المحدد' : 'Apply to all selected'}
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => {
              const key = rowKey(g);
              const isSel = selected.has(key);
              const fullName = `${g.firstName || ''} ${g.lastName || ''}`.trim();
              const initials = ((g.firstName?.[0] || '') + (g.lastName?.[0] || '')).toUpperCase();
              return (
                <tr key={key} style={{ borderTop: '1px solid var(--glass-border)', opacity: isSel ? 1 : 0.55 }}>
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <input type="checkbox" style={checkboxStyle} checked={isSel} onChange={() => toggleRowSelected(key)}/>
                  </td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar initials={initials} size={28} tier={g.tier} src={g.photoUrl}/>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{fullName}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                          {g.email}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--ink-faint)' }}>
                          {isAr ? 'سابقًا في: ' : 'Previously in: '}{g.eventTitle}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '4px 10px' }}>
                    <Select
                      value={rowLevel[key] ?? g.serviceLevelId ?? ''}
                      onChange={(v) => setRowLevel((p) => ({ ...p, [key]: v || null }))}
                      options={levelOpts}
                      isClearable
                      isDisabled={!isSel}
                      placeholder={isAr ? '— بدون —' : '— None —'}
                    />
                  </td>
                  {/* <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    {g.nationalityFlag} {g.nationalityName}
                  </td> */}
                  {/* <td style={{ padding: '8px 10px' }}>
                    <StatusChip status={g.invitationStatus} lang={lang}/>
                  </td> */}
                  <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                    <input
                      type="checkbox" style={checkboxStyle}
                      checked={!!rowAccred.get(key)} disabled={!isSel}
                      onChange={() => toggleRowAccred(key)}
                    />
                  </td>
                  {(sessions || []).map((s) => (
                    <td key={s.id} style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <input
                        type="checkbox" style={checkboxStyle}
                        checked={!!rowSessions.get(key)?.has(s.id)} disabled={!isSel}
                        onChange={() => toggleRowSession(key, s.id)}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6 + (sessions?.length || 0)} style={{ padding: 28, textAlign: 'center', color: 'var(--ink-mute)' }}>
                  {isAr ? 'لا يوجد ضيوف مطابقون في فعاليات أخرى' : 'No matching guests in other events'}
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={6 + (sessions?.length || 0)} style={{ padding: 28, textAlign: 'center', color: 'var(--ink-mute)' }}>
                  {isAr ? 'جارٍ البحث…' : 'Searching…'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalCount > 20 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--ink-mute)' }}>
          <button className="btn" disabled={!canPrev} onClick={() => setPageNumber((p) => p - 1)}>{isAr ? 'السابق' : 'Prev'}</button>
          <span>{isAr ? `صفحة ${pageNumber}` : `Page ${pageNumber}`}</span>
          <button className="btn" disabled={!canNext} onClick={() => setPageNumber((p) => p + 1)}>{isAr ? 'التالي' : 'Next'}</button>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingTop: 8, borderTop: '1px solid var(--glass-border)' }}>
        <span style={{ fontSize: 12, color: 'var(--ink-mute)' }}>
          {selected.size > 0
            ? (isAr ? `${selected.size} ضيف محدد` : `${selected.size} guest${selected.size === 1 ? '' : 's'} selected`)
            : (isAr ? 'حدد الضيوف بالمربعات على اليسار' : 'Check guests on the left to select them')}
        </span>
        <button className="btn primary" disabled={selected.size === 0} onClick={() => setPhase('invitation')}>
          {isAr ? `مراجعة وإضافة (${selected.size})` : `Review & Add (${selected.size})`} <Icon name="arrow" size={13}/>
        </button>
      </div>
    </div>
  );
}
