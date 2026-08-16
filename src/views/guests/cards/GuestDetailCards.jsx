// Guest-detail card system.
//
// One card family for everything a guest's detail screen shows — a session,
// a hotel stay, a ride, a flight, a dynamic service. `GuestCard` owns every
// shared decision (surface, hairline, radius, padding, dividers, type scale,
// status pills); each variant below owns only its own composition. That split
// is the point: adding a sixth service type should mean writing a body, not
// inventing a sixth card style.
//
// Colours come from the app's own tokens — --gc-accent / --gc-border (see the
// guest-detail block in styles/qoc-revamp.css), --ink*, --bg-1, --glass-border
// and the existing .chip status classes. Nothing here hardcodes a colour, so
// the cards follow the light/dark toggle like the rest of the portal.
//
// Mobile-first: no fixed widths anywhere, every text node can shrink
// (minWidth: 0) and long titles clamp rather than widening the card.
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '../../../components/Icons';
import { prefersReducedMotion } from '../../../lib/clickOrigin';
import { Skeleton } from '../../../components/ds';

// ── Type scale ────────────────────────────────────────────────────────────
// The whole family reads off this. Sizes are deliberately few: one headline,
// one sub, one label, one value — hierarchy comes from weight and colour, not
// from a new size per card.
export const TYPE = {
  headline:  { fontSize: 17, fontWeight: 700, lineHeight: 1.25, color: 'var(--ink)' },
  title:     { fontSize: 14.5, fontWeight: 700, lineHeight: 1.3, color: 'var(--ink)' },
  sub:       { fontSize: 12.5, fontWeight: 400, lineHeight: 1.45, color: 'var(--ink-mute)' },
  label:     {
    fontSize: 9.5, fontWeight: 600, lineHeight: 1.4, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'var(--ink-mute)',
  },
  value:     { fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, color: 'var(--ink)' },
  accent:    { fontSize: 13.5, fontWeight: 600, lineHeight: 1.35, color: 'var(--gc-accent)' },
  code:      { fontSize: 25, fontWeight: 800, lineHeight: 1, letterSpacing: '0.01em', color: 'var(--ink)' },
};

const ICON_SIZE = 13;     // metadata icons — never bigger than the text beside them
const FEATURE_ICON = 19;  // the one icon that identifies the card's subject

const clamp = (lines) => ({
  display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical',
  overflow: 'hidden', overflowWrap: 'anywhere',
});
const truncate = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

// ── Foundation ────────────────────────────────────────────────────────────

/**
 * The container every guest-detail card is built on. Owns the surface, the
 * hairline accent border, the radius and the padding — a variant never sets
 * any of those itself.
 *
 * `embedded` drops the fill (the split view's right pane is already a surface,
 * so a second opaque panel on top of it reads as a patch); the border stays,
 * so the cards are still legible as separate boxes either way.
 */
export function GuestCard({ children, embedded = false, style }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', gap: 12,
        width: '100%', height: '100%', minWidth: 0, boxSizing: 'border-box',
        padding: '15px 16px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--gc-border)',
        background: embedded ? 'transparent' : 'var(--bg-1)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * The card's bottom rail — pager, Add button, anything that acts on the card
 * as a whole. `marginTop: auto` pins it to the bottom edge, so the Add buttons
 * across a row of cards line up however much content sits above each of them.
 */
export function CardFooter({ children }) {
  if (!children) return null;
  return (
    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {children}
    </div>
  );
}

/** Hairline rule between a card's sections. One style, used by all of them. */
export function CardDivider({ style }) {
  return <div style={{ height: 1, background: 'var(--glass-border)', ...style }} />;
}

/** Small uppercase caption above a value. */
export function CardLabel({ children, style }) {
  return <div style={{ ...TYPE.label, ...style }}>{children}</div>;
}

/** One line of supporting metadata: a line icon, then muted text. */
export function CardMeta({ icon, children, style }) {
  if (children == null || children === '') return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, ...style }}>
      {icon && (
        <Icon name={icon} size={ICON_SIZE} style={{ color: 'var(--ink-mute)', flexShrink: 0 }} />
      )}
      <span style={{ ...TYPE.sub, ...truncate }}>{children}</span>
    </div>
  );
}

/**
 * A labelled value — the unit the hotel/flight information grids are built
 * from. `align: 'end'` is what keeps a right-hand column properly aligned
 * instead of ragged.
 */
