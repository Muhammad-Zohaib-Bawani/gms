import { useState } from 'react';
import { Icon } from '../../components/Icons';
import Select from '../../components/ui/Select';
import DateField from '../../components/ui/DateField';
import { toast } from '../../lib/toast';
import { startOfToday, isPastDate, toDate } from '../../lib/date';
import { DEFAULT_UI_THEME, getStoredThemes } from './eventsView.helpers';
import GuestModelPicker from './GuestModelPicker';
import LogoInput from './LogoInput';

// Hoisted to module scope (not redefined per EventsView render) so typed-but-
// unsaved form state survives unrelated parent re-renders — e.g. reload()
// after a session edit no longer resets whatever the user is mid-typing here.
export default function EventForm({ ev, onSave, onCancel, isNew = false, isAr, STR, venues, venuesLoading, eventTypes, eventTypesLoading }) {
  const [form, setForm] = useState(() => {
    // Older events saved before VenueId was tracked only have a venue name —
    // match it against the current venues list so the dropdown doesn't open
    // empty for them.
    if (!ev.venueId && ev.venue) {
      const matched = venues.find(v => v.name === ev.venue);
      if (matched) return { ...ev, venueId: matched.id };
    }
    return { ...ev };
  });
  const [uiTheme, setUiTheme] = useState(() => {
    if (ev.appKey) {
      const stored = getStoredThemes()[ev.appKey];
      return stored ? { ...DEFAULT_UI_THEME, ...stored } : { ...DEFAULT_UI_THEME };
    }
    return ev.uiTheme ? { ...DEFAULT_UI_THEME, ...ev.uiTheme } : { ...DEFAULT_UI_THEME };
  });

  function trySave() {
    if (!form.title?.trim()) {
      toast.warning(isAr ? "اسم الفعالية مطلوب" : "Event title is required"); return;
    }
    if (isNew && isPastDate(form.startDate)) {
      toast.warning(isAr ? "لا يمكن أن يكون تاريخ البداية في الماضي" : "Start date can't be in the past"); return;
    }
    if (form.startDate && form.endDate && toDate(form.endDate) < toDate(form.startDate)) {
      toast.warning(isAr ? "تاريخ النهاية لا يمكن أن يسبق تاريخ البداية" : "End date can't be before the start date"); return;
    }
    onSave({ ...form, uiTheme });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <label className="ev-field-label">{STR.fTitle}</label>
        <input type="text" className="ev-field-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/>
      </div>
      <div>
        <label className="ev-field-label">{STR.fVenue}</label>
        {venuesLoading ? (
          <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{isAr ? "جارٍ التحميل…" : "Loading…"}</div>
        ) : venues.length === 0 ? (
          <div style={{ fontSize: 12, color: "#e0a04e", padding: "8px 11px", background: "rgba(224,160,78,0.08)", border: "1px solid rgba(224,160,78,0.25)", borderRadius: 8 }}>
            {isAr ? "يرجى إضافة مكان أولاً" : "Please add a venue first"}
          </div>
        ) : (
          <Select
            value={form.venueId || ""}
            onChange={v => {
              const picked = venues.find(x => x.id === v);
              setForm(f => ({ ...f, venueId: v || "", venue: picked?.name || "" }));
            }}
            placeholder={isAr ? "— اختر مكاناً —" : "— Select venue —"}
            options={venues.map(v => ({ value: v.id, label: v.name }))}
            isClearable
          />
        )}
      </div>
      <div>
        <label className="ev-field-label">{STR.fGuestModel}</label>
        <GuestModelPicker
          value={form.guestModel || "flexible"}
          onChange={v => setForm(f => ({ ...f, guestModel: v }))}
          STR={STR}
        />
      </div>
      <div>
        <label className="ev-field-label">{STR.fType}</label>
        {eventTypesLoading ? (
          <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{isAr ? "جارٍ التحميل…" : "Loading…"}</div>
        ) : (
          <Select value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))}
            options={eventTypes.map(t => ({ value: t.name, label: t.name }))} />
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="ev-field-label">{STR.fStart}</label>
          <DateField value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))}
            minDate={isNew ? startOfToday() : undefined} placeholder={STR.fStart} />
        </div>
        <div>
          <label className="ev-field-label">{STR.fEnd}</label>
          <DateField value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))}
            minDate={form.startDate || (isNew ? startOfToday() : undefined)} placeholder={STR.fEnd} />
        </div>
      </div>
      <LogoInput label={STR.fImage}
        value={form.image} onChange={v => setForm(f => ({ ...f, image: v }))} isAr={isAr}/>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
        <button className="btn" onClick={onCancel}>{STR.cancel}</button>
        <button className="btn primary" onClick={trySave} disabled={!form.title}>
          <Icon name="check" size={13}/> {STR.save}
        </button>
      </div>
    </div>
  );
}
