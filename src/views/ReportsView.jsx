import React, { useState } from 'react';
import { toArDigits, fmtNum } from '../i18n/translations';
import { Icon } from '../components/Icons';
import { Donut } from '../components/UI';

const REPORTS_EN = [
  {
    id: "RPT-001", title: "Guest Confirmation Summary", category: "Guest",
    desc: "Confirmation rates by tier, country, and organisation. Includes funnel metrics.",
    updated: "Dec 5, 09:14", size: "142 KB", format: "PDF",
    stats: [{ label: "Guests", val: "1,284" }, { label: "Confirmed", val: "77.8%" }, { label: "Pending", val: "221" }],
  },
  {
    id: "RPT-002", title: "Accreditation Status Report", category: "Guest",
    desc: "Badge issuance status for all confirmed guests. Highlights outstanding accreditations.",
    updated: "Dec 5, 08:30", size: "98 KB", format: "PDF",
    stats: [{ label: "Issued", val: "1,106" }, { label: "Pending", val: "178" }, { label: "Rate", val: "86%" }],
  },
  {
    id: "RPT-003", title: "Budget Utilisation Report", category: "Financial",
    desc: "Spend vs. allocation by category. Includes committed costs and remaining balance.",
    updated: "Dec 4, 17:00", size: "224 KB", format: "XLSX",
    stats: [{ label: "Budget", val: "QAR 1.6M" }, { label: "Spent", val: "94%" }, { label: "Remaining", val: "QAR 96K" }],
  },
  {
    id: "RPT-004", title: "Travel & Logistics Overview", category: "Event",
    desc: "Flight arrivals, hotel blocks, and ground transport assignments by guest tier.",
    updated: "Dec 4, 14:22", size: "178 KB", format: "PDF",
    stats: [{ label: "Bookings", val: "948" }, { label: "Hotels", val: "5" }, { label: "Flights", val: "612" }],
  },
  {
    id: "RPT-005", title: "Seating Plan Export", category: "Event",
    desc: "Full table assignments for all confirmed guests with tier and country breakdowns.",
    updated: "Dec 3, 11:45", size: "86 KB", format: "PDF",
    stats: [{ label: "Tables", val: "20" }, { label: "Seats", val: "1,284" }, { label: "VIP", val: "48" }],
  },
  {
    id: "RPT-006", title: "Protocol Precedence Sheet", category: "Protocol",
    desc: "Official order of precedence for state guests and delegations. Classified.",
    updated: "Dec 2, 09:00", size: "54 KB", format: "PDF",
    stats: [{ label: "Delegations", val: "38" }, { label: "VVIP", val: "12" }, { label: "Classified", val: "Yes" }],
  },
  {
    id: "RPT-007", title: "Post-Event Analytics Summary", category: "Financial",
    desc: "Attendance vs. confirmed counts, session occupancy, and engagement metrics.",
    updated: "Pending", size: "—", format: "PDF",
    stats: [{ label: "Status", val: "Draft" }, { label: "Sessions", val: "8" }, { label: "Release", val: "Dec 10" }],
  },
];