export function FieldPair({ label, value, align = 'start', tone = 'default' }) {
  const valueStyle = tone === 'accent' ? TYPE.accent : TYPE.value;
  return (
    <div style={{ minWidth: 0, textAlign: align === 'end' ? 'end' : 'start' }}>
      <CardLabel style={{ marginBottom: 4 }}>{label}</CardLabel>
      <div style={{ ...valueStyle, ...(tone === 'status' ? { color: 'var(--gc-accent)' } : null), overflowWrap: 'anywhere' }}>
        {value || <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>—</span>}
      </div>
    </div>
  );
}

// Status words the API uses → the portal's existing chip tones, so a pill here
// is the same pill as everywhere else in the app.
const STATUS_TONE = {
  confirmed: 'confirmed', completed: 'confirmed', issued: 'confirmed', accepted: 'confirmed',
  active: 'confirmed', arrived: 'confirmed', ontime: 'confirmed', 'on-time': 'confirmed',
  pending: 'pending', new: 'pending', assigned: 'pending', 'in-progress': 'pending',
  'in-transit': 'pending', draft: 'draft', locked: 'draft',
  cancelled: 'cancelled', declined: 'cancelled', rejected: 'cancelled',
};

export function statusTone(status) {
  return STATUS_TONE[String(status || '').toLowerCase()] || 'draft';
}

/** Compact status pill. Semantic colour, never the brand accent. */
export function StatusPill({ status, label, icon }) {
  if (!status && !label) return null;
  return (
    <span className={`chip ${statusTone(status)}`} style={{ fontSize: 10.5, flexShrink: 0 }}>
      {icon ? <Icon name={icon} size={10} /> : <span className="dot" />}
      {label || status}
    </span>
  );
}

/**
 * The card's top line: subject icon, title, and whatever the caller needs on
 * the right (a status pill, an edit button). Optional — the hotel and flight
 * cards lead with their own primary information instead.
 */
export function CardHeader({ icon, title, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
      {icon && <Icon name={icon} size={15} style={{ color: 'var(--gc-accent)', flexShrink: 0 }} />}
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', ...truncate, flex: 1, minWidth: 0 }}>
        {title}
      </span>
      {children}
    </div>
  );
}

/** Journey marker. Used by the transport rail and both ends of a flight route. */
function Dot({ color = 'var(--gc-accent)', size = 7 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      background: color, flexShrink: 0,
    }} />
  );
}

function Empty({ children }) {
  return (
    <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', textAlign: 'center', padding: '6px 0' }}>
      {children}
    </div>
  );
}

/**
 * One item at a time, with a pager beneath it — how every card here handles a
 * guest holding several of the same thing (three sessions, a second flight,
 * two seats). Stacking them instead would turn a card into a scroll wall and
 * break the equal-height grid.
 *
 * Renders through its child so the whole CARD belongs to the current item, not
 * just its body: `children(item, pager)` gets the pager to drop in a footer.
 */
export function CardSlider({ items = [], children }) {
  const [idx, setIdx] = useState(0);
  const count = items.length;
  if (count === 0) return null;
  const safe = idx < count ? idx : 0;

  const step = (d) => setIdx((i) => ((i < count ? i : 0) + d + count) % count);
  const pager = count > 1 ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
      <button type="button" className="icon-btn" style={{ width: 24, height: 24, flexShrink: 0 }}
        aria-label="Previous" onClick={() => step(-1)}>
        <Icon name="arrowLeft" size={11} />
      </button>
      <span style={{ fontSize: 11, color: 'var(--ink-mute)', minWidth: 30, textAlign: 'center' }}>
        {safe + 1}/{count}
      </span>
      <button type="button" className="icon-btn" style={{ width: 24, height: 24, flexShrink: 0 }}
        aria-label="Next" onClick={() => step(1)}>
        <Icon name="arrow" size={11} />
      </button>
    </div>
  ) : null;

  // Keyed fade so stepping between items reads as a change of content rather
  // than a snap. Deliberately short — this is a pager, not a carousel.
  return (
    <motion.div
      key={safe}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      style={{ display: 'flex', height: '100%', minWidth: 0 }}
    >
      {children(items[safe], pager)}
    </motion.div>
  );
}

