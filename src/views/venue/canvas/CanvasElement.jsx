import React from 'react';
import { RoundSVG, RectSVG, StadiumSVG, StageSVG, PitchSVG } from './ElementShapes.jsx';

// Positions + rotates one canvas element and dispatches to its shape renderer.
// All drag/select/seat-interaction logic lives in the parent (useVenueEditor);
// this component is purely presentational + wires up the mousedown-to-drag hook.
export default function CanvasElement({
  table, selected, showDeleteSeat, selectedSeatIndex,
  onMouseDown, onDeleteSeat, onSeatClick,
}) {
  let svgEl;
  if (table.type === 'round')
    svgEl = <RoundSVG table={table} selected={selected} onDeleteSeat={showDeleteSeat ? onDeleteSeat : null} onSeatClick={onSeatClick} selectedIndex={selectedSeatIndex}/>;
  else if (table.type === 'rect')
    svgEl = <RectSVG table={table} selected={selected} onDeleteSeat={showDeleteSeat ? onDeleteSeat : null} onSeatClick={onSeatClick} selectedIndex={selectedSeatIndex}/>;
  else if (table.type === 'stadium')
    svgEl = <StadiumSVG table={table} selected={selected} onDeleteSeat={showDeleteSeat ? onDeleteSeat : null} onSeatClick={onSeatClick} selectedIndex={selectedSeatIndex}/>;
  else if (table.type === 'stage')
    svgEl = <StageSVG table={table} selected={selected}/>;
  else
    svgEl = <PitchSVG table={table} selected={selected}/>;

  return (
    <div
      style={{
        position: 'absolute', left: table.x, top: table.y, cursor: 'move', userSelect: 'none',
        transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined,
        transformOrigin: 'center center',
        filter: selected ? 'drop-shadow(0 0 6px rgba(141, 1, 52,0.5))' : undefined,
      }}
      onMouseDown={onMouseDown}>
      {svgEl}
    </div>
  );
}
