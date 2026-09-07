// One field for a "From → To" pair — a flight's two airports or a transfer's two
// locations. Instead of two separate labelled selects the user tabs between, this
// reads as a single route control: pick the origin, and the destination field
// takes focus with its menu already open, so it's one continuous flow (no second
// click). Emits both values together via onChange(fromValue, toValue).
//
// Two backing modes, same look:
//   • async  — for large lookups (airports, 1000+ rows): pass loadPage + resolveOption
//   • static — for short lists (locations): pass options [{value,label}]
import React from 'react';
import Select from './Select';
import AsyncLookupSelect from './AsyncLookupSelect';

export default function RoutePicker({
  fromValue,
  toValue,
  onChange,            // (fromValue, toValue) => void
  // async mode
  loadPage,
  resolveOption,
  // static mode
  options,
  isClearable = false,
  fromPlaceholder,
  toPlaceholder,
  isAr = false,
}) {
  const async = typeof loadPage === 'function';
  const fromPh = fromPlaceholder || (isAr ? 'من…' : 'From…');
  const toPh = toPlaceholder || (isAr ? 'إلى…' : 'To…');

  const setFrom = (v) => onChange(v, toValue);
  const setTo = (v) => onChange(fromValue, v);

  // Auto-advance: once a "From" is chosen (and "To" is still empty) the To field
  // remounts focused with its menu open. Keyed on fromValue so it only fires on a
  // fresh pick — an empty initial mount (key '') has autoFocus off, so focus
  // isn't stolen from From before the user has picked anything.
  const advance = !!fromValue && !toValue;

  const fromSelect = async ? (
    <AsyncLookupSelect
      value={fromValue}
      onChange={setFrom}
      loadPage={loadPage}
      resolveOption={resolveOption}
      isClearable={isClearable}
      placeholder={fromPh}
      isAr={isAr}
    />
  ) : (
    <Select
      value={fromValue}
      onChange={setFrom}
      options={options}
      isClearable={isClearable}
      placeholder={fromPh}
    />
  );

  const toSelect = async ? (
    <AsyncLookupSelect
      key={`to-${fromValue || 'none'}`}
      value={toValue}
      onChange={setTo}
      loadPage={loadPage}
      resolveOption={resolveOption}
      isClearable={isClearable}
      placeholder={toPh}
      isAr={isAr}
      autoFocus={advance}
      openMenuOnFocus={advance}
    />
  ) : (
    <Select
      key={`to-${fromValue || 'none'}`}
      value={toValue}
      onChange={setTo}
      options={options}
      isClearable={isClearable}
      placeholder={toPh}
      autoFocus={advance}
      openMenuOnFocus={advance}
    />
  );

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8,
    }}>
      <div style={{ minWidth: 0 }}>{fromSelect}</div>
      <div style={{
        display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: '50%',
        color: 'var(--accent)', fontSize: 15, fontWeight: 600, flexShrink: 0,
        background: 'rgba(0, 98, 123, 0.10)',
      }}>
        {isAr ? '←' : '→'}
      </div>
      <div style={{ minWidth: 0 }}>{toSelect}</div>
    </div>
  );
}
