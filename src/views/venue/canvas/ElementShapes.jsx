import React from 'react';
import { brandColor, brandTint } from '../../../lib/brandColor';
import {
  TABLE_R, SEAT_R, SEAT_DIST, ROUND_SIZE, ROW_LABEL_W,
  hexToRgba, rectTableSize, stadiumSize, seatColor, seatDisplayCode, DISABLED_SEAT_COLOR,
} from '../venueHelpers.js';

// Diagonal "×" overlay marking a disabled seat, plus a native-tooltip <title>
// when the seat has manager-entered info — shared across all seat shapes.
function SeatOverlay({ meta, cx, cy, r }) {
  return (
    <>
      {meta.seatInfo && <title>{meta.seatInfo}</title>}
      {meta.isDisabled && (
        <g stroke={DISABLED_SEAT_COLOR} strokeWidth={1.2} strokeLinecap="round">
          <line x1={cx - r * 0.6} y1={cy - r * 0.6} x2={cx + r * 0.6} y2={cy + r * 0.6}/>
          <line x1={cx - r * 0.6} y1={cy + r * 0.6} x2={cx + r * 0.6} y2={cy - r * 0.6}/>
        </g>
      )}
    </>
  );
}

// Every seat-bearing shape accepts the same seat-interaction props:
//   onSeatClick(index)  — select a seat (any seat-bearing type)
//   onDeleteSeat(index) — remove a seat (delete-seat mode only)
//   selectedIndex        — currently-selected seat's flat index, or null

