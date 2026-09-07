import React from "react";
import DataTable from "../../components/ui/DataTable.jsx";
import TravelFilters from "./TravelFilters.jsx";

export default function HotelTab({
  STR,
  isAr,
  hSearch,
  setHSearch,
  filterFields,
  filterValues,
  onFilterChange,
  onFilterClear,
  filteredHotelBookings,
  hotelRows,
  fmtN,
  columns,
  filteredHotels,
  tabLoading,
}) {
  return (
    <div>
      <TravelFilters
        search={hSearch}
        onSearch={setHSearch}
        searchPlaceholder={STR.searchPh}
        fields={filterFields}
        values={filterValues}
        onChange={onFilterChange}
        onClear={onFilterClear}
        filtersLabel={STR.filters}
        clearLabel={STR.clearAll}
        shown={fmtN(filteredHotelBookings.length)}
        total={fmtN(hotelRows.length)}
        countLabel={isAr ? "من" : "of"}
      />
      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={columns.hotels}
          data={filteredHotels}
          loading={tabLoading[1]}
          emptyText={STR.noResults}
          showSearch={false}
          pageSize={10}
        />
      </div>
    </div>
  );
}
