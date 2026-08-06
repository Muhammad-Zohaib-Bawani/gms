// Themed date picker. Works with ISO 'YYYY-MM-DD' (or 'YYYY-MM-DDTHH:mm')
// strings in and out, and shows DD-MM-YYYY — the portal's one display format.
import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './datefield.css';
import {
  toDate, toIsoDate, toDateTime, toIsoDateTime,
  DISPLAY_DATE_FORMAT, DISPLAY_DATETIME_FORMAT,
} from '../../lib/date';

export default function DateField({
  value,
  onChange,
  minDate,
  maxDate,
  // 'YYYY-MM-DD' strings to grey out inside the allowed range — e.g. nights a
  // hotel has no rooms left. Unlike minDate/maxDate these punch holes in it.
  excludeDates,
  openToDate,
  // Defaults to the format itself, so a field shows what shape it expects.
  placeholder,
  disabled = false,
  showTime = false,
  // Pass on genuinely optional fields to get a small "Clear" link under the
  // input once a date is set. Opt-in: required fields have nothing to clear to,
  // and this deliberately replaces react-datepicker's built-in blue × (see below).
  clearable = false,
  clearLabel = 'Clear',
}) {
  const parse = showTime ? toDateTime : toDate;
  const format = showTime ? toIsoDateTime : toIsoDate;

  return (
    <>
    <DatePicker
      selected={parse(value)}
      onChange={(d) => onChange(format(d))}
      minDate={minDate ? toDate(minDate) : undefined}
      maxDate={maxDate ? toDate(maxDate) : undefined}
      excludeDates={excludeDates?.length ? excludeDates.map(toDate).filter(Boolean) : undefined}
      openToDate={!value && openToDate ? toDate(openToDate) : undefined}
      // Time via a native <input type="time"> under the calendar — one click to
      // focus, type or use the OS stepper. The scrolling 96-row time column
      // (showTimeSelect) was the part that made this unusable.
      showTimeInput={showTime}
      timeInputLabel={showTime ? 'Time' : undefined}
      dateFormat={showTime ? DISPLAY_DATETIME_FORMAT : DISPLAY_DATE_FORMAT}
      // Date-only closes on pick. With a time input it must stay open — the time
      // isn't set yet — closing instead on outside click/Escape/tab, same as any
      // other open popover. NOT auto-close on time change: a native time input
      // fires per segment, so stepping the hour would shut the calendar before
      // the minutes were touched.
      shouldCloseOnSelect={!showTime}
      // Jumping years/months one arrow-click at a time is the other half of the
      // pain — give the header real dropdowns.
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
      placeholderText={placeholder ?? (showTime ? 'DD-MM-YYYY HH:mm' : 'DD-MM-YYYY')}
      disabled={disabled}
      // The calendar lives inside scrollable modals; fixed positioning keeps it
      // from being clipped by (or scrolling away from) the container.
      popperProps={{ strategy: 'fixed' }}
      // Picker-only — typing a free-text date risks an invalid/unparsable
      // value slipping through, so selection via the calendar is required.
      // NOTE: the native `readOnly` prop looks like the right tool here, but
      // react-datepicker's own onInputClick checks `!props.readOnly` before
      // opening the calendar — so readOnly also blocks opening it by click,
      // not just typing. Block raw text entry instead, via onChangeRaw.
      onChangeRaw={(e) => e.preventDefault()}
      // Never react-datepicker's own clear: it's an unthemed blue × pinned inside
      // the field, and it appears on every field whether or not the date is
      // optional. Optional fields opt into the `clearable` link below instead.
      isClearable={false}
      showPopperArrow={false}
      className="gms-datefield-input"
      popperClassName="gms-datepicker-popper"
      wrapperClassName="gms-datefield-wrap"
    />
    {clearable && value && !disabled && (
      <button type="button" className="gms-datefield-clear" onClick={() => onChange('')}>
        {clearLabel}
      </button>
    )}
    </>
  );
}