/**
 * Placeholder for the whole detail screen while it loads. Built on the same
 * shell and the same grid the real cards land in, so the page doesn't jump
 * when the data arrives — the point of a skeleton is that the layout is
 * already correct before there's anything to put in it.
 */
export function GuestDetailSkeleton({ embedded, lang }) {
  const isAr = lang === 'ar';
  const card = (fields, key) => (
    <GuestCard key={key} embedded={embedded}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <Skeleton w={15} h={15} r={4} />
        <Skeleton w="44%" h={12} />
      </div>
      <CardDivider />
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))',
        gap: '13px 12px',
      }}>
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i}>
            <Skeleton w="54%" h={8} style={{ marginBottom: 6 }} />
            <Skeleton w="80%" h={13} />
          </div>
        ))}
      </div>
    </GuestCard>
  );

  return (
    <div role="status" aria-busy="true" aria-label={isAr ? 'جارٍ التحميل' : 'Loading guest'}>
      {/* Only the standalone page shows the identity header — see GuestDetailView. */}
      {!embedded && (
        <GuestCard style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', minWidth: 0 }}>
            <Skeleton w={64} h={64} r="50%" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Skeleton w="46%" h={18} />
              <Skeleton w="30%" h={12} style={{ marginTop: 8 }} />
              <Skeleton w={92} h={20} r={999} style={{ marginTop: 10 }} />
            </div>
          </div>
        </GuestCard>
      )}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16,
      }}>
        {[6, 2, 2, 4, 4].map((n, i) => card(n, i))}
      </div>
    </div>
  );
}

// ── Variants ──────────────────────────────────────────────────────────────
// Each one renders header → its own body → footer inside the shared shell.

/**
 * Session: an icon tile, a category, then the session title with its date and
 * place underneath. The title is the card's primary information, so it clamps
 * to two lines rather than being allowed to stretch the layout.
 */
export function SessionCard({
  title, category, dateLabel, timeLabel, venue,
  lang, header, footer, embedded, style,
}) {
  const isAr = lang === 'ar';
  const when = [dateLabel, timeLabel].filter(Boolean).join(', ');
  return (
    <GuestCard embedded={embedded} style={style}>
      {header}
      <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start', minWidth: 0 }}>
        <div style={{
          width: 46, height: 46, flexShrink: 0, borderRadius: 14,
          border: '1px solid var(--gc-border)', display: 'grid', placeItems: 'center',
        }}>
          <Icon name="venue" size={FEATURE_ICON} style={{ color: 'var(--gc-accent)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {category && (
            <span className="chip brand" style={{ fontSize: 10.5, alignSelf: 'flex-start' }}>
              {category}
            </span>
          )}
          <div style={{ ...TYPE.title, ...clamp(2) }}>
            {title || (isAr ? 'جلسة' : 'Session')}
          </div>
          <CardMeta icon="calendar">{when}</CardMeta>
          <CardMeta icon="mapPin">{venue}</CardMeta>
        </div>
      </div>
      <CardFooter>{footer}</CardFooter>
    </GuestCard>
  );
}

/**
 * Seat: the seat code is the whole point of the card, so it gets headline
 * weight beside a seat glyph; the event and session it belongs to support it.
 * `onOpen` makes the card itself the way through to the seating plan.
 */
export function SeatCard({
  seatCode, eventTitle, sessionTitle, onOpen,
  lang, header, footer, embedded, style,
}) {
  const isAr = lang === 'ar';
  const interactive = typeof onOpen === 'function';
  return (
    <GuestCard embedded={embedded} style={style}>
      {header}
      <div
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onClick={onOpen}
        onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } } : undefined}
        style={{
          display: 'flex', gap: 13, alignItems: 'center', minWidth: 0,
          cursor: interactive ? 'pointer' : 'default',
        }}
      >
        <div style={{
          width: 46, height: 46, flexShrink: 0, borderRadius: 14,
          border: '1px solid var(--gc-border)', display: 'grid', placeItems: 'center',
        }}>
          <Icon name="seating" size={FEATURE_ICON} style={{ color: 'var(--gc-accent)' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <CardLabel style={{ marginBottom: 3 }}>{isAr ? 'المقعد' : 'Seat'}</CardLabel>
          <div style={{ ...TYPE.headline, ...truncate }}>
            {seatCode || <span style={{ color: 'var(--ink-faint)' }}>—</span>}
          </div>
        </div>
        {interactive && (
          <Icon name="chevronRight" size={14} style={{
            color: 'var(--ink-faint)', flexShrink: 0,
            transform: isAr ? 'scaleX(-1)' : 'none',
          }} />
        )}
      </div>
      {(eventTitle || sessionTitle) && (
        <>
          <CardDivider />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
            <CardMeta icon="calendar">{eventTitle}</CardMeta>
            <CardMeta icon="venue">{sessionTitle}</CardMeta>
          </div>
        </>
      )}
      <CardFooter>{footer}</CardFooter>
    </GuestCard>
  );
}

