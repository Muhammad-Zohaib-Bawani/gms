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

// Presentation lives in styles/qoc-revamp.css under the `.dt-*` namespace.
// It used to be an inline-style object here, but those values were tuned for
// the dark shell (white-alpha borders and hover tints that vanish on a light
// page) and inline styles can't respond to the theme at all. Only genuinely
// dynamic values (column width, sort state) stay in JS.
const CHECKBOX = { cursor: 'pointer', accentColor: 'var(--accent)', width: 15, height: 15 };

export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

export default function DataTable({
  columns,
  data,
  loading = false,
  emptyText = 'No records found',
  searchPlaceholder = 'Search…',
  showSearch = true,
  // Controlled/server-driven search — pass both together when the rows
  // themselves come from the server (manualPagination): the local
  // `globalFilter` state would otherwise only ever search the current page's
  // handful of rows instead of the whole dataset. Omit both to keep the
  // existing uncontrolled, filters-the-local-`data` behaviour.
  searchValue,
  onSearchChange,
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
  const searchIsControlled = onSearchChange != null;
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([]);
  const [rowSelection, setRowSelection] = useState({});

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
        style={CHECKBOX}
        checked={table.getIsAllPageRowsSelected()}
        ref={el => { if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(); }}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        style={CHECKBOX}
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
      // Controlled mode never feeds the local filter model — the server
      // already returned only the matching rows.
      globalFilter: searchIsControlled ? '' : globalFilter,
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
    <div className="dt">
      {(showSearch || toolbar) && (
        <div className="dt-toolbar">
          {showSearch && (
            <input
              value={searchIsControlled ? (searchValue ?? '') : globalFilter}
              onChange={e => (searchIsControlled ? onSearchChange(e.target.value) : setGlobalFilter(e.target.value))}
              placeholder={searchPlaceholder}
              className="dt-search"
            />
          )}
          {toolbar && <div style={{ marginInlineStart: 'auto' }}>{toolbar}</div>}
        </div>
      )}

      <div className="dt-scroll">
        <table className="dt-table">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      className={canSort ? 'dt-th sortable' : 'dt-th'}
                      style={{ width: header.column.columnDef.size }}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className={sorted ? 'dt-sort active' : 'dt-sort'}>
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
              <tr><td colSpan={finalColumns.length} className="dt-empty">Loading…</td></tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr><td colSpan={finalColumns.length} className="dt-empty">{emptyText}</td></tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className={[
                    'dt-row',
                    selectedRowId != null && getRowId(row.original) === selectedRowId ? 'selected' : '',
                    onRowClick ? 'clickable' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="dt-td">
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
        <div className="dt-footer">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {from}–{to} of {totalRows}
            {showSizeSelector && (
              <select
                className="dt-size"
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
              className="dt-page"
              onClick={() => goToPage(pageIndex - 1)}
              disabled={!canPrev}
            >‹ Prev</button>

            {Array.from({ length: pageCount }, (_, i) => i)
              .filter(i => Math.abs(i - pageIndex) <= 2)
              .map(i => (
                <button
                  key={i}
                  className={i === pageIndex ? 'dt-page active' : 'dt-page'}
                  onClick={() => goToPage(i)}
                >{i + 1}</button>
              ))}

            <button
              className="dt-page"
              onClick={() => goToPage(pageIndex + 1)}
              disabled={!canNext}
            >Next ›</button>
          </div>
        </div>
      )}
    </div>
  );
}
