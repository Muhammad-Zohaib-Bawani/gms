// Shared "Excel export" convention used across the portal: no spreadsheet
// library on the frontend — just a plain CSV blob, downloaded client-side
// from data already in memory (Excel opens .csv natively). Originally
// hand-rolled per page (see TravelView.jsx, GuestsView.jsx); pulled out here
// once a third+ page needed the exact same three functions.
export function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers, rows) {
  return [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function downloadCsv(filename, csv) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  a.download = filename;
  a.click();
}
