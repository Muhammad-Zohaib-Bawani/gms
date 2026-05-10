import React, { useState, useRef } from 'react';
import { getTranslations, fmtNum, toArDigits } from '../i18n/translations';
import { Avatar, StatusChip, TierChip } from '../components/UI';
import { GUESTS, COUNTRIES, INVITATION_TEMPLATES, SESSIONS } from '../data/mockData';
import { Icon } from '../components/Icons';

export default function GuestsView({ onOpenGuest, lang }) {
  const G = GUESTS;
  const t = getTranslations(lang);
  const isAr = lang === "ar";
  const fmtN = (n) => fmtNum(n, lang);
  const fmtDate = (s) => {
    if (!isAr) return s;
    const months = { Dec: "ديسمبر", Nov: "نوفمبر", Jan: "يناير" };
    const m = s.match(/(\w+)\s+(\d+)/);
    if (!m) return s;
    return `${toArDigits(m[2])} ${months[m[1]] || m[1]}`;
  };

  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sel, setSel] = useState(new Set());
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [newStep, setNewStep] = useState(1);
  const [newGuest, setNewGuest] = useState({ name: "", role: "", org: "", email: "", country: "Qatar", tier: "Delegate", status: "pending", arrival: "Dec 7", flight: "", hotel: "Sheraton Grand", accreditation: "pending" });
  const [guestList, setGuestList] = useState(G);

  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [messageSent, setMessageSent] = useState(false);

  const [showAccredConfirm, setShowAccredConfirm] = useState(false);
  const [accredDone, setAccredDone] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importDone, setImportDone] = useState(false);
  const [importDragging, setImportDragging] = useState(false);
  const fileRef = useRef();

  const [notice, setNotice] = useState("");

  // Invite wizard
  const [newGuestTemplateId, setNewGuestTemplateId] = useState(null);
  const [newGuestSessions, setNewGuestSessions] = useState(new Set());

  const [showInviteWizard, setShowInviteWizard] = useState(false);
  const [inviteStep, setInviteStep] = useState(1);
  const [inviteRecipients, setInviteRecipients] = useState([]);
  const [inviteTemplateId, setInviteTemplateId] = useState("t4");
  const [inviteChannels, setInviteChannels] = useState(new Set(["Email"]));
  const [inviteSessions, setInviteSessions] = useState(new Set());
  const [inviteTiming, setInviteTiming] = useState("now");
  const [inviteDate, setInviteDate] = useState("2025-12-05");
  const [inviteTime, setInviteTime] = useState("09:00");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteDone, setInviteDone] = useState(false);

  function openInviteWizard() {
    setInviteRecipients(Array.from(sel));
    setInviteStep(1);
    setInviteTemplateId("t4");
    setInviteChannels(new Set(["Email"]));
    setInviteSessions(new Set());
    setInviteTiming("now");
    setInviteSending(false);
    setInviteDone(false);
    setShowInviteWizard(true);
  }

  function handleSendInvitations() {
    setInviteSending(true);
    setTimeout(() => {
      setInviteDone(true);
      setInviteSending(false);
      setTimeout(() => {
        setShowInviteWizard(false);
        setSel(new Set());
        const n = inviteRecipients.length;
        showNotice(isAr ? `تم إرسال الدعوة إلى ${n} ضيف` : `Invitation sent to ${n} guest${n !== 1 ? "s" : ""}`);
      }, 1200);
    }, 900);
  }

  function toggleChannel(ch) {
    setInviteChannels(prev => {
      const next = new Set(prev);
      if (next.has(ch)) { if (next.size > 1) next.delete(ch); }
      else next.add(ch);
      return next;
    });
  }

  const filtered = guestList.filter(g => {
    if (tierFilter !== "All" && g.tier !== tierFilter) return false;
    if (statusFilter !== "All" && g.status !== statusFilter) return false;
    if (query && !(g.name + g.org + g.country).toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  function toggle(id) {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSel(n);
  }

  function saveNewGuest() {
    if (!newGuest.name) return;
    const parts = newGuest.name.trim().split(" ");
    const first = parts[0] || "G";
    const last = parts[parts.length - 1] || "X";
    const initials = (first[0] + last[0]).toUpperCase();
    const added = {
      ...newGuest,
      id: "G-" + String(2025100 + guestList.length).padStart(7, "0"),
      initials,
      invited: "May 7",
      table: 1 + Math.floor(Math.random() * 20),
      sessions: Array.from(newGuestSessions),
    };
    const sentInvite = !!newGuestTemplateId;
    setGuestList([added, ...guestList]);
    setShowNewGuest(false);
    setNewStep(1);
    setNewGuestTemplateId(null);
    setNewGuestSessions(new Set());
    setNewGuest({ name: "", role: "", org: "", email: "", country: "Qatar", tier: "Delegate", status: "pending", arrival: "Dec 7", flight: "", hotel: "Sheraton Grand", accreditation: "pending" });
    showNotice(sentInvite
      ? (isAr ? "تمت إضافة الضيف وإرسال الدعوة ✓" : "Guest added & invitation sent ✓")
      : (isAr ? "تمت إضافة الضيف بنجاح" : "Guest added successfully"));
  }

  function handleSendMessage() {
    setMessageSent(true);
    setTimeout(() => { setShowMessageModal(false); setMessageSent(false); setMessageBody(""); setSel(new Set()); showNotice(isAr ? `تم إرسال الرسالة إلى ${sel.size} ضيف` : `Message sent to ${sel.size} guest${sel.size > 1 ? "s" : ""}`); }, 800);
  }

  function handleIssueAccred() {
    const ids = new Set(sel);
    setGuestList(prev => prev.map(g => ids.has(g.id) ? { ...g, accreditation: "issued" } : g));
    setShowAccredConfirm(false);
    setSel(new Set());
    showNotice(isAr ? `تم إصدار الاعتماد لـ ${ids.size} ضيف` : `Accreditation issued for ${ids.size} guest${ids.size > 1 ? "s" : ""}`);
  }

  function handleImport() {
    setImportDone(false);
    setShowImportModal(false);
    setImportFile(null);
    showNotice(isAr ? "تم استيراد البيانات بنجاح" : "Import completed successfully");
  }

  function handleExport() {
    const cols = ["ID","Name","Role","Org","Country","Tier","Status","Arrival","Hotel","Accreditation"];
    const rows = filtered.map(g => [g.id, g.name, g.role, g.org, g.country, g.tier, g.status, g.arrival, g.hotel, g.accreditation].map(v => `"${v}"`).join(","));
    const csv = [cols.join(","), ...rows].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "guests.csv";
    a.click();
  }

  function showNotice(msg) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3000);
  }

  function handleFileDrop(e) {
    e.preventDefault();
    setImportDragging(false);
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (file) { setImportFile(file); setImportDone(false); }
  }

  const tierOpts = isAr
    ? [["All","الكل"],["VVIP","VVIP"],["VIP","VIP"],["Speaker","متحدث"],["Delegate","مندوب"],["Press","صحافة"],["Observer","مراقب"]]
    : [["All","All"],["VVIP","VVIP"],["VIP","VIP"],["Speaker","Speaker"],["Delegate","Delegate"],["Press","Press"],["Observer","Observer"]];
  const statusOpts = isAr
    ? [["All","الكل"],["confirmed","مؤكد"],["pending","في الانتظار"],["declined","معتذر"],["draft","مسودة"]]
    : [["All","All"],["confirmed","confirmed"],["pending","pending"],["declined","declined"],["draft","draft"]];

  const TIERS = ["VVIP","VIP","Speaker","Delegate","Press","Observer"];
  const stepLabels = isAr
    ? ["المعلومات الشخصية", "الفئة والحالة", "السفر والإقامة", "الدعوة"]
    : ["Personal Info", "Tier & Status", "Travel & Stay", "Invitation"];

  const inputStyle = { width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "9px 12px", color: "var(--ink)", fontSize: 13 };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t.guests.title[0]} <em>{t.guests.title[1]}</em></h1>
          <div className="page-sub">{t.guests.sub(filtered.length, guestList.length)}</div>
        </div>
        <div className="page-actions">
          {sel.size > 0 && (
            <>
              <button className="btn primary" onClick={openInviteWizard}><Icon name="invitation" size={14}/> {isAr ? `إرسال دعوة (${fmtN(sel.size)})` : `Send Invitation (${fmtN(sel.size)})`}</button>
              <button className="btn" onClick={() => setShowMessageModal(true)}><Icon name="message" size={14}/> {t.common.message} ({fmtN(sel.size)})</button>
              <button className="btn" onClick={() => setShowAccredConfirm(true)}><Icon name="badge" size={14}/> {t.common.issueAccreditation}</button>
            </>
          )}
          <button className="btn" onClick={() => setShowImportModal(true)}><Icon name="upload" size={14}/> {t.common.importCsv}</button>
          <button className="btn" onClick={handleExport}><Icon name="download" size={14}/> {t.common.export}</button>
          <button className="btn primary" onClick={() => { setShowNewGuest(true); setNewStep(1); setNewGuestTemplateId(null); setNewGuestSessions(new Set()); }}>
            <Icon name="plus" size={14}/> {t.common.addGuest}
          </button>
        </div>
      </div>

      {notice && (
        <div style={{ marginBottom: 14, padding: "10px 16px", borderRadius: 10, background: "rgba(26,174,196,0.1)", border: "1px solid rgba(26,174,196,0.3)", fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
          <Icon name="check" size={14} style={{ color: "var(--accent)" }}/> <span>{notice}</span>
        </div>
      )}

      {/* Filters */}
      <div className="filter-bar">
        <div className="search" style={{ flex: 1, maxWidth: 320 }}>
          <Icon name="search" size={14}/>
          <input placeholder={t.common.searchGuests} value={query} onChange={e => setQuery(e.target.value)}/>
        </div>
        <select className="select" value={tierFilter} onChange={e => setTierFilter(e.target.value)}>
          {tierOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {statusOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "var(--ink-mute)", whiteSpace: "nowrap" }}>
          {t.common.showing} {fmtN(filtered.length)} {t.common.of} {fmtN(guestList.length)}
        </span>
        {sel.size > 0 && <span style={{ fontSize: 12, color: "var(--accent)" }}>{fmtN(sel.size)} {t.common.selected}</span>}
      </div>

      {/* Table */}
      <div className="card">
        <table className="table">
          <thead><tr>
            <th style={{ width: 36 }}><input type="checkbox" onChange={e => setSel(e.target.checked ? new Set(filtered.map(g => g.id)) : new Set())}/></th>
            <th>{t.guests.cols.guest}</th>
            <th>{t.guests.cols.tier}</th>
            <th>{t.guests.cols.country}</th>
            <th>{t.guests.cols.status}</th>
            <th>{t.guests.cols.arrival}</th>
            <th>{t.guests.cols.hotel}</th>
            <th>{t.guests.cols.accreditation}</th>
          </tr></thead>
          <tbody>
            {filtered.map(g => (
              <tr key={g.id} className={sel.has(g.id) ? "selected" : ""} onClick={() => toggle(g.id)} style={{ cursor: "pointer" }}>
                <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={sel.has(g.id)} onChange={() => toggle(g.id)}/></td>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }} onClick={e => { e.stopPropagation(); onOpenGuest && onOpenGuest(g); }}>
                    <Avatar initials={g.initials} size={32} tier={g.tier}/>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{g.name}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{g.role} · {g.org}</div>
                    </div>
                  </div>
                </td>
                <td><TierChip tier={g.tier} lang={lang}/></td>
                <td style={{ fontSize: 12 }}>{g.country}</td>
                <td><StatusChip status={g.status} lang={lang}/></td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{fmtDate(g.arrival)}</td>
                <td style={{ fontSize: 12 }}>{g.hotel}</td>
                <td>
                  <span className={`chip ${g.accreditation === "issued" ? "confirmed" : "pending"}`}>
                    <span className="dot"/>
                    {g.accreditation === "issued" ? t.guests.issued : t.guests.pending}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* NEW GUEST MODAL */}
      {showNewGuest && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowNewGuest(false); } }}>
          <div className="card glass" style={{ width: 560, maxWidth: "94vw", height: 680, maxHeight: "92vh", padding: 0, display: "flex", flexDirection: "column" }}>

            {/* Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>{isAr ? "ضيف جديد" : "Add New Guest"}</h3>
                {/* Step indicators — same pattern as invite wizard */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  {stepLabels.map((label, i) => {
                    const stepNum = i + 1;
                    const done = newStep > stepNum;
                    const active = newStep === stepNum;
                    return (
                      <React.Fragment key={i}>
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, flexShrink: 0,
                            background: done ? "var(--accent-deep)" : active ? "var(--accent)" : "var(--surface-soft-4)",
                            color: done || active ? "#fff" : "var(--ink-mute)" }}>
                            {done ? <Icon name="check" size={11}/> : stepNum}
                          </div>
                          <span style={{ fontSize: 11.5, whiteSpace: "nowrap",
                            color: active ? "var(--accent)" : done ? "var(--ink-dim)" : "var(--ink-mute)",
                            fontWeight: active ? 600 : 400 }}>{label}</span>
                        </div>
                        {i < stepLabels.length - 1 && (
                          <div style={{ width: 18, height: 1, background: done ? "var(--accent-deep)" : "var(--glass-border)", margin: "0 5px", flexShrink: 0 }}/>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
              <button className="icon-btn" style={{ marginTop: 2, flexShrink: 0 }} onClick={() => setShowNewGuest(false)}>
                <Icon name="close" size={14}/>
              </button>
            </div>

            {/* Body — scrollable, fixed height */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

              {/* STEP 1 — Personal Info */}
              {newStep === 1 && (
                <>
                  {[
                    { label: isAr ? "الاسم الكامل" : "Full Name", key: "name", ph: isAr ? "مثال: خالد المنصوري" : "e.g. Khalid Al-Mansouri" },
                    { label: isAr ? "البريد الإلكتروني" : "Email", key: "email", ph: "name@organization.com", type: "email" },
                    { label: isAr ? "المنصب / الدور" : "Title / Role", key: "role", ph: isAr ? "مثال: وزير" : "e.g. Minister" },
                    { label: isAr ? "المؤسسة" : "Organization", key: "org", ph: isAr ? "مثال: وزارة الخارجية" : "e.g. Ministry of Foreign Affairs" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5 }}>{f.label}</label>
                      <input type={f.type || "text"} placeholder={f.ph} value={newGuest[f.key]}
                        onChange={e => setNewGuest({ ...newGuest, [f.key]: e.target.value })} style={inputStyle}/>
                    </div>
                  ))}
                  <div>
                    <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5 }}>{isAr ? "الدولة" : "Country"}</label>
                    <select value={newGuest.country} onChange={e => setNewGuest({ ...newGuest, country: e.target.value })} style={inputStyle}>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </>
              )}

              {/* STEP 2 — Tier & Status */}
              {newStep === 2 && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>{isAr ? "الفئة" : "Tier"}</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      {TIERS.map(tier => (
                        <div key={tier} onClick={() => setNewGuest({ ...newGuest, tier })}
                          style={{ padding: "12px 10px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                            border: `1px solid ${newGuest.tier === tier ? "var(--accent)" : "var(--glass-border)"}`,
                            background: newGuest.tier === tier ? "rgba(26,174,196,0.12)" : "var(--surface-soft-2)",
                            fontSize: 13, fontWeight: newGuest.tier === tier ? 600 : 400 }}>
                          {tier}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>{isAr ? "حالة الدعوة" : "Invitation Status"}</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        { val: "confirmed", color: "var(--accent)" },
                        { val: "pending",   color: "#e0c47e" },
                        { val: "draft",     color: "var(--ink-mute)" },
                      ].map(({ val, color }) => (
                        <div key={val} onClick={() => setNewGuest({ ...newGuest, status: val })}
                          style={{ padding: "11px 14px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                            border: `1px solid ${newGuest.status === val ? "var(--accent)" : "var(--glass-border)"}`,
                            background: newGuest.status === val ? "rgba(26,174,196,0.12)" : "var(--surface-soft-2)" }}>
                          <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }}/>
                          <span style={{ fontSize: 13, textTransform: "capitalize", fontWeight: newGuest.status === val ? 600 : 400 }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* STEP 3 — Travel & Stay */}
              {newStep === 3 && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      { label: isAr ? "تاريخ الوصول" : "Arrival Date", key: "arrival", ph: "Dec 7" },
                      { label: isAr ? "رقم الرحلة" : "Flight No.", key: "flight", ph: "QR 512" },
                    ].map(f => (
                      <div key={f.key}>
                        <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5 }}>{f.label}</label>
                        <input placeholder={f.ph} value={newGuest[f.key]} onChange={e => setNewGuest({ ...newGuest, [f.key]: e.target.value })} style={inputStyle}/>
                      </div>
                    ))}
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 5 }}>{isAr ? "الفندق" : "Hotel"}</label>
                    <select value={newGuest.hotel} onChange={e => setNewGuest({ ...newGuest, hotel: e.target.value })} style={inputStyle}>
                      {["Sheraton Grand","Mondrian Doha","Mandarin Oriental","St. Regis","Four Seasons"].map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>{isAr ? "الاعتماد" : "Accreditation"}</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      {["pending","issued"].map(s => (
                        <div key={s} onClick={() => setNewGuest({ ...newGuest, accreditation: s })}
                          style={{ flex: 1, padding: "12px 14px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                            border: `1px solid ${newGuest.accreditation === s ? "var(--accent)" : "var(--glass-border)"}`,
                            background: newGuest.accreditation === s ? "rgba(26,174,196,0.12)" : "var(--surface-soft-2)",
                            fontSize: 13, textTransform: "capitalize", fontWeight: newGuest.accreditation === s ? 600 : 400 }}>
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* STEP 4 — Invitation & Sessions */}
              {newStep === 4 && (
                <>
                  {/* Invitation template */}
                  <div>
                    <label style={{ display: "block", fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
                      {isAr ? "قالب الدعوة (اختياري)" : "Invitation Template (optional)"}
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                      <div onClick={() => setNewGuestTemplateId(null)}
                        style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                          border: `1px solid ${!newGuestTemplateId ? "var(--accent)" : "var(--glass-border)"}`,
                          background: !newGuestTemplateId ? "rgba(26,174,196,0.1)" : "var(--surface-soft-2)" }}>
                        <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${!newGuestTemplateId ? "var(--accent)" : "var(--glass-border)"}`, background: !newGuestTemplateId ? "var(--accent)" : "transparent", display: "grid", placeItems: "center", flexShrink: 0 }}>
                          {!newGuestTemplateId && <Icon name="check" size={10} style={{ color: "#fff" }}/>}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: !newGuestTemplateId ? 600 : 400 }}>{isAr ? "بدون دعوة" : "No invitation"}</div>
                          <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{isAr ? "إضافة الضيف فقط" : "Add guest only, no email sent"}</div>
                        </div>
                      </div>
                      {INVITATION_TEMPLATES.map(t => (
                        <div key={t.id} onClick={() => setNewGuestTemplateId(t.id)}
                          style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                            border: `1px solid ${newGuestTemplateId === t.id ? t.color : "var(--glass-border)"}`,
                            background: newGuestTemplateId === t.id ? t.color + "18" : "var(--surface-soft-2)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: t.color, flexShrink: 0 }}/>
                            <span style={{ fontSize: 13, fontWeight: newGuestTemplateId === t.id ? 600 : 400 }}>{isAr ? t.nameAr : t.name}</span>
                            <span style={{ marginLeft: "auto", fontSize: 10.5, color: "var(--ink-mute)", fontFamily: "var(--mono)" }}>{t.lang}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginLeft: 18, marginTop: 3, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {isAr ? t.subjectAr : t.subject}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Session selection */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <label style={{ fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em" }}>
                        {isAr ? "الجلسات (اختياري)" : "Sessions (optional)"}
                      </label>
                      <button onClick={() => setNewGuestSessions(prev => prev.size === SESSIONS.length ? new Set() : new Set(SESSIONS.map(s => s.id)))}
                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "var(--accent)", padding: 0 }}>
                        {newGuestSessions.size === SESSIONS.length ? (isAr ? "إلغاء الكل" : "Deselect all") : (isAr ? "تحديد الكل" : "Select all")}
                      </button>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {SESSIONS.map(s => {
                        const checked = newGuestSessions.has(s.id);
                        return (
                          <div key={s.id} onClick={() => setNewGuestSessions(prev => { const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}
                            style={{ padding: "8px 12px", borderRadius: 9, cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 10,
                              border: `1px solid ${checked ? "var(--accent)" : "var(--glass-border)"}`,
                              background: checked ? "rgba(26,174,196,0.08)" : "var(--surface-soft-2)" }}>
                            <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${checked ? "var(--accent)" : "var(--glass-border)"}`, background: checked ? "var(--accent)" : "transparent", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 1 }}>
                              {checked && <Icon name="check" size={9} style={{ color: "#fff" }}/>}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, fontWeight: checked ? 500 : 400 }}>{s.title}</div>
                              <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                <span style={{ fontFamily: "var(--mono)" }}>{s.date} · {s.time}</span>
                                {" · "}{s.venue}{s.room ? ` · ${s.room}` : ""}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
              <button className="btn" onClick={() => newStep > 1 ? setNewStep(newStep - 1) : setShowNewGuest(false)}>
                {newStep > 1 ? <><Icon name="arrowLeft" size={13}/> {isAr ? "السابق" : "Back"}</> : (isAr ? "إلغاء" : "Cancel")}
              </button>
              {newStep < 4 ? (
                <button className="btn primary" onClick={() => setNewStep(newStep + 1)} disabled={newStep === 1 && !newGuest.name}>
                  {isAr ? "التالي" : "Next"} <Icon name="arrow" size={13}/>
                </button>
              ) : (
                <button className="btn primary" onClick={saveNewGuest} disabled={!newGuest.name}>
                  <Icon name="check" size={13}/>
                  {newGuestTemplateId ? (isAr ? "إضافة وإرسال دعوة" : "Add & Send Invite") : (isAr ? "إضافة الضيف" : "Add Guest")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MESSAGE MODAL */}
      {showMessageModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card glass" style={{ width: 480, maxWidth: "90vw", padding: 0 }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0 }}>{isAr ? "إرسال رسالة" : "Send Message"}</h3>
                <div style={{ fontSize: 12, color: "var(--ink-mute)", marginTop: 4 }}>{isAr ? `إلى ${fmtN(sel.size)} ضيف` : `To ${fmtN(sel.size)} guest${sel.size > 1 ? "s" : ""}`}</div>
              </div>
              <button className="icon-btn" onClick={() => setShowMessageModal(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: "20px 22px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {Array.from(sel).slice(0,5).map(id => {
                  const g = guestList.find(x => x.id === id);
                  return g ? <span key={id} className="chip"><Avatar initials={g.initials} size={16} tier={g.tier}/> {g.name}</span> : null;
                })}
                {sel.size > 5 && <span className="chip">+{sel.size - 5} {isAr ? "آخرين" : "more"}</span>}
              </div>
              <textarea rows={5} placeholder={isAr ? "اكتب رسالتك هنا…" : "Type your message here…"} value={messageBody} onChange={e => setMessageBody(e.target.value)}
                style={{ width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "8px 12px", color: "var(--ink)", fontSize: 13, resize: "vertical" }}/>
            </div>
            <div style={{ padding: "14px 22px", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setShowMessageModal(false)}>{isAr ? "إلغاء" : "Cancel"}</button>
              <button className="btn primary" onClick={handleSendMessage} disabled={!messageBody.trim() || messageSent}>
                <Icon name="message" size={13}/> {messageSent ? (isAr ? "جارٍ الإرسال…" : "Sending…") : (isAr ? "إرسال" : "Send")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCREDITATION CONFIRM MODAL */}
      {showAccredConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card glass" style={{ width: 400, maxWidth: "90vw", padding: 0 }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{isAr ? "إصدار الاعتماد" : "Issue Accreditation"}</h3>
              <button className="icon-btn" onClick={() => setShowAccredConfirm(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: "20px 22px" }}>
              <p style={{ color: "var(--ink-dim)", marginBottom: 0 }}>
                {isAr ? `سيتم إصدار الاعتماد لـ ${fmtN(sel.size)} ضيف. هل تريد المتابعة؟` : `Issue accreditation for ${fmtN(sel.size)} selected guest${sel.size > 1 ? "s" : ""}. Proceed?`}
              </p>
            </div>
            <div style={{ padding: "14px 22px", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => setShowAccredConfirm(false)}>{isAr ? "إلغاء" : "Cancel"}</button>
              <button className="btn primary" onClick={handleIssueAccred}><Icon name="badge" size={13}/> {isAr ? "إصدار" : "Issue"}</button>
            </div>
          </div>
        </div>
      )}

      {/* SEND INVITATION WIZARD */}
      {showInviteWizard && (() => {
        const tmpl = INVITATION_TEMPLATES.find(t => t.id === inviteTemplateId) || INVITATION_TEMPLATES[0];
        const recipientGuests = inviteRecipients.map(id => guestList.find(g => g.id === id)).filter(Boolean);
        const STEPS = isAr
          ? ["المستلمون", "القالب", "الجلسات", "التسليم", "المراجعة والإرسال"]
          : ["Recipients", "Template", "Sessions", "Delivery", "Review & Send"];
        const channelOpts = isAr
          ? [["Email","بريد إلكتروني"],["WhatsApp","واتساب"],["SMS","رسالة نصية"]]
          : [["Email","Email"],["WhatsApp","WhatsApp"],["SMS","SMS"]];
        const TOTAL_STEPS = 5;

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100 }}>
            <div className="card glass" style={{ width: inviteStep === 2 ? 860 : 580, maxWidth: "96vw", maxHeight: "90vh", padding: 0, display: "flex", flexDirection: "column", transition: "width 0.2s" }}>

              {/* Header */}
              <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
                <div>
                  <h3 style={{ margin: 0, marginBottom: 10 }}>{isAr ? "معالج إرسال الدعوة" : "Send Invitation Wizard"}</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                    {STEPS.map((label, i) => {
                      const stepNum = i + 1;
                      const done = inviteStep > stepNum;
                      const active = inviteStep === stepNum;
                      return (
                        <React.Fragment key={i}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 22, height: 22, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, flexShrink: 0,
                              background: done ? "var(--accent-deep)" : active ? "var(--accent)" : "var(--surface-soft-4)",
                              color: done || active ? "#fff" : "var(--ink-mute)" }}>
                              {done ? <Icon name="check" size={11}/> : isAr ? toArDigits(String(stepNum)) : stepNum}
                            </div>
                            <span style={{ fontSize: 12, color: active ? "var(--accent)" : done ? "var(--ink-dim)" : "var(--ink-mute)", whiteSpace: "nowrap" }}>{label}</span>
                          </div>
                          {i < TOTAL_STEPS - 1 && (
                            <div style={{ width: 20, height: 1, background: done ? "var(--accent-deep)" : "var(--glass-border)", margin: "0 6px", flexShrink: 0 }}/>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
                <button className="icon-btn" style={{ marginTop: 2 }} onClick={() => setShowInviteWizard(false)}><Icon name="close" size={14}/></button>
              </div>

              {/* Body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

                {/* STEP 1 — Recipients */}
                {inviteStep === 1 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ fontSize: 13, color: "var(--ink-dim)" }}>
                      {isAr
                        ? `${fmtNum(recipientGuests.length, lang)} ضيف مُختار. يمكنك إزالة أي ضيف قبل المتابعة.`
                        : `${recipientGuests.length} guest${recipientGuests.length !== 1 ? "s" : ""} selected. Remove anyone before continuing.`}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {recipientGuests.map(g => (
                        <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 10px 5px 6px", borderRadius: 20, background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)" }}>
                          <Avatar initials={g.initials} size={22} tier={g.tier}/>
                          <span style={{ fontSize: 12.5 }}>{g.name}</span>
                          <span style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>{g.tier}</span>
                          <button onClick={() => setInviteRecipients(prev => prev.filter(id => id !== g.id))}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-mute)", padding: 0, display: "flex", marginLeft: 2 }}>
                            <Icon name="close" size={10}/>
                          </button>
                        </div>
                      ))}
                    </div>
                    {recipientGuests.length === 0 && (
                      <div style={{ padding: "24px", textAlign: "center", color: "var(--ink-mute)", fontSize: 13, border: "1px dashed var(--glass-border)", borderRadius: 10 }}>
                        {isAr ? "لا يوجد مستلمون. أضف ضيوفاً من القائمة." : "No recipients. Go back and select guests from the list."}
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 4 }}>
                      {[
                        { label: isAr ? "VVIP / VIP" : "VVIP / VIP", val: recipientGuests.filter(g => g.tier === "VVIP" || g.tier === "VIP").length, color: "var(--accent)" },
                        { label: isAr ? "متحدثون" : "Speakers", val: recipientGuests.filter(g => g.tier === "Speaker").length, color: "var(--accent-2)" },
                        { label: isAr ? "مندوبون / آخرون" : "Delegates / Other", val: recipientGuests.filter(g => !["VVIP","VIP","Speaker"].includes(g.tier)).length, color: "#e0c47e" },
                      ].map((s, i) => (
                        <div key={i} style={{ padding: "12px 14px", borderRadius: 10, background: "var(--surface-soft-2)", border: "1px solid var(--glass-border)", textAlign: "center" }}>
                          <div style={{ fontFamily: "var(--serif)", fontSize: 26, fontStyle: "italic", color: s.color }}>{isAr ? toArDigits(String(s.val)) : s.val}</div>
                          <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* STEP 2 — Template */}
                {inviteStep === 2 && (
                  <div style={{ display: "flex", gap: 16, minHeight: 400 }}>
                    {/* Template list */}
                    <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
                        {isAr ? "اختر قالباً" : "Choose a template"}
                      </div>
                      {INVITATION_TEMPLATES.map(t => (
                        <div key={t.id} onClick={() => setInviteTemplateId(t.id)}
                          style={{ padding: "12px 14px", borderRadius: 10, cursor: "pointer", border: `1px solid ${inviteTemplateId === t.id ? "var(--accent)" : "var(--glass-border)"}`,
                            background: inviteTemplateId === t.id ? "rgba(26,174,196,0.1)" : "var(--surface-soft-2)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: t.color, flexShrink: 0 }}/>
                            <span style={{ fontSize: 13, fontWeight: inviteTemplateId === t.id ? 600 : 400 }}>
                              {isAr ? t.nameAr : t.name}
                            </span>
                          </div>
                          <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginLeft: 18 }}>{t.lang} · {t.sent} {isAr ? "مُرسل" : "sent"}</div>
                          <div style={{ fontSize: 10.5, color: "var(--ink-mute)", marginLeft: 18, marginTop: 2 }}>
                            {isAr ? "الفئة: " : "Tiers: "}{t.tiers.join(", ")}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Live preview */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>
                        {isAr ? "معاينة" : "Preview"}
                      </div>
                      <div style={{ background: "var(--bg-2)", borderRadius: 12, padding: "22px 24px", border: "1px solid var(--glass-border)", height: "calc(100% - 28px)", overflowY: "auto" }}>
                        <div style={{ fontFamily: "var(--serif)", fontSize: 13, color: "var(--ink-mute)", marginBottom: 8, fontStyle: "italic" }}>
                          Doha Forum · 23rd Edition
                        </div>
                        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: tmpl.color, marginTop: 4, flexShrink: 0 }}/>
                          <div>
                            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginBottom: 2 }}>{isAr ? "الموضوع" : "Subject"}</div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{isAr ? tmpl.subjectAr : tmpl.subject}</div>
                          </div>
                        </div>
                        <div style={{ width: 40, height: 1, background: "var(--glass-border)", marginBottom: 14 }}/>
                        <div style={{ fontSize: 13.5, color: "var(--ink-dim)", lineHeight: 1.7 }}>
                          <div style={{ marginBottom: 10 }}>{isAr ? tmpl.openingAr : tmpl.opening}</div>
                          <div style={{ marginBottom: 16 }}>{isAr ? tmpl.bodyAr : tmpl.body}</div>
                          <div style={{ color: "var(--ink-mute)", fontStyle: "italic", marginBottom: 16 }}>
                            {isAr ? "[[سيتم استبدال الاسم وعنوان الضيف تلقائياً]]" : "[[Guest name and title will be auto-filled per recipient]]"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                          <button className="btn primary" style={{ fontSize: 12 }}>{isAr ? "تأكيد الحضور" : "Confirm attendance"}</button>
                          <button className="btn ghost" style={{ fontSize: 12 }}>{isAr ? "اعتذار" : "Decline politely"}</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* STEP 3 — Sessions */}
                {inviteStep === 3 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 13, color: "var(--ink-dim)" }}>
                        {isAr ? "اختر الجلسات التي سيحضرها الضيوف." : "Select sessions the invited guests will attend."}
                      </div>
                      <button onClick={() => {
                        if (inviteSessions.size === SESSIONS.length) setInviteSessions(new Set());
                        else setInviteSessions(new Set(SESSIONS.map(s => s.id)));
                      }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: "var(--accent)", padding: 0, whiteSpace: "nowrap" }}>
                        {inviteSessions.size === SESSIONS.length ? (isAr ? "إلغاء الكل" : "Deselect all") : (isAr ? "تحديد الكل" : "Select all")}
                      </button>
                    </div>
                    {SESSIONS.map(s => {
                      const checked = inviteSessions.has(s.id);
                      return (
                        <div key={s.id} onClick={() => setInviteSessions(prev => { const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n; })}
                          style={{ padding: "11px 14px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12,
                            border: `1px solid ${checked ? "var(--accent)" : "var(--glass-border)"}`,
                            background: checked ? "rgba(26,174,196,0.08)" : "var(--surface-soft-2)" }}>
                          <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${checked ? "var(--accent)" : "var(--glass-border)"}`, background: checked ? "var(--accent)" : "transparent", display: "grid", placeItems: "center", flexShrink: 0, marginTop: 2 }}>
                            {checked && <Icon name="check" size={10} style={{ color: "#fff" }}/>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: checked ? 500 : 400 }}>{s.title}</div>
                            <div style={{ fontSize: 11, color: "var(--ink-mute)", marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                              <span style={{ fontFamily: "var(--mono)" }}>{s.date} · {s.time}</span>
                              <span><Icon name="venue" size={10}/> {s.venue}</span>
                              {s.room && <span style={{ color: "var(--ink-faint)" }}>· {s.room}</span>}
                            </div>
                          </div>
                          <span style={{ fontSize: 11, color: "var(--ink-mute)", whiteSpace: "nowrap", paddingTop: 2 }}>
                            <Icon name="seating" size={10}/> {isAr ? toArDigits(String(s.capacity)) : s.capacity}
                          </span>
                        </div>
                      );
                    })}
                    {inviteSessions.size === 0 && (
                      <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(224,196,126,0.1)", border: "1px solid rgba(224,196,126,0.3)", fontSize: 12, color: "#e0c47e" }}>
                        {isAr ? "لم تحدد أي جلسة — سيتم دعوة الضيوف للفعالية الكاملة." : "No sessions selected — guests will be invited to the full event."}
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 4 — Delivery */}
                {inviteStep === 4 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
                        {isAr ? "قنوات التسليم" : "Delivery channels"}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {channelOpts.map(([key, label]) => {
                          const checked = inviteChannels.has(key);
                          return (
                            <div key={key} onClick={() => toggleChannel(key)}
                              style={{ padding: "12px 16px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 14,
                                border: `1px solid ${checked ? "var(--accent)" : "var(--glass-border)"}`,
                                background: checked ? "rgba(26,174,196,0.1)" : "var(--surface-soft-2)" }}>
                              <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${checked ? "var(--accent)" : "var(--glass-border)"}`,
                                background: checked ? "var(--accent)" : "transparent", display: "grid", placeItems: "center", flexShrink: 0 }}>
                                {checked && <Icon name="check" size={11} style={{ color: "#fff" }}/>}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13.5, fontWeight: checked ? 600 : 400 }}>{label}</div>
                                <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                                  {key === "Email" ? (isAr ? "يصل خلال دقيقتين" : "Delivered within 2 min")
                                    : key === "WhatsApp" ? (isAr ? "إشعار فوري" : "Instant push notification")
                                    : (isAr ? "رسالة نصية قصيرة للتأكيد" : "Short confirmation SMS")}
                                </div>
                              </div>
                              {checked && <Icon name="check" size={14} style={{ color: "var(--accent)", flexShrink: 0 }}/>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ width: "100%", height: 1, background: "var(--glass-border)" }}/>

                    <div>
                      <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
                        {isAr ? "توقيت الإرسال" : "Send timing"}
                      </div>
                      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                        {[[isAr ? "إرسال فوري" : "Send now", "now"], [isAr ? "جدولة" : "Schedule", "scheduled"]].map(([label, val]) => (
                          <div key={val} onClick={() => setInviteTiming(val)}
                            style={{ flex: 1, padding: "12px 14px", borderRadius: 10, cursor: "pointer", textAlign: "center", fontSize: 13,
                              border: `1px solid ${inviteTiming === val ? "var(--accent)" : "var(--glass-border)"}`,
                              background: inviteTiming === val ? "rgba(26,174,196,0.1)" : "var(--surface-soft-2)",
                              fontWeight: inviteTiming === val ? 600 : 400 }}>
                            {label}
                          </div>
                        ))}
                      </div>
                      {inviteTiming === "scheduled" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                          {[[isAr ? "التاريخ" : "Date", "date", inviteDate, setInviteDate],
                            [isAr ? "الوقت" : "Time", "time", inviteTime, setInviteTime]].map(([label, type, val, setter]) => (
                            <div key={type}>
                              <label style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{label}</label>
                              <input type={type} value={val} onChange={e => setter(e.target.value)}
                                style={{ width: "100%", background: "var(--surface-soft-3)", border: "1px solid var(--glass-border)", borderRadius: 8, padding: "9px 12px", color: "var(--ink)", fontSize: 13 }}/>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* STEP 5 — Review & Send */}
                {inviteStep === 5 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {inviteDone ? (
                      <div style={{ textAlign: "center", padding: "40px 20px" }}>
                        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(26,174,196,0.15)", border: "1px solid rgba(26,174,196,0.4)", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
                          <Icon name="check" size={24} style={{ color: "var(--accent)" }}/>
                        </div>
                        <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontStyle: "italic", marginBottom: 6 }}>
                          {isAr ? "تم إرسال الدعوات" : "Invitations sent!"}
                        </div>
                        <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>
                          {isAr
                            ? `تم إرسال ${fmtNum(inviteRecipients.length, lang)} دعوة عبر ${Array.from(inviteChannels).join(" · ")}`
                            : `${inviteRecipients.length} invitation${inviteRecipients.length !== 1 ? "s" : ""} dispatched via ${Array.from(inviteChannels).join(" · ")}`}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ fontSize: 13, color: "var(--ink-dim)" }}>
                          {isAr ? "راجع التفاصيل قبل الإرسال." : "Review before sending."}
                        </div>
                        {[
                          { label: isAr ? "المستلمون" : "Recipients", val: isAr ? `${fmtNum(inviteRecipients.length, lang)} ضيف` : `${inviteRecipients.length} guest${inviteRecipients.length !== 1 ? "s" : ""}` },
                          { label: isAr ? "القالب" : "Template", val: isAr ? tmpl.nameAr : tmpl.name },
                          { label: isAr ? "الجلسات" : "Sessions", val: inviteSessions.size > 0 ? (isAr ? `${toArDigits(String(inviteSessions.size))} جلسة` : `${inviteSessions.size} session${inviteSessions.size !== 1 ? "s" : ""}`) : (isAr ? "الفعالية الكاملة" : "Full event") },
                          { label: isAr ? "القنوات" : "Channels", val: Array.from(inviteChannels).join(" · ") },
                          { label: isAr ? "الإرسال" : "Send", val: inviteTiming === "now" ? (isAr ? "فوري" : "Immediately") : `${inviteDate} ${inviteTime}` },
                        ].map((row, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderRadius: 10, background: "var(--surface-soft-2)", border: "1px solid var(--glass-border)", fontSize: 13 }}>
                            <span style={{ color: "var(--ink-mute)" }}>{row.label}</span>
                            <span style={{ fontWeight: 500 }}>{row.val}</span>
                          </div>
                        ))}
                        {/* Recipient chips preview */}
                        <div style={{ padding: "12px 16px", borderRadius: 10, background: "var(--surface-soft-2)", border: "1px solid var(--glass-border)" }}>
                          <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                            {isAr ? "الضيوف" : "Guests"}
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {recipientGuests.slice(0, 8).map(g => (
                              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 10px 3px 4px", borderRadius: 20, background: "var(--surface-soft-4)", fontSize: 11.5 }}>
                                <Avatar initials={g.initials} size={18} tier={g.tier}/>
                                {g.name}
                              </div>
                            ))}
                            {recipientGuests.length > 8 && (
                              <span style={{ fontSize: 11.5, color: "var(--ink-mute)", padding: "3px 8px" }}>
                                +{isAr ? toArDigits(String(recipientGuests.length - 8)) : recipientGuests.length - 8} {isAr ? "آخرين" : "more"}
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              {!inviteDone && (
                <div style={{ padding: "14px 24px", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
                  <button className="btn" onClick={() => inviteStep > 1 ? setInviteStep(s => s - 1) : setShowInviteWizard(false)}>
                    {inviteStep > 1 ? <><Icon name="arrowLeft" size={13}/> {isAr ? "السابق" : "Back"}</> : (isAr ? "إلغاء" : "Cancel")}
                  </button>
                  {inviteStep < 5 ? (
                    <button className="btn primary" disabled={inviteStep === 1 && inviteRecipients.length === 0} onClick={() => setInviteStep(s => s + 1)}>
                      {isAr ? "التالي" : "Next"} <Icon name="arrow" size={13}/>
                    </button>
                  ) : (
                    <button className="btn primary" disabled={inviteSending || inviteRecipients.length === 0} onClick={handleSendInvitations}
                      style={{ minWidth: 140 }}>
                      {inviteSending
                        ? <><Icon name="clock" size={13}/> {isAr ? "جارٍ الإرسال…" : "Sending…"}</>
                        : <><Icon name="arrow" size={13}/> {inviteTiming === "now" ? (isAr ? "إرسال الآن" : "Send Now") : (isAr ? "جدولة الإرسال" : "Schedule Send")}</>}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div className="card glass" style={{ width: 460, maxWidth: "90vw", padding: 0 }}>
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{isAr ? "استيراد CSV" : "Import CSV"}</h3>
              <button className="icon-btn" onClick={() => setShowImportModal(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: "20px 22px" }}>
              <div
                onDragOver={e => { e.preventDefault(); setImportDragging(true); }}
                onDragLeave={() => setImportDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${importDragging ? "var(--accent)" : "var(--glass-border)"}`, borderRadius: 12, padding: "32px 20px", textAlign: "center", cursor: "pointer", background: importDragging ? "rgba(26,174,196,0.08)" : "var(--surface-soft-2)" }}>
                <Icon name="upload" size={24} style={{ color: "var(--accent)", display: "block", margin: "0 auto 10px" }}/>
                {importFile ? (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{importFile.name}</div>
                    <div style={{ fontSize: 12, color: "var(--accent)" }}>
                      {isAr ? "~٤٢ صف جاهزة للاستيراد" : "~42 rows ready to import"}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{isAr ? "اسحب ملف CSV هنا" : "Drag & drop a CSV file here"}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>{isAr ? "أو انقر للاختيار" : "or click to browse"}</div>
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleFileDrop}/>
              </div>
              {!importFile && (
                <div style={{ marginTop: 12, fontSize: 12, color: "var(--ink-mute)" }}>
                  {isAr ? "الأعمدة المطلوبة: الاسم، الدور، المؤسسة، الدولة، الفئة" : "Required columns: Name, Role, Org, Country, Tier"}
                </div>
              )}
            </div>
            <div style={{ padding: "14px 22px", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="btn" onClick={() => { setShowImportModal(false); setImportFile(null); }}>{isAr ? "إلغاء" : "Cancel"}</button>
              <button className="btn primary" disabled={!importFile} onClick={handleImport}>
                <Icon name="upload" size={13}/> {isAr ? "استيراد" : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
