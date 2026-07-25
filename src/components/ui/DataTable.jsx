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
};

export default function DataTable({
  columns,
  data,
  loading = false,
  emptyText = 'No records found',
  searchPlaceholder = 'Search…',
  showSearch = true,
  pageSize: initialPageSize = 15,
  toolbar,
  onRowClick,
  // row selection
  enableRowSelection = false,
  onSelectionChange,
  getRowId = (row) => row.id,
  selectionResetKey,
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
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: initialPageSize } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const totalRows = table?.getFilteredRowModel()?.rows?.length;
  const from = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, totalRows);

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

      {!loading && totalRows > pageSize && (
        <div style={S.footer}>
          <span>{from}–{to} of {totalRows}</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              style={{ ...S.pageBtn, ...(table.getCanPreviousPage() ? {} : S.pageBtnDisabled) }}
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >‹ Prev</button>

            {Array.from({ length: table.getPageCount() }, (_, i) => i)
              .filter(i => Math.abs(i - pageIndex) <= 2)
              .map(i => (
                <button
                  key={i}
                  style={{ ...S.pageBtn, ...(i === pageIndex ? S.pageBtnActive : {}) }}
                  onClick={() => table.setPageIndex(i)}
                >{i + 1}</button>
              ))}

            <button
              style={{ ...S.pageBtn, ...(table.getCanNextPage() ? {} : S.pageBtnDisabled) }}
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}
