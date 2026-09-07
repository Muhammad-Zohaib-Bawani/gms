import { Icon } from "../../../../components/Icons";
import Select from "../../../../components/ui/Select";
import { nationalityOptionLabel } from "../../../../components/FlagIcon";
import { FieldLabel } from "./guestModal.helpers";

// STEP 1 — Personal Info. Moved verbatim out of GuestModal.jsx's inline JSX.
export default function GuestModalStep1PersonalInfo({
  form,
  setF,
  step1Errors,
  setStep1Errors,
  emailConflict,
  setEmailConflict,
  existingPerson,
  applyExistingPerson,
  photoUploading,
  handlePhotoSelect,
  guestTypeOpts,
  organizationOpts,
  nationalityOpts,
  t,
}) {
  return (
    <>
      <div className="guest-modal-photo-wrap">
        <div style={{ position: "relative" }}>
          <div className="guest-modal-photo-circle">
            {form.photoUrl ? (
              <img
                src={form.photoUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <Icon
                name="image"
                size={26}
                style={{ color: "var(--ink-faint)" }}
              />
            )}
          </div>
          <label
            className={
              "guest-modal-photo-upload-btn" +
              (photoUploading ? " guest-modal-photo-upload-btn--busy" : "")
            }
          >
            <Icon name="upload" size={12} style={{ color: "#fff" }} />
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              disabled={photoUploading}
              title="Guest Photo"
              style={{ display: "none" }}
            />
          </label>
        </div>
        <div className="guest-modal-photo-caption">
          {photoUploading ? t.step1.photoUploading : t.step1.photoOptional}
        </div>
        {form.photoUrl && !photoUploading && (
          <button
            onClick={() => setF("photoUrl", "")}
            title=""
            className="guest-modal-remove-photo-btn"
          >
            {t.step1.removePhoto}
          </button>
        )}
      </div>
      <div className="guest-modal-grid-2col">
        {[
          {
            label: t.fields.firstName,
            key: "firstName",
            ph: t.fields.firstNamePh,
          },
          {
            label: t.fields.lastName,
            key: "lastName",
            ph: t.fields.lastNamePh,
          },
        ].map((f) => (
          <div key={f.key}>
            <FieldLabel>{f.label} *</FieldLabel>
            <input
              placeholder={f.ph}
              value={form[f.key]}
              onChange={(e) => {
                setF(f.key, e.target.value);
                setStep1Errors((p) => ({ ...p, [f.key]: false }));
              }}
              className={
                "guest-modal-input" +
                (step1Errors[f.key] ? " guest-modal-input--error" : "")
              }
            />
            {step1Errors[f.key] && (
              <div className="guest-modal-error-msg">{t.fields.required}</div>
            )}
          </div>
        ))}
      </div>
      <div>
        <FieldLabel>{t.fields.email} *</FieldLabel>
        <input
          type="email"
          placeholder="name@organization.com"
          value={form.email}
          onChange={(e) => {
            setF("email", e.target.value);
            setStep1Errors((p) => ({ ...p, email: false }));
            setEmailConflict(null);
          }}
          className={
            "guest-modal-input" +
            (step1Errors.email || emailConflict
              ? " guest-modal-input--error"
              : "")
          }
        />
        {step1Errors.email && (
          <div className="guest-modal-error-msg">{t.fields.required}</div>
        )}
        {/* Straight from the backend (GUEST_ALREADY_ON_EVENT /
            GUEST_EMAIL_CONFLICT) — its wording already explains which
            case it is. */}
        {emailConflict && !step1Errors.email && (
          <div className="guest-modal-error-msg">{emailConflict}</div>
        )}
        {/* Same email, DIFFERENT event: not an error. Saving adds this
            person to this event, reusing their identity and login. */}
        {existingPerson && !emailConflict && (
          <div
            className="alert alert-info"
            style={{
              marginTop: 8,
              fontSize: 12,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <Icon name="alert" size={14} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>
                {t.step1.existingPersonMsg(
                  existingPerson.firstName,
                  existingPerson.lastName,
                  existingPerson.eventTitle,
                )}
              </div>
              <button
                type="button"
                className="btn"
                style={{ marginTop: 8 }}
                onClick={applyExistingPerson}
              >
                <Icon name="check" size={12} />
                {t.step1.useExistingDetails}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="guest-modal-grid-2col">
        <div>
          <FieldLabel>{t.fields.guestType}</FieldLabel>
          <Select
            value={form.guestType}
            onChange={(v) => setF("guestType", v)}
            options={guestTypeOpts}
            placeMenu="top"
          />
        </div>
        <div>
          <FieldLabel>{t.fields.organization}</FieldLabel>
          <Select
            value={form.organizationId}
            onChange={(v) => setF("organizationId", v)}
            options={organizationOpts}
            placeholder={t.fields.selectPlaceholder}
            isClearable
            placeMenu="top"
          />
        </div>
      </div>
      <div>
        <FieldLabel>{t.fields.nationality}</FieldLabel>
        <Select
          value={form.nationalityId}
          onChange={(v) => setF("nationalityId", v)}
          options={nationalityOpts}
          formatOptionLabel={nationalityOptionLabel}
          placeholder={t.fields.selectPlaceholder}
          isClearable
          placeMenu="top"
        />
      </div>
    </>
  );
}
