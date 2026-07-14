// Themed date picker. Works with 'YYYY-MM-DD' strings in and out.
import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './datefield.css';
import { toDate, toIsoDate } from '../../lib/date';

export default function DateField({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Select date',
  disabled = false,
}) {
  return (
    <DatePicker
      selected={toDate(value)}
      onChange={(d) => onChange(toIsoDate(d))}
      minDate={minDate ? toDate(minDate) : undefined}
      maxDate={maxDate ? toDate(maxDate) : undefined}
      dateFormat="yyyy-MM-dd"
      placeholderText={placeholder}
      disabled={disabled}
      // Picker-only — typing a free-text date risks an invalid/unparsable
      // value slipping through, so selection via the calendar is required.
      readOnly
      isClearable={!disabled}
      showPopperArrow={false}
      className="gms-datefield-input"
      popperClassName="gms-datepicker-popper"
      wrapperClassName="gms-datefield-wrap"
    />
  );
}
