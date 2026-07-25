import React, { useState, useMemo, useRef, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { toArDigits } from '../i18n/translations.js';
import { Avatar } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';
import toast from '../lib/toast.js';
import { createMeeting, getMeetings, editMeeting } from '../api/services/meetingService.js';
import { listGuests } from '../api/services/guestService.js';

const ANCHOR = new Date();

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function initialsFromName(name) {
  const parts = (name || '').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

// Backend GetMeetingResponse -> the shape this view renders internally.
function mapMeeting(m) {
  return {
    id: m.id,
    title: m.name,
    date: m.date,
    startTime: (m.startTime || '').slice(0, 5),
    endTime: (m.endTime || '').slice(0, 5),
    location: m.location || '',
    notes: m.meetingAgenda || '',
    color: '#8d0134',
    guests: (m.guests || []).map(g => ({ id: g.id, name: g.name || '' })),
  };
}

export default function MeetingsView({ lang, activeEventId }) {
  const isAr = lang === 'ar';
  const ad = s => isAr ? toArDigits(String(s)) : String(s);

  const STR = isAr ? {
    title: 'الاجتماعات',
    sub: 'الجدول الأسبوعي · إدارة الاجتماعات الثنائية ومجموعات العمل',
    newMeeting: 'اجتماع جديد',
    today: 'اليوم',
    upcomingTitle: 'الاجتماعات القادمة',
    attendees: 'المشاركون',
    notes: 'ملاحظات',
    step1: 'التفاصيل', step2: 'المشاركون', step3: 'الملاحظات',
    meetingTitle: 'عنوان الاجتماع',
    date: 'التاريخ', startTime: 'وقت البدء', endTime: 'وقت الانتهاء',
    location: 'الموقع',
    searchGuest: 'بحث عن ضيف…',
    cancel: 'إلغاء', back: 'السابق', next: 'التالي', save: 'حفظ الاجتماع', saving: 'جارٍ الحفظ…',
    days: ['أح','اث','ث','أر','خ','ج','س'],
    months: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
    newTitle: 'اجتماع جديد',
    addAttendee: 'إضافة مشارك',
    noMeetings: 'لا اجتماعات هذا الأسبوع',
    meetingDetail: 'تفاصيل الاجتماع',
    noEvent: 'اختر فعالية أولاً',
    created: 'تم إنشاء الاجتماع بنجاح',
    editMeeting: 'تعديل الاجتماع', editTitle: 'تعديل الاجتماع',
    update: 'تحديث', updating: 'جارٍ التحديث…', updated: 'تم تحديث الاجتماع بنجاح',
    dateLocked: 'لا يمكن تغيير تاريخ الاجتماع بعد إنشائه',
  } : {
    title: 'Meetings',
    sub: 'Weekly schedule · bilateral and working group management',
    newMeeting: 'New meeting',
    today: 'Today',
    upcomingTitle: 'Upcoming meetings',
    attendees: 'Attendees',
    notes: 'Notes',
    step1: 'Details', step2: 'Attendees', step3: 'Notes',
    meetingTitle: 'Meeting title',
    date: 'Date', startTime: 'Start time', endTime: 'End time',
    location: 'Location',
    searchGuest: 'Search guest…',
    cancel: 'Cancel', back: 'Back', next: 'Next', save: 'Save Meeting', saving: 'Saving…',
    days: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    newTitle: 'New Meeting',
    addAttendee: 'Add attendee',
    noMeetings: 'No meetings this week',
    meetingDetail: 'Meeting detail',
    noEvent: 'Select an event first',
    created: 'Meeting created successfully',
    editMeeting: 'Edit meeting', editTitle: 'Edit Meeting',
    update: 'Update', updating: 'Updating…', updated: 'Meeting updated successfully',
    dateLocked: "A meeting's date can't be changed after it's created",
  };

  const [meetings, setMeetings] = useState([]);
  const [guestList, setGuestList] = useState([]);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newStep, setNewStep] = useState(1);
  const [newForm, setNewForm] = useState({ title:'', date: todayStr(), startTime:'09:00', endTime:'10:00', location:'' });
  const [newNotes, setNewNotes] = useState('');
  const [newAttendees, setNewAttendees] = useState([]);
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState(null);
  const calendarRef = useRef(null);

  useEffect(() => {
    if (!activeEventId) { setMeetings([]); return; }
    let cancelled = false;
    getMeetings(activeEventId)
      .then(res => { if (!cancelled) setMeetings((res || []).map(mapMeeting)); })
      .catch(() => { if (!cancelled) toast.error(isAr ? 'تعذر تحميل الاجتماعات' : 'Could not load meetings'); });
    return () => { cancelled = true; };
  }, [activeEventId]);

  useEffect(() => {
    if (!activeEventId) { setGuestList([]); return; }
    let cancelled = false;
    listGuests({ eventId: activeEventId, pageSize: 200, excludeDeclined: true })
      .then(res => { if (!cancelled) setGuestList(res?.items || []); })
      .catch(() => { if (!cancelled) setGuestList([]); });
    return () => { cancelled = true; };
  }, [activeEventId]);

  const filteredGuests = guestList
    .filter(g => !attendeeSearch || `${g.firstName} ${g.lastName}`.toLowerCase().includes(attendeeSearch.toLowerCase()))
    .slice(0, 6);

  const calendarEvents = useMemo(() => meetings.map(m => ({
    id: m.id,
    title: m.title,
    start: `${m.date}T${m.startTime}:00`,
    end: `${m.date}T${m.endTime}:00`,
    backgroundColor: m.color,
    borderColor: m.color,
    textColor: '#fff',
  })), [meetings]);

  function resetMeetingForm() {
    setShowNew(false);
    setNewStep(1);
    setEditingMeetingId(null);
    setNewForm({ title:'', date: todayStr(), startTime:'09:00', endTime:'10:00', location:'' });
    setNewNotes('');
    setNewAttendees([]);
    setAttendeeSearch('');
  }

  function openNewMeeting(prefilledDate) {
    resetMeetingForm();
    if (prefilledDate) setNewForm(f => ({ ...f, date: prefilledDate }));
    setShowNew(true);
  }

  function openEditMeeting(meeting) {
    setEditingMeetingId(meeting.id);
    setNewForm({
      title: meeting.title, date: meeting.date,
      startTime: meeting.startTime, endTime: meeting.endTime, location: meeting.location,
    });
    setNewNotes(meeting.notes);
    // The edit form's attendee chips render firstName/lastName (matching the
    // real guest-list shape); the meeting's own guests only carry a full name.
    setNewAttendees(meeting.guests.map(g => {
      const [firstName, ...rest] = g.name.split(' ');
      return { id: g.id, firstName, lastName: rest.join(' ') };
    }));
    setAttendeeSearch('');
    setNewStep(1);
    setSelectedMeeting(null);
    setShowNew(true);
  }

  async function saveNewMeeting() {
    if (!activeEventId) { toast.error(STR.noEvent); return; }
    setSaving(true);
    try {
      const guestIds = newAttendees.map(g => g.id);
      if (editingMeetingId) {
        const res = await editMeeting({
          meetId: editingMeetingId,
          eventId: activeEventId,
          name: newForm.title,
          location: newForm.location || null,
          startTime: newForm.startTime ? `${newForm.startTime}:00` : null,
          endTime: newForm.endTime ? `${newForm.endTime}:00` : null,
          agenda: newNotes || null,
          guestIds,
        });
        setMeetings(prev => prev.map(m => m.id === editingMeetingId ? mapMeeting(res) : m));
        toast.success(STR.updated);
      } else {
        const res = await createMeeting({
          eventId: activeEventId,
          name: newForm.title,
          date: newForm.date,
          location: newForm.location || null,
          startTime: newForm.startTime ? `${newForm.startTime}:00` : null,
          endTime: newForm.endTime ? `${newForm.endTime}:00` : null,
          meetingAgenda: newNotes || null,
          guestIds,
        });
        setMeetings(prev => [...prev, mapMeeting(res)]);
        toast.success(STR.created);
      }
      resetMeetingForm();
    } catch (err) {
      toast.fromError(err, editingMeetingId
        ? (isAr ? 'حدث خطأ أثناء تحديث الاجتماع' : 'Error updating meeting')
        : (isAr ? 'حدث خطأ أثناء إنشاء الاجتماع' : 'Error creating meeting'));
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
    borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block', fontSize: 11, color: 'var(--ink-mute)',
    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5,
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title}</h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
        <div className="page-actions">
          <button className="btn primary" onClick={() => openNewMeeting()}>
            <Icon name="plus" size={14}/> {STR.newMeeting}
          </button>
        </div>
      </div>

      <div className="meetings-layout" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Calendar card */}
        <div className="card meetings-calendar gms-fullcalendar" style={{ flex: 1, padding: 12, overflow: 'hidden', minWidth: 0 }}>
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            initialDate={ANCHOR}
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay,dayGridMonth' }}
            allDaySlot={false}
            nowIndicator
            height="auto"
            contentHeight={560}
            firstDay={0}
            events={calendarEvents}
            eventClick={(info) => {
              const m = meetings.find(x => x.id === info.event.id);
              if (m) setSelectedMeeting(m);
            }}
            dateClick={(info) => openNewMeeting(info.dateStr.slice(0, 10))}
            direction={isAr ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Upcoming sidebar */}
        <div className="meetings-sidebar" style={{ width: 250, flexShrink: 0 }}>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--glass-border)', fontWeight: 600, fontSize: 13 }}>
              {STR.upcomingTitle}
            </div>
            <div className="meetings-list-scroll" style={{ maxHeight: 580, overflowY: 'auto' }}>
              {meetings.length === 0 && (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 12 }}>
                  {STR.noMeetings}
                </div>
              )}
              {[...meetings]
                .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
                .map(m => {
                  const [, mo, dy] = m.date.split('-').map(Number);
                  const dateStr = `${STR.months[mo-1]} ${ad(dy)}`;
                  const firstAttendees = m.guests.slice(0, 3);
                  return (
                    <div key={m.id} onClick={() => setSelectedMeeting(m)}
                      style={{ padding: '12px 16px', borderBottom: '1px solid var(--glass-border)', cursor: 'pointer', display: 'flex', gap: 10 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-soft-2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div style={{ width: 4, borderRadius: 4, background: m.color, flexShrink: 0, alignSelf: 'stretch' }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, marginBottom: 3 }}>
                          {m.title}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', fontFamily: 'var(--mono)', marginBottom: 2 }}>
                          {dateStr} · {m.startTime}–{m.endTime}
                        </div>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-mute)', display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
                          <Icon name="venue" size={9}/>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.location}</span>
                        </div>
                        {firstAttendees.length > 0 && (
                          <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            {firstAttendees.map(g => <Avatar key={g.id} initials={initialsFromName(g.name)} size={16}/>)}
                            {m.guests.length > 3 && <span style={{ fontSize: 10, color: 'var(--ink-mute)' }}>+{m.guests.length - 3}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* Meeting detail drawer */}
      {selectedMeeting && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 499 }} onClick={() => setSelectedMeeting(null)}/>
          <div className="drawer open" style={{ width: 380, zIndex: 500 }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)' }}>{STR.meetingDetail}</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="icon-btn" title={STR.editMeeting} onClick={() => openEditMeeting(selectedMeeting)}>
                  <Icon name="edit" size={14}/>
                </button>
                <button className="icon-btn" onClick={() => setSelectedMeeting(null)}><Icon name="close" size={14}/></button>
              </div>
            </div>
            <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: selectedMeeting.color, marginTop: 8, flexShrink: 0 }}/>
                <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, margin: 0, fontWeight: 400, lineHeight: 1.3 }}>{selectedMeeting.title}</h2>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {(() => { const [, mo, dy] = selectedMeeting.date.split('-').map(Number); return (
                  <span className="chip"><Icon name="calendar" size={11}/> {STR.months[mo-1]} {ad(dy)}</span>
                ); })()}
                <span className="chip" style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{selectedMeeting.startTime}–{selectedMeeting.endTime}</span>
                <span className="chip"><Icon name="venue" size={11}/> {selectedMeeting.location}</span>
              </div>
              {selectedMeeting.notes && (
                <div style={{ fontSize: 13, color: 'var(--ink-dim)', marginBottom: 18, padding: '10px 14px', background: 'var(--surface-soft-2)', borderRadius: 8, lineHeight: 1.6 }}>
                  {selectedMeeting.notes}
                </div>
              )}
              <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-mute)', marginBottom: 10 }}>
                {STR.attendees} · {ad(selectedMeeting.guests.length)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedMeeting.guests.map(g => (
                  <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-soft-2)' }}>
                    <Avatar initials={initialsFromName(g.name)} size={28}/>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{g.name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* New Meeting modal */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card glass" style={{ width: 520, maxWidth: '90vw', padding: 0, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>{editingMeetingId ? STR.editTitle : STR.newTitle}</h3>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {[STR.step1, STR.step2, STR.step3].map((l, i) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: newStep === i+1 ? 'var(--accent)' : newStep > i+1 ? 'var(--ink-dim)' : 'var(--ink-mute)' }}>
                      <span style={{ width: 16, height: 16, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700,
                        background: newStep === i+1 ? 'var(--accent)' : newStep > i+1 ? 'var(--accent-deep)' : 'var(--surface-soft-4)',
                        color: newStep >= i+1 ? '#fff' : 'var(--ink-mute)' }}>{i+1}</span>
                      {l}
                      {i < 2 && <span style={{ color: 'var(--ink-faint)' }}>›</span>}
                    </span>
                  ))}
                </div>
              </div>
              <button className="icon-btn" onClick={resetMeetingForm}><Icon name="close" size={14}/></button>
            </div>

            <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {newStep === 1 && (
                <>
                  <div>
                    <label style={labelStyle}>{STR.meetingTitle}</label>
                    <input style={inputStyle} value={newForm.title}
                      onChange={e => setNewForm(f => ({...f, title: e.target.value}))}
                      placeholder={isAr ? 'مثل: اجتماع ثنائي – قطر / اليابان' : 'e.g. Bilateral Meeting – Qatar / Japan'}/>
                  </div>
                  <div>
                    <label style={labelStyle}>{STR.date}</label>
                    <input type="date" style={inputStyle} value={newForm.date} disabled={!!editingMeetingId}
                      onChange={e => setNewForm(f => ({...f, date: e.target.value}))}/>
                    {editingMeetingId && (
                      <div style={{ fontSize: 10.5, color: 'var(--ink-faint)', fontStyle: 'italic', marginTop: 4 }}>{STR.dateLocked}</div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>{STR.startTime}</label>
                      <input type="time" style={inputStyle} value={newForm.startTime} onChange={e => setNewForm(f => ({...f, startTime: e.target.value}))}/>
                    </div>
                    <div>
                      <label style={labelStyle}>{STR.endTime}</label>
                      <input type="time" style={inputStyle} value={newForm.endTime} onChange={e => setNewForm(f => ({...f, endTime: e.target.value}))}/>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>{STR.location}</label>
                    <input style={inputStyle} value={newForm.location}
                      onChange={e => setNewForm(f => ({...f, location: e.target.value}))}
                      placeholder={isAr ? 'مثل: جناح تنفيذي أ' : 'e.g. Executive Suite A'}/>
                  </div>
                </>
              )}

              {newStep === 2 && (
                <>
                  <div>
                    <label style={labelStyle}>{STR.searchGuest}</label>
                    <input style={inputStyle} value={attendeeSearch} onChange={e => setAttendeeSearch(e.target.value)} placeholder={STR.searchGuest}/>
                  </div>
                  {newAttendees.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {newAttendees.map(g => (
                        <span key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 4px', borderRadius: 20, background: 'rgba(141, 1, 52,0.15)', border: '1px solid rgba(141, 1, 52,0.3)', fontSize: 11.5 }}>
                          <Avatar initials={initialsFromName(`${g.firstName} ${g.lastName}`)} size={18}/>
                          {g.firstName} {g.lastName}
                          <button onClick={() => setNewAttendees(a => a.filter(x => x.id !== g.id))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)', padding: 0, display: 'flex', alignItems: 'center', marginLeft: 2 }}>
                            <Icon name="close" size={10}/>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {filteredGuests.filter(g => !newAttendees.some(a => a.id === g.id)).map(g => (
                      <div key={g.id} onClick={() => setNewAttendees(a => [...a, g])}
                        style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--glass-border)', background: 'var(--surface-soft-2)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-soft-3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-soft-2)'}>
                        <Avatar initials={initialsFromName(`${g.firstName} ${g.lastName}`)} size={28}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{g.firstName} {g.lastName}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{[g.tier, g.organization].filter(Boolean).join(' · ')}</div>
                        </div>
                        <Icon name="plus" size={13} style={{ color: 'var(--accent)', flexShrink: 0 }}/>
                      </div>
                    ))}
                    {guestList.length === 0 && (
                      <div style={{ padding: '12px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 12 }}>
                        {isAr ? 'لا يوجد ضيوف لهذه الفعالية' : 'No guests found for this event'}
                      </div>
                    )}
                  </div>
                </>
              )}

              {newStep === 3 && (
                <div>
                  <label style={labelStyle}>{STR.notes}</label>
                  <textarea style={{ ...inputStyle, height: 140, resize: 'vertical' }}
                    value={newNotes} onChange={e => setNewNotes(e.target.value)}
                    placeholder={isAr ? 'أضف ملاحظات أو جدول أعمال…' : 'Add meeting notes, agenda, or context…'}/>
                </div>
              )}
            </div>

            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <button className="btn" onClick={() => newStep > 1 ? setNewStep(s => s - 1) : resetMeetingForm()}>
                {newStep > 1 ? <><Icon name="arrowLeft" size={13}/> {STR.back}</> : STR.cancel}
              </button>
              {newStep < 3 ? (
                <button className="btn primary" onClick={() => setNewStep(s => s + 1)} disabled={newStep === 1 && !newForm.title}>
                  {STR.next} <Icon name="arrow" size={13}/>
                </button>
              ) : (
                <button className="btn primary" onClick={saveNewMeeting} disabled={saving}>
                  <Icon name="check" size={13}/>
                  {editingMeetingId ? (saving ? STR.updating : STR.update) : (saving ? STR.saving : STR.save)}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
