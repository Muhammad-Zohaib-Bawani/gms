// QOC design-system primitives.
//
// Thin, styling-only wrappers over the classes in styles/qoc-revamp.css. They
// exist so screens stop carrying inline style objects (the previous pattern),
// which is what made the old UI drift — every view had its own idea of a card,
// a badge and a button. Import from '../components/ds'.
//
// Deliberately NOT included here: Select, DateField, Modal, DataTable and
// ActionMenu already exist under components/ui and are reused as-is.
import React from 'react';
import { motion } from 'framer-motion';
import { Icon } from '../Icons';

// ── Motion presets ──────────────────────────────────────────────────────────
// One place for entrance motion so every screen animates identically.
// `reduce` is honoured globally by the CSS media query, but Framer needs its
// own guard for transform-based animation.
const prefersReduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const fadeUp = {
  initial: prefersReduced() ? {} : { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
};

/** Staggers children on mount — wrap a grid/list, give each child `fadeUpItem`. */
export const staggerParent = {
  initial: 'hidden',
  animate: 'show',
  variants: { hidden: {}, show: { transition: { staggerChildren: 0.05 } } },
};
export const fadeUpItem = {
  variants: prefersReduced()
    ? { hidden: {}, show: {} }
    : { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
};

// ── Layout ──────────────────────────────────────────────────────────────────

export function PageHeader({ title, accent, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">
          {title} {accent && <em>{accent}</em>}
        </h1>
        {subtitle && <div className="page-sub">{subtitle}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '', hover = false, padded = true, style, ...rest }) {
  return (
    <div
      className={`card${hover ? ' card-hover' : ''} ${className}`.trim()}
      style={{ ...(padded ? null : { padding: 0 }), ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHead({ title, subtitle, action, icon }) {
  return (
    <div className="card-head">
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
        {icon && <Icon name={icon} size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
        <div style={{ minWidth: 0 }}>
          <div className="card-title">{title}</div>
          {subtitle && <div className="card-sub">{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Responsive auto-fit grid — the default layout for card collections. */
export function Grid({ min = 260, gap = 16, children, style }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

export function Button({
  children, variant = 'default', size, icon, iconRight, className = '', ...rest
}) {
  const cls = ['btn', variant !== 'default' ? variant : '', size || '', className]
    .filter(Boolean).join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === 'sm' ? 12 : 14} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 12 : 14} />}
    </button>
  );
}

export function IconButton({ icon, size = 16, showDot = false, className = '', ...rest }) {
  return (
    <button type="button" className={`icon-btn ${className}`.trim()} {...rest}>
      <Icon name={icon} size={size} />
      {showDot && <span className="dot" />}
    </button>
  );
}

// ── Form fields ─────────────────────────────────────────────────────────────

export function Field({ label, required, hint, error, children }) {
  return (
    <div className="field">
      {label && (
        <label className="field-label">
          {label}{required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {error ? <div className="field-error">{error}</div>
        : hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}

export function Input({ error, className = '', ...rest }) {
  return <input className={`input${error ? ' error' : ''} ${className}`.trim()} {...rest} />;
}

export function Textarea({ error, rows = 3, className = '', ...rest }) {
  return (
    <textarea rows={rows} className={`input${error ? ' error' : ''} ${className}`.trim()} {...rest} />
  );
}

/**
 * Floating-label input. The CSS relies on `:placeholder-shown`, so the
 * placeholder must be a single space and the label must be the input's NEXT
 * sibling — both enforced here rather than left to each caller.
 */
export function FloatingField({ label, error, hint, id, className = '', ...rest }) {
  const inputId = id || `ff-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className={`float-field ${className}`.trim()}>
      <input
        id={inputId}
        placeholder=" "
        className={`input${error ? ' error' : ''}`}
        {...rest}
      />
      <label htmlFor={inputId}>{label}</label>
      {error ? <div className="field-error">{error}</div>
        : hint ? <div className="field-hint">{hint}</div> : null}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────────────────────────────

const TONE_CLASS = {
  ok: 'badge-ok', success: 'badge-ok',
  warn: 'badge-warn', warning: 'badge-warn', pending: 'badge-warn',
  danger: 'badge-danger', error: 'badge-danger',
  info: 'badge-info',
  brand: 'badge-brand',
  neutral: 'badge-neutral',
};

export function Badge({ children, tone = 'neutral', dot = true, style }) {
  return (
    <span className={`badge-pill ${TONE_CLASS[tone] || TONE_CLASS.neutral}`} style={style}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

// ── Alert ───────────────────────────────────────────────────────────────────

const ALERT_ICON = { ok: 'check', warn: 'alert', danger: 'alert', info: 'alert' };

export function Alert({ tone = 'info', title, children, icon }) {
  return (
    <div className={`alert alert-${tone}`}>
      <Icon name={icon || ALERT_ICON[tone] || 'alert'} size={15} />
      <div style={{ minWidth: 0 }}>
        {title && <div className="alert-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}

// ── Stat card ───────────────────────────────────────────────────────────────

/**
 * `delta` is a signed number (percent). Direction is derived from its sign so
 * callers can't accidentally show a green down-arrow.
 */
export function StatCard({ label, value, delta, deltaLabel, icon, tint = 'var(--accent)' }) {
  const dir = delta == null ? null : delta >= 0 ? 'up' : 'down';
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
      {dir && (
        <div className={`stat-delta ${dir}`}>
          <Icon name={dir === 'up' ? 'arrow' : 'arrow'} size={11}
            style={{ transform: `rotate(${dir === 'up' ? -45 : 45}deg)` }} />
          {Math.abs(delta)}%
          {deltaLabel && <span className="muted">{deltaLabel}</span>}
        </div>
      )}
    </motion.div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────────

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => {
        const key = t.value ?? t;
        return (
          <button
            key={key}
            type="button"
            className={`tab${value === key ? ' active' : ''}`}
            onClick={() => onChange(key)}
          >
            {t.icon && <Icon name={t.icon} size={13} />}
            {t.label ?? t}
            {t.count != null && (
              <span className="badge-pill badge-neutral" style={{ padding: '0 6px', fontSize: 10.5 }}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Empty + loading states ──────────────────────────────────────────────────

export function EmptyState({ icon = 'search', title, children, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon"><Icon name={icon} size={22} /></div>
      <div className="empty-state-title">{title}</div>
      {children && <div className="empty-state-text">{children}</div>}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

export function Skeleton({ w = '100%', h = 14, r, style }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

/** Placeholder rows matching the table layout, so loading doesn't collapse it. */
export function SkeletonRows({ rows = 5, cols = 4 }) {
  return (
    <div style={{ padding: '4px 14px' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: 'flex', gap: 14, padding: '13px 0', alignItems: 'center' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} w={c === 0 ? '22%' : `${Math.floor(60 / (cols - 1))}%`} h={13} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Determinate bar. Colour follows the value unless `tint` is given. */
export function Progress({ value = 0, max = 100, tint, height = 6 }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color = tint || (pct >= 100 ? 'var(--ok)' : 'var(--accent)');
  return (
    <div style={{ height, borderRadius: height, background: 'var(--surface-soft-4)', overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ height: '100%', borderRadius: height, background: color }}
      />
    </div>
  );
}