/**
 * Hotel: the property name leads, the address supports it, and the stay window
 * sits below a rule as two aligned columns. Check-in/check-out are the values
 * a reader actually came for, so they take the accent.
 */
export function HotelCard({
  hotel, address, roomType, checkIn, checkOut, nights,
  lang, header, footer, embedded, style,
}) {
  const isAr = lang === 'ar';
  const dash = { flex: 1, minWidth: 8, height: 0, borderTop: '1px dashed var(--glass-border-strong)' };
  const nightsLabel = nights > 0
    ? (isAr ? `${nights} ليلة` : `${nights} ${nights === 1 ? 'night' : 'nights'}`)
    : null;

  return (
    <GuestCard embedded={embedded} style={style}>
      {header}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ ...TYPE.headline, ...clamp(2) }}>
          {hotel || <span style={{ color: 'var(--ink-faint)' }}>—</span>}
        </div>
        <CardMeta icon="mapPin">{address}</CardMeta>
        <CardMeta icon="doc">{roomType}</CardMeta>
      </div>
      <CardDivider />
      {/* A stay is a span, not two unrelated dates — same connector the flight
          route uses, with its length on the line. Bottom-aligned so the line
          stays level with the dates however the labels above them wrap. */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <CardLabel style={{ marginBottom: 4 }}>{isAr ? 'الوصول' : 'Check-in'}</CardLabel>
          <div style={{ ...TYPE.value, ...truncate }}>
            {checkIn || <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>—</span>}
          </div>
        </div>

        <div style={{
          flex: 1, minWidth: 34, paddingBottom: 5,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
        }}>
          {nightsLabel && (
            <span style={{ fontSize: 10, lineHeight: 1.3, color: 'var(--ink-mute)', whiteSpace: 'nowrap' }}>
              {nightsLabel}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 4 }}>
            <Dot size={5} />
            <span style={dash} />
            <Icon name="hotel" size={13} style={{ color: 'var(--gc-accent)', flexShrink: 0 }} />
            <span style={dash} />
            <Dot size={5} color="var(--accent-2)" />
          </div>
        </div>

        <div style={{ minWidth: 0, textAlign: 'end' }}>
          <CardLabel style={{ marginBottom: 4 }}>{isAr ? 'المغادرة' : 'Check-out'}</CardLabel>
          <div style={{ ...TYPE.value, ...truncate }}>
            {checkOut || <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>—</span>}
          </div>
        </div>
      </div>
      <CardFooter>{footer}</CardFooter>
    </GuestCard>
  );
}

/**
 * Transport: the journey reads top-to-bottom down a dashed rail — origin, then
 * destination — with the vehicle and its status below a rule. The rail is
 * deliberately faint; the two place names are the information, not the line.
 */
