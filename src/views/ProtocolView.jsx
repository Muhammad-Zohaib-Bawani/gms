import React, { useState } from 'react';
import { toArDigits } from '../i18n/translations';
import { Avatar, TierChip } from '../components/UI';
import { Icon } from '../components/Icons';
import { GUESTS } from '../data/mockData';

const PROTOCOL_NOTES_EN = [
  { id: "PN-01", type: "VVIP", title: "Motorcade sequence confirmed", body: "Lead vehicle departs Sheraton Grand South entrance. Outriders × 2. ETA Forum Plaza: 08:45.", time: "Today 07:30", priority: "high" },
  { id: "PN-02", type: "Seating", title: "Head table revised – Japan bilateral", body: "FM Qatar seated left of centre. Ambassador of Japan to the right. Place cards updated.", time: "Yesterday 18:00", priority: "medium" },
  { id: "PN-03", type: "Arrival", title: "State delegation – advance team on site", body: "Saudi Arabia advance party cleared security at 06:15. Holding suite ready at Level 4.", time: "Today 06:20", priority: "high" },
  { id: "PN-04", type: "Gift", title: "Protocol gifts dispatched to suites", body: "250 units distributed. VVIP tier received premium selection. Confirmation received from concierge.", time: "Yesterday 14:00", priority: "low" },
  { id: "PN-05", type: "Flag", title: "Flag order updated for closing ceremony", body: "Alphabetical order per UN convention. Host flag leading. Check Appendix C.", time: "Dec 4, 11:00", priority: "medium" },
];

const PROTOCOL_NOTES_AR = [
  { id: "PN-01", type: "VVIP", title: "تأكيد تسلسل الموكب", body: "المركبة الأمامية تغادر المدخل الجنوبي لشيراتون الكبرى. حراسة × ٢. الوصول المتوقع إلى ساحة المنتدى: ٠٨:٤٥.", time: "اليوم ٠٧:٣٠", priority: "high" },
  { id: "PN-02", type: "Seating", title: "مراجعة طاولة الرئاسة – الاجتماع الثنائي مع اليابان", body: "وزير خارجية قطر يجلس على يسار الوسط. سفير اليابان على اليمين. تحديث بطاقات الأماكن.", time: "أمس ١٨:٠٠", priority: "medium" },
  { id: "PN-03", type: "Arrival", title: "الوفد الرسمي – الفريق المتقدم في الموقع", body: "الفريق المتقدم للمملكة العربية السعودية اجتاز الأمن في ٠٦:١٥. الجناح جاهز في الطابق الرابع.", time: "اليوم ٠٦:٢٠", priority: "high" },
  { id: "PN-04", type: "Gift", title: "توزيع هدايا البروتوكول على الأجنحة", body: "توزيع ٢٥٠ وحدة. حصل VVIP على التشكيلة المميزة. تأكيد الاستلام من مدير الفندق.", time: "أمس ١٤:٠٠", priority: "low" },
  { id: "PN-05", type: "Flag", title: "تحديث ترتيب الأعلام لحفل الختام", body: "الترتيب الأبجدي وفق اتفاقية الأمم المتحدة. علم الدولة المضيفة في المقدمة. راجع الملحق ج.", time: "٤ ديس، ١١:٠٠", priority: "medium" },
];

const PRECEDENCE_GUESTS = GUESTS.filter(g => g.tier === "VVIP" || g.tier === "VIP").slice(0, 10);

const CHECKLISTS_EN = [
  { section: "Arrival Protocol", items: [
    { text: "Motorcade route briefed to security lead", done: true },
    { text: "Meet-and-greet team confirmed (3 persons)", done: true },
    { text: "Red carpet deployed at Forum Plaza entrance", done: true },
    { text: "Holding suite stocked and inspected", done: false },
    { text: "Press pool position confirmed", done: false },
  ]},
  { section: "Session Protocol", items: [
    { text: "Head table placard order confirmed with FM office", done: true },
    { text: "Interpreters briefed for bilateral sessions", done: true },
    { text: "Note-taker assigned for all VVIP bilaterals", done: false },
    { text: "Session recording consent forms distributed", done: false },
  ]},
  { section: "Closing Ceremony", items: [
    { text: "Flag order confirmed (UN alphabetical)", done: true },
    { text: "Gifts arranged backstage by tier", done: true },
    { text: "Protocol dinner seating plan signed off", done: false },
    { text: "Closing remarks running order distributed", done: false },
  ]},
];

