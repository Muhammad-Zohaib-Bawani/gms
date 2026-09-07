import React, { useMemo } from "react";
import { StatusChip, ServiceLevelChip } from "../../../components/UI";
import FlagIcon from "../../../components/FlagIcon";
import GuestCell from "../../../components/GuestCell";
import DataTable from "../../../components/ui/DataTable";
import ActionMenu from "../../../components/ui/ActionMenu";
import { useAccess } from "../../../auth/AccessContext";

// The guest data table: column definitions (Guest / Service Level /
// Nationality / Invite Status / Accreditation / row actions) plus the
// DataTable wrapper handling server-side pagination and row selection.
export default function GuestsTable({
  gt,
  isAr,
  lang,
  guests,
  loading,
  activeEventId,
  pageIndex,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  selResetKey,
  onSelectionChange,
  onOpenGuest,
  navigate,
  openEditGuest,
  onDeleteRequest,
}) {
  const { canWrite } = useAccess();
  const canManage = canWrite('guests');
  const columns = useMemo(
    () => [
      {
        id: "guest",
        header: gt.colGuest,
        accessorKey: "fullName",
        cell: ({ row: { original: g } }) => (
          <GuestCell
            name={g.fullName}
            email={g.email}
            photoUrl={g.photoUrl}
            tier={g.tier}
            onOpen={(e) => { e.stopPropagation(); onOpenGuest?.(g); }}
          />
        ),
      },
      {
        id: "serviceLevel",
        header: gt.colServiceLevel,
        accessorKey: "serviceLevelName",
        size: 130,
        cell: ({ row: { original: g } }) => (
          <ServiceLevelChip
            name={g.serviceLevelName}
            nameAr={g.serviceLevelNameAr}
            color={g.serviceLevelColor}
            lang={lang}
          />
        ),
      },
      {
        id: "nationality",
        header: gt.colNationality,
        accessorKey: "nationalityName",
        size: 130,
        cell: ({ row: { original: g } }) => (
          <span style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FlagIcon code={g.nationalityCode} />
            {g.nationalityName}
          </span>
        ),
      },
      {
        id: "inviteStatus",
        header: gt.colInviteStatus,
        accessorKey: "invitationStatus",
        size: 120,
        cell: ({ getValue }) => <StatusChip status={getValue()} lang={lang} />,
      },

      {
        id: "accreditation",
        header: gt.colAccreditation,
        accessorKey: "accreditationStatus",
        size: 110,
        enableSorting: false,
        cell: ({ row: { original: g } }) => {
          if (!g.accreditationRequired) {
            return (
              <span className="chip draft">
                <span className="dot" />
                {gt.accredCellNotRequired}
              </span>
            );
          }
          const issued = g.accreditationStatus === "issued";
          return (
            <span className={`chip ${issued ? "confirmed" : "pending"}`}>
              <span className="dot" />
              {issued ? gt.accredCellIssued : gt.accredCellPending}
            </span>
          );
        },
      },
      {
        id: "actions",
        size: 44,
        enableSorting: false,
        cell: ({ row: { original: g } }) => (
          <ActionMenu
            items={[
              {
                label: gt.actionView,
                icon: "guests",
                onClick: () => navigate(`/guests/${g.id}`),
              },
              {
                label: gt.actionMessage,
                icon: "message",
                onClick: () => navigate('/support-chat', {
                  // Person-level: support chat keys off personId, not the participation.
                  state: { personId: g.personId, guestName: g.fullName, guestOrganization: g.organization || '' },
                }),
              },
              canManage && !["accepted", "declined"].includes(g.invitationStatus) && {
                label: gt.actionSendInvite,
                icon: "invitation",
                onClick: () => openEditGuest(g, 4),
              },
              canManage && {
                label: gt.actionEdit,
                icon: "edit",
                onClick: () => openEditGuest(g),
              },
              canManage && {
                label: gt.actionDelete,
                icon: "trash",
                danger: true,
                onClick: () => onDeleteRequest(g),
              },
            ]}
          />
        ),
      },
    ],
    [gt, lang, onOpenGuest, navigate, openEditGuest, onDeleteRequest, canManage],
  );

  return (
    <div className="card guests-card-flush">
      <DataTable
        columns={columns}
        data={guests}
        loading={loading}
        emptyText={
          activeEventId ? gt.noGuestsYet : gt.selectEventFirst
        }
        showSearch={false}
        manualPagination
        pageSize={pageSize}
        pageIndex={pageIndex}
        totalRows={totalCount}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        enableRowSelection
        onSelectionChange={onSelectionChange}
        selectionResetKey={selResetKey}
        getRowId={(g) => g.id}
      />
    </div>
  );
}