export function TransportCard({
  pickup, dropoff, pickupTime, dropoffTime,
  vehicle, plate, driver, status, statusLabel,
  lang, header, footer, embedded, style,
}) {
  const isAr = lang === 'ar';
  const stop = (name, meta, fallback) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...TYPE.value, ...clamp(2) }}>
        {name || <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>{fallback}</span>}
      </div>
      {meta && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, minWidth: 0 }}>
          <Icon name="clock" size={11.5} style={{ color: 'var(--ink-mute)', flexShrink: 0 }} />
          <span style={{ ...TYPE.sub, ...truncate }}>{meta}</span>
        </div>
      )}
    </div>
  );

  return (
    <GuestCard embedded={embedded} style={style}>
      {header}
      <div style={{ display: 'flex', gap: 11, minWidth: 0 }}>
        {/* Rail: marker, dashed connector, marker. Stretches to the stops. */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: 5, paddingBottom: 5, flexShrink: 0,
        }}>
          <Dot color="var(--gc-accent)" />
          <span style={{
            flex: 1, minHeight: 20, margin: '4px 0',
            borderInlineStart: '1px dashed var(--glass-border-strong)',
          }} />
          <Dot color="var(--accent-2)" />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {stop(pickup, pickupTime && `${isAr ? 'الاستلام' : 'Pickup'} ${pickupTime}`, isAr ? 'موقع الاستلام' : 'Pickup location')}
          {stop(dropoff, dropoffTime && `${isAr ? 'الوصول' : 'Arrival'} ${dropoffTime}`, isAr ? 'موقع التوصيل' : 'Dropoff location')}
        </div>
      </div>

      {(vehicle || driver || plate || status) && (
        <>
          <CardDivider />
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
            <Icon name="car" size={FEATURE_ICON} style={{ color: 'var(--gc-accent)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...TYPE.value, ...truncate }}>
                {[vehicle, driver].filter(Boolean).join(' · ') || (isAr ? 'لم تُسند مركبة' : 'No vehicle assigned')}
              </div>
              {plate && (
                <div style={{ ...TYPE.sub, ...truncate, marginTop: 2 }}>
                  {isAr ? 'اللوحة' : 'Plate'} {plate}
                </div>
              )}
            </div>
            <StatusPill status={status} label={statusLabel} />
          </div>
        </>
      )}
      <CardFooter>{footer}</CardFooter>
    </GuestCard>
  );
}

/**
 * Flight: airport codes at each end of a dotted route line, then the booking
 * facts as a two-by-two grid. The codes are the card's primary information and
 * carry the most visual weight on the whole screen.
 */