const REPORTS_AR = [
  {
    id: "RPT-001", title: "ملخص تأكيد الضيوف", category: "Guest",
    desc: "معدلات التأكيد حسب الفئة والدولة والمنظمة. يشمل مقاييس القمع.",
    updated: "٥ ديس، ٠٩:١٤", size: "١٤٢ KB", format: "PDF",
    stats: [{ label: "الضيوف", val: "١٬٢٨٤" }, { label: "مؤكد", val: "٧٧٫٨٪" }, { label: "معلق", val: "٢٢١" }],
  },
  {
    id: "RPT-002", title: "تقرير حالة الاعتماد", category: "Guest",
    desc: "حالة إصدار الشارات لجميع الضيوف المؤكدين. يُبرز الاعتمادات المعلقة.",
    updated: "٥ ديس، ٠٨:٣٠", size: "٩٨ KB", format: "PDF",
    stats: [{ label: "صادر", val: "١٬١٠٦" }, { label: "معلق", val: "١٧٨" }, { label: "النسبة", val: "٨٦٪" }],
  },
  {
    id: "RPT-003", title: "تقرير استخدام الميزانية", category: "Financial",
    desc: "الإنفاق مقابل التخصيص حسب الفئة. يشمل التكاليف الملتزم بها والرصيد المتبقي.",
    updated: "٤ ديس، ١٧:٠٠", size: "٢٢٤ KB", format: "XLSX",
    stats: [{ label: "الميزانية", val: "QAR 1.6M" }, { label: "المنصرف", val: "٩٤٪" }, { label: "المتبقي", val: "QAR 96K" }],
  },
  {
    id: "RPT-004", title: "نظرة عامة على السفر واللوجستيات", category: "Event",
    desc: "وصول الرحلات الجوية وكتل الفنادق وتخصيصات النقل البري حسب فئة الضيف.",
    updated: "٤ ديس، ١٤:٢٢", size: "١٧٨ KB", format: "PDF",
    stats: [{ label: "الحجوزات", val: "٩٤٨" }, { label: "الفنادق", val: "٥" }, { label: "الرحلات", val: "٦١٢" }],
  },
  {
    id: "RPT-005", title: "تصدير خطة الجلوس", category: "Event",
    desc: "تخصيصات الطاولة الكاملة لجميع الضيوف المؤكدين مع تصنيفات الفئة والدولة.",
    updated: "٣ ديس، ١١:٤٥", size: "٨٦ KB", format: "PDF",
    stats: [{ label: "الطاولات", val: "٢٠" }, { label: "المقاعد", val: "١٬٢٨٤" }, { label: "VIP", val: "٤٨" }],
  },
  {
    id: "RPT-006", title: "ورقة أسبقية البروتوكول", category: "Protocol",
    desc: "ترتيب الأسبقية الرسمي للضيوف الرسميين والوفود. سري.",
    updated: "٢ ديس، ٠٩:٠٠", size: "٥٤ KB", format: "PDF",
    stats: [{ label: "الوفود", val: "٣٨" }, { label: "VVIP", val: "١٢" }, { label: "سري", val: "نعم" }],
  },
  {
    id: "RPT-007", title: "ملخص تحليلات ما بعد الحدث", category: "Financial",
    desc: "الحضور الفعلي مقابل المؤكد وإشغال الجلسات ومقاييس التفاعل.",
    updated: "قيد الانتظار", size: "—", format: "PDF",
    stats: [{ label: "الحالة", val: "مسودة" }, { label: "الجلسات", val: "٨" }, { label: "الإصدار", val: "١٠ ديس" }],
  },
];

const CAT_COLORS = { Guest: "var(--accent)", Financial: "#e0c47e", Event: "var(--accent-2)", Protocol: "#9d80c3" };

