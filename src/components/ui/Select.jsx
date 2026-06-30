// Themed wrapper around react-select. Accepts/returns the raw value (not the
// option object) so it's a drop-in for native <select> usage.
import React from 'react';
import ReactSelect from 'react-select';

const styles = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    background: 'var(--surface-soft-3)',
    borderColor: state.isFocused ? 'var(--accent)' : 'var(--glass-border)',
    boxShadow: 'none',
    borderRadius: 8,
    fontSize: 13,
    ':hover': { borderColor: 'var(--accent)' },
  }),
  singleValue: (base) => ({ ...base, color: 'var(--ink)' }),
  input: (base) => ({ ...base, color: 'var(--ink)' }),
  placeholder: (base) => ({ ...base, color: 'var(--ink-mute)' }),
  menu: (base) => ({
    ...base,
    background: 'var(--bg-1, #0e1c24)',
    border: '1px solid var(--glass-border)',
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 3000,
  }),
  menuPortal: (base) => ({ ...base, zIndex: 3000 }),
  option: (base, state) => ({
    ...base,
    fontSize: 13,
    background: state.isSelected
      ? 'var(--accent)'
      : state.isFocused
      ? 'var(--surface-soft-3)'
      : 'transparent',
    color: state.isSelected ? '#fff' : 'var(--ink)',
    cursor: 'pointer',
  }),
  dropdownIndicator: (base) => ({ ...base, color: 'var(--ink-mute)', padding: 6 }),
  indicatorSeparator: (base) => ({ ...base, background: 'var(--glass-border)' }),
  clearIndicator: (base) => ({ ...base, color: 'var(--ink-mute)', padding: 6 }),
};

export default function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  isDisabled = false,
  isClearable = false,
  ...rest
}) {
  const selected = options.find((o) => o.value === value) ?? null;
  return (
    <ReactSelect
      classNamePrefix="gms-select"
      options={options}
      value={selected}
      onChange={(opt) => onChange(opt ? opt.value : '')}
      placeholder={placeholder}
      isDisabled={isDisabled}
      isClearable={isClearable}
      styles={styles}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
      menuPosition="fixed"
      {...rest}
    />
  );
}