export function RoundSVG({ table, selected, onDeleteSeat, onSeatClick, selectedIndex }) {
  const cx = ROUND_SIZE / 2, cy = ROUND_SIZE / 2;
  const removed = new Set(table.removedSeats || []);
  const c = table.color;
  const fill = selected ? (c ? hexToRgba(c, 0.34) : brandTint(0.34)) : (c ? hexToRgba(c, 0.20) : brandTint(0.20));
  const stroke = selected ? (c || brandColor()) : (c ? hexToRgba(c, 0.72) : brandTint(0.72));
  return (
    <svg width={ROUND_SIZE} height={ROUND_SIZE} style={{ display: 'block' }}>
      <circle cx={cx} cy={cy} r={TABLE_R} fill={fill} stroke={stroke} strokeWidth={selected ? 2 : 1.5}/>
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fill="var(--ink)" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      {Array.from({ length: table.seats }, (_, i) => {
        if (removed.has(i)) return null;
        const angle = (i / table.seats) * Math.PI * 2 - Math.PI / 2;
        const sx = cx + Math.cos(angle) * SEAT_DIST;
        const sy = cy + Math.sin(angle) * SEAT_DIST;
        const isSeatSel = selectedIndex === i;
        const meta = (table.seatMeta || {})[i] || {};
        const sc = seatColor(meta);
        return (
          <g key={i}
            onMouseDown={e => e.stopPropagation()}
            onClick={onSeatClick ? (e => { e.stopPropagation(); onSeatClick(i); }) : undefined}
            style={{ cursor: onSeatClick ? 'pointer' : 'default' }}>
            <circle cx={sx} cy={sy} r={SEAT_R}
              fill={isSeatSel ? brandTint(0.35) : (sc ? hexToRgba(sc, 0.35) : 'var(--surface-soft-3)')}
              stroke={isSeatSel ? 'var(--accent)' : (sc || 'var(--glass-border)')}
              strokeWidth={isSeatSel ? 1.5 : 1}/>
            <text x={sx} y={sy + 2.5} textAnchor="middle" fontSize="7" fill={isSeatSel ? 'var(--accent)' : 'var(--ink)'} fontFamily="var(--mono)">{seatDisplayCode(table, i)}</text>
            <SeatOverlay meta={meta} cx={sx} cy={sy} r={SEAT_R}/>
            {onDeleteSeat && (
              <g style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onDeleteSeat(i); }}>
                <circle cx={sx + SEAT_R - 2} cy={sy - SEAT_R + 2} r={5} fill="rgba(220,70,70,0.9)" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
                <text x={sx + SEAT_R - 2} y={sy - SEAT_R + 5.5} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">×</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function RectSVG({ table, selected, onDeleteSeat, onSeatClick, selectedIndex }) {
  const sps = table.seatsPerSide;
  const { w, h } = rectTableSize(sps);
  const tblX = 10, tblY = 26, tblW = sps * 24, tblH = 28;
  const seatY1 = 10, seatY2 = h - 10;
  const removed = new Set(table.removedSeats || []);
  const c = table.color;
  const fill = selected ? (c ? hexToRgba(c, 0.34) : brandTint(0.34)) : (c ? hexToRgba(c, 0.20) : brandTint(0.20));
  const stroke = selected ? (c || brandColor()) : (c ? hexToRgba(c, 0.72) : brandTint(0.72));

  function seat(index, sx, sy) {
    if (removed.has(index)) return null;
    const isSeatSel = selectedIndex === index;
    const meta = (table.seatMeta || {})[index] || {};
    const sc = seatColor(meta);
    return (
      <g key={index}
        onMouseDown={e => e.stopPropagation()}
        onClick={onSeatClick ? (e => { e.stopPropagation(); onSeatClick(index); }) : undefined}
        style={{ cursor: onSeatClick ? 'pointer' : 'default' }}>
        <circle cx={sx} cy={sy} r={SEAT_R}
          fill={isSeatSel ? brandTint(0.35) : (sc ? hexToRgba(sc, 0.35) : 'var(--surface-soft-3)')}
          stroke={isSeatSel ? 'var(--accent)' : (sc || 'var(--glass-border)')}
          strokeWidth={isSeatSel ? 1.5 : 1}/>
        <text x={sx} y={sy + 2.5} textAnchor="middle" fontSize="7" fill={isSeatSel ? 'var(--accent)' : 'var(--ink)'} fontFamily="var(--mono)">{seatDisplayCode(table, index)}</text>
        <SeatOverlay meta={meta} cx={sx} cy={sy} r={SEAT_R}/>
        {onDeleteSeat && (
          <g style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onDeleteSeat(index); }}>
            <circle cx={sx + SEAT_R - 2} cy={sy - SEAT_R + 2} r={5} fill="rgba(220,70,70,0.9)" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
            <text x={sx + SEAT_R - 2} y={sy - SEAT_R + 5.5} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">×</text>
          </g>
        )}
      </g>
    );
  }

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <rect x={tblX} y={tblY} width={tblW} height={tblH} rx={4} fill={fill} stroke={stroke} strokeWidth={selected ? 2 : 1.5}/>
      <text x={tblX + tblW / 2} y={tblY + tblH / 2 + 4} textAnchor="middle" fontSize="9" fill="var(--ink)" fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      {Array.from({ length: sps }, (_, i) => {
        const sx = tblX + (i + 0.5) * 24;
        return (
          <React.Fragment key={i}>
            {seat(i, sx, seatY1)}
            {seat(sps + i, sx, seatY2)}
          </React.Fragment>
        );
      })}
    </svg>
  );
}

export function StadiumSVG({ table, selected, onDeleteSeat, onSeatClick, selectedIndex }) {
  const { w, h } = stadiumSize(table.rows, table.seatsPerRow);
  const step = 22, seatW = 16, seatH = 16;
  const removed = new Set(table.removedSeats || []);
  const rowNamesArr = table.rowNames || [];
  const c = table.color;
  const fill = selected ? (c ? hexToRgba(c, 0.24) : brandTint(0.24)) : (c ? hexToRgba(c, 0.14) : brandTint(0.14));
  const stroke = selected ? (c || brandColor()) : (c ? hexToRgba(c, 0.60) : brandTint(0.60));
  const labelColor = c || 'var(--accent)';

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <rect x={1} y={1} width={w - 2} height={h - 2} rx={6}
        fill={fill} stroke={stroke}
        strokeWidth={selected ? 2 : 1} strokeDasharray={selected ? undefined : '4 3'}/>
      <text x={w / 2} y={14} textAnchor="middle" fontSize="9" fill={labelColor} fontFamily="var(--mono)" fontWeight="600">{table.label}</text>

      {Array.from({ length: table.rows }, (_, row) => {
        const rowName = rowNamesArr[row] !== undefined ? rowNamesArr[row] : String.fromCharCode(65 + row);
        const by0 = 20 + row * step;
        return (
          <g key={row}>
            <text x={8 + ROW_LABEL_W / 2} y={by0 + seatH / 2 + 4}
              textAnchor="middle" fontSize="8" fill={labelColor} fontFamily="var(--mono)" fontWeight="700">
              {rowName}
            </text>
            {Array.from({ length: table.seatsPerRow }, (_, col) => {
              const idx = row * table.seatsPerRow + col;
              if (removed.has(idx)) return null;
              const bx = 8 + ROW_LABEL_W + col * step;
              const by = by0;
              const skey = `${row}-${col}`;
              const displayCode = seatDisplayCode(table, idx);
              const isSeatSel = selectedIndex === idx;
              const meta = (table.seatMeta || {})[idx] || {};
              const sc = seatColor(meta);
              return (
                <g key={skey}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={onSeatClick ? (e => { e.stopPropagation(); onSeatClick(idx); }) : undefined}
                  style={{ cursor: onSeatClick ? 'pointer' : 'default' }}>
                  <rect x={bx} y={by} width={seatW} height={seatH} rx={3}
                    fill={isSeatSel ? brandTint(0.35) : (sc ? hexToRgba(sc, 0.35) : 'var(--surface-soft-3)')}
                    stroke={isSeatSel ? 'var(--accent)' : (sc || 'var(--glass-border)')}
                    strokeWidth={isSeatSel ? 1.5 : 0.8}/>
                  <text x={bx + seatW / 2} y={by + seatH / 2 + 3.5}
                    textAnchor="middle" fontSize="7" fill={isSeatSel ? 'var(--accent)' : 'var(--ink)'} fontFamily="var(--mono)">
                    {displayCode}
                  </text>
                  <SeatOverlay meta={meta} cx={bx + seatW / 2} cy={by + seatH / 2} r={seatW / 2}/>
                  {onDeleteSeat && (
                    <g style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onDeleteSeat(idx); }}>
                      <circle cx={bx + seatW - 2} cy={by} r={5} fill="rgba(220,70,70,0.9)" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5"/>
                      <text x={bx + seatW - 2} y={by + 3.5} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="bold">×</text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

export function StageSVG({ table, selected }) {
  const w = table.stageW || 220, h = table.stageH || 80;
  const svgW = w + 20, svgH = h + 34;
  const c = table.color || '#e0b864';
  return (
    <svg width={svgW} height={svgH} style={{ display: 'block' }}>
      <text x={svgW / 2} y={12} textAnchor="middle" fontSize="9" fill={c} fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      <rect x={2} y={16} width={w + 16} height={h + 10} rx={3} fill={hexToRgba(c, 0.06)} stroke={hexToRgba(c, 0.2)} strokeWidth="1"/>
      <rect x={6} y={19} width={w + 8} height={h + 6} rx={3} fill={hexToRgba(c, 0.18)} stroke={hexToRgba(c, 0.55)} strokeWidth="1"/>
      <rect x={10} y={22} width={w} height={h} rx={4}
        fill={selected ? hexToRgba(c, 0.28) : hexToRgba(c, 0.16)}
        stroke={selected ? c : hexToRgba(c, 0.5)}
        strokeWidth={selected ? 2 : 1.5}/>
      <text x={svgW / 2} y={22 + h / 2 + 5} textAnchor="middle" fontSize="10" fill={hexToRgba(c, 0.65)} fontFamily="sans-serif" fontWeight="700" letterSpacing="2">▲ STAGE</text>
    </svg>
  );
}

export function PitchSVG({ table, selected }) {
  const pw = table.pitchW || 280, ph = table.pitchH || 140;
  const svgW = pw + 20, svgH = ph + 30;
  const fx = 10, fy = 22;
  const cr = Math.min(pw, ph) * 0.13;
  const c = table.color || '#5abf6e';
  return (
    <svg width={svgW} height={svgH} style={{ display: 'block' }}>
      <text x={svgW / 2} y={13} textAnchor="middle" fontSize="9" fill={c} fontFamily="var(--mono)" fontWeight="600">{table.label}</text>
      <rect x={fx} y={fy} width={pw} height={ph} rx={6}
        fill={selected ? hexToRgba(c, 0.26) : hexToRgba(c, 0.15)}
        stroke={selected ? c : hexToRgba(c, 0.62)}
        strokeWidth={selected ? 2 : 1.5}/>
      <line x1={fx + pw / 2} y1={fy + 5} x2={fx + pw / 2} y2={fy + ph - 5} stroke={hexToRgba(c, 0.48)} strokeWidth="1" strokeDasharray="5 3"/>
      <circle cx={fx + pw / 2} cy={fy + ph / 2} r={cr} fill="none" stroke={hexToRgba(c, 0.48)} strokeWidth="1"/>
      <circle cx={fx + pw / 2} cy={fy + ph / 2} r={2.5} fill={hexToRgba(c, 0.7)}/>
      <text x={svgW / 2} y={fy + ph / 2 + 4} textAnchor="middle" fontSize="9" fill={hexToRgba(c, 0.7)} fontFamily="sans-serif" fontWeight="700" letterSpacing="1.5">PITCH AREA</text>
    </svg>
  );
}
