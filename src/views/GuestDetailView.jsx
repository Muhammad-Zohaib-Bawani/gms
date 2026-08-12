// Dedicated full-page guest detail — opened via the Guests list row menu's
// "View" action (as opposed to clicking the guest's name, which still opens
// the quick GuestDrawer). Read-only display of every field the API has for
// this guest; Edit/Delete reuse the same modals as the Guests list so the
// actual mutation logic isn't duplicated.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, ServiceLevelChip } from '../components/UI';
import { Icon } from '../components/Icons';
import toast from '../lib/toast';
import { fmtDate as isoDate, fmtDateTime as isoDateTime } from '../lib/date';
import { useAuth } from '../auth/AuthContext';
import { getGuest, issueAccreditation, revokeAccreditation, updateGuest } from '../api/services/guestService';
import { getNationalities } from '../api/services/nationalityService';
import { getOrganizations } from '../api/services/organizationService';
import { getTemplates } from '../api/services/invitationTemplateService';
import { getEvent } from '../api/services/eventService';
import { getEventFlights, getEventAccommodation, getEventTransport } from '../api/services/travelService';
import { getGuestSeatAssignments } from '../api/services/seatingService';
import GuestModal from './guests/modals/GuestModal';
import { flightTypeLabel, legTitle } from './guests/modals/TravelAccordion';
import DeleteGuestsModal from './guests/modals/DeleteGuestsModal';
import GuestProfileEditModal from './guests/modals/GuestProfileEditModal';
import GuestServicesPanel from './guests/GuestServicesPanel';
import ActionMenu from '../components/ui/ActionMenu';
import AccreditationCardModal from './accreditation/AccreditationCardModal';

// Each guest's own travel rows out of the event-wide lists — those already
// carry resolved display names (hotel, vehicle, driver...), unlike
// GET /travel/guest/{id} which only ever returns the single most-recent
// booking of each kind (that endpoint is built for the edit wizard's
// single-accordion prefill, not for showing every booking a guest has).
const forGuest = (rows, guestId) => (rows || []).filter((r) => r.guestId === guestId);

const INVITE_BADGE = {
  not_sent: { label: { en: 'Not sent', ar: 'لم تُرسل' }, color: '#9CA3AF' },
  sent:     { label: { en: 'Sent',     ar: 'أُرسلت' },   color: '#3B82F6' },
  opened:   { label: { en: 'Opened',   ar: 'فُتحت' },    color: '#F59E0B' },
  accepted: { label: { en: 'Accepted', ar: 'مقبولة' },   color: '#5abf6e' },
  declined: { label: { en: 'Declined', ar: 'مرفوضة' },   color: 'var(--danger)' },
};
const ACCRED_BADGE = {
  not_issued: { label: { en: 'Not issued', ar: 'غير صادر' }, color: '#9CA3AF' },
  issued:     { label: { en: 'Issued',     ar: 'صادر' },     color: '#5abf6e' },
  revoked:    { label: { en: 'Revoked',    ar: 'ملغى' },     color: '#e05050' },
};

// Thin wrappers over lib/date so this screen reads the portal's DD-MM-YYYY like
// everywhere else. Null (not '—') when empty: callers here hide the whole field.
const fmtDate = (d) => (d ? isoDate(d, null) : null);
const fmtDateTime = (d) => (d ? isoDateTime(d, null) : null);

function Section({ icon, title, children, action }) {
  return (
    <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        padding: '13px 18px', borderBottom: '1px solid var(--glass-border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name={icon} size={15} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{title}</span>
        </div>
        {action}
      </div>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value ?? <span style={{ color: 'var(--ink-faint)' }}>—</span>}
      </div>
    </div>
  );
}

function Empty({ children }) {
  return (
    <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', textAlign: 'center', padding: '10px 0' }}>
      {children}
    </div>
  );
}

const fieldGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 };

