import React, { useMemo } from "react";
import { Icon } from "../../../components/Icons";
import { nationalityOptionLabel } from "../../../components/FlagIcon";
import Select from "../../../components/ui/Select";

// Search box, the Filter button + its dropdown panel (Service Level /
// Invitation Status / Organization / Nationality / Accreditation), the
// "N of Total" / "N selected" counters, and the List/Overview view-mode
// toggle pinned to the far right of the row.
export default function GuestsFilterBar({
  t,
  gt,
  isAr,
  fmtN,
  query,
  setQuery,
  showFilterPanel,
  toggleFilterPanel,
  filterPanelRef,
  activeFilterCount,
  clearAllFilters,
  levelFilter,
  setLevelFilter,
  serviceLevels,
  statusFilters,
  setStatusFilters,
  orgFilter,
  setOrgFilter,
  organizations,
  nationalityFilter,
  setNationalityFilter,
  nationalities,
  accreditationFilter,
  setAccreditationFilter,
  guestsCount,
  totalCount,
  selCount,
  viewMode,
  setViewMode,
}) {
  const levelFilterOpts = useMemo(
    () => [
      { value: "All", label: gt.allServiceLevels },
      ...serviceLevels.map((l) => ({ value: l.id, label: isAr ? (l.nameAr || l.name) : l.name })),
    ],
    [serviceLevels, isAr, gt],
  );

  const statusFilterOpts = useMemo(
    () => [
      { value: "not_sent", label: gt.statusNotSent },
      { value: "sent", label: gt.statusSent },
      { value: "opened", label: gt.statusOpened },
      { value: "accepted", label: gt.statusAccepted },
      { value: "declined", label: gt.statusDeclined },
    ],
    [gt],
  );

  const orgFilterOpts = useMemo(
    () => [
      { value: "All", label: gt.allOrganizations },
      ...organizations.map((o) => ({ value: o.id, label: isAr ? (o.nameAr || o.name) : o.name })),
    ],
    [organizations, isAr, gt],
  );

  const nationalityFilterOpts = useMemo(
    () => [
      { value: "All", label: gt.allNationalities },
      ...nationalities.map((n) => ({ value: n.id, label: (isAr ? n.nameAr : n.name) || n.name, code: n.code })),
    ],
    [nationalities, isAr, gt],
  );

  const accreditationFilterOpts = useMemo(
    () => [
      { value: "All", label: gt.allAccreditation },
      { value: "not_required", label: gt.accredNotRequiredFilter },
      { value: "pending", label: gt.accredPendingFilter },
      { value: "issued", label: gt.accredIssuedFilter },
    ],
    [gt],
  );

  return (
    <div className="filter-bar">
      <div className="search" style={{ flex: 1, maxWidth: 320 }}>
        <Icon name="search" size={14} />
        <input
          placeholder={gt.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div style={{ position: "relative" }} ref={filterPanelRef}>
        <button
          className="btn"
          onClick={toggleFilterPanel}
          style={{ position: "relative" }}
          title={gt.filterBtn}
        >
          <Icon name="filter" size={14} />
          {gt.filterBtn}
          {activeFilterCount > 0 && (
            <span className="guests-filter-badge">{fmtN(activeFilterCount)}</span>
          )}
        </button>

        {showFilterPanel && (
          <div className="guests-filter-panel">
            <div className="guests-filter-panel-header">
              <span className="guests-filter-panel-title">{gt.filterPanelTitle}</span>
              {activeFilterCount > 0 && (
                <button className="guests-filter-clear-btn" onClick={clearAllFilters}>
                  {gt.clearAll}
                </button>
              )}
            </div>

            <div>
              <label className="guests-filter-field-label">{gt.serviceLevelLabel}</label>
              <Select
                value={levelFilter}
                onChange={(v) => setLevelFilter(v || "All")}
                options={levelFilterOpts}
                placeholder={gt.serviceLevelLabel}
              />
            </div>

            <div>
              <label className="guests-filter-field-label">{gt.invitationStatusLabel}</label>
              <Select
                value={statusFilters}
                onChange={(v) => setStatusFilters(v || [])}
                options={statusFilterOpts}
                placeholder={gt.anyStatus}
                isMulti
              />
            </div>

            <div>
              <label className="guests-filter-field-label">{gt.organizationLabel}</label>
              <Select
                value={orgFilter}
                onChange={(v) => setOrgFilter(v || "All")}
                options={orgFilterOpts}
                placeholder={gt.organizationLabel}
              />
            </div>

            <div>
              <label className="guests-filter-field-label">{gt.nationalityLabel}</label>
              <Select
                value={nationalityFilter}
                onChange={(v) => setNationalityFilter(v || "All")}
                options={nationalityFilterOpts}
                formatOptionLabel={nationalityOptionLabel}
                placeholder={gt.nationalityLabel}
              />
            </div>

            <div>
              <label className="guests-filter-field-label">{gt.accreditationFilterLabel}</label>
              <Select
                value={accreditationFilter}
                onChange={(v) => setAccreditationFilter(v || "All")}
                options={accreditationFilterOpts}
                placeholder={gt.accreditationFilterLabel}
              />
            </div>
          </div>
        )}
      </div>

      <span className="guests-count-text">
        {fmtN(guestsCount)} {t.common?.of || (isAr ? "من" : "of")} {fmtN(totalCount)}
      </span>
      {selCount > 0 && (
        <span className="guests-selected-text">
          {fmtN(selCount)} {t.common?.selected || (isAr ? "محدد" : "selected")}
        </span>
      )}

      <div className="tabs guests-view-toggle">
        <button
          type="button"
          className={`guests-view-toggle-btn${viewMode === "list" ? " active" : ""}`}
          title={gt.listViewTitle}
          aria-pressed={viewMode === "list"}
          onClick={() => setViewMode("list")}
        >
          <Icon name="reports" size={15} />
        </button>
        <button
          type="button"
          className={`guests-view-toggle-btn${viewMode === "split" ? " active" : ""}`}
          title={gt.overviewTitle}
          aria-pressed={viewMode === "split"}
          onClick={() => setViewMode("split")}
        >
          <Icon name="guests" size={15} />
        </button>
      </div>
    </div>
  );
}
