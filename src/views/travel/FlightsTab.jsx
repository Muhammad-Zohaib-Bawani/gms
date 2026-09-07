import React from "react";
import DataTable from "../../components/ui/DataTable.jsx";
import TravelFilters from "./TravelFilters.jsx";

export default function FlightsTab({
  STR,
  isAr,
  fSearch,
  setFSearch,
  filterFields,
  filterValues,
  onFilterChange,
  onFilterClear,
  filteredFlightBookings,
  flightRows,
  fmtN,
  columns,
  filteredFlights,
  tabLoading,
}) {
  return (
    <div>
      <TravelFilters
        search={fSearch}
        onSearch={setFSearch}
        searchPlaceholder={STR.searchPh}
        fields={filterFields}
        values={filterValues}
        onChange={onFilterChange}
        onClear={onFilterClear}
        filtersLabel={STR.filters}
        clearLabel={STR.clearAll}
        shown={fmtN(filteredFlightBookings.length)}
        total={fmtN(flightRows.length)}
        countLabel={isAr ? "من" : "of"}
      />
      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={columns.flights}
          data={filteredFlights}
          loading={tabLoading[0]}
          emptyText={STR.noResults}
          showSearch={false}
          pageSize={10}
        />
      </div>
    </div>
  );
}
