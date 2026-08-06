// Themed wrapper around react-select. Accepts/returns the raw value (not the
// option object) so it's a drop-in for native <select> usage.
// Pass isMulti={true} for multi-select — value becomes string[] and onChange
// receives string[].
import React from 'react';
import ReactSelect, { components as RSComponents } from 'react-select';

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
    // zIndex: 3000,
  }),
  singleValue: (base) => ({ ...base, color: 'var(--ink)' }),
  multiValue: (base) => ({ ...base, background: 'rgba(141, 1, 52,0.15)', borderRadius: 5 }),
  multiValueLabel: (base) => ({ ...base, color: 'var(--ink)', fontSize: 12 }),
  multiValueRemove: (base) => ({
    ...base, color: 'var(--ink-mute)',
    ':hover': { background: 'rgba(141, 1, 52,0.25)', color: 'var(--ink)' },
  }),
  input: (base) => ({ ...base, color: 'var(--ink)' }),
  placeholder: (base) => ({ ...base, color: 'var(--ink-mute)' }),
  menu: (base) => ({
    ...base,
    background: 'var(--popover-bg, #33091e)',
    border: '1px solid var(--glass-border)',
    borderRadius: 8,
    overflow: 'hidden',
    zIndex: 99999,
    position: 'absolute',
  }),
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
    zIndex: 99999,
  }),
  dropdownIndicator: (base) => ({ ...base, color: 'var(--ink-mute)', padding: 6 }),
  indicatorSeparator: (base) => ({ ...base, background: 'var(--glass-border)' }),
  clearIndicator: (base) => ({ ...base, color: 'var(--ink-mute)', padding: 6 }),
};

// A long option list (e.g. Nationality) didn't scroll when opened inside a
// dialog. Radix's Dialog locks background scroll by listening for `wheel` on
// `document` and calling preventDefault() on anything outside the dialog's own
// portal — and this menu is portaled separately, straight to <body>, as a
// SIBLING of the dialog rather than a descendant (see the pointerEvents note
// below for why it's portaled at all: escaping the modal's motion.div, which
// sets a CSS transform and would otherwise trap a position:fixed/absolute
// menu inside its bounds). Radix's listener never learns this menu exists, so
// it treats every wheel tick over it as background scroll and blocks it.
// Stopping propagation here keeps the native scroll (nothing calls
// preventDefault) while stopping the event from ever reaching Radix's
// document-level listener.
function ScrollableMenuList(props) {
  return <RSComponents.MenuList {...props} innerProps={{ ...props.innerProps, onWheel: (e) => e.stopPropagation() }} />;
}

export default function Select({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  isDisabled = false,
  isClearable = false,
  isMulti = false,
  components: componentsOverride,
  ...rest
}) {
  const selected = isMulti
    ? (value || []).map(v => options.find(o => o.value === v)).filter(Boolean)
    : (options.find((o) => o.value === value) ?? null);

  function handleChange(opt) {
    if (isMulti) {
      onChange((opt || []).map(o => o.value));
    } else {
      onChange(opt ? opt.value : '');
    }
  }

  return (
    <ReactSelect
      classNamePrefix="gms-select"
      options={options}
      value={selected}
      onChange={handleChange}
      placeholder={placeholder}
      isDisabled={isDisabled}
      isClearable={isClearable}
      isMulti={isMulti}
      menuPortalTarget={document.body}
      components={{ MenuList: ScrollableMenuList, ...componentsOverride }}
      styles={{
    ...styles,
    // Radix Dialog sets `pointer-events: none` on <body> while open, only
    // re-enabling it on the dialog's own content node. This menu is portaled
    // straight to <body> as a sibling, so without an explicit override here
    // it inherits `none` and becomes unclickable while still visible.
    menuPortal: (base) => ({
      ...base,
      zIndex: 999999,
      pointerEvents: 'auto',
    }),
  }}
      // menuPosition="fixed"
      menuPlacement="auto"
      maxMenuHeight={200}
      menuShouldScrollIntoView={true}
      {...rest}
    />
  );
}
