import React, { useEffect, useState } from 'react';
import { Icon } from '../components/Icons';
import toast from '../lib/toast';
import { getInvitation, respondToInvitation } from '../api/services/invitationService';

// Standalone, no-login page shown to a guest who clicks the "View invitation"
// link in their email (?screen=invitation&token=...). Renders outside the auth
// gate — see main.jsx.
export default function InvitationResponseView({ token, lang }) {
  const isAr = lang === 'ar';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [invite, setInvite] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const T = isAr ? {
    loading: 'جارٍ التحميل…',
    invalid: 'رابط الدعوة غير صالح أو منتهي الصلاحية.',
    youreInvited: 'أنت مدعو',
    tier: 'الفئة',
    venue: 'المكان',
    dates: 'التواريخ',
    accept: 'قبول الدعوة',
    reject: 'رفض الدعوة',
    accepted: 'شكراً لك! تم تأكيد حضورك.',
    declined: 'تم تسجيل اعتذارك. شكراً لإعلامنا.',
    respondedAccepted: 'لقد قبلت هذه الدعوة بالفعل.',
    respondedDeclined: 'لقد رفضت هذه الدعوة بالفعل.',
    errGeneric: 'حدث خطأ. حاول مرة أخرى.',
  } : {
    loading: 'Loading…',
    invalid: 'This invitation link is invalid or has expired.',
    youreInvited: "You're invited",
    tier: 'Tier',
    venue: 'Venue',
    dates: 'Dates',
    accept: 'Accept Invitation',
    reject: 'Decline Invitation',
    accepted: 'Thank you! Your attendance is confirmed.',
    declined: 'Your regrets have been recorded. Thank you for letting us know.',
    respondedAccepted: 'You have already accepted this invitation.',
    respondedDeclined: 'You have already declined this invitation.',
    errGeneric: 'Something went wrong. Please try again.',
  };

  useEffect(() => {
    if (!token) { setError(T.invalid); setLoading(false); return; }
    let cancelled = false;
    getInvitation(token)
      .then(res => { if (!cancelled) setInvite(res); })
      .catch(() => { if (!cancelled) setError(T.invalid); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  async function respond(accept) {
    setSubmitting(true);
    try {
      const res = await respondToInvitation(token, accept);
      setInvite(res);
    } catch (err) {
      toast.error(err?.message || T.errGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  const fmtDates = () => {
    if (!invite?.eventStartDate) return '—';
    const s = invite.eventStartDate;
    const e = invite.eventEndDate;
    return e && e !== s ? `${s} → ${e}` : s;
  };

  const status = invite?.invitationStatus;
  const responded = invite?.alreadyResponded;

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center',
      padding: 20, background: 'var(--bg-1, #0a1c24)',
      fontFamily: 'var(--sans, system-ui, sans-serif)', color: 'var(--ink, #e6f0f3)',
    }}>
      <div style={{
        width: 460, maxWidth: '94vw',
        background: 'var(--glass-bg, rgba(10,28,36,0.92))',
        border: '1px solid var(--glass-border, rgba(255,255,255,0.08))',
        borderRadius: 16, padding: '32px 30px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {loading && (
          <div style={{ textAlign: 'center', color: 'var(--ink-mute)', padding: '30px 0' }}>{T.loading}</div>
        )}

        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--danger-bg)', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              <Icon name="close" size={22} style={{ color: 'var(--danger)' }} />
            </div>
            <div style={{ fontSize: 15, color: 'var(--ink-dim)' }}>{error}</div>
          </div>
        )}

        {!loading && !error && invite && (
          <>
            {/* Event header */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>
                {T.youreInvited}
              </div>
              <h1 style={{ fontFamily: 'var(--serif, Georgia, serif)', fontSize: 26, fontWeight: 400, margin: '0 0 6px', lineHeight: 1.25 }}>
                {invite.eventTitle || '—'}
              </h1>
              <div style={{ fontSize: 14, color: 'var(--ink-dim)' }}>{invite.guestName}</div>
            </div>

            {/* Details */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--glass-border)', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
              {[
                [T.venue, invite.eventVenue || '—'],
                [T.dates, fmtDates()],
                [T.tier, invite.tier || '—'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 16px', background: 'var(--surface-soft-2)' }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
                  <span style={{ fontSize: 13, textAlign: isAr ? 'left' : 'right', textTransform: label === T.tier ? 'capitalize' : 'none' }}>{val}</span>
                </div>
              ))}
            </div>

            {/* Actions / confirmation */}
            {responded ? (
              <div style={{
                textAlign: 'center', padding: '18px 16px', borderRadius: 12,
                background: status === 'accepted' ? 'rgba(90,191,110,0.12)' : 'var(--danger-bg)',
                border: `1px solid ${status === 'accepted' ? 'rgba(90,191,110,0.35)' : 'var(--danger-bg)'}`,
              }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 12px',
                  background: status === 'accepted' ? 'rgba(90,191,110,0.2)' : 'var(--danger-bg)' }}>
                  <Icon name={status === 'accepted' ? 'check' : 'close'} size={22} style={{ color: status === 'accepted' ? '#5abf6e' : 'var(--danger)' }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {status === 'accepted' ? T.accepted : T.declined}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => respond(true)}
                  disabled={submitting}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'var(--accent, #8d0134)', color: '#fff', fontSize: 15, fontWeight: 600,
                    opacity: submitting ? 0.6 : 1,
                  }}>
                  {T.accept}
                </button>
                <button
                  onClick={() => respond(false)}
                  disabled={submitting}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 10, cursor: 'pointer',
                    background: 'transparent', color: 'var(--ink-dim)', fontSize: 15, fontWeight: 500,
                    border: '1px solid var(--glass-border)', opacity: submitting ? 0.6 : 1,
                  }}>
                  {T.reject}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
