import React from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../../components/Icons";
import toast from "../../../lib/toast";
import { getNationalities } from "../../../api/services/nationalityService";
import { getGuest, updateGuest, deleteGuest } from "../../../api/services/guestService";
import { uploadImageFile, stripSasToken } from "../../../api/services/uploadService";
import { getMeetings, editMeeting } from "../../../api/services/meetingService";
import { guestDrawer } from "../../../i18n/modules/guestDrawer";
import { guestToProfileForm } from "./guestDrawer.helpers";
import { useAccess } from "../../../auth/AccessContext";
import { PERM } from "../../../auth/permissions";
import GuestDrawerHeader from "./GuestDrawerHeader";
import GuestProfilePanel from "./GuestProfilePanel";
import GuestTravelPanel from "./GuestTravelPanel";
import GuestSessionsPanel from "./GuestSessionsPanel";
import GuestBadgeModal from "./GuestBadgeModal";
import GuestRemoveConfirmModal from "./GuestRemoveConfirmModal";
import GuestMeetingPickerModal from "./GuestMeetingPickerModal";
import "../guest-drawer.css";

const TIER_COLOR = {
  VVIP: "#e0b864",
  VIP: "#a78bda",
  Speaker: "var(--accent)",
  Delegate: "#5abf6e",
  Press: "#e08a7e",
  Observer: "var(--ink-mute)",
  vvip: "#e0b864",
  vip: "#a78bda",
  speaker: "var(--accent)",
  delegate: "#5abf6e",
  press: "#e08a7e",
  observer: "var(--ink-mute)",
};

