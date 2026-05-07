import React, { useState, useRef } from 'react';
import { getTranslations, fmtNum, toArDigits } from '../i18n/translations';
import { Avatar, StatusChip, TierChip } from '../components/UI';
import { GUESTS, COUNTRIES } from '../data/mockData';
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
  const [newGuest, setNewGuest] = useState({ name: "", role: "", org: "", country: "Qatar", tier: "Delegate", status: "pending", arrival: "Dec 7", flight: "", hotel: "Sheraton Grand", accreditation: "pending" });
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
    };
    setGuestList([added, ...guestList]);
    setShowNewGuest(false);
    setNewStep(1);
    setNewGuest({ name: "", role: "", org: "", country: "Qatar", tier: "Delegate", status: "pending", arrival: "Dec 7", flight: "", hotel: "Sheraton Grand", accreditation: "pending" });
    showNotice(isAr ? "تمت إضافة الضيف بنجاح" : "Guest added successfully");
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
    ? ["المعلومات الشخصية", "الفئة والحالة", "السفر والإقامة"]
    : ["Personal Info", "Tier & Status", "Travel & Stay"];

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
              <button className="btn" onClick={() => setShowMessageModal(true)}><Icon name="message" size={14}/> {t.common.message} ({fmtN(sel.size)})</button>
              <button className="btn" onClick={() => setShowAccredConfirm(true)}><Icon name="badge" size={14}/> {t.common.issueAccreditation}</button>
            </>
          )}
          <button className="btn" onClick={() => setShowImportModal(true)}><Icon name="upload" size={14}/> {t.common.importCsv}</button>
          <button className="btn" onClick={handleExport}><Icon name="download" size={14}/> {t.common.export}</button>
          <button className="btn primary" onClick={() => { setShowNewGuest(true); setNewStep(1); }}>
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

      {/* NEW GUEST DRAWER */}
      {showNewGuest && (
        <>
          <div className="drawer-mask" onClick={() => setShowNewGuest(false)}/>
          <div className="drawer">
            <div style={{ padding: "20px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--glass-border)" }}>
              <div>
                <div style={{ fontSize: 11, letterSpacing: isAr ? "0.04em" : "0.18em", textTransform: "uppercase", color: "var(--ink-mute)" }}>
                  {isAr ? "ضيف جديد" : "New Guest"}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  {stepLabels.map((l, i) => (
                    <span key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: newStep === i+1 ? "var(--accent)" : newStep > i+1 ? "var(--ink-dim)" : "var(--ink-mute)" }}>
                      <span style={{ width: 16, height: 16, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 700, background: newStep === i+1 ? "var(--accent)" : newStep > i+1 ? "var(--accent-deep)" : "var(--surface-soft-4)", color: newStep >= i+1 ? "#fff" : "var(--ink-mute)" }}>{i+1}</span>
                      {l}{i < 2 && <span style={{ color: "var(--ink-faint)" }}>›</span>}
                    </span>
                  ))}
                </div>
              </div>
              <button className="icon-btn" onClick={() => setShowNewGuest(false)}><Icon name="close" size={14}/></button>
            </div>
            <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
              {newStep === 1 && (
                <>
                  {[
                    { label: isAr ? "الاسم الكامل" : "Full Name", key: "name", ph: isAr ? "مثال: خالد المنصوري" : "e.g. Khalid Al-Mansouri" },
                    { label: isAr ? "المنصب / الدور" : "Title / Role", key: "role", ph: isAr ? "مثال: وزير" : "e.g. Minister" },
                    { label: isAr ? "المؤسسة" : "Organization", key: "org", ph: isAr ? "مثال: وزارة الخارجية" : "e.g. Ministry of Foreign Affairs" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{f.label}</label>
                      <input placeholder={f.ph} value={newGuest[f.key]} onChange={e => setNewGuest({ ...newGuest, [f.key]: e.target.value })} style={inputStyle}/>
                    </div>
                  ))}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{isAr ? "الدولة" : "Country"}</label>
                    <select value={newGuest.country} onChange={e => setNewGuest({ ...newGuest, country: e.target.value })} style={inputStyle}>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </>
              )}
              {newStep === 2 && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{isAr ? "الفئة" : "Tier"}</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {TIERS.map(tier => (
                        <div key={tier} onClick={() => setNewGuest({ ...newGuest, tier })}
                          style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer", border: `1px solid ${newGuest.tier === tier ? "var(--accent)" : "var(--glass-border)"}`, background: newGuest.tier === tier ? "rgba(26,174,196,0.12)" : "var(--surface-soft-2)", fontSize: 13, fontWeight: newGuest.tier === tier ? 600 : 400 }}>
                          {tier}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{isAr ? "حالة الدعوة" : "Invitation Status"}</label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {["confirmed","pending","draft"].map(s => (
                        <div key={s} onClick={() => setNewGuest({ ...newGuest, status: s })}
                          style={{ padding: "10px 14px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, border: `1px solid ${newGuest.status === s ? "var(--accent)" : "var(--glass-border)"}`, background: newGuest.status === s ? "rgba(26,174,196,0.12)" : "var(--surface-soft-2)" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: s === "confirmed" ? "var(--accent)" : s === "pending" ? "#e0c47e" : "var(--ink-mute)" }}/>
                          <span style={{ fontSize: 13, textTransform: "capitalize" }}>{s}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {newStep === 3 && (
                <>
                  {[
                    { label: isAr ? "تاريخ الوصول" : "Arrival Date", key: "arrival", ph: "Dec 7" },
                    { label: isAr ? "رقم الرحلة" : "Flight Number", key: "flight", ph: "QR 512" },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{f.label}</label>
                      <input placeholder={f.ph} value={newGuest[f.key]} onChange={e => setNewGuest({ ...newGuest, [f.key]: e.target.value })} style={inputStyle}/>
                    </div>
                  ))}
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{isAr ? "الفندق" : "Hotel"}</label>
                    <select value={newGuest.hotel} onChange={e => setNewGuest({ ...newGuest, hotel: e.target.value })} style={inputStyle}>
                      {["Sheraton Grand","Mondrian Doha","Mandarin Oriental","St. Regis","Four Seasons"].map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{isAr ? "الاعتماد" : "Accreditation"}</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["pending","issued"].map(s => (
                        <div key={s} onClick={() => setNewGuest({ ...newGuest, accreditation: s })}
                          style={{ flex: 1, padding: "10px 14px", borderRadius: 10, cursor: "pointer", textAlign: "center", border: `1px solid ${newGuest.accreditation === s ? "var(--accent)" : "var(--glass-border)"}`, background: newGuest.accreditation === s ? "rgba(26,174,196,0.12)" : "var(--surface-soft-2)", fontSize: 13, textTransform: "capitalize" }}>
                          {s}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div style={{ padding: "14px 22px", borderTop: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", gap: 8 }}>
              <button className="btn" onClick={() => newStep > 1 ? setNewStep(newStep - 1) : setShowNewGuest(false)}>
                {newStep > 1 ? <><Icon name="arrowLeft" size={13}/> {isAr ? "السابق" : "Back"}</> : (isAr ? "إلغاء" : "Cancel")}
              </button>
              {newStep < 3 ? (
                <button className="btn primary" onClick={() => setNewStep(newStep + 1)} disabled={newStep === 1 && !newGuest.name}>
                  {isAr ? "التالي" : "Next"} <Icon name="arrow" size={13}/>
                </button>
              ) : (
                <button className="btn primary" onClick={saveNewGuest} disabled={!newGuest.name}>
                  <Icon name="check" size={13}/> {isAr ? "إضافة الضيف" : "Add Guest"}
                </button>
              )}
            </div>
          </div>
        </>
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
