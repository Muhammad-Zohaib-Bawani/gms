import { fmtDate } from "../../../lib/date";

// Tier and Arrival/Departure used to be editable here too — dropped since
// Tier is now a legacy mirror of the guest's ServiceLevel (not directly
// settable) and this form isn't the place for travel dates anymore.
export function guestToProfileForm(g) {
  return {
    firstName: g.firstName || "",
    lastName: g.lastName || "",
    email: g.email || "",
    guestType: g.guestType || "delegate",
    organization: g.organization || "",
    nationalityId: g.nationalityId || "",
    photoUrl: g.photoUrl || "",
    accreditationRequired: !!g.accreditationRequired,
  };
}

export function fmtEventDates(ev) {
  if (!ev?.startDate) return "";
  // Portal-wide DD-MM-YYYY (lib/date), not the browser locale.
  const start = fmtDate(ev.startDate, "");
  if (!ev.endDate || ev.endDate === ev.startDate) return start;
  return `${start} – ${fmtDate(ev.endDate, "")}`;
}
