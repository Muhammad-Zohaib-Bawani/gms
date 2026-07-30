import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table';
import { Icon } from '../Icons';

const S = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 0 },
  toolbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', borderBottom: '1px solid var(--glass-border)',
    gap: 12, flexWrap: 'wrap',
  },
  search: {
    background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
    borderRadius: 8, padding: '7px 11px', color: 'var(--ink)', fontSize: 13,
    outline: 'none', minWidth: 200,
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '10px 14px', textAlign: 'left',
    fontSize: 10.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: 'var(--ink-mute)', borderBottom: '1px solid var(--glass-border)',
    whiteSpace: 'nowrap', userSelect: 'none',
  },
  thSortable: { cursor: 'pointer' },
  td: {
    padding: '11px 14px', fontSize: 13,
    color: 'var(--ink)', borderBottom: '1px solid rgba(255,255,255,0.04)',
    verticalAlign: 'middle',
  },
  trHover: { background: 'rgba(255,255,255,0.02)' },
  trSelected: { background: 'rgba(141, 1, 52,0.1)', boxShadow: 'inset 3px 0 0 var(--accent)' },
  empty: { padding: '36px 16px', textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 },
  footer: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 16px', borderTop: '1px solid var(--glass-border)',
    fontSize: 12, color: 'var(--ink-mute)', flexWrap: 'wrap', gap: 8,
  },
  pageBtn: {
    background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
    borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
    color: 'var(--ink-mute)', lineHeight: 1.4,
  },
  pageBtnActive: {
    background: 'rgba(141, 1, 52,0.12)', border: '1px solid rgba(141, 1, 52,0.4)',
    color: 'var(--accent)',
  },
  pageBtnDisabled: { opacity: 0.35, cursor: 'not-allowed' },
  checkbox: { cursor: 'pointer', accentColor: 'var(--accent)', width: 15, height: 15 },
  sizeSelect: {
    background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
    borderRadius: 6, padding: '4px 8px', fontSize: 12, color: 'var(--ink)',
    cursor: 'pointer', outline: 'none',
  },
};

export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

