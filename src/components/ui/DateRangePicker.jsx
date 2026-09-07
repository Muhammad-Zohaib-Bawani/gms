// One control for a date (or datetime) RANGE — a flight's departure→arrival, a
// transfer's pickup→dropoff, a hotel's check-in→check-out.
//
// Shape: the form shows a read-only SUMMARY CARD, and picking happens in a small
// modal opened from it. Earlier revisions put the calendar straight into the form
// (~300px of every modal, pushing the real fields below the fold) and then into a
// popover (still a raw calendar hanging off a field). A card states the answer in
// the layout's own language — labelled halves, an icon per end, the span
// underneath — and keeps the calendar out of the form entirely.
//
// The modal edits a DRAFT and commits on Apply, so Cancel really discards and
// nothing re-saves while the user is still adjusting a time.
//
// Two modes:
//   'datetime' — flight / transport. Values are 'YYYY-MM-DDTHH:mm', and the
//                modal carries a merged two-half time control under the calendar.
//   'date'     — accommodation. Values are 'YYYY-MM-DD', no times. Check-out is
//                the morning after the last night, so `endMaxFor` bounds it
//                rather than maxDate (see the availability note below).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './datefield.css';
import { Icon } from '../Icons.jsx';
import { toDate, toDateTime, toIsoDate, fmtDate, addDaysIso } from '../../lib/date';

// 'YYYY-MM-DDTHH:mm' → { date, time }. Blank-safe; date mode just leaves time ''.
function split(iso) {
  if (!iso) return { date: '', time: '' };
  const [date, time] = String(iso).split('T');
  return { date: date || '', time: (time || '').slice(0, 5) };
}
const joinDT = (date, time) => (date ? `${date}T${time || '00:00'}` : '');

// A native <input type="time"> reports '' until BOTH segments are valid, so a
// full HH:mm is the only reliable "this one is filled in" signal.
const COMPLETE_TIME = /^\d{2}:\d{2}$/;
// ...but it isn't sufficient alone: typing "14:30" passes through the
// complete-but-wrong '14:03' on the way (minute '3' before '30'), and the OS
// stepper walks a complete value on every press. So the focus hand-off waits for
// the value to settle instead of firing on the first complete one.
const SETTLE_MS = 700;

const dayCount = (a, b) => {
  const s = toDate(a);
  const e = toDate(b);
  if (!s || !e) return 0;
  return Math.round((e - s) / 86400000);
};

