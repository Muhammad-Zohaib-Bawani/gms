import React, { useState } from 'react';
import { fmtNum, toArDigits } from '../i18n/translations';
import { Donut, Spark } from '../components/UI';
import { Icon } from '../components/Icons';
import { brandHex } from '../lib/brandColor';

const CATEGORIES_EN = ["Venue & Logistics","Hospitality & Catering","VIP Transport","Security","Media & Production","Gifts & Protocol","Contingency"];
const CATEGORIES_AR = ["المكان واللوجستيات","الضيافة والتموين","نقل الشخصيات","الأمن","الإعلام والإنتاج","الهدايا والبروتوكول","الطوارئ"];

const BUDGET_ROWS = [
  { allocated: 420000, spent: 398000, committed: 18000 },
  { allocated: 280000, spent: 243000, committed: 24000 },
  { allocated: 180000, spent: 164000, committed: 12000 },
  { allocated: 320000, spent: 301000, committed: 14000 },
  { allocated: 210000, spent: 187000, committed: 18000 },
  { allocated: 95000,  spent: 78000,  committed:  9000 },
  { allocated: 80000,  spent: 31000,  committed:  6000 },
];

const TRANSACTIONS_EN = [
  { id: "TXN-0421", desc: "Sheraton Grand – ballroom deposit", cat: "Venue & Logistics", amount: 125000, status: "paid", date: "Nov 28" },
  { id: "TXN-0420", desc: "VIP fleet – 12 vehicles · 3 days", cat: "VIP Transport", amount: 54000, status: "paid", date: "Nov 25" },
  { id: "TXN-0419", desc: "Gala dinner catering – 800 covers", cat: "Hospitality & Catering", amount: 96000, status: "paid", date: "Nov 22" },
  { id: "TXN-0418", desc: "Protocol gifts – 250 units", cat: "Gifts & Protocol", amount: 38000, status: "paid", date: "Nov 20" },
  { id: "TXN-0417", desc: "AV production – plenary sessions", cat: "Media & Production", amount: 72000, status: "approved", date: "Nov 18" },
  { id: "TXN-0416", desc: "Security detail – 3-day contract", cat: "Security", amount: 88000, status: "approved", date: "Nov 15" },
  { id: "TXN-0415", desc: "Coffee-break catering – Day 1", cat: "Hospitality & Catering", amount: 14500, status: "paid", date: "Nov 12" },
];

const TRANSACTIONS_AR = [
  { id: "TXN-0421", desc: "شيراتون الكبرى – وديعة القاعة", cat: "المكان واللوجستيات", amount: 125000, status: "paid", date: "٢٨ نوف" },
  { id: "TXN-0420", desc: "أسطول VIP – ١٢ مركبة · ٣ أيام", cat: "نقل الشخصيات", amount: 54000, status: "paid", date: "٢٥ نوف" },
  { id: "TXN-0419", desc: "تموين حفل العشاء – ٨٠٠ غطاء", cat: "الضيافة والتموين", amount: 96000, status: "paid", date: "٢٢ نوف" },
  { id: "TXN-0418", desc: "هدايا البروتوكول – ٢٥٠ وحدة", cat: "الهدايا والبروتوكول", amount: 38000, status: "paid", date: "٢٠ نوف" },
  { id: "TXN-0417", desc: "إنتاج الصوت والصورة – جلسات الجلسة الرئيسية", cat: "الإعلام والإنتاج", amount: 72000, status: "approved", date: "١٨ نوف" },
  { id: "TXN-0416", desc: "فريق الأمن – عقد ٣ أيام", cat: "الأمن", amount: 88000, status: "approved", date: "١٥ نوف" },
  { id: "TXN-0415", desc: "استراحة القهوة – اليوم الأول", cat: "الضيافة والتموين", amount: 14500, status: "paid", date: "١٢ نوف" },
];

function fmtQAR(n, lang) {
  const s = fmtNum(n, lang);
  return lang === "ar" ? `QAR ${s}` : `QAR ${s}`;
}

