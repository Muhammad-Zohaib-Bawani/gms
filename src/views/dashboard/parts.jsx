// Dashboard building blocks.
//
// Split out of DashboardView so the view reads as a layout — which panel goes
// where — rather than several hundred lines of chart configuration. Every
// component here is presentational: it takes already-shaped data and renders
// it, and none of them fetch or derive business numbers.
import React from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardHead, Progress, EmptyState, fadeUpItem } from '../../components/ds';
import { Icon } from '../../components/Icons';
import { fmtDate } from '../../lib/date';

/**
 * Same markup/classes as the ds `StatCard` (`.stat-card`/`.stat-top`/
 * `.stat-label`/`.stat-icon`/`.stat-value`), so it sits flush next to plain
 * StatCards, extended with a couple of breakdown sublines underneath — a bare
 * number+label KPI tile reads as empty at a glance; a "Confirmed 5 · Pending
 * 4" style breakdown (same idea used throughout the rest of the dashboard's
 * panels) fills that without needing a chart. `lines` is
 * `[{ label, value, tint? }]`.
 */
export function StatCardBreakdown({ label, value, icon, tint = 'var(--accent)', lines }) {
  return (
    <motion.div className="stat-card" {...fadeUpItem}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && (
          <span className="stat-icon" style={{ background: `${tint}14`, color: tint }}>
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {lines?.length > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 4, marginTop: 10,
          paddingTop: 9, borderTop: '1px solid var(--glass-border)',
        }}>
          {lines.map((l) => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11.5 }}>
              <span style={{ color: 'var(--ink-mute)' }}>{l.label}</span>
              <span style={{ fontWeight: 600, color: l.tint || 'var(--ink-dim)' }}>{l.value}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// Local tab strip — same `.tabs`/`.tab` classes as the ds `Tabs` component,
// just without its "cards live above the tabs" assumption: these switch
// what a single already-open Card shows, so they render tighter, right
// under the card's own header.
function PanelTabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" style={{ margin: '2px 0 8px', minHeight: 0 }}>
      {tabs.map((t) => (
        <button key={t.value} type="button"
          className={`tab${active === t.value ? ' active' : ''}`}
          style={{ padding: '4px 10px', fontSize: 11.5 }}
          onClick={() => onChange(t.value)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// The categorical series slots, assigned in order and never cycled. Values live
// in styles/qoc-revamp.css as --series-1..7 so each theme gets its own validated
// step rather than one hex list forced onto both surfaces — the old array was a
// single set of literals and repeated itself (#5ABF6E/#5abf6e and
// #DFB764/#e0b864 were the same two colours twice), so a 5-slice chart drew two
// pairs of identical wedges.
export const CHART_COLORS = ['#8d0134', '#DFB764', '#5ABF6E', '#a78bda', '#5abf6e', '#e0b864', '#8fa3b8'];

/** Themed recharts tooltip — the library default is a white box that breaks in dark mode. */
export function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--popover-bg)', border: '1px solid var(--glass-border)',
      borderRadius: 10, padding: '9px 11px', boxShadow: 'var(--shadow-lg)', fontSize: 12,
    }}>
      {label != null && (
        <div style={{ color: 'var(--ink-mute)', marginBottom: 5, fontSize: 11 }}>{label}</div>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--ink)' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color || p.fill }} />
          <span style={{ color: 'var(--ink-mute)' }}>{p.name}</span>
          <strong style={{ marginInlineStart: 'auto' }}>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

/**
 * A donut with the headline total in the middle and a value/percentage legend
 * beneath. `data` is [{name, value, color}]. Split from the `<Card>` chrome
 * (see DonutTabsPanel) so two datasets can share one card behind a tab switch
 * instead of each getting its own.
 *
 * Zero-value entries are dropped from the RING only — an invisible segment is
 * meaningless — but kept in the LEGEND, so a category the user is looking for
 * (e.g. Declined) reads "0" rather than vanishing and leaving them unsure
 * whether it's absent or simply unsupported.
 */
function DonutVisual({ icon, data, centerValue, centerLabel, emptyTitle, emptyHint, fmtN, ad }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const ringData = data.filter((d) => d.value > 0);
  if (total === 0) return <EmptyState icon={icon} title={emptyTitle}>{emptyHint}</EmptyState>;
  return (
    <>
      <div style={{ height: 120, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={ringData} dataKey="value" nameKey="name"
              innerRadius={38} outerRadius={58} paddingAngle={2} stroke="none">
              {ringData.map((d, i) => <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>{centerValue}</div>
            <div style={{ fontSize: 9.5, color: 'var(--ink-mute)' }}>{centerLabel}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 8 }}>
        {data.map((d, i) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5 }}>
            <span style={{
              width: 7, height: 7, borderRadius: 2, flexShrink: 0,
              background: d.color || CHART_COLORS[i % CHART_COLORS.length],
            }} />
            <span style={{ color: 'var(--ink-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
            <span style={{ marginInlineStart: 'auto', fontWeight: 600 }}>{fmtN(d.value)}</span>
            <span style={{ color: 'var(--ink-mute)', fontSize: 10.5, minWidth: 30, textAlign: 'end' }}>
              {ad(total ? Math.round((d.value / total) * 100) : 0)}%
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/** DonutVisual, wrapped in its own card — used where only one dataset applies. */
export function DonutPanel({ title, subtitle, icon, ...visual }) {
  return (
    <Card>
      <CardHead title={title} subtitle={subtitle} icon={icon} />
      <DonutVisual icon={icon} {...visual} />
    </Card>
  );
}

/**
 * Two (or more) donut datasets sharing one card behind a tab switch — e.g.
 * RSVP vs. Accreditation. Each entry in `tabs` is
 * `{ value, label, data, centerValue, centerLabel, icon, emptyTitle, emptyHint }`.
 */
export function DonutTabsPanel({ title, icon, tabs, active, onChange, fmtN, ad }) {
  const current = tabs.find((t) => t.value === active) || tabs[0];
  return (
    <Card>
      <CardHead title={title} subtitle={current.subtitle} icon={icon} />
      <PanelTabs tabs={tabs} active={current.value} onChange={onChange} />
      <DonutVisual {...current} fmtN={fmtN} ad={ad} />
    </Card>
  );
}

/**
 * Horizontal ranked bars for a breakdown (service level, nationality,
 * organization). Bars beat a pie here: these lists are ranked and often have a
 * long tail, which a pie renders as a fringe of unreadable slivers.
 */
function BreakdownBars({ rows, emptyTitle, emptyHint, icon, fmtN, isAr }) {
  if (!rows?.length) return <EmptyState icon={icon} title={emptyTitle}>{emptyHint}</EmptyState>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 2 }}>
      {rows.slice(0, 5).map((r, i) => {
        const label = (isAr && r.labelAr) || r.label;
        return (
          <div key={`${r.label}-${i}`}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-dim)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label}
              </span>
              <span style={{ marginInlineStart: 'auto', fontSize: 12, fontWeight: 600 }}>{fmtN(r.count)}</span>
            </div>
            {/* Service levels carry their own configured colour; the other
                breakdowns fall back to the shared chart palette. */}
            <Progress value={r.count} max={max} tint={r.color || CHART_COLORS[i % CHART_COLORS.length]} height={5} />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Horizontal ranked bars for a breakdown (service level, nationality,
 * organization). Bars beat a pie here: these lists are ranked and often have a
 * long tail, which a pie renders as a fringe of unreadable slivers.
 */
export function BreakdownPanel({ title, subtitle, icon, rows, emptyTitle, emptyHint, fmtN, isAr }) {
  return (
    <Card>
      <CardHead title={title} subtitle={subtitle} icon={icon} />
      <BreakdownBars rows={rows} emptyTitle={emptyTitle} emptyHint={emptyHint} icon={icon} fmtN={fmtN} isAr={isAr} />
    </Card>
  );
}

/**
 * Several breakdowns (service levels, nationalities, organisations, and
 * optionally the arrivals/departures chart) sharing one card behind a tab
 * switch, instead of each claiming a whole column. Each `tabs` entry is
 * either `{ value, label, kind: 'bars', rows, emptyTitle, emptyHint }` or
 * `{ value, label, kind: 'chart', data, labels }` (rendered as MovementsChart).
 */
export function BreakdownTabsPanel({ title, icon, tabs, active, onChange, fmtN, isAr }) {
  const current = tabs.find((t) => t.value === active) || tabs[0];
  return (
    <Card>
      <CardHead title={title} subtitle={current.subtitle} icon={icon} />
      <PanelTabs tabs={tabs} active={current.value} onChange={onChange} />
      {current.kind === 'chart' ? (
        <MovementsChart data={current.data} labels={current.labels} height={132} />
      ) : (
        <BreakdownBars rows={current.rows} emptyTitle={current.emptyTitle} emptyHint={current.emptyHint} icon={icon} fmtN={fmtN} isAr={isAr} />
      )}
    </Card>
  );
}

/**
 * Operational readiness: how far each workstream has got through the guest
 * list. Each row is count-of-done against a denominator that makes sense for
 * that workstream — accreditation is measured against guests who actually need
 * it, not the whole list.
 */
export function ReadinessPanel({ title, subtitle, rows, fmtN, ad }) {
  return (
    <Card>
      <CardHead title={title} subtitle={subtitle} icon="reports" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 2 }}>
        {rows.map((r) => {
          const pct = r.max > 0 ? Math.round((r.value / r.max) * 100) : 0;
          return (
            <div key={r.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
                <Icon name={r.icon} size={12} style={{ color: r.tint, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--ink-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                <span style={{ marginInlineStart: 'auto', fontSize: 12, whiteSpace: 'nowrap' }}>
                  <strong>{fmtN(r.value)}</strong>
                  <span style={{ color: 'var(--ink-mute)' }}> / {fmtN(r.max)}</span>
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', minWidth: 32, textAlign: 'end' }}>
                  {ad(pct)}%
                </span>
              </div>
              <Progress value={r.value} max={r.max} tint={r.tint} height={5} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Arrivals vs departures per day, chart only — shared by MovementsPanel and
 * BreakdownTabsPanel's "chart" tab kind. */
function MovementsChart({ data, labels, height = 148 }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -18, right: 8, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="arrFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8d0134" stopOpacity={0.30} />
              <stop offset="100%" stopColor="#8d0134" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="depFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4a9edd" stopOpacity={0.26} />
              <stop offset="100%" stopColor="#4a9edd" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--glass-border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fill: 'var(--ink-mute)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--ink-mute)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: 'var(--ink-mute)' }} iconType="circle" iconSize={7} />
          <Area type="monotone" dataKey="arrivals" name={labels.arrivals}
            stroke="#8d0134" strokeWidth={2} fill="url(#arrFill)" />
          <Area type="monotone" dataKey="departures" name={labels.departures}
            stroke="#4a9edd" strokeWidth={2} fill="url(#depFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Arrivals vs departures per day — the operational shape of the event week. */
export function MovementsPanel({ title, subtitle, data, labels }) {
  return (
    <Card>
      <CardHead title={title} subtitle={subtitle} icon="travel" />
      <MovementsChart data={data} labels={labels} />
    </Card>
  );
}

/** The confirmation funnel, stage by stage. */
export function FunnelPanel({ title, subtitle, data, seriesName }) {
  return (
    <Card>
      <CardHead title={title} subtitle={subtitle} icon="reports" />
      <div style={{ height: 178 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--glass-border)" />
            <XAxis type="number" tick={{ fill: 'var(--ink-mute)', fontSize: 10.5 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="stage" width={72}
              tick={{ fill: 'var(--ink-dim)', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--hover-tint)' }} />
            <Bar dataKey="value" name={seriesName} radius={[0, 6, 6, 0]} maxBarSize={18}>
              {/* `d.color` lets a stage opt out of the progress palette — Rejected
                  is a drop-off, not a step forward, so it reads red. Same
                  convention as DonutVisual. */}
              {data.map((d, i) => <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** A compact "time — title — detail" list, used for sessions and meetings.
 * `quickActions`, when given, adds a row of action buttons fixed under the
 * list (same box as the meetings list — not a separate card). */
export function AgendaPanel({ title, icon, items, emptyText, action, quickActions, withImages = false }) {
  return (
    <Card padded={false}>
      <div style={{ padding: '16px 18px 0' }}>
        <CardHead title={title} icon={icon} action={action} />
      </div>
      <div style={{ padding: '0 18px 14px' }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', padding: '6px 0 4px' }}>{emptyText}</div>
        ) : items.slice(0, 5).map((it) => (
          <div key={it.id} style={{
            display: 'flex', gap: 10, padding: '6px 0', alignItems: 'flex-start',
            borderBottom: '1px solid var(--glass-border)',
          }}>
            {withImages && (
              it.imageUrl ? (
                <img src={it.imageUrl} alt="" style={{
                  width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0,
                }}/>
              ) : (
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: 'var(--surface-soft-3)', display: 'grid', placeItems: 'center',
                }}>
                  <Icon name="image" size={13} style={{ color: 'var(--ink-faint)' }}/>
                </div>
              )
            )}
            {it.time && (
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)',
                minWidth: 40, direction: 'ltr', paddingTop: 1,
              }}>{it.time}</span>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 550 }}>{it.title}</div>
              {it.detail && <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>{it.detail}</div>}
            </div>
            {/* Optional right-aligned metric (e.g. guests in this session). The
                `flex: 1` above is what pushes it to the far edge. */}
            {it.trailing != null && (
              <div style={{ flexShrink: 0, paddingTop: 1 }}>{it.trailing}</div>
            )}
          </div>
        ))}
      </div>
      {quickActions?.length > 0 && (
        <div style={{
          display: 'flex', gap: 6, padding: '9px 12px', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap',
        }}>
          {quickActions.map((qa) => (
            <button key={qa.label} type="button" className="btn sm" onClick={qa.onClick} style={{ flex: '1 1 auto', justifyContent: 'center' }}>
              <Icon name={qa.icon} size={12} /> {qa.label}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * Today's programme / upcoming meetings sharing one card behind a tab
 * switch, with a row of quick-action buttons fixed under the list — merges
 * what used to be three separate cards into one, matching the reference
 * layout's schedule-card-plus-action-strip.
 */
export function AgendaTabsPanel({ title, icon, tabs, active, onChange, quickActions }) {
  const current = tabs.find((t) => t.value === active) || tabs[0];
  return (
    <Card padded={false}>
      <div style={{ padding: '14px 16px 0' }}>
        <CardHead title={title} icon={icon} />
        <PanelTabs tabs={tabs} active={current.value} onChange={onChange} />
      </div>
      <div style={{ padding: '0 16px 10px', maxHeight: 172, overflowY: 'auto' }}>
        {current.items.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', padding: '4px 0' }}>{current.emptyText}</div>
        ) : current.items.slice(0, 5).map((it) => (
          <div key={it.id} style={{
            display: 'flex', gap: 10, padding: '6px 0', alignItems: 'flex-start',
            borderBottom: '1px solid var(--glass-border)',
          }}>
            {it.time && (
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)',
                minWidth: 40, direction: 'ltr', paddingTop: 1,
              }}>{it.time}</span>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 550 }}>{it.title}</div>
              {it.detail && <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>{it.detail}</div>}
            </div>
            {/* Optional right-aligned metric (e.g. guests in this session). The
                `flex: 1` above is what pushes it to the far edge. */}
            {it.trailing != null && (
              <div style={{ flexShrink: 0, paddingTop: 1 }}>{it.trailing}</div>
            )}
          </div>
        ))}
      </div>
      {quickActions?.length > 0 && (
        <div style={{
          display: 'flex', gap: 6, padding: '9px 12px', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap',
        }}>
          {quickActions.map((qa) => (
            <button key={qa.label} type="button" className="btn sm" onClick={qa.onClick} style={{ flex: '1 1 auto', justifyContent: 'center' }}>
              <Icon name={qa.icon} size={12} /> {qa.label}
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

/**
 * Full listing of every session on the event — name, date, time, room — as a
 * plain table rather than the short "time — title" agenda list, since this
 * is the dedicated sessions section (moved to the bottom of the page) rather
 * than a compact "what's on today" glance.
 */
export function SessionsListPanel({ title, subtitle, icon = 'calendar', sessions, emptyText, isAr }) {
  return (
    <Card padded={false}>
      <div style={{ padding: '16px 18px 0' }}>
        <CardHead title={title} subtitle={subtitle} icon={icon} />
      </div>
      {(!sessions || sessions.length === 0) ? (
        <EmptyState icon={icon} title={emptyText} />
      ) : (
        <div style={{ overflowX: 'auto', padding: '10px 4px 14px' }}>
          <table className="table">
            <thead>
              <tr>
                <th>{isAr ? 'الجلسة' : 'Session'}</th>
                <th>{isAr ? 'التاريخ' : 'Date'}</th>
                <th>{isAr ? 'الوقت' : 'Time'}</th>
                <th>{isAr ? 'القاعة' : 'Room'}</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontSize: 12.5, fontWeight: 550 }}>{s.title}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-mute)' }}>{s.date ? fmtDate(s.date) : '—'}</td>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-mute)' }}>{s.time || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--ink-mute)' }}>{s.room || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