// Orchestrator for the Guest Drawer: owns all state/handlers, and composes
// the header/profile/travel/sessions sub-panels plus the badge/remove/
// meeting-picker modals. Extracted out of App.jsx's ~1800-line GuestDrawer.
export default function GuestDrawer({
  guest,
  onClose,
  lang,
  activeEventId,
  activeEvent,
  onGuestUpdated,
  onGuestDeleted,
}) {
  const isAr = lang === "ar";
  const t = guestDrawer[isAr ? "ar" : "en"];

  // Every write this drawer offers (edit profile, remove guest, session
  // changes) posts to the guest endpoints, which gate on Guests/Write.
  const { canWrite } = useAccess();
  const canManage = canWrite(PERM.GUESTS);

  const navigate = useNavigate();
  const [guestSessions, setGuestSessions] = React.useState(
    new Set(guest.sessions || []),
  );
  const [editSessions, setEditSessions] = React.useState(false);
  const [sessionsSaved, setSessionsSaved] = React.useState(false);

  // Real GuestResponse fields (fullName/invitationStatus/accreditationStatus)
  // — the rest of this drawer predates the API and still reads some mock names.
  const guestName =
    guest.fullName ||
    guest.name ||
    `${guest.firstName || ""} ${guest.lastName || ""}`.trim();

  // Support chat is keyed by PERSON, but not every feed that opens this drawer
  // carries personId (the dashboard's recent-guests rows are eventGuestId only),
  // so it's fetched on demand rather than assumed present.
  const [openingChat, setOpeningChat] = React.useState(false);
  async function openSupportChat() {
    if (openingChat) return;
    let personId = guest.personId;
    if (!personId) {
      setOpeningChat(true);
      try {
        personId = (await getGuest(guest.id))?.personId;
      } catch {
        personId = null;
      } finally {
        setOpeningChat(false);
      }
    }
    if (!personId) {
      toast.error(
        isAr ? "تعذّر تحديد هوية الضيف" : "Could not resolve this guest's identity",
      );
      return;
    }
    navigate("/support-chat", {
      state: {
        personId,
        guestName,
        guestOrganization: guest.organization || "",
      },
    });
  }

  const [showBadge, setShowBadge] = React.useState(false);
  const [drawerNotice, setDrawerNotice] = React.useState("");
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);

  // ── Reference data for the real "Edit profile" modal ───────────────────────
  const [nationalities, setNationalities] = React.useState([]);
  React.useEffect(() => {
    getNationalities()
      .then(setNationalities)
      .catch(() => setNationalities([]));
  }, []);

  // ── Edit profile modal ──────────────────────────────────────────────────────
  const [editProfile, setEditProfile] = React.useState(false);
  const [profileForm, setProfileForm] = React.useState(() =>
    guestToProfileForm(guest),
  );
  const [savingProfile, setSavingProfile] = React.useState(false);
  const [photoUploading, setPhotoUploading] = React.useState(false);
  const setProfileField = (k, v) => setProfileForm((p) => ({ ...p, [k]: v }));

  function openEditProfile() {
    setProfileForm(guestToProfileForm(guest));
    setEditProfile(true);
  }

  async function handleProfilePhotoSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoUploading(true);
    try {
      const url = await uploadImageFile(file);
      setProfileField("photoUrl", url);
    } catch (err) {
      toast.fromError(err, isAr ? "فشل تحميل الصورة" : "Failed to upload photo");
    } finally {
      setPhotoUploading(false);
    }
  }

  async function saveProfile() {
    if (!profileForm.firstName.trim() || !profileForm.lastName.trim()) {
      toast.error(
        isAr ? "الاسم الأول والأخير مطلوبان" : "First and last name are required",
      );
      return;
    }
    setSavingProfile(true);
    try {
      const updated = await updateGuest(guest.id, {
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        email: profileForm.email || null,
        guestType: profileForm.guestType,
        organization: profileForm.organization || null,
        // The update endpoint resolves both of these fresh and overwrites the
        // guest's existing links from them — omitting serviceLevelId in
        // particular cleared the guest's assigned service level (and with it
        // their whole services checklist) on every save from this form.
        organizationId: guest.organizationId || null,
        nationalityId: profileForm.nationalityId || null,
        serviceLevelId: guest.serviceLevelId || null,
        overrideServiceLevelRules: !!guest.serviceLevelRulesOverridden,
        serviceLevelOverrideReason: guest.serviceLevelOverrideReason || null,
        // Not editable in this form — carried over unchanged.
        tier: guest.tier,
        arrivalDate: guest.arrivalDate || null,
        departureDate: guest.departureDate || null,
        photoUrl: stripSasToken(profileForm.photoUrl) || null,
        accreditationRequired: profileForm.accreditationRequired,
        invitationTemplateId: guest.invitationTemplateId || null,
        sessionIds: guest.sessionIds || [],
      });
      onGuestUpdated?.(updated);
      setEditProfile(false);
      drawerMsg(isAr ? "تم حفظ الملف الشخصي ✓" : "Profile saved ✓");
    } catch (err) {
      toast.fromError(
        err,
        isAr ? "حدث خطأ أثناء حفظ الملف الشخصي" : "Error saving the profile",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  // ── Add to meeting modal ────────────────────────────────────────────────────
  const [showMeetingPicker, setShowMeetingPicker] = React.useState(false);
  const [meetings, setMeetings] = React.useState([]);
  const [loadingMeetings, setLoadingMeetings] = React.useState(false);
  const [addingMeetingId, setAddingMeetingId] = React.useState(null);

  function openMeetingPicker() {
    setShowMeetingPicker(true);
    if (!activeEventId) return;
    setLoadingMeetings(true);
    getMeetings(activeEventId)
      .then((res) => setMeetings(res || []))
      .catch(() => setMeetings([]))
      .finally(() => setLoadingMeetings(false));
  }

  // Meeting attendees are EventGuest.PublicIds: a meeting belongs to one event,
  // and `guest.id` is this guest's participation in that same event. The
  // meeting's existing guests carry the same kind of id, so the union below is
  // apples-to-apples.
  async function addToMeeting(m) {
    if ((m.guests || []).some((g) => g.id === guest.id)) {
      setShowMeetingPicker(false);
      drawerMsg(
        isAr ? "الضيف مُضاف بالفعل إلى هذا الاجتماع" : "Guest is already in this meeting",
      );
      return;
    }
    setAddingMeetingId(m.id);
    try {
      const eventGuestIds = [
        ...(m.guests || []).map((g) => g.id).filter(Boolean),
        guest.id,
      ];
      await editMeeting({ meetId: m.id, eventId: activeEventId, eventGuestIds });
      setShowMeetingPicker(false);
      drawerMsg(isAr ? t.meetingAdded : t.meetingAdded);
    } catch (err) {
      toast.fromError(
        err,
        isAr ? "تعذّرت الإضافة إلى الاجتماع" : "Failed to add guest to meeting",
      );
    } finally {
      setAddingMeetingId(null);
    }
  }

  // ── Scoped print (Export PDF / Print Badge) ─────────────────────────────────
  function printSection(cls) {
    document.body.classList.add(cls);
    const cleanup = () => {
      document.body.classList.remove(cls);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  }

  function drawerMsg(msg) {
    setDrawerNotice(msg);
    setTimeout(() => setDrawerNotice(""), 2500);
  }

  function toggleSession(id) {
    setGuestSessions((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function saveSessions() {
    setSessionsSaved(true);
    setEditSessions(false);
    setTimeout(() => setSessionsSaved(false), 2500);
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await deleteGuest(guest.id);
      setConfirmRemove(false);
      onGuestDeleted?.();
    } catch (err) {
      toast.fromError(err, isAr ? "تعذّر إزالة الضيف" : "Failed to remove guest");
      setRemoving(false);
    }
  }

  const tierColor = TIER_COLOR[guest.tier] || "var(--accent)";

  const INVITE_BADGE = {
    not_sent: { label: isAr ? "لم تُرسل" : "Not sent", color: "#9CA3AF" },
    sent: { label: isAr ? "أُرسلت" : "Sent", color: "#3B82F6" },
    opened: { label: isAr ? "فُتحت" : "Opened", color: "#F59E0B" },
    accepted: { label: isAr ? "مقبولة" : "Accepted", color: "#5abf6e" },
    declined: { label: isAr ? "مرفوضة" : "Declined", color: "#e08a7e" },
  };
  const ACCRED_BADGE = {
    not_issued: { label: isAr ? "غير صادر" : "Not Required", color: "#9CA3AF" },
    issued: { label: isAr ? "صادر" : "Required", color: "#5abf6e" },
    revoked: { label: isAr ? "ملغى" : "Revoked", color: "#e05050" },
  };
  const inviteBadge = INVITE_BADGE[guest.invitationStatus] || INVITE_BADGE.not_sent;
  const accredBadge = ACCRED_BADGE[guest.accreditationStatus] || ACCRED_BADGE.not_issued;

  return (
    <>
      <div className="guest-drawer-header">
        <div className="guest-drawer-section-title">{t.profile}</div>
        <button className="icon-btn" onClick={onClose}>
          <Icon name="close" size={14} />
        </button>
      </div>
      <div id="print-profile-root" className="guest-drawer-body">
        <GuestDrawerHeader
          guest={guest}
          guestName={guestName}
          lang={lang}
          isAr={isAr}
          t={t}
          onMessage={openSupportChat}
          openingChat={openingChat}
          onShowBadge={() => setShowBadge(true)}
          canManage={canManage}
          onEditProfile={openEditProfile}
          onAddMeeting={openMeetingPicker}
          onExportPdf={() => printSection("printing-profile")}
          onRemove={() => setConfirmRemove(true)}
          drawerNotice={drawerNotice}
          inviteBadge={inviteBadge}
          accredBadge={accredBadge}
        />

        {/* No gate here: the panel only renders its form when editProfile is
            set, and the one thing that sets it is the header's Edit Profile
            item, which is already gated. */}
        <GuestProfilePanel
          guest={guest}
          t={t}
          isAr={isAr}
          accredBadge={accredBadge}
          editProfile={editProfile}
          onCloseEdit={() => setEditProfile(false)}
          profileForm={profileForm}
          setProfileField={setProfileField}
          savingProfile={savingProfile}
          photoUploading={photoUploading}
          onPhotoSelect={handleProfilePhotoSelect}
          onRemovePhoto={() => setProfileField("photoUrl", "")}
          onSave={saveProfile}
          nationalities={nationalities}
        />

        <div className="divider" />

        <GuestTravelPanel />

        <GuestSessionsPanel
          t={t}
          isAr={isAr}
          guestSessions={guestSessions}
          setGuestSessions={setGuestSessions}
          editSessions={editSessions}
          setEditSessions={setEditSessions}
          sessionsSaved={sessionsSaved}
          toggleSession={toggleSession}
          saveSessions={saveSessions}
        />
      </div>

      <GuestBadgeModal
        open={showBadge}
        onClose={() => setShowBadge(false)}
        guest={guest}
        activeEvent={activeEvent}
        lang={lang}
        isAr={isAr}
        tierColor={tierColor}
        guestName={guestName}
        t={t}
        onPrint={() => printSection("printing-badge")}
      />

      <GuestRemoveConfirmModal
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        guestName={guestName}
        t={t}
        removing={removing}
        onConfirm={handleRemove}
      />

      <GuestMeetingPickerModal
        open={showMeetingPicker}
        onClose={() => setShowMeetingPicker(false)}
        t={t}
        loadingMeetings={loadingMeetings}
        meetings={meetings}
        guestId={guest.id}
        addingMeetingId={addingMeetingId}
        onAdd={addToMeeting}
      />
    </>
  );
}