export default function ReportsView({ lang }) {
  const isAr = lang === "ar";
  const REPORTS = isAr ? REPORTS_AR : REPORTS_EN;
  const [activeFilter, setActiveFilter] = useState("All");

  const STR = isAr ? {
    title: "التقارير",
    sub: "تقارير الحدث القابلة للتصدير · الماليات والضيوف والعمليات",
    generate: "إنشاء تقرير",
    filters: ["الكل", "Guest", "Financial", "Event", "Protocol"],
    filterKeys: { "الكل": "All", Guest: "Guest", Financial: "Financial", Event: "Event", Protocol: "Protocol" },
    updated: "آخر تحديث",
    download: "تنزيل",
    preview: "معاينة",
    summaryTitle: "ملخص التقارير",
    totalReports: "إجمالي التقارير",
    readyCount: "جاهز",
    draftCount: "مسودة",
    catLabel: "التصنيف",
  } : {
    title: "Reports",
    sub: "Exportable event reports · financials, guests, and operations",
    generate: "Generate Report",
    filters: ["All", "Guest", "Financial", "Event", "Protocol"],
    filterKeys: {},
    updated: "Last updated",
    download: "Download",
    preview: "Preview",
    summaryTitle: "Report summary",
    totalReports: "Total reports",
    readyCount: "Ready",
    draftCount: "Draft",
    catLabel: "Category",
  };

  const resolveFilter = (f) => {
    if (!isAr) return f;
    return STR.filterKeys[f] || f;
  };

  const filteredReports = resolveFilter(activeFilter) === "All"
    ? REPORTS
    : REPORTS.filter(r => r.category === resolveFilter(activeFilter));

  const readyReports = REPORTS.filter(r => r.updated !== "Pending" && r.updated !== "قيد الانتظار");
  const draftReports = REPORTS.filter(r => r.updated === "Pending" || r.updated === "قيد الانتظار");

  const catCounts = Object.entries(
    REPORTS.reduce((acc, r) => { acc[r.category] = (acc[r.category] || 0) + 1; return acc; }, {})
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title}</h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
        <div className="page-actions">
          <button className="btn primary">
            <Icon name="plus" size={14}/> {STR.generate}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* Main report list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {STR.filters.map(f => (
              <button key={f}
                className={"btn ghost" + (activeFilter === f ? " active" : "")}
                style={{ padding: "4px 14px", fontSize: 12, background: activeFilter === f ? "rgba(141, 1, 52,0.15)" : undefined, borderColor: activeFilter === f ? "rgba(141, 1, 52,0.4)" : undefined }}
                onClick={() => setActiveFilter(f)}>
                {f}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredReports.map(r => (
              <div key={r.id} className="card" style={{ padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center",
                    background: (CAT_COLORS[r.category] || "var(--accent)") + "18",
                    border: `1px solid ${(CAT_COLORS[r.category] || "var(--accent)") + "40"}` }}>
                    <Icon name={r.category === "Financial" ? "finance" : r.category === "Protocol" ? "protocol" : r.category === "Guest" ? "guests" : "doc"} size={18}
                      style={{ color: CAT_COLORS[r.category] || "var(--accent)" }}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{r.title}</div>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20,
                        background: (CAT_COLORS[r.category] || "var(--accent)") + "18",
                        border: `1px solid ${(CAT_COLORS[r.category] || "var(--accent)") + "40"}`,
                        color: CAT_COLORS[r.category] || "var(--accent)" }}>
                        {r.category}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--ink-mute)", fontFamily: "var(--mono)" }}>{r.format}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-dim)", marginBottom: 10, lineHeight: 1.5 }}>{r.desc}</div>
                    <div style={{ display: "flex", gap: 16 }}>
                      {r.stats.map((s, i) => (
                        <div key={i} style={{ fontSize: 11 }}>
                          <span style={{ color: "var(--ink-mute)" }}>{s.label} </span>
                          <span style={{ fontFamily: "var(--mono)", color: "var(--ink)", fontSize: 12 }}>{s.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flexShrink: 0 }}>
                    <div style={{ fontSize: 10.5, color: "var(--ink-mute)", fontFamily: "var(--mono)", direction: "ltr" }}>{r.updated}</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 11 }}>
                        <Icon name="doc" size={12}/> {STR.preview}
                      </button>
                      {r.size !== "—" && (
                        <button className="btn" style={{ padding: "4px 10px", fontSize: 11 }}
                          onClick={() => {
                            const a = document.createElement("a"); a.href = "#"; a.download = `${r.id}.${r.format.toLowerCase()}`; a.click();
                          }}>
                          <Icon name="download" size={12}/> {STR.download} · {r.size}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary sidebar */}
        <div style={{ width: 220, flexShrink: 0 }}>
          <div className="card" style={{ padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: isAr ? "0.04em" : "0.14em", marginBottom: 14 }}>
              {STR.summaryTitle}
            </div>
            <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 16 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--serif)", fontSize: 28, fontStyle: "italic", color: "var(--accent)" }}>
                  {isAr ? toArDigits(String(REPORTS.length)) : REPORTS.length}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>{STR.totalReports}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--serif)", fontSize: 28, fontStyle: "italic", color: "var(--accent-2)" }}>
                  {isAr ? toArDigits(String(readyReports.length)) : readyReports.length}
                </div>
                <div style={{ fontSize: 10.5, color: "var(--ink-mute)" }}>{STR.readyCount}</div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 10.5, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>
                {STR.catLabel}
              </div>
              {catCounts.map(([cat, count]) => (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: CAT_COLORS[cat] || "var(--accent)", flexShrink: 0 }}/>
                  <span style={{ flex: 1, color: "var(--ink-dim)" }}>{cat}</span>
                  <span style={{ fontFamily: "var(--mono)", color: "var(--ink)", fontSize: 11 }}>
                    {isAr ? toArDigits(String(count)) : count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
