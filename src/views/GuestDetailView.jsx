// Dedicated full-page guest detail — opened via the Guests list row menu's
// "View" action (as opposed to clicking the guest's name, which still opens
// the quick GuestDrawer). Read-only display of every field the API has for
// this guest; Edit/Delete reuse the same modals as the Guests list so the
// actual mutation logic isn't duplicated.
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../components/UI';
import { Icon } from '../components/Icons';
import toast from '../lib/toast';
import { getGuest, issueAccreditation, revokeAccreditation } from '../api/services/guestService';
import { getNationalities } from '../api/services/nationalityService';
import { getTemplates } from '../api/services/invitationTemplateService';
import { getEvent } from '../api/services/eventService';
import { getGuestTravel, getTravelLookups } from '../api/services/travelService';
import { getGuestSeatAssignments } from '../api/services/seatingService';
import GuestModal from './guests/modals/GuestModal';
import DeleteGuestsModal from './guests/modals/DeleteGuestsModal';
import { driverLabel, vehicleLabel } from './guests/modals/TravelAccordion';

const INVITE_BADGE = {
  not_sent: { label: { en: 'Not sent', ar: 'لم تُرسل' }, color: '#9CA3AF' },
  sent:     { label: { en: 'Sent',     ar: 'أُرسلت' },   color: '#3B82F6' },
  opened:   { label: { en: 'Opened',   ar: 'فُتحت' },    color: '#F59E0B' },
  accepted: { label: { en: 'Accepted', ar: 'مقبولة' },   color: '#5abf6e' },
  declined: { label: { en: 'Declined', ar: 'مرفوضة' },   color: '#e08a7e' },
};
const ACCRED_BADGE = {
  not_issued: { label: { en: 'Not issued', ar: 'غير صادر' }, color: '#9CA3AF' },
  issued:     { label: { en: 'Issued',     ar: 'صادر' },     color: '#5abf6e' },
  revoked:    { label: { en: 'Revoked',    ar: 'ملغى' },     color: '#e05050' },
};

function nameOf(list, id, fallback = '—') {
  return (list || []).find((x) => x.id === id)?.name || fallback;
}
function findById(list, id) {
  return (list || []).find((x) => x.id === id);
}
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

const fieldGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 };

export default function GuestDetailView({ guestId, lang }) {
  const isAr = lang === 'ar';
  const navigate = useNavigate();

  const [guest, setGuest] = useState(null);
  const [event, setEvent] = useState(null);
  const [travel, setTravel] = useState(null);
  const [lookups, setLookups] = useState(null);
  const [seats, setSeats] = useState([]);
  const [nationalities, setNationalities] = useState([]);
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
      const [ev, trav, lk, st, nats, tmpls] = await Promise.all([
        getEvent(g.eventId).catch(() => null),
        getGuestTravel(g.id).catch(() => null),
        getTravelLookups().catch(() => null),
        getGuestSeatAssignments(g.id).catch(() => []),
        getNationalities().catch(() => []),
        getTemplates(g.eventId).catch(() => []),
      ]);
      setEvent(ev);
      setTravel(trav);
      setLookups(lk);
      setSeats(st || []);
      setNationalities(nats || []);
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

  const flight = travel?.flight;
  const accommodation = travel?.accommodation;
  const transport = travel?.transport;

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
                <button className="btn" disabled={busy} style={{ color: '#e08a7e', borderColor: 'rgba(224,138,126,0.3)' }} onClick={handleRevoke}>
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
            <Field label={isAr ? 'الفئة' : 'Tier'} value={guest.tier} />
            <Field label={isAr ? 'الدولة' : 'Country'} value={guest.nationalityName ? `${guest.nationalityFlag || ''} ${guest.nationalityName}`.trim() : null} />
            <Field label={isAr ? 'تاريخ الإنشاء' : 'Created'} value={fmtDate(guest.createdAt, isAr)} />
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
          {!flight ? (
            <Empty>{isAr ? 'لا يوجد حجز طيران' : 'No flight booked'}</Empty>
          ) : (
            <div style={fieldGrid}>
              <Field label={isAr ? 'رقم الرحلة' : 'Flight No.'} value={flight.flightNumber} />
              <Field label={isAr ? 'النوع' : 'Type'} value={nameOf(lookups?.flightTypes, flight.flightTypeId)} />
              <Field label={isAr ? 'الدرجة' : 'Class'} value={nameOf(lookups?.flightClasses, flight.flightClassId)} />
              <Field label={isAr ? 'المقعد' : 'Seat'} value={flight.seat} />
              <Field label={isAr ? 'من' : 'From'} value={findById(lookups?.airports, flight.fromAirportId)?.code} />
              <Field label={isAr ? 'إلى' : 'To'} value={findById(lookups?.airports, flight.toAirportId)?.code} />
              <Field label={isAr ? 'الإقلاع' : 'Departure'} value={fmtDateTime(flight.startTime, isAr)} />
              <Field label={isAr ? 'الوصول' : 'Arrival'} value={fmtDateTime(flight.endTime, isAr)} />
              <Field label={isAr ? 'الحالة' : 'Status'} value={flight.status} />
            </div>
          )}
        </Section>

        <Section icon="hotel" title={isAr ? 'الإقامة' : 'Accommodation'}>
          {!accommodation ? (
            <Empty>{isAr ? 'لا يوجد حجز إقامة' : 'No accommodation booked'}</Empty>
          ) : (
            <div style={fieldGrid}>
              <Field label={isAr ? 'الفندق' : 'Hotel'} value={findById(lookups?.hotels, accommodation.hotelId)?.name} />
              <Field label={isAr ? 'نوع الغرفة' : 'Room Type'} value={nameOf(lookups?.roomTypes, accommodation.roomTypeId)} />
              <Field label={isAr ? 'تسجيل الوصول' : 'Check-in'} value={fmtDate(accommodation.checkIn, isAr)} />
              <Field label={isAr ? 'تسجيل المغادرة' : 'Check-out'} value={fmtDate(accommodation.checkOut, isAr)} />
            </div>
          )}
        </Section>

        <Section icon="car" title={isAr ? 'النقل' : 'Transport'}>
          {!transport ? (
            <Empty>{isAr ? 'لا يوجد حجز نقل' : 'No transport booked'}</Empty>
          ) : (
            <div style={fieldGrid}>
              <Field label={isAr ? 'المركبة' : 'Vehicle'} value={transport.vehicleId ? vehicleLabel(findById(lookups?.vehicles, transport.vehicleId) || {}) : null} />
              <Field label={isAr ? 'السائق' : 'Driver'} value={transport.driverId ? driverLabel(findById(lookups?.drivers, transport.driverId) || {}) : null} />
              <Field label={isAr ? 'الاستلام' : 'Pickup'} value={findById(lookups?.locations, transport.pickupLocationId)?.address} />
              <Field label={isAr ? 'التوصيل' : 'Dropoff'} value={findById(lookups?.locations, transport.dropoffLocationId)?.address} />
              <Field label={isAr ? 'وقت الاستلام' : 'Pickup Time'} value={fmtDateTime(transport.pickupTime, isAr)} />
              <Field label={isAr ? 'الحالة' : 'Status'} value={transport.tripStatus} />
            </div>
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
