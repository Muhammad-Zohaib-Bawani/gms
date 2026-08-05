// Dashboard building blocks.
//
// Split out of DashboardView so the view reads as a layout — which panel goes
// where — rather than several hundred lines of chart configuration. Every
// component here is presentational: it takes already-shaped data and renders
// it, and none of them fetch or derive business numbers.
import React from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardHead, Progress, EmptyState } from '../../components/ds';
import { Icon } from '../../components/Icons';

// Ordered so adjacent slices stay distinguishable; maroon leads because the
// first series is almost always the primary one.
export const CHART_COLORS = ['#8d0134', '#c21857', '#a78bda', '#4a9edd', '#5abf6e', '#e0b864', '#8fa3b8'];

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
 * beneath. `data` is [{name, value, color}]; zero-value slices are dropped by
 * the caller so the ring never renders invisible segments.
 */
export function DonutPanel({ title, subtitle, icon, data, centerValue, centerLabel, emptyTitle, emptyHint, fmtN, ad }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Card>
      <CardHead title={title} subtitle={subtitle} icon={icon} />
      {data.length === 0 ? (
        <EmptyState icon={icon} title={emptyTitle}>{emptyHint}</EmptyState>
      ) : (
        <>
          <div style={{ height: 168, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name"
                  innerRadius={52} outerRadius={76} paddingAngle={2} stroke="none">
                  {data.map((d, i) => <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{centerValue}</div>
                <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>{centerLabel}</div>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
            {data.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: 2, flexShrink: 0,
                  background: d.color || CHART_COLORS[i % CHART_COLORS.length],
                }} />
                <span style={{ color: 'var(--ink-dim)' }}>{d.name}</span>
                <span style={{ marginInlineStart: 'auto', fontWeight: 600 }}>{fmtN(d.value)}</span>
                <span style={{ color: 'var(--ink-mute)', fontSize: 11, minWidth: 34, textAlign: 'end' }}>
                  {ad(total ? Math.round((d.value / total) * 100) : 0)}%
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/**
 * Horizontal ranked bars for a breakdown (service level, nationality,
 * organization). Bars beat a pie here: these lists are ranked and often have a
 * long tail, which a pie renders as a fringe of unreadable slivers.
 */
export function BreakdownPanel({ title, subtitle, icon, rows, emptyTitle, emptyHint, fmtN, isAr }) {
  if (!rows?.length) {
    return (
      <Card>
        <CardHead title={title} subtitle={subtitle} icon={icon} />
        <EmptyState icon={icon} title={emptyTitle}>{emptyHint}</EmptyState>
      </Card>
    );
  }
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <Card>
      <CardHead title={title} subtitle={subtitle} icon={icon} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 4 }}>
        {rows.map((r, i) => {
          const label = (isAr && r.labelAr) || r.label;
          return (
            <div key={`${r.label}-${i}`}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-dim)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {label}
                </span>
                <span style={{ marginInlineStart: 'auto', fontSize: 12.5, fontWeight: 600 }}>{fmtN(r.count)}</span>
              </div>
              {/* Service levels carry their own configured colour; the other
                  breakdowns fall back to the shared chart palette. */}
              <Progress value={r.count} max={max} tint={r.color || CHART_COLORS[i % CHART_COLORS.length]} height={7} />
            </div>
          );
        })}
      </div>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 4 }}>
        {rows.map((r) => {
          const pct = r.max > 0 ? Math.round((r.value / r.max) * 100) : 0;
          return (
            <div key={r.label}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Icon name={r.icon} size={13} style={{ color: r.tint, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: 'var(--ink-dim)' }}>{r.label}</span>
                <span style={{ marginInlineStart: 'auto', fontSize: 12.5 }}>
                  <strong>{fmtN(r.value)}</strong>
                  <span style={{ color: 'var(--ink-mute)' }}> / {fmtN(r.max)}</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-mute)', minWidth: 36, textAlign: 'end' }}>
                  {ad(pct)}%
                </span>
              </div>
              <Progress value={r.value} max={r.max} tint={r.tint} height={7} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Arrivals vs departures per day — the operational shape of the event week. */
export function MovementsPanel({ title, subtitle, data, labels }) {
  return (
    <Card>
      <CardHead title={title} subtitle={subtitle} icon="travel" />
      <div style={{ height: 210 }}>
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
            <Legend wrapperStyle={{ fontSize: 11.5, color: 'var(--ink-mute)' }} iconType="circle" iconSize={8} />
            <Area type="monotone" dataKey="arrivals" name={labels.arrivals}
              stroke="#8d0134" strokeWidth={2} fill="url(#arrFill)" />
            <Area type="monotone" dataKey="departures" name={labels.departures}
              stroke="#4a9edd" strokeWidth={2} fill="url(#depFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** The confirmation funnel, stage by stage. */
export function FunnelPanel({ title, subtitle, data, seriesName }) {
  return (
    <Card>
      <CardHead title={title} subtitle={subtitle} icon="reports" />
      <div style={{ height: 232 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--glass-border)" />
            <XAxis type="number" tick={{ fill: 'var(--ink-mute)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="stage" width={86}
              tick={{ fill: 'var(--ink-dim)', fontSize: 11.5 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--hover-tint)' }} />
            <Bar dataKey="value" name={seriesName} radius={[0, 6, 6, 0]} maxBarSize={26}>
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** A compact "time — title — detail" list, used for sessions and meetings. */
export function AgendaPanel({ title, icon, items, emptyText, action }) {
  return (
    <Card padded={false}>
      <div style={{ padding: '16px 18px 0' }}>
        <CardHead title={title} icon={icon} action={action} />
      </div>
      <div style={{ padding: '0 18px 16px' }}>
        {items.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', padding: '8px 0 4px' }}>{emptyText}</div>
        ) : items.map((it) => (
          <div key={it.id} style={{
            display: 'flex', gap: 11, padding: '9px 0', alignItems: 'flex-start',
            borderBottom: '1px solid var(--glass-border)',
          }}>
            {it.time && (
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--accent)',
                minWidth: 42, direction: 'ltr', paddingTop: 1,
              }}>{it.time}</span>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 550 }}>{it.title}</div>
              {it.detail && <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{it.detail}</div>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