const CHECKLISTS_AR = [
  { section: "بروتوكول الاستقبال", items: [
    { text: "إحاطة مسار الموكب لقيادة الأمن", done: true },
    { text: "تأكيد فريق الاستقبال (٣ أشخاص)", done: true },
    { text: "نشر السجادة الحمراء عند مدخل ساحة المنتدى", done: true },
    { text: "تجهيز الجناح المخصص وتفتيشه", done: false },
    { text: "تأكيد موقع وفد الصحافة", done: false },
  ]},
  { section: "بروتوكول الجلسة", items: [
    { text: "تأكيد ترتيب بطاقات الطاولة الرئيسية مع مكتب وزير الخارجية", done: true },
    { text: "إحاطة المترجمين للجلسات الثنائية", done: true },
    { text: "تعيين كاتب محاضر لجميع الاجتماعات الثنائية لـ VVIP", done: false },
    { text: "توزيع نماذج موافقة تسجيل الجلسات", done: false },
  ]},
  { section: "حفل الختام", items: [
    { text: "تأكيد ترتيب الأعلام (أبجدي وفق الأمم المتحدة)", done: true },
    { text: "ترتيب الهدايا خلف الكواليس حسب الفئة", done: true },
    { text: "اعتماد خطة جلوس عشاء البروتوكول", done: false },
    { text: "توزيع برنامج كلمات الختام", done: false },
  ]},
];

const PRIORITY_COLORS = { high: "#e07e7e", medium: "#e0c47e", low: "var(--accent-2)" };
const PRIORITY_LABELS_EN = { high: "Urgent", medium: "Medium", low: "Info" };
const PRIORITY_LABELS_AR = { high: "عاجل", medium: "متوسط", low: "معلومة" };

