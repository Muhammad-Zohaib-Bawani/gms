import { Icon } from "../../../components/Icons";
import Select from "../../../components/ui/Select";
import { fmtDate } from "../../../lib/date";

const GUEST_TYPES = ["dignitary", "delegate", "media", "staff", "vip", "observer"];

export function DetailRow({ label, value, mono }) {
  return (
    <div className="guest-drawer-detail-row">
      <span className="guest-drawer-detail-row-label">{label}</span>
      <span
        className={
          "guest-drawer-detail-row-value" +
          (mono ? " guest-drawer-detail-row-value--mono" : "")
        }
      >
        {value}
      </span>
    </div>
  );
}

// The guest's read-only detail rows (email / arrival / accreditation), plus
// the "Edit profile" modal — kept together since the modal is this panel's
// own editing surface.
export default function GuestProfilePanel({
  guest,
  t,
  isAr,
  accredBadge,
  editProfile,
  onCloseEdit,
  profileForm,
  setProfileField,
  savingProfile,
  photoUploading,
  onPhotoSelect,
  onRemovePhoto,
  onSave,
  nationalities,
}) {
  return (
    <>
      <DetailRow label={t.email} value={guest.email || "—"} mono />
      {guest.arrivalDate && (
        <DetailRow label={t.arrival} value={fmtDate(guest.arrivalDate)} mono />
      )}
      <DetailRow label={t.accreditation} value={accredBadge.label} />

      {editProfile && (
        <div className="guest-drawer-modal-overlay">
          <div
            className="card glass modal-solid guest-drawer-modal-card"
            style={{
              width: 460,
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div className="guest-drawer-modal-head">
              <h3 style={{ margin: 0, fontSize: 15 }}>{t.editPro}</h3>
              <button className="icon-btn" onClick={onCloseEdit}>
                <Icon name="close" size={14} />
              </button>
            </div>
            <div
              style={{
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                overflowY: "auto",
                flex: 1,
              }}
            >
              <div className="guest-drawer-avatar-upload-wrap">
                <div style={{ position: "relative" }}>
                  <div className="guest-drawer-avatar-preview">
                    {profileForm.photoUrl ? (
                      <img
                        src={profileForm.photoUrl}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <Icon
                        name="image"
                        size={24}
                        style={{ color: "var(--ink-faint)" }}
                      />
                    )}
                  </div>
                  <label
                    className="guest-drawer-avatar-upload-btn"
                    style={{
                      cursor: photoUploading ? "default" : "pointer",
                      opacity: photoUploading ? 0.6 : 1,
                    }}
                  >
                    <Icon name="upload" size={11} style={{ color: "#fff" }} />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={onPhotoSelect}
                      disabled={photoUploading}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                  {photoUploading ? t.uploading : t.photoOptional}
                </div>
                {profileForm.photoUrl && !photoUploading && (
                  <button
                    onClick={onRemovePhoto}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--ink-mute)",
                      fontSize: 11,
                      cursor: "pointer",
                      padding: 0,
                      textDecoration: "underline",
                    }}
                  >
                    {t.removePhoto}
                  </button>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label className="guest-drawer-field-label">
                    {isAr ? "الاسم الأول" : "First Name"} *
                  </label>
                  <input
                    className="guest-drawer-input"
                    value={profileForm.firstName}
                    onChange={(e) => setProfileField("firstName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="guest-drawer-field-label">
                    {isAr ? "الاسم الأخير" : "Last Name"} *
                  </label>
                  <input
                    className="guest-drawer-input"
                    value={profileForm.lastName}
                    onChange={(e) => setProfileField("lastName", e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="guest-drawer-field-label">{t.email}</label>
                <input
                  type="email"
                  className="guest-drawer-input"
                  value={profileForm.email}
                  onChange={(e) => setProfileField("email", e.target.value)}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                <div>
                  <label className="guest-drawer-field-label">
                    {t.guestType}
                  </label>
                  <Select
                    value={profileForm.guestType}
                    onChange={(v) => setProfileField("guestType", v)}
                    options={GUEST_TYPES.map((gt) => ({
                      value: gt,
                      label: gt.charAt(0).toUpperCase() + gt.slice(1),
                    }))}
                  />
                </div>
                <div>
                  <label className="guest-drawer-field-label">
                    {t.organization}
                  </label>
                  <input
                    className="guest-drawer-input"
                    value={profileForm.organization}
                    onChange={(e) =>
                      setProfileField("organization", e.target.value)
                    }
                  />
                </div>
              </div>

              <div>
                <label className="guest-drawer-field-label">
                  {t.nationality}
                </label>
                <Select
                  value={profileForm.nationalityId}
                  onChange={(v) => setProfileField("nationalityId", v)}
                  options={nationalities.map((n) => ({
                    value: n.id,
                    label: `${n.flag} ${isAr ? n.nameAr : n.name}`,
                  }))}
                  placeholder={isAr ? "— اختر —" : "— Select —"}
                  isClearable
                />
              </div>

              <div>
                <label
                  className="guest-drawer-field-label"
                  style={{ marginBottom: 8 }}
                >
                  {t.accreditation2}
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { value: false, label: t.accredNotRequired },
                    { value: true, label: t.accredRequired },
                  ].map((opt) => (
                    <div
                      key={String(opt.value)}
                      onClick={() =>
                        setProfileField("accreditationRequired", opt.value)
                      }
                      className="guest-drawer-radio-tile"
                      style={{
                        fontWeight:
                          profileForm.accreditationRequired === opt.value
                            ? 600
                            : 400,
                        border: `1px solid ${profileForm.accreditationRequired === opt.value ? "var(--accent)" : "var(--glass-border)"}`,
                        background:
                          profileForm.accreditationRequired === opt.value
                            ? "rgba(141, 1, 52,0.12)"
                            : "var(--surface-soft-2)",
                      }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="guest-drawer-modal-foot">
              <button
                className="btn"
                onClick={onCloseEdit}
                disabled={savingProfile}
              >
                {t.cancel}
              </button>
              <button
                className="btn primary"
                onClick={onSave}
                disabled={savingProfile}
              >
                <Icon name="check" size={13} />{" "}
                {savingProfile ? t.saving : t.saveChanges}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