// Admin-only "which sessions is this guest in" popup — just the sessions,
// not the full guest wizard. Saves through the same full-payload update every
// guest edit uses (the API replaces the whole record), so everything else on
// the guest is carried over unchanged and only sessionIds actually changes.
function SessionsEditModal({ open, guest, event, lang, onClose, onSaved }) {
  const isAr = lang === 'ar';
  const [selected, setSelected] = useState(() => new Set(guest?.sessionIds || []));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setSelected(new Set(guest?.sessionIds || []));
  }, [open, guest]);

  if (!open) return null;
  const allSessions = event?.sessions || [];

  function toggle(id) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateGuest(guest.id, {
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email || null,
        guestType: guest.guestType,
        organization: guest.organization || null,
        // Omitting either of these nulls out the guest's linked organization
        // and service level (and with the latter, their whole services
        // checklist) — the update endpoint resolves both fresh from the
        // request and overwrites the guest's existing links either way.
        organizationId: guest.organizationId || null,
        nationalityId: guest.nationalityId || null,
        serviceLevelId: guest.serviceLevelId || null,
        overrideServiceLevelRules: !!guest.serviceLevelRulesOverridden,
        serviceLevelOverrideReason: guest.serviceLevelOverrideReason || null,
        tier: guest.tier,
        arrivalDate: guest.arrivalDate || null,
        departureDate: guest.departureDate || null,
        photoUrl: guest.photoUrl || null,
        accreditationRequired: guest.accreditationRequired,
        invitationTemplateId: guest.invitationTemplateId || null,
        sessionIds: Array.from(selected),
      });
      toast.success(isAr ? 'تم حفظ الجلسات' : 'Sessions saved');
      onSaved?.(updated);
      onClose();
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذّر الحفظ' : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}
      onClick={onClose}>
      <div className="card glass modal-solid" style={{ width: 420, maxWidth: '92vw', padding: 0, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>{isAr ? 'جلسات الضيف' : 'Guest Sessions'}</h3>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>
        <div style={{ padding: '14px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {allSessions.length === 0 ? (
            <Empty>{isAr ? 'لا توجد جلسات لهذه الفعالية' : 'This event has no sessions'}</Empty>
          ) : allSessions.map((s) => (
            <label key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${selected.has(s.id) ? 'var(--accent)' : 'var(--glass-border)'}`,
              background: selected.has(s.id) ? 'rgba(141, 1, 52,0.08)' : 'var(--surface-soft-2)',
            }}>
              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>
                  {[fmtDate(s.date, isAr), s.time, s.room].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
            </label>
          ))}
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

export default function GuestDetailView({ guestId, lang, embedded = false }) {
  const isAr = lang === 'ar';
  const navigate = useNavigate();
  const { can } = useAuth();
  const canEditGuest = can('Guests.Update');
  const canSeeSeating = can('Seating.View');

  const [guest, setGuest] = useState(null);
  const [event, setEvent] = useState(null);
  const [flights, setFlights] = useState([]);
  const [accommodations, setAccommodations] = useState([]);
  const [transports, setTransports] = useState([]);
  const [seats, setSeats] = useState([]);
  const [nationalities, setNationalities] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showSessionsEdit, setShowSessionsEdit] = useState(false);
  const [showAccredCard, setShowAccredCard] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const g = await getGuest(guestId);
      if (!g) { setNotFound(true); return; }
      setGuest(g);
      const [ev, fl, acc, tr, st, nats, orgs, tmpls] = await Promise.all([
        getEvent(g.eventId).catch(() => null),
        getEventFlights(g.eventId).catch(() => null),
        getEventAccommodation(g.eventId).catch(() => null),
        getEventTransport(g.eventId).catch(() => null),
        getGuestSeatAssignments(g.id).catch(() => []),
        getNationalities().catch(() => []),
        getOrganizations().catch(() => []),
        getTemplates(g.eventId).catch(() => []),
      ]);
      setEvent(ev);
      setFlights(forGuest(fl?.items, g.id));
      setAccommodations(forGuest(acc?.items, g.id));
      setTransports(forGuest(tr?.items, g.id));
      setSeats(st || []);
      setNationalities(nats || []);
      setOrganizations(orgs || []);
      setTemplates(tmpls || []);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [guestId]);

  useEffect(() => { load(); }, [load]);

  const guestName = guest?.fullName || `${guest?.firstName || ''} ${guest?.lastName || ''}`.trim();
  const initials = ((guest?.firstName?.[0] || '') + (guest?.lastName?.[0] || '')).toUpperCase();
  const inviteBadge = INVITE_BADGE[guest?.invitationStatus] || INVITE_BADGE.not_sent;
  const accredBadge = ACCRED_BADGE[guest?.accreditationStatus] || ACCRED_BADGE.not_issued;
  const canIssue = guest?.invitationStatus === 'accepted';

  const sessions = useMemo(() => {
    if (!guest || !event) return [];
    const ids = new Set(guest.sessionIds || []);
    return (event.sessions || []).filter((s) => ids.has(s.id));
  }, [guest, event]);

  async function handleIssue() {
    if (!canIssue) {
      toast.error(isAr ? 'لا يمكن إصدار الاعتماد قبل قبول الضيف للدعوة' : 'Cannot issue accreditation until the guest has accepted their invitation');
      return;
    }
    setBusy(true);
    try {
      await issueAccreditation(guest.id);
      setGuest((g) => ({ ...g, accreditationStatus: 'issued' }));
      toast.success(isAr ? 'تم إصدار الاعتماد' : 'Accreditation issued');
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذر إصدار الاعتماد' : 'Failed to issue accreditation');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke() {
    setBusy(true);
    try {
      await revokeAccreditation(guest.id);
      setGuest((g) => ({ ...g, accreditationStatus: 'not_issued' }));
      toast.success(isAr ? 'تم سحب الاعتماد' : 'Accreditation revoked');
    } catch (err) {
      toast.fromError(err, isAr ? 'تعذر سحب الاعتماد' : 'Failed to revoke accreditation');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>{isAr ? 'جارٍ التحميل…' : 'Loading…'}</div>;
  }
  if (notFound || !guest) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginBottom: 14 }}>
          {isAr ? 'تعذر العثور على الضيف' : 'Guest not found'}
        </div>
        <button className="btn" onClick={() => navigate('/guests')}>
          <Icon name="arrowLeft" size={13} /> {isAr ? 'العودة إلى الضيوف' : 'Back to Guests'}
        </button>
      </div>
    );
  }

  return (
    <div style={{ margin: '0 auto' }}>
      {!embedded && (
        <button
          className="btn"
          style={{ marginBottom: 14, fontSize: 12.5 }}
          onClick={() => navigate('/guests')}
        >
          <Icon name="arrowLeft" size={13} /> {isAr ? 'العودة إلى الضيوف' : 'Back to Guests'}
        </button>
      )}

      {/* Header */}
      <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flex: '1 1 320px', minWidth: 260 }}>
            <Avatar initials={initials} size={64} tier={guest.tier} src={guest.photoUrl} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{guestName}</div>
              {guest.organization && <div style={{ fontSize: 13, color: 'var(--ink-mute)', marginTop: 2 }}>{guest.organization}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 9 }}>
                <span className="chip" style={{ borderColor: `${inviteBadge.color}55`, color: inviteBadge.color, background: `${inviteBadge.color}18` }}>
                  <span className="dot" style={{ background: inviteBadge.color }} />
                  {inviteBadge.label[isAr ? 'ar' : 'en']}
                </span>
              </div>
            </div>
          </div>

          <ActionMenu
            items={[
              {
                label: isAr ? 'رسالة' : 'Message',
                icon: 'message',
                onClick: () => navigate('/support-chat', {
                  state: { guestId: guest.id, guestName, guestOrganization: guest.organization || '' },
                }),
              },
              guest.accreditationRequired && (
                guest.accreditationStatus === 'issued'
                  ? { label: isAr ? 'سحب الاعتماد' : 'Revoke Accreditation', icon: 'x', danger: true, disabled: busy, onClick: handleRevoke }
                  : {
                      label: isAr ? 'إصدار الاعتماد' : 'Issue Accreditation', icon: 'badge',
                      disabled: busy || !canIssue,
                      hint: !canIssue ? (isAr ? 'يجب قبول الدعوة أولاً' : 'Guest must accept the invitation first') : undefined,
                      onClick: handleIssue,
                    }
              ),
              { label: isAr ? 'تعديل' : 'Edit', icon: 'edit', onClick: () => setShowEdit(true) },
              { label: isAr ? 'حذف' : 'Delete', icon: 'trash', danger: true, onClick: () => setShowDelete(true) },
            ]}
          />
        </div>
      </div>

      {/* Detail grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Section icon="guests" title={isAr ? 'المعلومات الشخصية' : 'Personal Info'}
          action={canEditGuest && (
            <button className="icon-btn" title={isAr ? 'تعديل' : 'Edit'} onClick={() => setShowProfileEdit(true)}>
              <Icon name="edit" size={13} />
            </button>
          )}>
          <div style={fieldGrid}>
            <Field label={isAr ? 'البريد الإلكتروني' : 'Email'} value={guest.email} />
            <Field label={isAr ? 'نوع الضيف' : 'Guest Type'} value={guest.guestType} />
            <Field
              label={isAr ? 'مستوى الخدمة' : 'Service Level'}
              value={guest.serviceLevelName
                ? <ServiceLevelChip name={guest.serviceLevelName} nameAr={guest.serviceLevelNameAr}
                    color={guest.serviceLevelColor} lang={lang} />
                : null}
            />
            <Field label={isAr ? 'الدولة' : 'Country'} value={guest.nationalityName ? `${guest.nationalityFlag || ''} ${guest.nationalityName}`.trim() : null} />
            <Field label={isAr ? 'تاريخ الإنشاء' : 'Created'} value={fmtDate(guest.createdAt, isAr)} />
            <Field
              label={isAr ? 'الاعتماد' : 'Accreditation'}
              value={guest.accreditationRequired
                ? <button
                    type="button"
                    className=""
                    style={{display: "flex",gap: 4,alignItems: "center", borderBottom: '1px solid #000 !important',border: "none", background: 'transparent', padding: 0, fontSize: 12, color: 'var(--accent)', cursor: 'pointer' }}
                    onClick={() => setShowAccredCard(true)}
                  >
                    <Icon name="badge" size={12} />
                    {isAr ? 'عرض الاعتماد' : 'View Pass'}
                  </button>
                : (isAr ? 'غير مطلوب' : 'Not required')}
            />
          </div>
        </Section>

        <Section icon="calendar" title={isAr ? 'الجلسات' : 'Sessions'}
          action={canEditGuest && (
            <button className="icon-btn" title={isAr ? 'تعديل الجلسات' : 'Edit sessions'} onClick={() => setShowSessionsEdit(true)}>
              <Icon name="edit" size={13} />
            </button>
          )}>
          {sessions.length === 0 ? (
            <Empty>{isAr ? 'لم يسجل الضيف في أي جلسة' : 'Not registered for any session'}</Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {sessions.map((s) => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, paddingBottom: 8, borderBottom: '1px solid var(--glass-border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                    <div style={{ color: 'var(--ink-mute)', fontSize: 11, marginTop: 2 }}>
                      {[s.venueName, s.room].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                  <div style={{ textAlign: isAr ? 'left' : 'right', flexShrink: 0, color: 'var(--ink-mute)', fontSize: 11.5 }}>
                    <div>{fmtDate(s.date, isAr)}</div>
                    <div style={{ fontFamily: 'var(--mono)' }}>{s.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section icon="venue" title={isAr ? 'المقعد المخصص' : 'Seat Assignment'}
          action={canSeeSeating && (
            <button className="icon-btn" title={isAr ? 'الذهاب إلى الجلوس' : 'Go to Seating'} onClick={() => navigate('/seating')}>
              <Icon name="arrow" size={13} />
            </button>
          )}>
          {seats.length === 0 ? (
            <Empty>{isAr ? 'لم يُخصص مقعد بعد' : 'No seat assigned'}</Empty>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seats.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, paddingBottom: 8, borderBottom: '1px solid var(--glass-border)' }}>
                  <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.eventTitle}{s.sessionTitle ? ` · ${s.sessionTitle}` : ''}
                  </div>
                  <span className="chip pending" style={{ flexShrink: 0 }}>{isAr ? 'مقعد' : 'Seat'} {s.seatCode}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Each service the guest's level assigns gets its own card here —
            Flight, Transport, Accommodation, Arrival/Departure, then any
            dynamic services — instead of one "Services" box containing all
            of them. GuestServicesPanel renders its cards as siblings (not
            wrapped in a Section), so they drop into this same grid. */}
        <GuestServicesPanel guestId={guestId} lang={lang} onChanged={load}
          eventStart={guest?.eventStartDate} eventEnd={guest?.eventEndDate}
          eventId={guest?.eventId}
          arrivalDate={guest?.arrivalDate} departureDate={guest?.departureDate} />
      </div>

      {showEdit && (
        <GuestModal
          open={showEdit}
          onClose={() => setShowEdit(false)}
          guest={guest}
          activeEventId={guest.eventId}
          eventStartDate={event?.startDate}
          eventEndDate={event?.endDate}
          nationalities={nationalities}
          organizations={organizations}
          templates={templates}
          sessions={event?.sessions || []}
          lang={lang}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}

      {showDelete && (
        <DeleteGuestsModal
          open={showDelete}
          onClose={() => setShowDelete(false)}
          selectedGuests={[guest]}
          activeEventId={guest.eventId}
          lang={lang}
          onDeleted={() => navigate('/guests')}
        />
      )}

      <GuestProfileEditModal
        open={showProfileEdit}
        guest={guest}
        lang={lang}
        onClose={() => setShowProfileEdit(false)}
        onSaved={() => load()}
      />

      <SessionsEditModal
        open={showSessionsEdit}
        guest={guest}
        event={event}
        lang={lang}
        onClose={() => setShowSessionsEdit(false)}
        onSaved={() => load()}
      />

      <AccreditationCardModal
        open={showAccredCard}
        guest={guest}
        event={event}
        lang={lang}
        onClose={() => setShowAccredCard(false)}
        onIssue={handleIssue}
        onRevoke={handleRevoke}
        canIssue={canIssue}
        busy={busy}
        notAcceptedTitle={isAr ? 'يجب قبول الدعوة أولاً' : 'Guest must accept the invitation first'}
      />
    </div>
  );
}
