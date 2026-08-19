import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { RoundSVG, RectSVG, StadiumSVG, StageSVG, PitchSVG } from './ElementShapes.jsx';

// Positions + rotates one canvas element and dispatches to its shape renderer.
// All drag/select/seat-interaction logic lives in the parent (useVenueEditor);
// this component is purely presentational + wires up the mousedown-to-drag hook.
export default function CanvasElement({
  table, selected, showDeleteSeat, selectedSeatIndex, index = 0,
  onMouseDown, onDeleteSeat, onSeatClick,
}) {
  const reduced = useReducedMotion();

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

  const rotation = table.rotation || 0;

  // Rotation is animated rather than set through CSS because framer owns the
  // element's transform once it animates scale — leaving `rotate` in a style
  // rule would be overwritten the moment the entrance runs.
  //
  // The stagger is capped: on a floor plan with 200 tables an uncapped
  // per-element delay would still be drawing itself a minute later.
  const delay = reduced ? 0 : Math.min(index * 0.018, 0.5);

  return (
    <motion.div
      // Elements only mount once (keyed by id in VenueCanvas), so the entrance
      // plays on load and on genuine additions — not on every drag frame.
      initial={reduced ? false : { opacity: 0, scale: 0.82, rotate: rotation }}
      animate={{ opacity: 1, scale: 1, rotate: rotation }}
      transition={{ duration: 0.34, delay, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'absolute', left: table.x, top: table.y, cursor: 'move', userSelect: 'none',
        transformOrigin: 'center center',
        filter: selected ? 'drop-shadow(0 0 6px rgba(141, 1, 52,0.5))' : undefined,
      }}
      onMouseDown={onMouseDown}>
      {svgEl}
    </motion.div>
  );
}