function FlightLeg({ leg, isAr, status, statusLabel, hideDirection }) {
  const dash = { flex: 1, minWidth: 8, height: 0, borderTop: '1px dashed var(--glass-border-strong)' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11, minWidth: 0 }}>
      {/* Only a multi-leg booking needs telling apart. Wording is the event's,
          not the airline's: the guest arrives (inbound) before they leave. */}
      {leg.direction && !hideDirection && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon
            name={leg.direction === 'inbound' ? 'planeLanding' : 'planeTakeoff'}
            size={12}
            style={{ color: 'var(--ink-mute)', flexShrink: 0 }}
          />
          <CardLabel>
            {leg.direction === 'inbound' ? (isAr ? 'قادمة' : 'Inbound') : (isAr ? 'مغادرة' : 'Outbound')}
          </CardLabel>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
        <div style={{ minWidth: 0, maxWidth: '34%' }}>
          <div style={{ ...TYPE.code, ...truncate }}>{leg.fromCode || '—'}</div>
          <div style={{ ...TYPE.sub, ...truncate, marginTop: 4 }}>{leg.fromCity}</div>
        </div>
        {/* Route line — subtle on purpose; it connects the codes, it isn't a
            map. Time in the air rides on the line itself, where the eye
            already is, rather than becoming another field in the grid. */}
        <div style={{
          flex: 1, minWidth: 34, paddingTop: 6,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
        }}>
          {leg.duration && (
            <span style={{ fontSize: 10, lineHeight: 1.3, color: 'var(--ink-mute)', whiteSpace: 'nowrap' }}>
              {leg.duration}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 4 }}>
            <Dot size={5} />
            <span style={dash} />
            <Icon
              name={leg.direction === 'inbound' ? 'planeLanding' : 'planeTakeoff'}
              size={14}
              style={{ color: 'var(--gc-accent)', flexShrink: 0 }}
            />
            <span style={dash} />
            <Dot size={5} color="var(--accent-2)" />
          </div>
        </div>
        <div style={{ minWidth: 0, maxWidth: '34%', textAlign: 'end' }}>
          <div style={{ ...TYPE.code, ...truncate }}>{leg.toCode || '—'}</div>
          <div style={{ ...TYPE.sub, ...truncate, marginTop: 4 }}>{leg.toCity}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '13px 12px' }}>
        <FieldPair label={isAr ? 'التاريخ والوقت' : 'Date & Time'} value={leg.dateTime} />
        <FieldPair label={isAr ? 'رقم الرحلة' : 'Flight Number'} value={leg.flightNumber} align="end" />
      </div>

      {/* Cabin and seat belong to the leg, not the booking — a return can fly
          out in Business and back in Economy. Muted, so the route keeps the
          weight. The booking's status rides on the same line rather than
          claiming a labelled row of its own underneath. */}
      {(leg.flightClass || status || statusLabel) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <CardMeta icon="seating" style={{ flex: 1 }}>{leg.flightClass}</CardMeta>
          <span style={{ marginInlineStart: 'auto' }}>
            <StatusPill status={status} label={statusLabel} />
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * A return booking's legs go behind small tabs — Inbound first, then Outbound.
 * One leg on screen at a time keeps a return card the same height as a one-way
 * one, and naming the two beats any pager: you pick the flight you meant
 * rather than stepping through to find it.
 */
function FlightLegStrip({ legs, isAr, status, statusLabel }) {
  const [idx, setIdx] = useState(0);
  const count = legs.length;
  const legProps = { isAr, status, statusLabel };
  const reduced = prefersReducedMotion();

  if (count === 1) return <FlightLeg leg={legs[0]} {...legProps} />;

  const safe = idx < count ? idx : 0;
  const tabLabel = (leg, i) => {
    if (leg.direction === 'inbound') return isAr ? 'قادمة' : 'Inbound';
    if (leg.direction === 'outbound') return isAr ? 'مغادرة' : 'Outbound';
    return isAr ? `الرحلة ${i + 1}` : `Leg ${i + 1}`;
  };

  return (
    <>
      {/* Portal's own segmented control, one notch smaller — a card's tabs
          shouldn't carry the weight of a page's. */}
      <div className="tabs" style={{ padding: 3, borderRadius: 10, gap: 3, alignSelf: 'flex-start', maxWidth: '100%' }}>
        {legs.map((leg, i) => {
          const on = i === safe;
          return (
            <button
              key={leg.key ?? i}
              type="button"
              className={on ? 'active' : ''}
              aria-pressed={on}
              onClick={() => setIdx(i)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 10px', borderRadius: 7, fontSize: 11.5,
                fontWeight: on ? 600 : 500, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <Icon
                name={leg.direction === 'inbound' ? 'planeLanding' : 'planeTakeoff'}
                size={12}
                style={{ color: on ? 'var(--gc-accent)' : 'var(--ink-mute)', flexShrink: 0 }}
              />
              {tabLabel(leg, i)}
            </button>
          );
        })}
      </div>

      <motion.div
        key={safe}
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        style={{ minWidth: 0 }}
      >
        {/* The tab already names the direction — repeating it above the route
            would be the same word twice, eight pixels apart. */}
        <FlightLeg leg={legs[safe]} {...legProps} hideDirection />
      </motion.div>
    </>
  );
}

export function FlightCard({
  legs = [], status, statusLabel,
  lang, header, footer, embedded, style,
}) {
  const isAr = lang === 'ar';
  return (
    <GuestCard embedded={embedded} style={style}>
      {header}
      <FlightLegStrip legs={legs} isAr={isAr} status={status} statusLabel={statusLabel} />
      <CardFooter>{footer}</CardFooter>
    </GuestCard>
  );
}

/**
 * Anything without a bespoke layout — every dynamic service from the catalogue.
 * Its form decides its fields, so the body is the same grid of labelled values
 * the other cards use, with the first field promoted to the headline.
 */
export function ServiceCard({
  primary, primaryLabel, facts = [], icon,
  lang, header, footer, embedded, emptyText, style,
}) {
  const isAr = lang === 'ar';
  return (
    <GuestCard embedded={embedded} style={style}>
      {header}
      {primary != null && primary !== '' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {icon && <Icon name={icon} size={FEATURE_ICON} style={{ color: 'var(--gc-accent)', flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            {primaryLabel && <CardLabel style={{ marginBottom: 3 }}>{primaryLabel}</CardLabel>}
            <div style={{ ...TYPE.title, ...clamp(2) }}>{primary}</div>
          </div>
        </div>
      )}
      {facts.length > 0 ? (
        <>
          {primary != null && primary !== '' && <CardDivider />}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(112px, 1fr))',
            gap: '13px 12px',
          }}>
            {facts.map(([label, value], i) => (
              <FieldPair key={`${label}-${i}`} label={label} value={value} />
            ))}
          </div>
        </>
      ) : (primary == null || primary === '') ? (
        <Empty>{emptyText || (isAr ? 'لا تفاصيل مسجلة' : 'No details recorded')}</Empty>
      ) : null}
      <CardFooter>{footer}</CardFooter>
    </GuestCard>
  );
}
