import React from 'react';
import { Icon } from '../../components/Icons.jsx';
import { ELEMENT_META } from './venueHelpers.js';

const BORDER_BY_TYPE = {
  stage: 'rgba(224,184,100,0.45)',
  pitch: 'rgba(90,191,110,0.45)',
};

// Drag-source list of element types, built from the ELEMENT_TYPE lookup.
export default function ElementPalette({ elementTypes, dragTypeRef, isAr, title, dragHint, descByCode }) {
  const items = elementTypes.map(t => {
    const meta = ELEMENT_META[t.code] || { icon: 'seating', color: 'var(--accent)' };
    return {
      type: t.code,
      icon: meta.icon,
      color: meta.color,
      label: isAr ? (t.nameAr || t.name) : t.name,
      desc: descByCode[t.code] || '',
    };
  });

  return (
    <div className="venue-palette-panel" style={{ width: 200, flexShrink: 0 }}>
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--glass-border)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 600 }}>
          {title}
        </div>
        <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(item => (
            <div key={item.type} draggable
              onDragStart={() => { dragTypeRef.current = item.type; }}
              style={{ padding: '10px 12px', borderRadius: 9, border: `1px dashed ${BORDER_BY_TYPE[item.type] || 'var(--glass-border)'}`, cursor: 'grab', background: 'var(--surface-soft-2)', userSelect: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Icon name={item.icon} size={14} style={{ color: item.color }}/>
                <span style={{ fontSize: 12.5, fontWeight: 600 }}>{item.label}</span>
                <Icon name="drag" size={12} style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}/>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-mute)' }}>{item.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--glass-border)', fontSize: 10.5, color: 'var(--ink-faint)', lineHeight: 1.5 }}>
          {dragHint}
        </div>
      </div>
    </div>
  );
}
