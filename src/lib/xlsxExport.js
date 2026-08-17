// Real .xlsx workbooks — several sheets in one file, each with its own tab at
// the bottom of Excel.
//
// The portal's other exports are hand-rolled CSV (see lib/csvExport), which is
// right when a page has one table. It can't express sheets, though: a guest's
// events, flights, hotel nights and seats are four different column sets, and
// stacking them into one CSV with title rows is a file you have to unpick
// before you can sort or pivot anything. One sheet each solves that.
//
// The writer is loaded on demand so it never lands in the main bundle — nobody
// pays for it until they actually press Export.

// Excel's own rules: 31 chars, none of \ / ? * [ ] : and no duplicates.
function sheetName(raw, taken) {
  let name = String(raw || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet';
  if (taken.has(name)) {
    // "Accommodation" and "Accommodation 2" rather than a silent overwrite.
    let n = 2;
    const stem = name.slice(0, 28);
    while (taken.has(`${stem} ${n}`)) n += 1;
    name = `${stem} ${n}`;
  }
  taken.add(name);
  return name;
}

// Everything is written as text on purpose. These values are already formatted
// for reading (dd-MM-yyyy dates, "5h 15m", status words), and handing Excel a
// half-typed sheet is how "AB689" turns into a number and a leading zero on a
// seat vanishes.
const cell = (v) => (v == null || v === '' ? null : { value: String(v), type: String });

// Wide enough to read, capped so one long address doesn't push everything else
// off screen. Sampled rather than measured over every row of a big export.
function columnWidths(headers, rows) {
  const sample = rows.slice(0, 200);
  return headers.map((h, i) => {
    const longest = sample.reduce(
      (max, r) => Math.max(max, String(r[i] ?? '').length),
      String(h ?? '').length,
    );
    return { width: Math.min(52, Math.max(10, longest + 2)) };
  });
}

/**
 * @param fileName e.g. 'guest-overview.xlsx'
 * @param sheets   [{ name, headers: string[], rows: any[][] }] — one tab each.
 *                 Sheets with no rows are kept, so a reader can tell "no
 *                 flights" from "flights weren't exported".
 */
export async function downloadWorkbook(fileName, sheets) {
  // The package exposes no root entry — only subpaths. '/browser' is the one
  // that writes via Blob + a download link rather than Node's fs.
  const writeXlsxFile = (await import('write-excel-file/browser')).default;

  const taken = new Set();

  // One Sheet object per tab: `sheet` is the tab's name, `data` its rows, and
  // both live on the sheet rather than in the top-level options (the shape
  // changed in v4 — passing bare row arrays plus a `sheets: [names]` option is
  // the older API and throws here).
  const workbook = sheets.map((s) => ({
    sheet: sheetName(s.name, taken),
    columns: columnWidths(s.headers, s.rows),
    // Header row stays put while the body scrolls — these sheets get long.
    stickyRowsCount: 1,
    data: [
      s.headers.map((h) => ({ value: String(h ?? ''), type: String, fontWeight: 'bold' })),
      // Indexed off the headers so a short row still lands in the right columns.
      ...s.rows.map((r) => s.headers.map((_, i) => cell(r[i]))),
    ],
  }));

  // v4 returns { toBlob(), toFile(fileName) } — it does NOT download from a
  // `fileName` option the way v1 did. Passing one and awaiting the result
  // resolves silently having written nothing, which looks exactly like a
  // broken button. The download only happens via toFile().
  await writeXlsxFile(workbook).toFile(fileName);
}
