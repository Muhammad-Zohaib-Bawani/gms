import { useState } from 'react';
import { Icon } from '../../components/Icons';
import Select from '../../components/ui/Select';
import DateField from '../../components/ui/DateField';
import { toast } from '../../lib/toast';
import { startOfToday, toDate } from '../../lib/date';
import LogoInput from './LogoInput';

// Hoisted to module scope — see EventForm's comment above for why.
export default function SessionForm({ session, evId, event, onSave, onCancel, isAr, STR, venues, venuesLoading }) {
  const [form, setForm] = useState({ ...session });

  function trySave() {
    if (!form.title?.trim()) { toast.warning(isAr ? "عنوان الجلسة مطلوب" : "Session title is required"); return; }
    if (!form.date) { toast.warning(isAr ? "تاريخ الجلسة مطلوب" : "Session date is required"); return; }
    if (!form.time) { toast.warning(isAr ? "وقت الجلسة مطلوب" : "Session time is required"); return; }
    if (event?.startDate && toDate(form.date) < toDate(event.startDate)) {
      toast.warning(isAr ? "تاريخ الجلسة قبل بداية الفعالية" : "Session date is before the event start date"); return;
    }
    if (event?.endDate && toDate(form.date) > toDate(event.endDate)) {
      toast.warning(isAr ? "تاريخ الجلسة بعد نهاية الفعالية" : "Session date is after the event end date"); return;
    }
    if (!(Number(form.capacity) > 0)) { toast.warning(isAr ? "السعة يجب أن تكون أكبر من صفر" : "Capacity must be greater than zero"); return; }
    onSave(evId, { ...form, capacity: +form.capacity });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <label className="ev-field-label">{STR.sTitle}</label>
        <input className="ev-field-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label className="ev-field-label">{STR.sDate}</label>
          <DateField value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))}
            minDate={event?.startDate || startOfToday()} maxDate={event?.endDate || undefined} placeholder={STR.sDate} />
        </div>
        <div>
          <label className="ev-field-label">{STR.sTime}</label>
          <input type="time" className="ev-field-input" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}/>
        </div>
        <div>
          <label className="ev-field-label">{STR.sVenue}</label>
          {venuesLoading ? (
            <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{isAr ? "جارٍ التحميل…" : "Loading…"}</div>
          ) : (
            <Select
              value={form.venueId || ""}
              onChange={v => setForm(f => ({ ...f, venueId: v || "" }))}
              placeholder={isAr ? "— اختر مكاناً —" : "— Select venue —"}
              options={(venues || []).map(v => ({ value: v.id, label: v.name }))}
              isClearable
            />
          )}
        </div>
        <div>
          <label className="ev-field-label">{STR.sRoom}</label>
          <input className="ev-field-input" value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))} placeholder={isAr ? "مثال: قاعة المياسة" : "e.g. Al Mayassa Hall"}/>
        </div>
        <div>
          <label className="ev-field-label">{STR.sCapacity}</label>
          <input type="number" className="ev-field-input" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}/>
        </div>
      </div>
      <div>
        <label className="ev-field-label">{STR.sSpeaker}</label>
        <input className="ev-field-input" value={form.speaker} onChange={e => setForm(f => ({ ...f, speaker: e.target.value }))}/>
      </div>
      <LogoInput label={STR.sImage }
        value={form.image || ""} onChange={v => setForm(f => ({ ...f, image: v }))} isAr={isAr}/>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button className="btn" onClick={onCancel}>{STR.cancel}</button>
        <button className="btn primary" onClick={trySave} disabled={!form.title}>
          <Icon name="check" size={13}/> {STR.save}
        </button>
      </div>
    </div>
  );
}
