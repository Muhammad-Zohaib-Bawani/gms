import React from "react";
import DataTable from "../../components/ui/DataTable.jsx";
import TravelFilters from "./TravelFilters.jsx";

export default function TransfersTab({
  STR,
  isAr,
  tSearch,
  setTSearch,
  filterFields,
  filterValues,
  onFilterChange,
  onFilterClear,
  filteredTransferBookings,
  transferRows,
  fmtN,
  columns,
  filteredTransfers,
  tabLoading,
}) {
  return (
    <div>
      <TravelFilters
        search={tSearch}
        onSearch={setTSearch}
        searchPlaceholder={STR.searchPh}
        fields={filterFields}
        values={filterValues}
        onChange={onFilterChange}
        onClear={onFilterClear}
        filtersLabel={STR.filters}
        clearLabel={STR.clearAll}
        shown={fmtN(filteredTransferBookings.length)}
        total={fmtN(transferRows.length)}
        countLabel={isAr ? "من" : "of"}
      />
      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={columns.transfers}
          data={filteredTransfers}
          loading={tabLoading[2]}
          emptyText={STR.noResults}
          showSearch={false}
          pageSize={10}
        />
      </div>
    </div>
  );
}
