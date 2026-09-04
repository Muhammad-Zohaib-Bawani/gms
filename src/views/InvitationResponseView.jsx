import React, { useEffect, useState } from 'react';
import { Icon } from '../components/Icons';
import toast from '../lib/toast';
import { fmtDate } from '../lib/date';
import { getInvitation, respondToInvitation } from '../api/services/invitationService';
import { brandTint } from '../lib/brandColor';

// Standalone, no-login page shown to a guest who clicks the "View invitation"
// link in their email (?screen=invitation&token=...). Renders outside the auth
// gate — see main.jsx.
export default function InvitationResponseView({ token, lang }) {
  const isAr = lang === 'ar';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState(null);
  const [submitting, setSubmitting] = useState(null); // 'accept' | 'decline' | null

  const T = isAr ? {
    loading: 'جارٍ التحميل…',
    invalid: 'رابط الدعوة غير صالح أو منتهي الصلاحية.',
    youreInvited: 'أنت مدعو',
    venue: 'المكان',
    dates: 'تواريخ الفعالية',
    arrival: 'الوصول',
    departure: 'المغادرة',
    servicesTitle: 'سيتم تزويدك بالخدمات التالية',
    servicesHint: 'سيتولى فريقنا الترتيبات؛ التفاصيل الكاملة متاحة بعد قبول الدعوة عبر تطبيق كبار المندوبين.',
    accept: 'قبول الدعوة',
    reject: 'رفض الدعوة',
    accepted: 'رائع! تم تأكيد حضورك.',
    acceptedSub: ' سيتواصل معك فريق التنسيق قريباً بكل التفاصيل',
    declined: 'تم تسجيل اعتذارك. شكراً لإعلامنا.',
    respondedAccepted: 'لقد قبلت هذه الدعوة بالفعل.',
    respondedDeclined: 'لقد رفضت هذه الدعوة بالفعل.',
    errGeneric: 'حدث خطأ. حاول مرة أخرى.',
    appTitle:'نزّل تطبيق كبار المندوبين',
    appBody: 'تفاصيل رحلتك، الفندق، ووسيلة التنقل ستكون جاهزة في تطبيق كبار المندوبين قبل الفعالية. نزّله الآن ليكون كل شيء في متناول يدك فور وصولك.',
    appStore: 'App Store',
    playStore: 'Google Play',
  } : {
    loading: 'Loading…',
    invalid: 'This invitation link is invalid or has expired.',
    youreInvited: "You're invited",
    venue: 'Venue',
    dates: 'Event dates',
    arrival: 'Arrival',
    departure: 'Departure',
    servicesTitle: "You'll be facilitated with the following services",
    servicesHint: 'Our team takes care of the arrangements — full details appear in the VIP Delegate App once you accept.',
    accept: 'Accept Invitation',
    reject: 'Decline Invitation',
    accepted: 'your attendance is confirmed.',
    acceptedSub: "We can't wait to host you. Our team will be in touch with the finer details soon.",
    declined: 'Your regrets have been recorded. Thank you for letting us know.',
    respondedAccepted: 'You have already accepted this invitation.',
    respondedDeclined: 'You have already declined this invitation.',
    errGeneric: 'Something went wrong. Please try again.',
    appTitle: "Get the VIP Delegate App",
    appBody: "Your flight, hotel and transport details will be ready in the VIP Delegate App ahead of the event. Download it now so everything is one tap away the moment you land.",
    appStore: 'App Store',
    playStore: 'Google Play',
  };

  useEffect(() => {
    if (!token) { setError(T.invalid); setLoading(false); return; }
    let cancelled = false;
    getInvitation(token)
      .then(res => { if (!cancelled) setInvite(res); })
      .catch(() => { if (!cancelled) setError(T.invalid); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function respond(accept) {
    setSubmitting(accept ? 'accept' : 'decline');
    try {
      const res = await respondToInvitation(token, accept);
      setInvite(res);
    } catch (err) {
      toast.error(err?.message || T.errGeneric);
    } finally {
      setSubmitting(null);
    }
  }

  const fmtDates = () => {
    if (!invite?.eventStartDate) return null;
    const s = invite.eventStartDate;
    const e = invite.eventEndDate;
    return e && e !== s ? `${fmtDate(s)} → ${fmtDate(e)}` : fmtDate(s);
  };

  const status = invite?.invitationStatus;
  const responded = invite?.alreadyResponded;
  const initials = ((invite?.guestName || '').trim().split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('') || '?').toUpperCase();

  const detailRows = invite ? [
    [T.venue, invite.eventVenue],
    [T.dates, fmtDates()],
    [T.arrival, invite.arrivalDate ? fmtDate(invite.arrivalDate) : null],
    [T.departure, invite.departureDate ? fmtDate(invite.departureDate) : null],
  ].filter(([, v]) => v) : [];

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '0 16px 40px', background: 'var(--bg-0, #f3eceb)',
      fontFamily: 'var(--sans, system-ui, sans-serif)', color: 'var(--ink, #23161a)',
    }}>
      {/* Branded hero band */}
      <div style={{
        width: '100%', maxWidth: 560, marginTop: 0,
        background: 'var(--brand-gradient)',
        borderRadius: '0 0 24px 24px', padding: '38px 30px 46px',
        textAlign: 'center', color: '#fff', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.12, backgroundSize: '140px',
          backgroundImage: 'radial-gradient(circle at 20% 30%, #fff 0, transparent 45%), radial-gradient(circle at 80% 70%, #fff 0, transparent 45%)',
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', opacity: 0.85, marginBottom: 12 }}>
            {T.youreInvited}
          </div>
          {loading ? (
            <div style={{ fontSize: 15, opacity: 0.85 }}>{T.loading}</div>
          ) : error ? (
            <div style={{ fontSize: 16 }}>{error}</div>
          ) : invite ? (
            <>
              <h1 style={{ fontFamily: 'var(--serif, Georgia, serif)', fontSize: 28, fontWeight: 400, margin: '0 0 6px', lineHeight: 1.25 }}>
                {invite.eventTitle || '—'}
              </h1>
              {fmtDates() && (
                <div style={{ fontSize: 13, opacity: 0.85, fontFamily: 'var(--mono, monospace)' }}>{fmtDates()}</div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {!loading && !error && invite && (
        <div style={{ width: '100%', maxWidth: 460, marginTop: -26, position: 'relative' }}>
          {/* Guest profile card */}
          <div style={{
            background: 'var(--surface-1, #fff)', borderRadius: 16, padding: '20px 22px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.12)', marginBottom: 16,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            {invite.guestPhotoUrl ? (
              <img src={invite.guestPhotoUrl} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 56, height: 56, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
                background: 'var(--brand-gradient)', color: '#fff', fontSize: 20, fontWeight: 600,
              }}>
                {initials}
              </div>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 650, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {invite.guestName}
              </div>
              {invite.guestEmail && (
                <div style={{ fontSize: 12.5, color: 'var(--ink-mute, #8a7377)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {invite.guestEmail}
                </div>
              )}
              {invite.organization && (
                <div style={{ fontSize: 12, color: 'var(--ink-faint, #a99699)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {invite.organization}
                </div>
              )}
            </div>
            {(invite.serviceLevelName || invite.tier) && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '4px 11px', borderRadius: 20, flexShrink: 0,
                color: invite.serviceLevelColor || 'var(--accent)',
                background: (invite.serviceLevelColor ? `${invite.serviceLevelColor}1f` : brandTint(0.12)),
                border: `1px solid ${invite.serviceLevelColor ? `${invite.serviceLevelColor}55` : brandTint(0.33)}`,
                textTransform: 'capitalize',
              }}>
                {(isAr ? invite.serviceLevelNameAr : null) || invite.serviceLevelName || invite.tier}
              </span>
            )}
          </div>

          {/* Details */}
          {detailRows.length > 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--glass-border, #eee)',
              borderRadius: 14, overflow: 'hidden', marginBottom: 16,
            }}>
              {detailRows.map(([label, val]) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 16px',
                  background: 'var(--surface-1, #fff)',
                }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-mute, #8a7377)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, textAlign: isAr ? 'left' : 'right' }}>{val}</span>
                </div>
              ))}
            </div>
          )}

          {/* Services — names only, no field detail */}
          {invite.services?.length > 0 && (
            <div style={{
              background: 'var(--surface-1, #fff)', borderRadius: 14, padding: '16px 18px', marginBottom: 20,
            }}>
              <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 4 }}>{T.servicesTitle}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-mute, #8a7377)', marginBottom: 12 }}>{T.servicesHint}</div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {invite.services.map((s, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500,
                    padding: '6px 12px', borderRadius: 20, background: 'hsl(var(--brand-hsl) / 0.08)',
                    border: '1px solid hsl(var(--brand-hsl) / 0.18)', color: 'hsl(var(--brand-h) 96% 20.2%)',
                  }}>
                    {s.icon && <Icon name={s.icon} size={12} />}
                    {(isAr ? s.nameAr : null) || s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions / confirmation */}
          {responded ? (
            <>
              <div style={{
                textAlign: 'center', padding: '22px 18px', borderRadius: 14,
                background: status === 'accepted' ? 'rgba(90,191,110,0.1)' : 'rgba(224,80,80,0.08)',
                border: `1px solid ${status === 'accepted' ? 'rgba(90,191,110,0.3)' : 'rgba(224,80,80,0.25)'}`,
                marginBottom: status === 'accepted' ? 20 : 0,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 12px',
                  background: status === 'accepted' ? 'rgba(90,191,110,0.18)' : 'rgba(224,80,80,0.15)',
                }}>
                  <Icon name={status === 'accepted' ? 'check' : 'close'} size={22} style={{ color: status === 'accepted' ? '#3f9e57' : '#c94040' }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 650, marginBottom: status === 'accepted' ? 5 : 0 }}>
                  {status === 'accepted' ? T.accepted : T.declined}
                </div>
                {status === 'accepted' && (
                  <div style={{ fontSize: 12.5, color: 'var(--ink-mute, #8a7377)' }}>{T.acceptedSub}</div>
                )}
              </div>

              {status === 'accepted' && <AppDownloadCard isAr={isAr} T={T} />}
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 4 }}>
              <button
                onClick={() => respond(true)}
                disabled={!!submitting}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer',
                  background: 'var(--accent)', color: '#fff', fontSize: 15, fontWeight: 650,
                  opacity: submitting ? 0.6 : 1, boxShadow: '0 8px 20px hsl(var(--brand-hsl) / 0.25)',
                }}>
                {submitting === 'accept' ? '…' : T.accept}
              </button>
              <button
                onClick={() => respond(false)}
                disabled={!!submitting}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, cursor: 'pointer',
                  background: '#dedede', color: 'var(--ink-dim, #55444a)', fontSize: 14.5, fontWeight: 500,
                  border: '1px solid var(--glass-border, #ddd)', opacity: submitting ? 0.6 : 1,
                }}>
                {submitting === 'decline' ? '…' : T.reject}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Shown once the guest accepts — the VIP Guest App is where their actual
// flight/hotel/transport bookings live, not this page (see docs/business-flows.md,
// "guest-facing VIP App"). Store links are placeholders until the app is
// published — swap the hrefs in once it's live on both stores.
function AppDownloadCard({ isAr, T }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #23161a, hsl(var(--brand-h) 59% 14.3%))', color: '#fff',
      borderRadius: 16, padding: '22px 20px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 14.5, fontWeight: 650, marginBottom: 6 }}>{T.appTitle}</div>
      <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginBottom: 18 }}>
        {T.appBody}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
        <StoreBadge kind="apple" label={T.appStore} />
        <StoreBadge kind="google" label={T.playStore} />
      </div>
    </div>
  );
}

