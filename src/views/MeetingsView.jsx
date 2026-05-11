import React, { useState } from 'react';
import { toArDigits } from '../i18n/translations.js';
import { Avatar } from '../components/UI.jsx';
import { Icon } from '../components/Icons.jsx';
import { GUESTS, MEETINGS } from '../data/mockData.js';

const HOUR_HEIGHT = 56;
const START_HOUR = 8;
const END_HOUR = 21;
// Anchor: Sunday Dec 7 2025 — week Dec 7–13 shows all forum meetings
const ANCHOR = new Date(2025, 11, 7);

function getWeekDays(offset) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ANCHOR);
    d.setDate(d.getDate() + offset * 7 + i);
    return d;
  });
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export default function MeetingsView({ lang }) {
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
    cancel: 'إلغاء', back: 'السابق', next: 'التالي', save: 'حفظ الاجتماع',
    days: ['أح','اث','ث','أر','خ','ج','س'],
    months: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
    newTitle: 'اجتماع جديد',
    addAttendee: 'إضافة مشارك',
    noMeetings: 'لا اجتماعات هذا الأسبوع',
    meetingDetail: 'تفاصيل الاجتماع',
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
    cancel: 'Cancel', back: 'Back', next: 'Next', save: 'Save Meeting',
    days: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
    months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    newTitle: 'New Meeting',
    addAttendee: 'Add attendee',
    noMeetings: 'No meetings this week',
    meetingDetail: 'Meeting detail',
  };

  const [meetings, setMeetings] = useState(MEETINGS);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newStep, setNewStep] = useState(1);
  const [newForm, setNewForm] = useState({ title:'', date:'2025-12-07', startTime:'09:00', endTime:'10:00', location:'' });
  const [newNotes, setNewNotes] = useState('');
  const [newAttendees, setNewAttendees] = useState([]);
  const [attendeeSearch, setAttendeeSearch] = useState('');

  const weekDays = getWeekDays(weekOffset);

  const meetingsByDay = {};
  meetings.forEach(m => {
    if (!meetingsByDay[m.date]) meetingsByDay[m.date] = [];
    meetingsByDay[m.date].push(m);
  });

  const filteredGuests = GUESTS
    .filter(g => !attendeeSearch || g.name.toLowerCase().includes(attendeeSearch.toLowerCase()))
    .slice(0, 6);

  const monthLabel = (() => {
    const s = weekDays[0], e = weekDays[6];
    const ms = STR.months[s.getMonth()], me = STR.months[e.getMonth()];
    if (s.getMonth() === e.getMonth()) {
      return `${ms} ${ad(s.getDate())}–${ad(e.getDate())}, ${ad(s.getFullYear())}`;
    }
    return `${ms} – ${me} ${ad(s.getFullYear())}`;
  })();

  function saveNewMeeting() {
    const id = `M-${String(meetings.length + 1).padStart(3,'0')}`;
    setMeetings(prev => [...prev, { id, ...newForm, notes: newNotes, attendees: newAttendees, color: '#1aaec4' }]);
    setShowNew(false);
    setNewStep(1);
    setNewForm({ title:'', date:'2025-12-07', startTime:'09:00', endTime:'10:00', location:'' });
    setNewNotes('');
    setNewAttendees([]);
    setAttendeeSearch('');
  }

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

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
          <button className="btn primary" onClick={() => { setShowNew(true); setNewStep(1); }}>
            <Icon name="plus" size={14}/> {STR.newMeeting}
          </button>
        </div>
      </div>

      <div className="meetings-layout" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Calendar card */}
        <div className="card meetings-calendar" style={{ flex: 1, padding: 0, overflow: 'hidden', minWidth: 0 }}>
          {/* Calendar toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 17, fontStyle: 'italic' }}>{monthLabel}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="icon-btn" onClick={() => setWeekOffset(w => w - 1)}>
                <Icon name="arrowLeft" size={14}/>
              </button>
              <button className="btn ghost" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => setWeekOffset(0)}>
                {STR.today}
              </button>
              <button className="icon-btn" onClick={() => setWeekOffset(w => w + 1)}>
                <Icon name="arrow" size={14}/>
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(7,1fr)', borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ borderRight: '1px solid var(--glass-border)' }}/>
            {weekDays.map((d, i) => {
              const hasMeetings = (meetingsByDay[dateKey(d)] || []).length > 0;
              return (
                <div key={i} style={{ padding: '8px 4px', textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--glass-border)' : undefined }}>
                  <div style={{ fontSize: 10, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {STR.days[d.getDay()]}
                  </div>
                  <div style={{ width: 26, height: 26, margin: '3px auto 0', borderRadius: '50%', display: 'grid', placeItems: 'center',
                    fontSize: 12, fontWeight: 600,
                    background: hasMeetings ? 'rgba(26,174,196,0.15)' : 'transparent',
                    color: hasMeetings ? 'var(--accent)' : 'var(--ink)',
                    border: hasMeetings ? '1px solid rgba(26,174,196,0.4)' : '1px solid transparent',
                  }}>{ad(d.getDate())}</div>
                </div>
              );
            })}
          </div>

          {/* Time grid */}
          <div style={{ overflowY: 'auto', maxHeight: 490 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(7,1fr)' }}>
              {/* Time labels */}
              <div style={{ borderRight: '1px solid var(--glass-border)' }}>
                {hours.map(h => (
                  <div key={h} style={{ height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, paddingTop: 4,
                    borderBottom: '1px solid var(--glass-border)', fontSize: 10, color: 'var(--ink-faint)', fontFamily: 'var(--mono)' }}>
                    {ad(String(h).padStart(2,'0'))}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day, di) => {
                const dk = dateKey(day);
                const dayMeetings = meetingsByDay[dk] || [];
                return (
                  <div key={di} style={{ position: 'relative', borderLeft: di > 0 ? '1px solid var(--glass-border)' : undefined }}>
                    {hours.map(h => (
                      <div key={h} style={{ height: HOUR_HEIGHT, borderBottom: '1px solid rgba(255,255,255,0.03)' }}/>
                    ))}
                    {dayMeetings.map(m => {
                      const startMin = timeToMinutes(m.startTime) - START_HOUR * 60;
                      const durMin = timeToMinutes(m.endTime) - timeToMinutes(m.startTime);
                      if (startMin < 0) return null;
                      const top = (startMin / 60) * HOUR_HEIGHT;
                      const height = Math.max((durMin / 60) * HOUR_HEIGHT - 3, 18);
                      return (
                        <div key={m.id} onClick={() => setSelectedMeeting(m)}
                          style={{ position: 'absolute', top, left: 2, right: 2, height, borderRadius: 5, cursor: 'pointer',
                            background: m.color + '28', borderLeft: `3px solid ${m.color}`, padding: '3px 5px', overflow: 'hidden',
                          }}>
                          <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.title}
                          </div>
                          {height > 32 && (
                            <div style={{ fontSize: 9.5, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
                              {m.startTime}–{m.endTime}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Upcoming sidebar */}
        <div className="meetings-sidebar" style={{ width: 250, flexShrink: 0 }}>
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--glass-border)', fontWeight: 600, fontSize: 13 }}>
              {STR.upcomingTitle}
            </div>
            <div className="meetings-list-scroll" style={{ maxHeight: 580, overflowY: 'auto' }}>
              {[...meetings]
                .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
                .map(m => {
                  const [, mo, dy] = m.date.split('-').map(Number);
                  const dateStr = `${STR.months[mo-1]} ${ad(dy)}`;
                  const firstAttendees = m.attendees.slice(0, 3).map(id => GUESTS.find(g => g.id === id)).filter(Boolean);
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
                            {firstAttendees.map(g => <Avatar key={g.id} initials={g.initials} size={16} tier={g.tier}/>)}
                            {m.attendees.length > 3 && <span style={{ fontSize: 10, color: 'var(--ink-mute)' }}>+{m.attendees.length - 3}</span>}
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
              <button className="icon-btn" onClick={() => setSelectedMeeting(null)}><Icon name="close" size={14}/></button>
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
                {STR.attendees} · {ad(selectedMeeting.attendees.length)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedMeeting.attendees.map(id => {
                  const g = GUESTS.find(g => g.id === id);
                  if (!g) return null;
                  return (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-soft-2)' }}>
                      <Avatar initials={g.initials} size={28} tier={g.tier}/>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 500 }}>{g.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{g.role} · {g.org}</div>
                      </div>
                    </div>
                  );
                })}
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
                <h3 style={{ margin: 0 }}>{STR.newTitle}</h3>
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
              <button className="icon-btn" onClick={() => setShowNew(false)}><Icon name="close" size={14}/></button>
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
                    <input type="date" style={inputStyle} value={newForm.date} onChange={e => setNewForm(f => ({...f, date: e.target.value}))}/>
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
                      {newAttendees.map(id => {
                        const g = GUESTS.find(g => g.id === id);
                        if (!g) return null;
                        return (
                          <span key={id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px 3px 4px', borderRadius: 20, background: 'rgba(26,174,196,0.15)', border: '1px solid rgba(26,174,196,0.3)', fontSize: 11.5 }}>
                            <Avatar initials={g.initials} size={18} tier={g.tier}/>
                            {g.name}
                            <button onClick={() => setNewAttendees(a => a.filter(x => x !== id))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mute)', padding: 0, display: 'flex', alignItems: 'center', marginLeft: 2 }}>
                              <Icon name="close" size={10}/>
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {filteredGuests.filter(g => !newAttendees.includes(g.id)).map(g => (
                      <div key={g.id} onClick={() => setNewAttendees(a => [...a, g.id])}
                        style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--glass-border)', background: 'var(--surface-soft-2)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-soft-3)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-soft-2)'}>
                        <Avatar initials={g.initials} size={28} tier={g.tier}/>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{g.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--ink-mute)' }}>{g.role} · {g.org}</div>
                        </div>
                        <Icon name="plus" size={13} style={{ color: 'var(--accent)', flexShrink: 0 }}/>
                      </div>
                    ))}
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
              <button className="btn" onClick={() => newStep > 1 ? setNewStep(s => s - 1) : setShowNew(false)}>
                {newStep > 1 ? <><Icon name="arrowLeft" size={13}/> {STR.back}</> : STR.cancel}
              </button>
              {newStep < 3 ? (
                <button className="btn primary" onClick={() => setNewStep(s => s + 1)} disabled={newStep === 1 && !newForm.title}>
                  {STR.next} <Icon name="arrow" size={13}/>
                </button>
              ) : (
                <button className="btn primary" onClick={saveNewMeeting}>
                  <Icon name="check" size={13}/> {STR.save}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
