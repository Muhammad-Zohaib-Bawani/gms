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
import { getGuest, issueAccreditation, revokeAccreditation } from '../api/services/guestService';
import { getNationalities } from '../api/services/nationalityService';
import { getOrganizations } from '../api/services/organizationService';
import { getTemplates } from '../api/services/invitationTemplateService';
import { getEvent } from '../api/services/eventService';
import { getEventFlights, getEventAccommodation, getEventTransport } from '../api/services/travelService';
import { getGuestSeatAssignments } from '../api/services/seatingService';
import GuestModal from './guests/modals/GuestModal';
import { flightTypeLabel, legTitle } from './guests/modals/TravelAccordion';
import DeleteGuestsModal from './guests/modals/DeleteGuestsModal';

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

function fmtDate(d, isAr) {
  if (!d) return null;
  try { return new Date(d).toLocaleDateString(isAr ? 'ar' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
function fmtDateTime(d, isAr) {
  if (!d) return null;
  try {
    return new Date(d).toLocaleString(isAr ? 'ar' : 'en-US', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return d; }
}

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

// One slide visible at a time with prev/next + dot nav — used wherever a guest
// can hold more than one booking of the same kind (flight/accommodation/
// transport), so a second or third booking doesn't just pile up under the first.
function BookingCarousel({ items, renderItem }) {
  const [idx, setIdx] = useState(0);
  const count = items.length;
  const safeIdx = idx < count ? idx : 0;

  if (count === 0) return null;

  return (
    <div>
      {count > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button
            type="button"
            className="icon-btn"
            style={{ width: 26, height: 26 }}
            onClick={() => setIdx((i) => (i - 1 + count) % count)}
          >
            <Icon name="arrowLeft" size={12} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {items.map((_, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`${i + 1}`}
                style={{
                  width: i === safeIdx ? 16 : 6, height: 6, borderRadius: 3, padding: 0, border: 'none',
                  cursor: 'pointer', background: i === safeIdx ? 'var(--accent)' : 'var(--glass-border)',
                  transition: 'width 0.15s ease',
                }}
              />
            ))}
          </div>
          <button
            type="button"
            className="icon-btn"
            style={{ width: 26, height: 26 }}
            onClick={() => setIdx((i) => (i + 1) % count)}
          >
            <Icon name="arrow" size={12} />
          </button>
        </div>
      )}
      {renderItem(items[safeIdx], safeIdx)}
    </div>
  );
}

const fieldGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 };

export default function GuestDetailView({ guestId, lang }) {
  const isAr = lang === 'ar';
  const navigate = useNavigate();

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
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <button
        className="btn"
        style={{ marginBottom: 14, fontSize: 12.5 }}
        onClick={() => navigate('/guests')}
      >
        <Icon name="arrowLeft" size={13} /> {isAr ? 'العودة إلى الضيوف' : 'Back to Guests'}
      </button>

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
                {guest.accreditationRequired && (
                  <span className="chip" style={{ borderColor: `${accredBadge.color}55`, color: accredBadge.color, background: `${accredBadge.color}18` }}>
                    <span className="dot" style={{ background: accredBadge.color }} />
                    {accredBadge.label[isAr ? 'ar' : 'en']}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button className="btn" onClick={() => navigate('/support-chat', {
              state: { guestId: guest.id, guestName, guestOrganization: guest.organization || '' },
            })}>
              <Icon name="message" size={13} /> {isAr ? 'رسالة' : 'Message'}
            </button>
            {guest.accreditationRequired && (
              guest.accreditationStatus === 'issued' ? (
                <button className="btn" disabled={busy} style={{ color: 'var(--danger)', borderColor: 'var(--danger-border)' }} onClick={handleRevoke}>
                  <Icon name="x" size={13} /> {isAr ? 'سحب الاعتماد' : 'Revoke Accreditation'}
                </button>
              ) : (
                <button className="btn" disabled={busy || !canIssue} title={!canIssue ? (isAr ? 'يجب قبول الدعوة أولاً' : 'Guest must accept the invitation first') : undefined}
                  style={canIssue ? undefined : { opacity: 0.4, cursor: 'not-allowed' }} onClick={handleIssue}>
                  <Icon name="badge" size={13} /> {isAr ? 'إصدار الاعتماد' : 'Issue Accreditation'}
                </button>
              )
            )}
            <button className="btn primary" onClick={() => setShowEdit(true)}>
              <Icon name="edit" size={13} /> {isAr ? 'تعديل' : 'Edit'}
            </button>
            <button className="btn" style={{ color: '#e05050', borderColor: 'rgba(224,80,80,0.3)' }} onClick={() => setShowDelete(true)}>
              <Icon name="trash" size={13} /> {isAr ? 'حذف' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      {/* Detail grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        <Section icon="guests" title={isAr ? 'المعلومات الشخصية' : 'Personal Info'}>
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
            {/* GuestServiceType.Transport (3) on the guest's allowed-services
                list — whether they may book a car from the app themselves,
                regardless of what's booked for them in the Transport section. */}
            <Field
              label={isAr ? 'طلب النقل من التطبيق' : 'Self-book transport'}
              value={(guest.allowedServices || []).includes(3)
                ? (isAr ? 'مسموح' : 'Allowed')
                : (isAr ? 'غير مسموح' : 'Not allowed')}
            />
          </div>
        </Section>

        <Section icon="calendar" title={isAr ? 'الجلسات' : 'Sessions'}>
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

        <Section icon="venue" title={isAr ? 'المقعد المخصص' : 'Seat Assignment'}>
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

        <Section icon="flight" title={isAr ? 'الطيران' : 'Flight'}>
          {flights.length === 0 ? (
            <Empty>{isAr ? 'لا يوجد حجز طيران' : 'No flight booked'}</Empty>
          ) : (
            <BookingCarousel items={flights} renderItem={(f) => (
              <>
                <div style={fieldGrid}>
                  <Field label={isAr ? 'النوع' : 'Type'} value={flightTypeLabel(f.flightType, isAr)} />
                  <Field label={isAr ? 'الدرجة' : 'Class'} value={f.flightClass} />
                  <Field label={isAr ? 'المقعد' : 'Seat'} value={f.seat} />
                  <Field label={isAr ? 'الحالة' : 'Status'} value={f.status} />
                </div>
                {/* One block per leg — a return booking has two. */}
                {(f.legs || []).map((l, i) => (
                  <div key={l.id || i} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--glass-border)' }}>
                    {(f.legs.length > 1) && (
                      <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)', marginBottom: 6 }}>
                        {legTitle(f.flightType, i, isAr)}
                      </div>
                    )}
                    <div style={fieldGrid}>
                      <Field label={isAr ? 'رقم الرحلة' : 'Flight No.'} value={l.flightNumber} />
                      <Field label={isAr ? 'من' : 'From'} value={[l.departureCity, l.departureCode].filter(Boolean).join(' · ')} />
                      <Field label={isAr ? 'إلى' : 'To'} value={[l.arrivalCity, l.arrivalCode].filter(Boolean).join(' · ')} />
                      <Field label={isAr ? 'الإقلاع' : 'Departure'} value={fmtDateTime(l.startTime, isAr)} />
                      <Field label={isAr ? 'الوصول' : 'Arrival'} value={fmtDateTime(l.endTime, isAr)} />
                    </div>
                  </div>
                ))}
              </>
            )} />
          )}
        </Section>

        <Section icon="hotel" title={isAr ? 'الإقامة' : 'Accommodation'}>
          {accommodations.length === 0 ? (
            <Empty>{isAr ? 'لا يوجد حجز إقامة' : 'No accommodation booked'}</Empty>
          ) : (
            <BookingCarousel items={accommodations} renderItem={(a) => (
              <div style={fieldGrid}>
                {a.hotelImageUrl && (
                  <img src={a.hotelImageUrl} alt="" style={{ gridColumn: '1 / -1', width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, marginBottom: 4 }}
                    onError={e => { e.target.style.display = 'none'; }}/>
                )}
                <Field label={isAr ? 'الفندق' : 'Hotel'} value={a.hotel} />
                <Field label={isAr ? 'نوع الغرفة' : 'Room Type'} value={a.roomType} />
                <Field label={isAr ? 'تسجيل الوصول' : 'Check-in'} value={fmtDate(a.checkIn, isAr)} />
                <Field label={isAr ? 'تسجيل المغادرة' : 'Check-out'} value={fmtDate(a.checkOut, isAr)} />
              </div>
            )} />
          )}
        </Section>

        <Section icon="car" title={isAr ? 'النقل' : 'Transport'}>
          {transports.length === 0 ? (
            <Empty>{isAr ? 'لا يوجد حجز نقل' : 'No transport booked'}</Empty>
          ) : (
            <BookingCarousel items={transports} renderItem={(t) => (
              <div style={fieldGrid}>
                <Field label={isAr ? 'المركبة' : 'Vehicle'} value={t.vehicle} />
                <Field label={isAr ? 'السائق' : 'Driver'} value={t.driverName} />
                <Field label={isAr ? 'الاستلام' : 'Pickup'} value={t.pickup} />
                <Field label={isAr ? 'التوصيل' : 'Dropoff'} value={t.dropoff} />
                <Field label={isAr ? 'وقت الاستلام' : 'Pickup Time'} value={fmtDateTime(t.pickupTime, isAr)} />
                <Field label={isAr ? 'الحالة' : 'Status'} value={t.tripStatus} />
              </div>
            )} />
          )}
        </Section>
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
    </div>
  );
}
