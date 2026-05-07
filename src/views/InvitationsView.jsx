import React, { useState } from 'react';
import { fmtNum, toArDigits } from '../i18n/translations';
import { Drawer } from '../components/UI';
import { Icon } from '../components/Icons';

export default function InvitationsView({ lang }) {
  const isAr = lang === "ar";
  const fmtN = (n) => fmtNum(n, lang);

  const STR = isAr ? {
    pageTitle: ["دورة حياة", "الدعوة"],
    pageSub: "تصميم · أتمتة · متابعة الإرسال عبر القنوات",
    reports: "تقارير", compose: "إنشاء",
    tabs: { templates: "القوالب", queue: "طابور مجدول", builder: "المُنشئ" },
    languages: "اللغات",
    sent: "مُرسلة", opened: "مفتوحة", accepted: "مقبولة",
    edit: "تعديل", send: "إرسال",
    cols: { recipient: "المستلم", schedule: "الجدولة", channels: "القنوات", template: "القالب" },
    today: "اليوم", tomorrow: "غدًا",
    composition: "الصياغة", autosaved: "حفظ تلقائي",
    subject: "سطر الموضوع", opening: "الافتتاحية", body: "النص",
    sendWindow: "نافذة الإرسال", channels: "القنوات",
    variables: "المتغيرات", saveDraft: "حفظ مسودة", schedule: "جدولة",
    livePreview: "معاينة مباشرة", desktop: "سطح المكتب",
    confirmAttend: "تأكيد الحضور", declinePolitely: "اعتذار",
    edition: "منتدى الدوحة · النسخة الـ ٢٣",
    defaultSubject: "دعوتكم لحضور منتدى الدوحة الـ ٢٣",
    defaultOpening: "صاحب السعادة،",
    bodyText: "نيابةً عن اللجنة الدائمة لتنظيم المؤتمرات، يشرفنا أن ندعوكم لحضور النسخة الـ ٢٣ من منتدى الدوحة…",
    reportsTitle: "تقارير الدعوة",
    reportsClose: "إغلاق",
    editTitle: "تعديل القالب",
    saveChanges: "حفظ التغييرات",
    cancel: "إلغاء",
    sendConfirmTitle: "تأكيد الإرسال",
    sendConfirmMsg: "هل تريد إرسال هذه الدفعة إلى جميع المستلمين المجدولين؟",
    confirmSend: "إرسال الآن",
    scheduleTitle: "جدولة الإرسال",
    schedDate: "تاريخ الإرسال",
    schedTime: "الوقت",
    schedConfirm: "جدولة",
    draftSavedMsg: "تم حفظ المسودة في الطابور",
    scheduledMsg: "تمت الجدولة بنجاح",
    draft: "مسودة",
    scheduled: "مجدول",
  } : {
    pageTitle: ["Invitation", "lifecycle"],
    pageSub: "Design · automate · track delivery across channels",
    reports: "Reports", compose: "Compose",
    tabs: { templates: "Templates", queue: "Scheduled queue", builder: "Builder" },
    languages: "Languages",
    sent: "Sent", opened: "Opened", accepted: "Accepted",
    edit: "Edit", send: "Send",
    cols: { recipient: "Recipient", schedule: "Schedule", channels: "Channels", template: "Template" },
    today: "Today", tomorrow: "Tomorrow",
    composition: "Composition", autosaved: "Auto-saved",
    subject: "Subject line", opening: "Opening", body: "Body",
    sendWindow: "Send window", channels: "Channels",
    variables: "Variables", saveDraft: "Save draft", schedule: "Schedule",
    livePreview: "Live preview", desktop: "Desktop",
    confirmAttend: "Confirm attendance", declinePolitely: "Decline politely",
    edition: "Doha Forum · 23rd Edition",
    defaultSubject: "Your invitation to the 23rd Doha Forum",
    defaultOpening: "Your Excellency,",
    bodyText: "On behalf of the Permanent Committee for Organizing Conferences, it is our distinct honour to invite you to the 23rd Doha Forum…",
    reportsTitle: "Invitation Reports",
    reportsClose: "Close",
    editTitle: "Edit Template",
    saveChanges: "Save Changes",
    cancel: "Cancel",
    sendConfirmTitle: "Confirm Send",
    sendConfirmMsg: "Send this batch to all scheduled recipients?",
    confirmSend: "Send Now",
    scheduleTitle: "Schedule Send",
    schedDate: "Send date",
    schedTime: "Time",
    schedConfirm: "Schedule",
    draftSavedMsg: "Draft saved to queue",
    scheduledMsg: "Scheduled successfully",
    draft: "Draft",
    scheduled: "Scheduled",
  };

  const defaultTemplates = isAr ? [
    { id: "t1", name: "رؤساء الدول · رسمي", lang: "EN/AR", sent: 84, opened: 78, accepted: 62, color: "#0a3947", subject: "دعوتكم الخاصة لحضور منتدى الدوحة", opening: "صاحب الفخامة / صاحب السمو،", body: "نيابةً عن دولة قطر، يشرفنا دعوتكم…" },
    { id: "t2", name: "المتحدثون · شخصي", lang: "EN", sent: 132, opened: 128, accepted: 119, color: "#1aaec4", subject: "دورك كمتحدث في منتدى الدوحة", opening: "البروفيسور العزيز،", body: "نتشرف بمشاركتكم كمتحدث رئيسي…" },
    { id: "t3", name: "كوادر صحفية · موجز", lang: "EN/AR/FR", sent: 248, opened: 201, accepted: 180, color: "#5fd1e0", subject: "اعتماد الصحافة — منتدى الدوحة", opening: "تحية طيبة،", body: "يسعدنا إخباركم بأن طلب اعتمادكم الصحفي…" },
    { id: "t4", name: "الوفود · رسمي", lang: "EN/AR", sent: 612, opened: 544, accepted: 481, color: "#3aa3b5", subject: "دعوة رسمية — منتدى الدوحة ٢٣", opening: "السيد / السيدة الفاضلة،", body: "تتشرف اللجنة الدائمة لتنظيم المؤتمرات بدعوتكم…" },
  ] : [
    { id: "t1", name: "Heads of State · Formal", lang: "EN/AR", sent: 84, opened: 78, accepted: 62, color: "#0a3947", subject: "Your personal invitation to the Doha Forum", opening: "Your Excellency / Your Highness,", body: "On behalf of the State of Qatar, it is our distinct honour to invite you…" },
    { id: "t2", name: "Speakers · Personal", lang: "EN", sent: 132, opened: 128, accepted: 119, color: "#1aaec4", subject: "Your role as a speaker at the Doha Forum", opening: "Dear Professor,", body: "We are honoured to confirm your participation as a keynote speaker…" },
    { id: "t3", name: "Press Pool · Brief", lang: "EN/AR/FR", sent: 248, opened: 201, accepted: 180, color: "#5fd1e0", subject: "Press accreditation — Doha Forum", opening: "Dear Colleague,", body: "We are pleased to inform you that your press accreditation request…" },
    { id: "t4", name: "Delegations · Formal", lang: "EN/AR", sent: 612, opened: 544, accepted: 481, color: "#3aa3b5", subject: "Official invitation — 23rd Doha Forum", opening: "Dear Sir / Madam,", body: "The Permanent Committee for Organizing Conferences is pleased to invite you…" },
  ];

  const defaultQueue = isAr ? [
    { id: "q1", recipient: "وزير خارجية ألمانيا", schedule: "اليوم · ١٤:٠٠", channels: "بريد · واتساب", template: "رؤساء الدول · رسمي", type: "scheduled" },
    { id: "q2", recipient: "وفد بنك آسيا", schedule: "غدًا · ٠٩:٠٠", channels: "بريد", template: "الوفود · رسمي", type: "scheduled" },
    { id: "q3", recipient: "وكالة رويترز", schedule: "غدًا · ١١:٠٠", channels: "بريد · رسالة نصية", template: "كوادر صحفية · موجز", type: "scheduled" },
    { id: "q4", recipient: "بروف. أكيرا تاناكا", schedule: "اليوم · ١٦:٣٠", channels: "بريد", template: "المتحدثون · شخصي", type: "scheduled" },
  ] : [
    { id: "q1", recipient: "FM Germany", schedule: "Today · 14:00", channels: "Email · WhatsApp", template: "Heads of State · Formal", type: "scheduled" },
    { id: "q2", recipient: "Asia Bank Delegation", schedule: "Tomorrow · 09:00", channels: "Email", template: "Delegations · Formal", type: "scheduled" },
    { id: "q3", recipient: "Reuters Agency", schedule: "Tomorrow · 11:00", channels: "Email · SMS", template: "Press Pool · Brief", type: "scheduled" },
    { id: "q4", recipient: "Prof. Akira Tanaka", schedule: "Today · 16:30", channels: "Email", template: "Speakers · Personal", type: "scheduled" },
  ];

  const [tab, setTab] = useState("templates");
  const [templates, setTemplates] = useState(defaultTemplates);
  const [queue, setQueue] = useState(defaultQueue);
  const [showReports, setShowReports] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [sendConfirm, setSendConfirm] = useState(null);
  const [sentDone, setSentDone] = useState(new Set());
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedDate, setSchedDate] = useState("2025-12-08");
  const [schedTime, setSchedTime] = useState("09:00");
  const [draftNotice, setDraftNotice] = useState("");

  const [editSubject, setEditSubject] = useState("");
  const [editOpening, setEditOpening] = useState("");
  const [editBody, setEditBody] = useState("");

  const [builderSubject, setBuilderSubject] = useState(STR.defaultSubject);
  const [builderOpening, setBuilderOpening] = useState(STR.defaultOpening);
  const [builderBody, setBuilderBody] = useState(STR.bodyText);

  function openEdit(tmpl) {
    setEditSubject(tmpl.subject || STR.defaultSubject);
    setEditOpening(tmpl.opening || STR.defaultOpening);
    setEditBody(tmpl.body || STR.bodyText);
    setEditTemplate(tmpl);
  }

  function saveChanges() {
    if (!editTemplate) return;
    setTemplates(prev => prev.map(t => t.id === editTemplate.id ? { ...t, subject: editSubject, opening: editOpening, body: editBody } : t));
    setQueue(prev => prev.map(q => q.id === editTemplate.id ? { ...q, subject: editSubject, opening: editOpening, body: editBody } : q));
    setEditTemplate(null);
  }

  function handleSend(item) {
    setSentDone(prev => new Set([...prev, item.id || item.recipient]));
    setSendConfirm(null);
  }

  function handleSaveDraft() {
    const newItem = {
      id: "d-" + Date.now(),
      recipient: isAr ? "مسودة جديدة" : "New Draft",
      schedule: isAr ? "مسودة" : "Draft",
      channels: "Email",
      template: isAr ? "مُنشئ" : "Builder",
      type: "draft",
      subject: builderSubject,
      opening: builderOpening,
      body: builderBody,
    };
    setQueue(prev => [newItem, ...prev]);
    setDraftNotice(STR.draftSavedMsg);
    setTab("queue");
    setTimeout(() => setDraftNotice(""), 3000);
  }

  function handleSchedule() {
    const newItem = {
      id: "s-" + Date.now(),
      recipient: isAr ? "إرسال مجدول" : "Scheduled Send",
      schedule: `${schedDate} · ${schedTime}`,
      channels: "Email",
      template: isAr ? "مُنشئ" : "Builder",
      type: "scheduled",
      subject: builderSubject,
      opening: builderOpening,
      body: builderBody,
    };
    setQueue(prev => [newItem, ...prev]);
    setShowScheduleModal(false);
    setDraftNotice(STR.scheduledMsg);
    setTab("queue");
    setTimeout(() => setDraftNotice(""), 3000);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.pageTitle[0]} <em>{STR.pageTitle[1]}</em></h1>
          <div className="page-sub">{STR.pageSub}</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => setShowReports(true)}>
            <Icon name="reports" size={14}/> {STR.reports}
          </button>
          <button className="btn primary" onClick={() => setTab("builder")}>
            <Icon name="plus" size={14}/> {STR.compose}
          </button>
        </div>
      </div>

      {draftNotice && (
        <div style={{ marginBottom: 14, padding: "10px 16px", borderRadius: 10, background: "rgba(26,174,196,0.1)", border: "1px solid rgba(26,174,196,0.3)", fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
          <Icon name="check" size={14} style={{ color: "var(--accent)" }}/>
          <span>{draftNotice}</span>
        </div>
      )}

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: STR.sent, val: fmtN(1076), delta: isAr ? "+٨٤ هذا الأسبوع" : "+84 this week", color: "var(--accent)" },
          { label: STR.opened, val: fmtN(951), delta: isAr ? "٨٨.٤٪ معدل فتح" : "88.4% open rate", color: "var(--accent-2)" },
          { label: STR.accepted, val: fmtN(842), delta: isAr ? "٧٨.٣٪ قبول" : "78.3% acceptance", color: "#5fd1e0" },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: isAr ? "0.04em" : "0.12em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 32, fontStyle: "italic", color: k.color, lineHeight: 1 }}>{k.val}</div>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 6 }}>{k.delta}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {Object.entries(STR.tabs).map(([k, v]) => (
          <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{v}</button>
        ))}
      </div>

      {/* Templates tab */}
      {tab === "templates" && (
        <div className="card">
          <div className="card-head"><h3>{STR.tabs.templates}</h3><span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{STR.languages}: EN · AR · FR</span></div>
          <table className="table">
            <thead><tr>
              <th>{isAr ? "القالب" : "Template"}</th>
              <th>{STR.sent}</th>
              <th>{STR.opened}</th>
              <th>{STR.accepted}</th>
              <th style={{ textAlign: "end" }}>{isAr ? "إجراءات" : "Actions"}</th>
            </tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: t.color, flexShrink: 0, display: "inline-block" }}/>
                      <div>
                        <div style={{ fontWeight: 500 }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{t.lang}</div>
                      </div>
                    </div>
                  </td>
                  <td><span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{fmtN(t.sent)}</span></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{fmtN(t.opened)}</span>
                      <span style={{ fontSize: 11, color: "var(--accent-2)" }}>{Math.round(t.opened/t.sent*100)}%</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{fmtN(t.accepted)}</span>
                      <span style={{ fontSize: 11, color: "var(--accent)" }}>{Math.round(t.accepted/t.sent*100)}%</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => openEdit(t)}>
                        <Icon name="edit" size={12}/> {STR.edit}
                      </button>
                      <button className="btn primary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setSendConfirm(t)}>
                        <Icon name="arrow" size={12}/> {STR.send}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Queue tab */}
      {tab === "queue" && (
        <div className="card">
          <div className="card-head"><h3>{STR.tabs.queue}</h3></div>
          <table className="table">
            <thead><tr>
              <th>{STR.cols.recipient}</th>
              <th>{STR.cols.schedule}</th>
              <th>{STR.cols.channels}</th>
              <th>{STR.cols.template}</th>
              <th style={{ textAlign: "end" }}></th>
            </tr></thead>
            <tbody>
              {queue.map((q) => (
                <tr key={q.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {q.type === "draft" && <span className="chip" style={{ fontSize: 10, padding: "1px 6px" }}>{STR.draft}</span>}
                      <span style={{ fontWeight: 500 }}>{q.recipient}</span>
                    </div>
                  </td>
                  <td><span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{q.schedule}</span></td>
                  <td><span className="chip"><span className="dot"/>{q.channels}</span></td>
                  <td style={{ fontSize: 12, color: "var(--ink-dim)" }}>{q.template}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {sentDone.has(q.id) ? (
                        <span className="chip confirmed"><span className="dot"/>{isAr ? "أُرسل" : "Sent"}</span>
                      ) : (
                        <>
                          <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => openEdit(q)}>
                            <Icon name="edit" size={12}/> {STR.edit}
                          </button>
                          <button className="btn primary" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setSendConfirm(q)}>
                            <Icon name="arrow" size={12}/> {STR.send}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Builder tab */}
      {tab === "builder" && (
        <div className="cols-2-narrow">
          <div className="card">
            <div className="card-head">
              <h3>{STR.composition}</h3>
              <span style={{ fontSize: 11, color: "var(--ink-mute)" }}><Icon name="check" size={11}/> {STR.autosaved}</span>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.1em" }}>{STR.subject}</div>
                <input style={{ width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px 12px", color: "var(--ink)", fontSize: 13 }} value={builderSubject} onChange={e => setBuilderSubject(e.target.value)}/>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.1em" }}>{STR.opening}</div>
                <input style={{ width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px 12px", color: "var(--ink)", fontSize: 13 }} value={builderOpening} onChange={e => setBuilderOpening(e.target.value)}/>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.1em" }}>{STR.body}</div>
                <textarea rows={5} style={{ width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px 12px", color: "var(--ink)", fontSize: 13, resize: "vertical" }} value={builderBody} onChange={e => setBuilderBody(e.target.value)}/>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span className="chip"><span className="dot" style={{ background: "var(--accent)" }}/>{isAr ? "نصي" : "Plain text"}</span>
                <span className="chip"><span className="dot" style={{ background: "var(--accent-2)" }}/>HTML</span>
              </div>
            </div>
            <div className="card-foot">
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" onClick={handleSaveDraft}><Icon name="download" size={13}/> {STR.saveDraft}</button>
                <button className="btn primary" onClick={() => setShowScheduleModal(true)}><Icon name="clock" size={13}/> {STR.schedule}</button>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h3>{STR.livePreview}</h3>
              <span className="chip"><span className="dot" style={{ background: "var(--accent)" }}/>{STR.desktop}</span>
            </div>
            <div className="card-body">
              <div style={{ background: "var(--bg-2)", borderRadius: 10, padding: "20px 18px", fontSize: 13 }}>
                <div style={{ fontFamily: "var(--serif)", fontSize: 18, marginBottom: 6, fontStyle: "italic" }}>{STR.edition}</div>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>{builderSubject}</div>
                <div style={{ color: "var(--ink-dim)", lineHeight: 1.7 }}>{builderOpening}<br/><br/>{builderBody}</div>
                <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
                  <button className="btn primary" style={{ fontSize: 12 }}>{STR.confirmAttend}</button>
                  <button className="btn ghost" style={{ fontSize: 12 }}>{STR.declinePolitely}</button>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>{STR.variables}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["{{first_name}}","{{title}}","{{event_date}}","{{venue}}"].map(v => (
                    <span key={v} className="chip" style={{ cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11 }} onClick={() => setBuilderBody(b => b + " " + v)}><span className="dot" style={{ background: "var(--accent)" }}/>{v}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPORTS PANEL */}
      {showReports && (
        <>
          <div className="drawer-mask" onClick={() => setShowReports(false)}/>
          <div className="drawer">
            <div style={{ padding: "20px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--glass-border)" }}>
              <div style={{ fontSize: 11, letterSpacing: isAr ? "0.04em" : "0.18em", textTransform: "uppercase", color: "var(--ink-mute)" }}>{STR.reportsTitle}</div>
              <button className="icon-btn" onClick={() => setShowReports(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
              {templates.map((t, i) => (
                <div key={t.id} style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: t.color, display: "inline-block" }}/>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{t.name}</span>
                  </div>
                  {[
                    { label: STR.sent, val: t.sent, pct: 100, color: "var(--ink-faint)" },
                    { label: STR.opened, val: t.opened, pct: Math.round(t.opened/t.sent*100), color: "var(--accent-2)" },
                    { label: STR.accepted, val: t.accepted, pct: Math.round(t.accepted/t.sent*100), color: "var(--accent)" },
                  ].map((r, j) => (
                    <div key={j} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span style={{ color: "var(--ink-dim)" }}>{r.label}</span>
                        <span style={{ fontFamily: "var(--mono)" }}>{fmtN(r.val)} <span style={{ color: "var(--ink-mute)" }}>({r.pct}%)</span></span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: "var(--surface-soft-4)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${r.pct}%`, background: r.color, borderRadius: 3 }}/>
                      </div>
                    </div>
                  ))}
                  {i < templates.length - 1 && <div className="divider"/>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* EDIT MODAL */}
      {editTemplate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card glass" style={{ width: 520, maxWidth: "90vw", padding: 0 }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{STR.editTitle}: <em>{editTemplate.name}</em></h3>
              <button className="icon-btn" onClick={() => setEditTemplate(null)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: STR.subject, val: editSubject, set: setEditSubject },
                { label: STR.opening, val: editOpening, set: setEditOpening },
              ].map((f, i) => (
                <div key={i}>
                  <label style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{f.label}</label>
                  <input value={f.val} onChange={e => f.set(e.target.value)} style={{ width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px 12px", color: "var(--ink)", fontSize: 13 }}/>
                </div>
              ))}
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{STR.body}</label>
                <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={4} style={{ width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px 12px", color: "var(--ink)", fontSize: 13, resize: "vertical" }}/>
              </div>
            </div>
            <div style={{ padding: "14px 22px", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setEditTemplate(null)}>{STR.cancel}</button>
              <button className="btn primary" onClick={saveChanges}><Icon name="check" size={13}/> {STR.saveChanges}</button>
            </div>
          </div>
        </div>
      )}

      {/* SEND CONFIRM MODAL */}
      {sendConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card glass" style={{ width: 420, maxWidth: "90vw", padding: 0 }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{STR.sendConfirmTitle}</h3>
              <button className="icon-btn" onClick={() => setSendConfirm(null)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: "20px 22px" }}>
              <p style={{ color: "var(--ink-dim)", marginBottom: 16 }}>{STR.sendConfirmMsg}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-mute)" }}>{isAr ? "القالب / المستلم" : "Template / Recipient"}</span>
                  <span>{sendConfirm.name || sendConfirm.recipient}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-mute)" }}>{isAr ? "القنوات" : "Channels"}</span>
                  <span>{sendConfirm.channels || "Email · WhatsApp"}</span>
                </div>
                {sendConfirm.schedule && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "var(--ink-mute)" }}>{isAr ? "الجدولة" : "Scheduled"}</span>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{sendConfirm.schedule}</span>
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: "14px 22px", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setSendConfirm(null)}>{STR.cancel}</button>
              <button className="btn primary" onClick={() => handleSend(sendConfirm)}><Icon name="arrow" size={13}/> {STR.confirmSend}</button>
            </div>
          </div>
        </div>
      )}

      {/* SCHEDULE MODAL */}
      {showScheduleModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card glass" style={{ width: 380, maxWidth: "90vw", padding: 0 }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{STR.scheduleTitle}</h3>
              <button className="icon-btn" onClick={() => setShowScheduleModal(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{STR.schedDate}</label>
                <input type="date" value={schedDate} onChange={e => setSchedDate(e.target.value)} style={{ width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px 12px", color: "var(--ink)", fontSize: 13 }}/>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{STR.schedTime}</label>
                <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)} style={{ width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px 12px", color: "var(--ink)", fontSize: 13 }}/>
              </div>
            </div>
            <div style={{ padding: "14px 22px", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setShowScheduleModal(false)}>{STR.cancel}</button>
              <button className="btn primary" onClick={handleSchedule}><Icon name="clock" size={13}/> {STR.schedConfirm}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