export default function ProtocolView({ lang, onOpenGuest }) {
  const isAr = lang === "ar";
  const ad = (s) => isAr ? toArDigits(String(s)) : String(s);

  const NOTES = isAr ? PROTOCOL_NOTES_AR : PROTOCOL_NOTES_EN;
  const CHECKLISTS = isAr ? CHECKLISTS_AR : CHECKLISTS_EN;
  const PRIORITY_LABELS = isAr ? PRIORITY_LABELS_AR : PRIORITY_LABELS_EN;

  const [checkState, setCheckState] = useState(() => {
    const state = {};
    CHECKLISTS_EN.forEach(cl => cl.items.forEach((item, i) => { state[`${cl.section}-${i}`] = item.done; }));
    return state;
  });

  const toggleCheck = (section, i) => {
    setCheckState(prev => ({ ...prev, [`${section}-${i}`]: !prev[`${section}-${i}`] }));
  };

  const totalItems = CHECKLISTS_EN.reduce((s, cl) => s + cl.items.length, 0);
  const doneItems = Object.values(checkState).filter(Boolean).length;
  const donePct = Math.round((doneItems / totalItems) * 100);

  const STR = isAr ? {
    title: "البروتوكول",
    sub: "إدارة الأسبقية والمواكب والمتطلبات الدبلوماسية",
    export: "تصدير",
    notesTitle: "ملاحظات البروتوكول",
    precedenceTitle: "أسبقية VIP",
    checklistTitle: "قائمة التحقق",
    progress: "التقدم العام",
    completed: "مكتمل",
    rank: "الترتيب",
    guest: "الضيف",
    tier: "الفئة",
    country: "الدولة",
    role: "الدور",
  } : {
    title: "Protocol",
    sub: "Precedence, motorcades, and diplomatic requirements",
    export: "Export",
    notesTitle: "Protocol notes",
    precedenceTitle: "VIP precedence",
    checklistTitle: "Protocol checklist",
    progress: "Overall progress",
    completed: "completed",
    rank: "Rank",
    guest: "Guest",
    tier: "Tier",
    country: "Country",
    role: "Role",
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title}</h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
        <div className="page-actions">
          <button className="btn">
            <Icon name="download" size={14}/> {STR.export}
          </button>
          <button className="btn primary">
            <Icon name="plus" size={14}/> {isAr ? "ملاحظة جديدة" : "New Note"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Protocol notes */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-head" style={{ padding: "14px 18px" }}>
            <h3>{STR.notesTitle}</h3>
            <span className="chip confirmed"><span className="dot"/>{isAr ? "مباشر" : "Live"}</span>
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {NOTES.map(n => (
              <div key={n.id} style={{ padding: "12px 18px", borderBottom: "1px solid var(--glass-border)", display: "flex", gap: 12 }}>
                <div style={{ width: 4, borderRadius: 4, background: PRIORITY_COLORS[n.priority], flexShrink: 0 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{n.title}</span>
                    <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 20,
                      background: PRIORITY_COLORS[n.priority] + "20",
                      color: PRIORITY_COLORS[n.priority],
                      border: `1px solid ${PRIORITY_COLORS[n.priority]}40` }}>
                      {PRIORITY_LABELS[n.priority]}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-dim)", lineHeight: 1.5, marginBottom: 4 }}>{n.body}</div>
                  <div style={{ fontSize: 10.5, color: "var(--ink-mute)", fontFamily: "var(--mono)", direction: "ltr" }}>{n.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Checklist */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-head" style={{ padding: "14px 18px" }}>
            <div>
              <h3>{STR.checklistTitle}</h3>
              <div className="sub">{STR.progress} · {ad(doneItems)}/{ad(totalItems)} {STR.completed}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontStyle: "italic", color: donePct >= 75 ? "var(--accent)" : "#e0c47e" }}>
                {ad(donePct)}%
              </div>
              <div style={{ height: 4, width: 80, borderRadius: 2, background: "var(--surface-soft-4)", overflow: "hidden", marginTop: 4 }}>
                <div style={{ height: "100%", width: `${donePct}%`, borderRadius: 2, background: donePct >= 75 ? "var(--accent)" : "#e0c47e" }}/>
              </div>
            </div>
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {CHECKLISTS.map((cl, ci) => (
              <div key={ci}>
                <div style={{ padding: "8px 18px 4px", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: isAr ? "0.04em" : "0.12em", background: "var(--surface-soft-2)" }}>
                  {cl.section}
                </div>
                {cl.items.map((item, ii) => {
                  const sectionKey = CHECKLISTS_EN[ci].section;
                  const checked = checkState[`${sectionKey}-${ii}`];
                  return (
                    <div key={ii} onClick={() => toggleCheck(sectionKey, ii)}
                      style={{ padding: "10px 18px", borderBottom: "1px solid var(--glass-border)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface-soft-2)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? "var(--accent)" : "var(--glass-border)"}`,
                        background: checked ? "var(--accent)" : "transparent", display: "grid", placeItems: "center", flexShrink: 0, transition: "all 0.15s" }}>
                        {checked && <Icon name="check" size={10} style={{ color: "#fff" }}/>}
                      </div>
                      <span style={{ fontSize: 12.5, color: checked ? "var(--ink-mute)" : "var(--ink)", textDecoration: checked ? "line-through" : "none" }}>
                        {item.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* VIP Precedence table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="card-head" style={{ padding: "14px 18px" }}>
          <h3>{STR.precedenceTitle}</h3>
          <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>
            <Icon name="shield" size={12}/> {isAr ? "ترتيب الأسبقية الرسمي" : "Official precedence order"}
          </span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 44 }}>{STR.rank}</th>
              <th>{STR.guest}</th>
              <th>{STR.tier}</th>
              <th>{STR.role}</th>
              <th>{STR.country}</th>
            </tr>
          </thead>
          <tbody>
            {PRECEDENCE_GUESTS.map((g, i) => (
              <tr key={g.id} style={{ cursor: "pointer" }} onClick={() => onOpenGuest && onOpenGuest(g)}>
                <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)", textAlign: "center" }}>{ad(i + 1)}</td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar initials={g.initials} size={28} tier={g.tier}/>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{g.name}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{g.org}</div>
                    </div>
                  </div>
                </td>
                <td><TierChip tier={g.tier} lang={lang}/></td>
                <td style={{ fontSize: 12, color: "var(--ink-dim)" }}>{g.role}</td>
                <td style={{ fontSize: 12 }}>{g.country}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
