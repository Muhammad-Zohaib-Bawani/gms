// Themed date picker. Works with 'YYYY-MM-DD' strings in and out.
import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './datefield.css';
import { toDate, toIsoDate, toDateTime, toIsoDateTime } from '../../lib/date';

export default function DateField({
  value,
  onChange,
  minDate,
  maxDate,
  openToDate,
  placeholder = 'Select date',
  disabled = false,
  showTime = false,
}) {
  const parse = showTime ? toDateTime : toDate;
  const format = showTime ? toIsoDateTime : toIsoDate;
  return (
    <DatePicker
      selected={parse(value)}
      onChange={(d) => onChange(format(d))}
      minDate={minDate ? toDate(minDate) : undefined}
      maxDate={maxDate ? toDate(maxDate) : undefined}
      openToDate={!value && openToDate ? toDate(openToDate) : undefined}
      // Time via a native <input type="time"> under the calendar — one click to
      // focus, type or use the OS stepper. The scrolling 96-row time column
      // (showTimeSelect) was the part that made this unusable.
      showTimeInput={showTime}
      timeInputLabel={showTime ? 'Time' : undefined}
      dateFormat={showTime ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd'}
      // Jumping years/months one arrow-click at a time is the other half of the
      // pain — give the header real dropdowns.
      showMonthDropdown
      showYearDropdown
      dropdownMode="select"
      placeholderText={placeholder}
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
      isClearable={!disabled}
      showPopperArrow={false}
      className="gms-datefield-input"
      popperClassName="gms-datepicker-popper"
      wrapperClassName="gms-datefield-wrap"
    />
  );
}