function StoreBadge({ kind, label }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px',
      borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)',
      cursor: 'default', minWidth: 140, justifyContent: 'center',
    }}>
      {kind === 'apple' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff">
          <path d="M16.365 1.43c0 1.14-.42 2.06-1.26 2.87-.9.87-1.94 1.36-3.03 1.27-.05-1.09.42-2.13 1.24-2.9.86-.83 1.98-1.36 3.05-1.24zM20.6 17.06c-.34.77-.75 1.48-1.24 2.16-.68.94-1.24 1.6-1.68 1.96-.68.6-1.4.9-2.17.92-.55.02-1.22-.16-1.99-.5-.77-.35-1.48-.52-2.13-.52-.68 0-1.4.17-2.16.52-.76.34-1.38.52-1.85.53-.75.03-1.48-.28-2.19-.94-.47-.42-1.06-1.12-1.77-2.1-.76-1.06-1.39-2.29-1.88-3.71-.53-1.54-.8-3.02-.8-4.46 0-1.65.36-3.07 1.07-4.26.56-.95 1.3-1.7 2.23-2.25.93-.55 1.93-.84 3.01-.86.5 0 1.16.15 2 .46.83.31 1.36.47 1.6.47.18 0 .68-.18 1.5-.53.79-.32 1.45-.46 2-.41 1.48.12 2.6.71 3.35 1.78-1.32.8-1.98 1.93-1.98 3.38 0 1.14.42 2.08 1.26 2.83.4.36.85.63 1.36.83-.11.31-.22.6-.35.89z"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M4.5 2.7c-.4.4-.6.9-.6 1.6v15.4c0 .7.2 1.2.6 1.6l.1.1L13 12.4v-.2L4.6 2.6l-.1.1z" fill="#00d3ff"/>
          <path d="M16.1 15.5 13 12.4v-.2l3.1-3.1 6.9 3.9c.6.3.6.9 0 1.2z" fill="#ff3a44"/>
          <path d="M13 12.2l3.1 3.1-6.9 3.9c-.6.3-1.1.2-1.4-.1z" fill="#00e277"/>
          <path d="M13 12.2 4.6 2.7c.3-.3.8-.4 1.4-.1l7 3.9z" fill="#ffbd00"/>
        </svg>
      )}
      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</span>
    </div>
  );
}
