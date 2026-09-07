import React from "react";
import { Icon } from "../../components/Icons.jsx";
import DataTable from "../../components/ui/DataTable.jsx";
import DateField from "../../components/ui/DateField.jsx";
import { FilterBar } from "./parts.jsx";

export default function ArrivalsDeparturesTab({
  STR,
  isAr,
  ad,
  adSearchInput,
  setAdSearchInput,
  adDirection,
  setAdDirection,
  adDirectionOpts,
  adRows,
  adTotal,
  fmtN,
  adFrom,
  setAdFrom,
  adTo,
  setAdTo,
  adColumns,
  adLoading,
  adPageSize,
  adPageIndex,
  setAdPageIndex,
  setAdPageSize,
}) {
  return (
    <div>
      <FilterBar
        search={adSearchInput}
        onSearch={setAdSearchInput}
        searchPlaceholder={STR.searchPh}
        filter={adDirection}
        onFilter={(v) => setAdDirection(v || "all")}
        filterOptions={adDirectionOpts}
        filterPlaceholder={STR.direction.all}
        shown={fmtN(adRows.length)}
        total={fmtN(adTotal)}
        countLabel={isAr ? "من" : "of"}
        extra={
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ minWidth: 140 }}>
              <DateField
                value={adFrom}
                onChange={(v) => setAdFrom(v || "")}
                placeholder={STR.dateFrom}
              />
            </div>
            <span style={{ color: "var(--ink-faint)", fontSize: 12 }}>
              –
            </span>
            <div style={{ minWidth: 140 }}>
              <DateField
                value={adTo}
                onChange={(v) => setAdTo(v || "")}
                minDate={adFrom || undefined}
                placeholder={STR.dateTo}
              />
            </div>
            {(adFrom || adTo) && (
              <button
                className="icon-btn"
                title={STR.clearDates}
                onClick={() => {
                  setAdFrom("");
                  setAdTo("");
                }}
                style={{ opacity: 0.6 }}
              >
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
        }
      />
      <div className="card" style={{ padding: 0 }}>
        <DataTable
          columns={adColumns}
          data={adRows}
          loading={adLoading}
          emptyText={STR.noResults}
          showSearch={false}
          manualPagination
          pageSize={adPageSize}
          pageIndex={adPageIndex}
          totalRows={adTotal}
          onPageChange={setAdPageIndex}
          onPageSizeChange={setAdPageSize}
        />
      </div>
    </div>
  );
}