export default function DataTable({
  columns,
  data,
  loading = false,
  emptyText = 'No records found',
  searchPlaceholder = 'Search…',
  showSearch = true,
  pageSize: initialPageSize = 15,
  // Server-driven paging. Pass `manualPagination` together with the current
  // page/size and the server's total row count; the table then renders exactly
  // the rows it's given and reports navigation back instead of slicing locally.
  manualPagination = false,
  pageIndex: controlledPageIndex = 0,
  totalRows: controlledTotalRows = 0,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  toolbar,
  onRowClick,
  // row selection
  enableRowSelection = false,
  onSelectionChange,
  getRowId = (row) => row.id,
  selectionResetKey,
  // Opt-in "active row" highlight (e.g. the open conversation in a chat inbox)
  // — distinct from enableRowSelection's checkboxes, which is a bulk-actions
  // concept. Compared against getRowId(row.original).
  selectedRowId,
}) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([]);
  const [rowSelection, setRowSelection] = useState({});
  const [hoveredRow, setHoveredRow] = useState(null);

  // Reset selection when selectionResetKey changes
  useEffect(() => {
    setRowSelection({});
  }, [selectionResetKey]);

  // Keep a ref so the selection effect reads the latest data without re-running on every data change
  const dataRef = useRef(data ?? []);
  dataRef.current = data ?? [];

  // Notify parent only when the selection actually changes — not on every data reference change
  useEffect(() => {
    if (!enableRowSelection || !onSelectionChange) return;
    onSelectionChange(dataRef.current.filter(r => rowSelection[getRowId(r)]));
  }, [rowSelection]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectColumn = useMemo(() => ({
    id: '_select',
    size: 40,
    enableSorting: false,
    enableGlobalFilter: false,
    header: ({ table }) => (
      <input
        type="checkbox"
        style={S.checkbox}
        checked={table.getIsAllPageRowsSelected()}
        ref={el => { if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(); }}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        style={S.checkbox}
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onChange={row.getToggleSelectedHandler()}
        onClick={e => e.stopPropagation()}
      />
    ),
  }), []);

  const finalColumns = useMemo(
    () => (enableRowSelection ? [selectColumn, ...columns] : columns),
    [enableRowSelection, selectColumn, columns],
  );

  const table = useReactTable({
    data: data ?? [],
    columns: finalColumns,
    state: {
      globalFilter,
      sorting,
      ...(enableRowSelection ? { rowSelection } : {}),
    },
    enableRowSelection: enableRowSelection || false,
    onRowSelectionChange: enableRowSelection ? setRowSelection : undefined,
    getRowId: enableRowSelection ? getRowId : undefined,
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    // In manual mode the server already sliced the page — running the local
    // pagination model on top would slice the slice.
    ...(manualPagination
      ? { manualPagination: true, pageCount: Math.ceil(controlledTotalRows / initialPageSize) || 1 }
      : { getPaginationRowModel: getPaginationRowModel() }),
    initialState: { pagination: { pageSize: initialPageSize } },
  });

  const localPagination = table.getState().pagination;
  const pageSize = manualPagination ? initialPageSize : localPagination.pageSize;
  const pageIndex = manualPagination ? controlledPageIndex : localPagination.pageIndex;
  const totalRows = manualPagination ? controlledTotalRows : table?.getFilteredRowModel()?.rows?.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalRows);

  const canPrev = manualPagination ? pageIndex > 0 : table.getCanPreviousPage();
  const canNext = manualPagination ? pageIndex + 1 < pageCount : table.getCanNextPage();
  const goToPage = (i) => (manualPagination ? onPageChange?.(i) : table.setPageIndex(i));
  // In manual mode the parent owns pageSize entirely; in local mode the table's
  // own state drives it, so flip it directly here as well as notifying the parent.
  const changePageSize = (n) => {
    if (!manualPagination) table.setPageSize(n);
    onPageSizeChange?.(n);
  };
  const showSizeSelector = manualPagination ? !!onPageSizeChange : true;

  return (
    <div style={S.wrap}>
      {(showSearch || toolbar) && (
        <div style={S.toolbar}>
          {showSearch && (
            <input
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              style={S.search}
            />
          )}
          {toolbar && <div style={{ marginInlineStart: 'auto' }}>{toolbar}</div>}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={S.table}>
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      style={{
                        ...S.th,
                        ...(canSort ? S.thSortable : {}),
                        width: header.column.columnDef.size,
                      }}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span style={{ fontSize: 10, opacity: sorted ? 1 : 0.3, color: sorted ? 'var(--accent)' : undefined }}>
                            {sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '⇅'}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan={finalColumns.length} style={S.empty}>Loading…</td></tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr><td colSpan={finalColumns.length} style={S.empty}>{emptyText}</td></tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  style={{
                    ...(hoveredRow === row.id ? S.trHover : {}),
                    ...(selectedRowId != null && getRowId(row.original) === selectedRowId ? S.trSelected : {}),
                    ...(onRowClick ? { cursor: 'pointer' } : {}),
                  }}
                  onMouseEnter={() => setHoveredRow(row.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} style={S.td}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Shown whenever paging is server-driven (the size picker must stay
          reachable even on a single page) or there's more than one local page. */}
      {!loading && (manualPagination || totalRows > pageSize) && (
        <div style={S.footer}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {from}–{to} of {totalRows}
            {showSizeSelector && (
              <select
                style={S.sizeSelect}
                value={pageSize}
                onChange={e => changePageSize(Number(e.target.value))}
                aria-label="Rows per page"
              >
                {pageSizeOptions.map(n => <option key={n} value={n}>{n} / page</option>)}
              </select>
            )}
          </span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              style={{ ...S.pageBtn, ...(canPrev ? {} : S.pageBtnDisabled) }}
              onClick={() => goToPage(pageIndex - 1)}
              disabled={!canPrev}
            >‹ Prev</button>

            {Array.from({ length: pageCount }, (_, i) => i)
              .filter(i => Math.abs(i - pageIndex) <= 2)
              .map(i => (
                <button
                  key={i}
                  style={{ ...S.pageBtn, ...(i === pageIndex ? S.pageBtnActive : {}) }}
                  onClick={() => goToPage(i)}
                >{i + 1}</button>
              ))}

            <button
              style={{ ...S.pageBtn, ...(canNext ? {} : S.pageBtnDisabled) }}
              onClick={() => goToPage(pageIndex + 1)}
              disabled={!canNext}
            >Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}
