// An always-open calendar that picks a date RANGE, for the one place a range is
// the whole question being asked: a hotel stay. Two separate date fields made
// the user hold "which nights are actually free" in their head across two
// popups; one calendar shows the window, the sold-out nights and the stay all at
// once. ISO 'YYYY-MM-DD' strings in and out, like DateField.
//
// Picking happens in two phases, and the bounds differ between them:
//   start — anywhere in the held window, sold-out nights greyed out
//   end   — after the start, and no further than `endMaxFor(start)`, which is
//           what stops a stay from running THROUGH a sold-out night
// The end is a check-out, not a night slept, so nothing is greyed while picking
// it — the cap alone is the rule. That is also why an end may legitimately land
// on a night that is itself full.
import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './datefield.css';
import { toDate, toIsoDate, addDaysIso } from '../../lib/date';

export default function DateRangeCalendar({
  start, end, onChange,
  minDate, maxDate, excludeDates,
  // (startIso) → last selectable end date. Optional; falls back to maxDate.
  endMaxFor,
  monthsShown = 1,
  isAr = false,
}) {
  // A start with no end yet means the next click is the check-out.
  const pickingEnd = !!start && !end;
  const min = pickingEnd ? addDaysIso(start, 1) : minDate;
  const max = pickingEnd ? (endMaxFor?.(start) || maxDate) : maxDate;

  return (
    <div className="gms-daterange">
      <DatePicker
        inline
        selectsRange
        // `selected` is what marks the check-in day while the check-out is still
        // unpicked: react-datepicker only assigns --range-start once BOTH ends
        // exist, so without this the day would fall back to --keyboard-selected
        // (its washed-out preselection style) and not read as chosen at all.
        selected={toDate(start)}
        startDate={toDate(start)}
        endDate={toDate(end)}
        onChange={([s, e]) => onChange(toIsoDate(s) || '', toIsoDate(e) || '')}
        minDate={min ? toDate(min) : undefined}
        maxDate={max ? toDate(max) : undefined}
        excludeDates={!pickingEnd && excludeDates?.length
          ? excludeDates.map(toDate).filter(Boolean)
          : undefined}
        // The window is a handful of days, so opening on the month that holds it
        // beats opening on today.
        openToDate={!start && min ? toDate(min) : undefined}
        monthsShown={monthsShown}
        showPopperArrow={false}
        calendarClassName="gms-daterange-cal"
      />
      {start && (
        <button
          type="button"
          className="gms-datefield-clear"
          onClick={() => onChange('', '')}
        >
          {isAr ? 'مسح' : 'Clear'}
        </button>
      )}
    </div>
  );
}
