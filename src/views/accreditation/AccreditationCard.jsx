import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Icon } from '../../components/Icons';
import FlagIcon from '../../components/FlagIcon';
import { fmtDate } from '../../lib/date';
import { brandColor } from '../../lib/brandColor';

// Tier palette. The brand slot is read from styles/brand.css at call time;
// the rest are their own hues and stay put.
const tierColor = (tier) => ({
  vvip: '#e0b864', vip: '#a78bda', speaker: brandColor(),
  delegate: '#5abf6e', press: '#c0392b', observer: '#9aa0a6',
}[tier] || brandColor());

const CARD_W = 300;
const CARD_H = 490;
const HEADER_H = 158;

const faceStyle = {
  position: 'absolute',
  inset: 0,
  borderRadius: 28,
  overflow: 'hidden',
  backfaceVisibility: 'hidden',
  WebkitBackfaceVisibility: 'hidden',
  boxShadow: '0 22px 46px -14px rgba(10, 0, 20,0.32), 0 4px 14px -4px rgba(10, 0, 20,0.16)',
  display: 'flex',
  flexDirection: 'column',
  background: '#fffdfb',
  border: '1px solid rgba(20,10,20,0.06)',
}

// Punch-hole + lanyard slot — the little detail that reads "real badge"
// instead of "rounded rectangle".
function LanyardSlot() {
  return (
    <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
      <div style={{
        width: 46, height: 9, borderRadius: 6,
        background: 'rgba(255,255,255,0.30)', border: '1px solid rgba(255,255,255,0.4)',
        boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.25)',
      }}/>
    </div>
  );
}

// A dashed "tear line" with two half-circle notches biting into the card's
// edges either side — the ticket-stub cue.
function Perforation() {
  return (
    <div style={{ position: 'relative', height: 0, margin: '0 -1px' }}>
      <div style={{ position: 'absolute', left: -9, top: -9, width: 18, height: 18, borderRadius: '50%', background: 'rgba(20,10,20,0.10)' }}/>
      <div style={{ position: 'absolute', right: -9, top: -9, width: 18, height: 18, borderRadius: '50%', background: 'rgba(20,10,20,0.10)' }}/>
      <div style={{
        position: 'absolute', left: 14, right: 14, top: -1,
        borderTop: '1.5px dashed rgba(20,10,20,0.16)',
      }}/>
    </div>
  );
}