export default function FinancialsView({ lang }) {
  const isAr = lang === "ar";
  const ad = (s) => isAr ? toArDigits(String(s)) : String(s);
  const fmtN = (n) => fmtNum(n, lang);

  const CATEGORIES = isAr ? CATEGORIES_AR : CATEGORIES_EN;
  const TRANSACTIONS = isAr ? TRANSACTIONS_AR : TRANSACTIONS_EN;

  const totalBudget  = BUDGET_ROWS.reduce((s, r) => s + r.allocated, 0);
  const totalSpent   = BUDGET_ROWS.reduce((s, r) => s + r.spent, 0);
  const totalCommit  = BUDGET_ROWS.reduce((s, r) => s + r.committed, 0);
  const totalRemain  = totalBudget - totalSpent - totalCommit;
  const spentPct     = ((totalSpent / totalBudget) * 100).toFixed(1);

  const [activeFilter, setActiveFilter] = useState("all");

  const STR = isAr ? {
    title: "الماليات",
    sub: "ميزانية الحدث · تتبع الإنفاق والالتزامات",
    export: "تصدير",
    newExpense: "مصروف جديد",
    totalBudget: "إجمالي الميزانية",
    totalSpent: "الإجمالي المنصرف",
    committed: "الملتزم به",
    remaining: "المتبقي",
    budgetBreakdown: "توزيع الميزانية",
    category: "الفئة",
    allocated: "المخصص",
    spent: "المنصرف",
    commitLabel: "الملتزم",
    remaining2: "المتبقي",
    utilizationLabel: "الاستخدام",
    recentTx: "المعاملات الأخيرة",
    filters: { all: "الكل", paid: "مدفوع", approved: "معتمد", pending: "قيد الانتظار" },
    cols: { ref: "المرجع", description: "الوصف", category: "الفئة", amount: "المبلغ", status: "الحالة", date: "التاريخ" },
    paid: "مدفوع",
    approved: "معتمد",
    pending: "في الانتظار",
    spentLabel: "منصرف",
  } : {
    title: "Financials",
    sub: "Event budget · spend and commitment tracking",
    export: "Export",
    newExpense: "New Expense",
    totalBudget: "Total Budget",
    totalSpent: "Total Spent",
    committed: "Committed",
    remaining: "Remaining",
    budgetBreakdown: "Budget breakdown",
    category: "Category",
    allocated: "Allocated",
    spent: "Spent",
    commitLabel: "Committed",
    remaining2: "Remaining",
    utilizationLabel: "Utilization",
    recentTx: "Recent transactions",
    filters: { all: "All", paid: "Paid", approved: "Approved", pending: "Pending" },
    cols: { ref: "Ref", description: "Description", category: "Category", amount: "Amount", status: "Status", date: "Date" },
    paid: "Paid",
    approved: "Approved",
    pending: "Pending",
    spentLabel: "spent",
  };

  const sparkData = [62, 71, 78, 82, 85, 88, 91, 94];

  const filteredTx = activeFilter === "all"
    ? TRANSACTIONS
    : TRANSACTIONS.filter(t => t.status === activeFilter);

  const statusColor = (s) => s === "paid" ? "var(--accent)" : s === "approved" ? "#e0c47e" : "var(--ink-mute)";
  const statusLabel = (s) => STR[s] || s;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{STR.title}</h1>
          <div className="page-sub">{STR.sub}</div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => {
            const rows = [STR.cols.ref, STR.cols.description, STR.cols.category, STR.cols.amount, STR.cols.status, STR.cols.date].join(",");
            const csv = rows + "\n" + TRANSACTIONS.map(t => `"${t.id}","${t.desc}","${t.cat}","${t.amount}","${t.status}","${t.date}"`).join("\n");
            const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="financials.csv"; a.click();
          }}>
            <Icon name="download" size={14}/> {STR.export}
          </button>
          <button className="btn primary">
            <Icon name="plus" size={14}/> {STR.newExpense}
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: STR.totalBudget, val: fmtQAR(totalBudget, lang), delta: isAr ? "الميزانية المعتمدة" : "Approved budget", color: "var(--ink)", spark: [100,100,100,100,100,100,100,100] },
          { label: STR.totalSpent,  val: fmtQAR(totalSpent, lang),  delta: `${ad(spentPct)}% ${STR.spentLabel}`, color: "var(--accent)", spark: sparkData },
          { label: STR.committed,   val: fmtQAR(totalCommit, lang), delta: isAr ? "التزامات معلقة" : "Pending obligations", color: "#e0c47e", spark: [20,22,25,28,30,32,34,35] },
          { label: STR.remaining,   val: fmtQAR(totalRemain, lang), delta: isAr ? "متاح للصرف" : "Available to spend", color: brandHex("--brand-2-hsl"), spark: [80,75,68,60,55,48,42,38] },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "var(--ink-mute)", textTransform: "uppercase", letterSpacing: isAr ? "0.04em" : "0.12em", marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 26, fontStyle: "italic", color: k.color, lineHeight: 1 }}>{k.val}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 }}>
              <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>{k.delta}</div>
              <Spark data={k.spark} color={k.color}/>
            </div>
          </div>
        ))}
      </div>

      {/* Budget breakdown + donut */}
      <div className="cols-2-narrow" style={{ marginBottom: 20 }}>
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-head" style={{ padding: "14px 20px" }}>
            <h3>{STR.budgetBreakdown}</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>{STR.category}</th>
                <th style={{ textAlign: "right" }}>{STR.allocated}</th>
                <th style={{ textAlign: "right" }}>{STR.spent}</th>
                <th style={{ textAlign: "right" }}>{STR.utilizationLabel}</th>
              </tr>
            </thead>
            <tbody>
              {BUDGET_ROWS.map((row, i) => {
                const pct = Math.round((row.spent / row.allocated) * 100);
                const over = pct > 100;
                return (
                  <tr key={i}>
                    <td style={{ fontSize: 12.5 }}>{CATEGORIES[i]}</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11 }}>
                      {fmtN(row.allocated)}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 11 }}>
                      {fmtN(row.spent)}
                    </td>
                    <td style={{ textAlign: "right", minWidth: 110 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                        <div style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--surface-soft-4)", overflow: "hidden", minWidth: 60 }}>
                          <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, borderRadius: 3, background: over ? "#e07e7e" : "var(--accent)" }}/>
                        </div>
                        <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: over ? "#e07e7e" : "var(--ink-dim)", width: 34, textAlign: "right" }}>
                          {ad(pct)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head"><h3>{isAr ? "نسبة الاستخدام" : "Budget utilization"}</h3></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <Donut value={parseFloat(spentPct)} max={100} size={130} color="var(--accent)" label={`${ad(spentPct)}%`} sub={STR.spentLabel}/>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: STR.totalSpent,  val: fmtQAR(totalSpent, lang),  color: "var(--accent)" },
                { label: STR.commitLabel, val: fmtQAR(totalCommit, lang),  color: "#e0c47e" },
                { label: STR.remaining,   val: fmtQAR(totalRemain, lang),  color: "var(--ink-mute)" },
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, flexShrink: 0 }}/>
                    <span style={{ color: "var(--ink-dim)" }}>{row.label}</span>
                  </div>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{row.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--glass-border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{STR.recentTx}</h3>
          <div style={{ display: "flex", gap: 6 }}>
            {Object.entries(STR.filters).map(([key, label]) => (
              <button key={key}
                className={"btn ghost" + (activeFilter === key ? " active" : "")}
                style={{ padding: "3px 10px", fontSize: 11, background: activeFilter === key ? "hsl(var(--brand-hsl) / 0.15)" : undefined, borderColor: activeFilter === key ? "hsl(var(--brand-hsl) / 0.4)" : undefined }}
                onClick={() => setActiveFilter(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>{STR.cols.ref}</th>
              <th>{STR.cols.description}</th>
              <th>{STR.cols.category}</th>
              <th style={{ textAlign: "right" }}>{STR.cols.amount}</th>
              <th>{STR.cols.status}</th>
              <th>{STR.cols.date}</th>
            </tr>
          </thead>
          <tbody>
            {filteredTx.map(t => (
              <tr key={t.id}>
                <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>{t.id}</td>
                <td style={{ fontSize: 13, maxWidth: 260 }}>{t.desc}</td>
                <td style={{ fontSize: 11, color: "var(--ink-dim)" }}>{t.cat}</td>
                <td style={{ textAlign: "right", fontFamily: "var(--mono)", fontSize: 12 }}>QAR {fmtN(t.amount)}</td>
                <td>
                  <span style={{ fontSize: 11, color: statusColor(t.status), fontWeight: 500 }}>
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: statusColor(t.status), marginInlineEnd: 5, verticalAlign: "middle" }}/>
                    {statusLabel(t.status)}
                  </span>
                </td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-mute)" }}>{t.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