export default function DateRangePicker({
  mode = 'datetime',
  startValue, endValue, onChange,
  minDate, maxDate, excludeDates, endMaxFor, maxRangeDays,
  // datetime mode: a hard cap on the real start→end span. maxRangeDays alone
  // can't express this — two dates one day apart are anywhere from 1 minute to
  // 47h59 apart once times are involved — so this is checked on the actual
  // datetimes and blocks Apply, while still narrowing the calendar to the days
  // that could possibly satisfy it.
  maxSpanHours,
  startLabel, endLabel,
  startIcon = 'calendar', endIcon = 'calendar',
  title,
  // Rendered under the calendar in the modal — e.g. the rooms-left note.
  hint,
  monthsShown = 1,
  isAr = false,
  disabled = false,
}) {
  const withTime = mode === 'datetime';
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ start: '', end: '' });

  const s = split(draft.start);
  const e = split(draft.end);
  const committed = { start: split(startValue), end: split(endValue) };
  const hasValue = !!committed.start.date;

  const triggerRef = useRef(null);
  // Where the picker's own overlay gets portaled.
  //
  // <body> is right when this field sits on a plain page, but NOT inside a Radix
  // dialog (Add Guest, the guest-detail edit modals): Radix traps focus inside
  // its content, so anything portaled to <body> has focus yanked straight back.
  // Day cells survived that — they're click handlers — but a native time input
  // needs to HOLD focus, which is why dates were selectable and times weren't.
  // Portaling into the dialog puts the picker inside the focus scope.
  const [portalHost, setPortalHost] = useState(null);

  const startTimeRef = useRef(null);
  const endTimeRef = useRef(null);
  const settleTimer = useRef(null);
  const [focusTarget, setFocusTarget] = useState(null); // 'start' | 'end' | null

  // What the two time inputs actually display. It CANNOT be read back off the
  // draft: a native <input type="time"> reports '' until both segments are
  // valid, and joinDT turns an empty time into '00:00' — so on the very first
  // keystroke the draft became 00:00 and, the input being controlled, React
  // wrote that straight back over what was being typed. The field looked
  // frozen. Raw strings live here and only reach the draft once complete.
  const [rawTimes, setRawTimes] = useState({ start: '', end: '' });

  const cancelSettle = () => clearTimeout(settleTimer.current);
  useEffect(() => cancelSettle, []);

  const openPicker = () => {
    if (disabled) return;
    // Resolved per open rather than once: the same field can be rendered on a
    // page or inside a dialog depending on the caller.
    setPortalHost(triggerRef.current?.closest('[role="dialog"]') || document.body);
    setDraft({ start: startValue || '', end: endValue || '' });
    setRawTimes({
      start: split(startValue).time,
      end: split(endValue).time,
    });
    setFocusTarget(null);
    setOpen(true);
  };
  const closePicker = useCallback(() => {
    cancelSettle();
    setFocusTarget(null);
    setOpen(false);
  }, []);

  // Escape closes without committing, like any other dismissable layer.
  useEffect(() => {
    if (!open) return;
    const onKey = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); closePicker(); } };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, closePicker]);

  // Keyed on the draft too: the target input is still `disabled` on the render
  // that asks for focus (its date landed in the same change), so this re-runs on
  // the render that enables it and focuses then.
  useEffect(() => {
    if (!focusTarget) return;
    const el = focusTarget === 'start' ? startTimeRef.current : endTimeRef.current;
    if (!el || el.disabled) return;
    el.focus();
    setFocusTarget(null);
  }, [focusTarget, draft.start, draft.end]);

  const settleThen = (fn) => {
    cancelSettle();
    settleTimer.current = setTimeout(fn, SETTLE_MS);
  };

  // While the end is unpicked the bounds differ from the start's: it must land
  // after the start, no further than maxRangeDays, and no further than
  // endMaxFor (which is what stops a hotel stay running THROUGH a full night).
  const pickingEnd = !!s.date && !e.date;
  // A 24h cap can still straddle midnight, so the day allowance rounds UP —
  // the exact hour check below is what actually rejects an over-long span.
  const spanDayCap = withTime && maxSpanHours ? Math.ceil(maxSpanHours / 24) : null;
  const dayCap = [maxRangeDays, spanDayCap]
    .filter((v) => v != null)
    .sort((a, b) => a - b)[0];
  const cap = pickingEnd && dayCap != null ? addDaysIso(s.date, dayCap) : null;
  const endCap = pickingEnd ? (endMaxFor?.(s.date) || null) : null;
  const upper = [maxDate, cap, endCap].filter(Boolean).sort()[0];
  // Date mode is nights: the check-out is the day AFTER the last one slept, so
  // it may never equal the check-in. Datetime mode allows same-day (a flight
  // usually departs and lands the same date — the times separate them).
  const lower = pickingEnd && !withTime ? addDaysIso(s.date, 1) : minDate;

  const onRange = ([sd, ed]) => {
    const sDate = toIsoDate(sd) || '';
    const eDate = toIsoDate(ed) || '';
    // Times come from what the inputs are showing, not the draft — picking days
    // must not discard a time that's been typed. The end inherits the start's
    // when it has none of its own.
    const sTime = rawTimes.start;
    const eTime = rawTimes.end || sTime;
    setDraft({
      start: withTime ? joinDT(sDate, sTime) : sDate,
      end: withTime ? joinDT(eDate, eTime) : eDate,
    });
    if (withTime && eDate && eTime !== rawTimes.end) {
      setRawTimes((r) => ({ ...r, end: eTime }));
    }
    cancelSettle();
    // Days done — move on to the times rather than making the user aim for them.
    if (withTime && sDate && eDate) setFocusTarget('start');
  };

  const setStartTime = (t) => {
    // Always keep what was typed, so the input never fights the typist.
    setRawTimes((r) => ({ ...r, start: t }));
    cancelSettle();
    // Only a complete HH:mm is worth writing to the draft. A mid-entry '' must
    // NOT go through joinDT, which would silently make it 00:00.
    if (!COMPLETE_TIME.test(t)) return;
    setDraft((d) => ({ ...d, start: joinDT(s.date, t) }));
    settleThen(() => setFocusTarget('end'));
  };
  const setEndTime = (t) => {
    setRawTimes((r) => ({ ...r, end: t }));
    // End of the chain — deliberately no auto-close. A time input keeps firing
    // while the user is still adjusting, so closing on "looks complete" yanked
    // the modal away mid-edit. Committing stays explicit: Apply.
    cancelSettle();
    if (!COMPLETE_TIME.test(t)) return;
    setDraft((d) => ({ ...d, end: joinDT(e.date, t) }));
  };

  // Measured on the real datetimes, so 10th 00:00 → 11th 23:00 is caught as 47h
  // even though the two days are only one apart.
  const spanHours = (() => {
    if (!withTime || !s.date || !e.date) return null;
    const a = toDateTime(draft.start);
    const b = toDateTime(draft.end);
    if (!a || !b) return null;
    return (b - a) / 3600000;
  })();
  const tooLong = maxSpanHours != null && spanHours != null && spanHours > maxSpanHours;
  const backwards = spanHours != null && spanHours < 0;
  const spanError = tooLong
    ? (isAr
      ? `المدة لا يمكن أن تتجاوز ${maxSpanHours} ساعة`
      : `Can't be longer than ${maxSpanHours} hours`)
    : backwards
      ? (isAr
        ? `${endLabel} يجب أن يكون بعد ${startLabel}`
        : `${endLabel} must be after ${startLabel}`)
      : null;

  const apply = () => {
    cancelSettle();
    onChange(draft.start, draft.end);
    setOpen(false);
  };
  const clearAll = () => {
    cancelSettle();
    setFocusTarget(null);
    setDraft({ start: '', end: '' });
  };

  const arrow = isAr ? '←' : '→';
  const span = hasValue && committed.end.date
    ? dayCount(committed.start.date, committed.end.date)
    : null;
  const spanText = span === null
    ? ''
    : withTime
      ? (span === 0
        ? (isAr ? 'نفس اليوم' : 'Same day')
        : (isAr ? `${span} يوم` : `${span} day${span > 1 ? 's' : ''}`))
      : (isAr ? `${span} ليلة` : `${span} night${span > 1 ? 's' : ''}`);

  const End = ({ icon, label, part, muted }) => (
    <div className="gms-drp-end">
      <div className="gms-drp-end-head">
        <Icon name={icon} size={13} />
        <span>{label}</span>
      </div>
      <div className={`gms-drp-end-date${muted ? ' is-muted' : ''}`}>
        {part.date ? fmtDate(part.date) : (isAr ? 'غير محدد' : 'Not set')}
      </div>
      {withTime && <div className="gms-drp-end-time">{part.time || '--:--'}</div>}
    </div>
  );

  return (
    <>
      {/* ── The form-side card ───────────────────────────────────────────── */}
      {hasValue ? (
        <button
          ref={triggerRef}
          type="button"
          className="gms-drp-card"
          onClick={openPicker}
          disabled={disabled}
        >
          <div className="gms-drp-card-body">
            <End icon={startIcon} label={startLabel} part={committed.start} />
            <span className="gms-drp-card-arrow">{arrow}</span>
            <End
              icon={endIcon}
              label={endLabel}
              part={committed.end}
              muted={!committed.end.date}
            />
          </div>
          <div className="gms-drp-card-foot">
            <span>{spanText}</span>
            <span className="gms-drp-card-edit">
              <Icon name="edit" size={12} />
              {isAr ? 'تعديل' : 'Change'}
            </span>
          </div>
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          className="gms-drp-empty"
          onClick={openPicker}
          disabled={disabled}
        >
          <Icon name="calendar" size={15} />
          <span>
            {withTime
              ? (isAr ? 'اختر التاريخ والوقت' : 'Select date & time')
              : (isAr ? 'اختر التواريخ' : 'Select dates')}
          </span>
        </button>
      )}

      {/* ── The picker modal ─────────────────────────────────────────────────
          Portaled to `portalHost` — the enclosing Radix dialog when there is
          one, else <body>. See the note on that state for why.
          Its own portal + overlay rather than <Modal>: these fields already sit
          inside dialogs (Radix at z-index 1001, and the hand-rolled travel
          overlays at 1000), so a plain layer above both avoids nesting focus
          traps inside one another. */}
      {open && createPortal(
        <div
          className="gms-drp-overlay"
          onMouseDown={(ev) => { if (ev.target === ev.currentTarget) closePicker(); }}
          dir={isAr ? 'rtl' : 'ltr'}
        >
          <div className="gms-drp-modal card glass modal-solid" role="dialog" aria-modal="true">
            <div className="gms-drp-modal-head">
              <div className="gms-drp-modal-title">
                {title || (withTime
                  ? (isAr ? 'التاريخ والوقت' : 'Date & Time')
                  : (isAr ? 'التواريخ' : 'Dates'))}
              </div>
              <button type="button" className="icon-btn" onClick={closePicker}>
                <Icon name="close" size={14} />
              </button>
            </div>

            <div className="gms-drp-modal-body">
              {/* Live read-out of the draft, so the two ends stay named while
                  clicking days — a bare calendar can't say which is which. */}
              <div className="gms-drp-draft">
                <div className={`gms-drp-draft-end${!s.date ? ' is-empty' : ''}${pickingEnd ? '' : ' '}`}>
                  <div className="gms-drp-draft-label">
                    <Icon name={startIcon} size={12} />
                    <span>{startLabel}</span>
                  </div>
                  <div className="gms-drp-draft-val">
                    {s.date ? fmtDate(s.date) : (isAr ? '—' : '—')}
                    {/* rawTimes, not the draft: the draft defaults an unset
                        time to 00:00, which would read as a real choice. */}
                    {withTime && s.date && <em>{rawTimes.start || '--:--'}</em>}
                  </div>
                </div>
                <span className="gms-drp-draft-arrow">{arrow}</span>
                <div className={`gms-drp-draft-end${!e.date ? ' is-empty' : ''}${pickingEnd ? ' is-next' : ''}`}>
                  <div className="gms-drp-draft-label">
                    <Icon name={endIcon} size={12} />
                    <span>{endLabel}</span>
                  </div>
                  <div className="gms-drp-draft-val">
                    {e.date ? fmtDate(e.date) : (isAr ? '—' : '—')}
                    {withTime && e.date && <em>{rawTimes.end || '--:--'}</em>}
                  </div>
                </div>
              </div>

              <div className="gms-daterange gms-drp-cal">
                <DatePicker
                  inline
                  selectsRange
                  // `selected` is what marks the start day while the end is
                  // still unpicked: react-datepicker only assigns --range-start
                  // once BOTH ends exist, so without it the day falls back to
                  // its washed-out --keyboard-selected style.
                  selected={toDate(s.date)}
                  startDate={toDate(s.date)}
                  endDate={toDate(e.date)}
                  onChange={onRange}
                  minDate={lower ? toDate(lower) : undefined}
                  maxDate={upper ? toDate(upper) : undefined}
                  // Nothing is greyed while picking the end: the cap alone is
                  // the rule there, which is why an end may legitimately land
                  // on a night that is itself full.
                  excludeDates={!pickingEnd && excludeDates?.length
                    ? excludeDates.map(toDate).filter(Boolean)
                    : undefined}
                  openToDate={!s.date && minDate ? toDate(minDate) : undefined}
                  monthsShown={monthsShown}
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  showPopperArrow={false}
                />
              </div>

              {withTime && (
                <div className="gms-range-times">
                  <div className="gms-range-times-half">
                    <span className="gms-range-times-label">{startLabel}</span>
                    <input
                      ref={startTimeRef}
                      type="time"
                      value={rawTimes.start}
                      disabled={!s.date}
                      onChange={(ev) => setStartTime(ev.target.value)}
                    />
                  </div>
                  <span className="gms-range-times-sep">{arrow}</span>
                  <div className="gms-range-times-half">
                    <span className="gms-range-times-label">{endLabel}</span>
                    <input
                      ref={endTimeRef}
                      type="time"
                      value={rawTimes.end}
                      disabled={!e.date}
                      onChange={(ev) => setEndTime(ev.target.value)}
                    />
                  </div>
                </div>
              )}

              {spanError && (
                <div className="gms-drp-error">
                  <Icon name="alert" size={13} />
                  <span>{spanError}</span>
                </div>
              )}
              {hint && <div className="gms-drp-hint">{hint}</div>}
            </div>

            <div className="gms-drp-modal-foot">
              <button type="button" className="gms-range-link" onClick={clearAll}>
                {isAr ? 'مسح' : 'Clear'}
              </button>
              <div style={{ flex: 1 }} />
              <button type="button" className="btn" onClick={closePicker}>
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={apply}
                disabled={!s.date || !e.date || !!spanError}
              >
                <Icon name="check" size={13} />
                {isAr ? 'تطبيق' : 'Apply'}
              </button>
            </div>
          </div>
        </div>,
        portalHost || document.body,
      )}
    </>
  );
}