export default function AccreditationCard({ guest, event, lang, issued }) {
  const isAr = lang === 'ar';
  const [flipped, setFlipped] = useState(false);
  if (!guest) return null;

  const accent = tierColor(guest.tier);
  const initials = ((guest.firstName?.[0] || '') + (guest.lastName?.[0] || '')).toUpperCase();
  const badgeNo = (guest.id || '').replace(/-/g, '').slice(0, 10).toUpperCase();
  const eventName = event?.title || (isAr ? 'فعالية' : 'Event');
  const dateRange = [fmtDate(event?.startDate), fmtDate(event?.endDate)].filter(Boolean).join(' – ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ perspective: 1600 }}>
        <div
          onClick={() => setFlipped((f) => !f)}
          role="button"
          tabIndex={0}
          title={isAr ? 'اضغط للتقليب' : 'Tap to flip'}
          style={{
            position: 'relative',
            width: CARD_W,
            height: CARD_H,
            cursor: 'pointer',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.7s cubic-bezier(.4,.2,.2,1)',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* ── Front ── */}
          <div style={faceStyle}>
            <div style={{
              position: 'relative', height: HEADER_H, flexShrink: 0,
              background: `
                radial-gradient(120% 130% at 20% -20%, hsl(var(--brand-h) 100% 79% / 0.22), transparent 60%),
                linear-gradient(160deg, hsl(var(--brand-h) 73% 36.9%) 0%, var(--accent) 45%, hsl(var(--brand-h) 96% 21.4%) 100%)`,
              borderRadius: '28px 28px 46% 46% / 28px 28px 30px 30px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '16px 20px 22px', color: '#fff',
            }}>
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 'inherit',
                backgroundImage: 'url(/assets/qoc-bg-pattern.png)',
                backgroundSize: '220px', backgroundRepeat: 'repeat',
                opacity: 0.08, pointerEvents: 'none',
              }}/>
              <LanyardSlot/>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, marginTop: 8 }}>
                <img src="/assets/logo.svg" alt="QOC" style={{ width: 20, height: 'auto' }}/>
                <span style={{ fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                  {isAr ? 'اللجنة الأولمبية القطرية' : 'Qatar Olympic Committee'}
                </span>
              </div>

              {/* Event identity — the headline of the band, not a footnote. */}
              <div style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 7,
                marginTop: 10, padding: '5px 14px', borderRadius: 20,
                background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.28)',
                maxWidth: '100%',
              }}>
                {event?.logoLightUrl && (
                  <img src={event.logoLightUrl} alt="" style={{ height: 16, width: 'auto', maxWidth: 34, objectFit: 'contain', flexShrink: 0 }}/>
                )}
                <span style={{
                  fontSize: 12.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {eventName}
                </span>
              </div>
            </div>

            {/* Guest photo — overlaps the header/body seam, classic badge move.
                Clears the event pill above it with real room to spare. */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: -38, position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 84, height: 84, borderRadius: '50%', flexShrink: 0,
                border: '4px solid #fffdfb', boxShadow: '0 8px 18px -4px rgba(10, 0, 20,0.28)',
                overflow: 'hidden', background: '#fff',
                display: 'grid', placeItems: 'center',
              }}>
                {guest.photoUrl ? (
                  <img src={guest.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                ) : (
                  <span style={{ fontSize: 26, fontWeight: 700, color: 'var(--accent)' }}>{initials}</span>
                )}
              </div>
            </div>

            {/* Guest identity — light card, dark ink, no tier/type wording. */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '10px 20px 0', minHeight: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25, color: '#1a1420' }}>{guest.fullName}</div>
              {guest.organization && (
                <div style={{ fontSize: 12, color: 'rgba(26,20,32,0.62)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                  {guest.organization}
                </div>
              )}
              {guest.nationalityName && (
                <div style={{ fontSize: 11.5, color: 'rgba(26,20,32,0.5)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <FlagIcon code={guest.nationalityCode} size={12}/> {guest.nationalityName}
                </div>
              )}

              {/* A small QR preview, centred in the middle of the card — the
                  full-size one is on the back; this is just enough for a
                  quick glance/scan without flipping. */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                {issued ? (
                  <div style={{ background: '#fff', padding: 6, borderRadius: 10, border: '1px solid rgba(20,10,20,0.08)' }}>
                    <QRCodeSVG value={`gms://accreditation/${guest.id}`} size={72} bgColor="#ffffff" fgColor={brandColor("--brand-deep")} level="M"/>
                  </div>
                ) : (
                  <div style={{
                    width: 84, height: 84, borderRadius: 10,
                    border: '1px dashed rgba(20,10,20,0.18)', background: 'rgba(20,10,20,0.03)',
                  }}/>
                )}
              </div>

              <Perforation/>

              {/* Status strip */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '7px 0', borderRadius: 20, marginTop: 14, marginBottom: 14, width: '100%',
                background: issued ? 'rgba(90,191,110,0.12)' : 'rgba(224,196,126,0.16)',
                border: `1px solid ${issued ? 'rgba(90,191,110,0.35)' : 'rgba(224,196,126,0.4)'}`,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: issued ? '#3fa85c' : '#c99a3a', flexShrink: 0 }}/>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: issued ? '#2f8a49' : '#a17c2e' }}>
                  {issued ? (isAr ? 'معتمد' : 'Accredited') : (isAr ? 'قيد الانتظار' : 'Pending')}
                </span>
              </div>
            </div>

            <div style={{ height: 6, background: accent, flexShrink: 0 }}/>
          </div>

          {/* ── Back ── */}
          <div style={{ ...faceStyle, transform: 'rotateY(180deg)' }}>
            <div style={{
              position: 'relative', height: 56, flexShrink: 0,
              background: 'linear-gradient(160deg, hsl(var(--brand-h) 73% 36.9%) 0%, var(--accent) 45%, hsl(var(--brand-h) 96% 21.4%) 100%)',
              borderRadius: '28px 28px 0 0',
            }}>
              <LanyardSlot/>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '20px 22px' }}>
              {issued ? (
                <>
                  <div style={{
                    background: '#fff', padding: 12, borderRadius: 16,
                    border: '1px solid rgba(20,10,20,0.08)', boxShadow: '0 4px 14px -4px rgba(10, 0, 20,0.16)',
                  }}>
                    <QRCodeSVG
                      value={`gms://accreditation/${guest.id}`}
                      size={140}
                      bgColor="#ffffff"
                      fgColor={brandColor("--brand-deep")}
                      level="M"
                    />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(26,20,32,0.45)' }}>
                      {isAr ? 'رقم البطاقة' : 'Badge No.'}
                    </div>
                    <div style={{ fontSize: 15, fontFamily: 'var(--mono)', fontWeight: 600, marginTop: 3, color: '#1a1420' }}>{badgeNo}</div>
                  </div>
                  {dateRange && (
                    <div style={{ fontSize: 11.5, color: 'rgba(26,20,32,0.55)', textAlign: 'center' }}>{dateRange}</div>
                  )}
                  <div style={{
                    fontSize: 10, color: 'rgba(26,20,32,0.4)', textAlign: 'center', lineHeight: 1.5,
                    borderTop: '1px solid rgba(20,10,20,0.1)', paddingTop: 12, maxWidth: 210,
                  }}>
                    {isAr
                      ? 'هذه البطاقة ملك اللجنة الأولمبية القطرية. عند العثور عليها يرجى إعادتها إلى مكتب التسجيل.'
                      : 'Property of Qatar Olympic Committee. If found, please return to registration.'}
                  </div>
                </>
              ) : (
                // Same card, empty QR space — the badge simply hasn't been
                // issued yet, so there's nothing to scan.
                <>
                  <div style={{
                    width: 140, height: 140, borderRadius: 16, flexShrink: 0,
                    border: '1.5px dashed rgba(20,10,20,0.18)', background: 'rgba(20,10,20,0.03)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    <Icon name="badge" size={26} style={{ color: 'rgba(20,10,20,0.22)' }}/>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1420' }}>
                      {isAr ? 'لم يُصدر الاعتماد بعد' : 'Accreditation not issued yet'}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(26,20,32,0.5)', marginTop: 3, maxWidth: 210 }}>
                      {isAr
                        ? 'سيظهر رمز QR هنا بعد إصدار الاعتماد لهذا المندوب.'
                        : "This delegate's QR code will appear here once their badge is issued."}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div style={{ height: 6, background: accent, flexShrink: 0 }}/>
          </div>
        </div>
      </div>

      <button
        onClick={() => setFlipped((f) => !f)}
        style={{
          background: 'none', border: 'none', color: 'var(--ink-mute)', fontSize: 11.5,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0,
        }}
      >
        <Icon name="refresh" size={12}/>
        {isAr ? 'اضغط للتقليب' : 'Tap the card to flip'}
      </button>
    </div>
  );
}
