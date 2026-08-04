// Single guest create/edit wizard — driven by the `guest` prop (null = create
// a new guest for `activeEventId`; an object = edit that guest in place).
import React, { useState, useMemo, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useEvents } from '../../../events/EventsContext';
import { Icon } from "../../../components/Icons";
import Select from "../../../components/ui/Select";
import { useAuth } from "../../../auth/AuthContext";
import toast from "../../../lib/toast";
import { createGuest, updateGuest } from "../../../api/services/guestService";
import {
  getTravelLookups,
  getGuestTravel,
  saveGuestTravel,
} from "../../../api/services/travelService";
import {
  uploadImageFile,
  stripSasToken,
} from "../../../api/services/uploadService";
import { addDaysIso } from "../../../lib/date";
import TravelAccordion, {
  EMPTY_TRAVEL,
  hydrateTravel,
  anyTravelEnabled,
  buildTravelPayload,
  validateTravel,
} from "./TravelAccordion";

const GUEST_TYPES = [
  "dignitary",
  "delegate",
  "media",
  "staff",
  "vip",
  "observer",
];

// Module scope on purpose: defining this inside the component gives it a
// fresh identity every render, remounting the label DOM on every keystroke.
function FieldLabel({ children }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 10.5,
        color: "var(--ink-mute)",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        marginBottom: 5,
      }}
    >
      {children}
    </label>
  );
}

function SectionLabel({ children }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 10.5,
        color: "var(--ink-mute)",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        marginBottom: 10,
      }}
    >
      {children}
    </label>
  );
}

const EMPTY_GUEST = {
  firstName: "",
  lastName: "",
  email: "",
  guestType: "delegate",
  organizationId: "",
  nationalityId: "",
  serviceLevelId: "",
  invitationStatus: "not_sent",
  arrivalDate: "",
  departureDate: "",
  photoUrl: "",
  accreditationRequired: false,
  // Set when the user chooses to push past a failing level rule. The backend
  // re-checks the permission, so ticking this without it changes nothing.
  overrideServiceLevelRules: false,
  serviceLevelOverrideReason: "",
};

function guestToForm(g) {
  if (!g) return { ...EMPTY_GUEST };
  return {
    firstName: g.firstName || "",
    lastName: g.lastName || "",
    email: g.email || "",
    guestType: g.guestType || "delegate",
    organizationId: g.organizationId || "",
    nationalityId: g.nationalityId || "",
    serviceLevelId: g.serviceLevelId || "",
    invitationStatus: g.invitationStatus || "not_sent",
    arrivalDate: g.arrivalDate || "",
    departureDate: g.departureDate || "",
    photoUrl: g.photoUrl || "",
    accreditationRequired: !!g.accreditationRequired,
    overrideServiceLevelRules: false,
    serviceLevelOverrideReason: "",
  };
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  backdropFilter: "blur(3px)",
  zIndex: 1100,
};

const contentStyle = {
  position: "fixed",
  inset: 0,
  margin: "auto",
  width: 560,
  maxWidth: "94vw",
  height: 680,
  maxHeight: "92vh",
  zIndex: 1101,
  display: "flex",
  flexDirection: "column",
  border: "1px solid var(--glass-border)",
  borderRadius: 16,
  boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
  outline: "none",
};

// One week of slack around the event's own start/end date — a guest may fly
// in up to 7 days before the event starts or leave up to 7 days after it ends.
const DATE_MARGIN_DAYS = 7;

// The pre-service-level tier vocabulary, mirroring Core.Constants.GuestTier.
// Kept as a literal because these six values are a code enum with no lookup
// endpoint — see GuestConstants.cs.
const LEGACY_TIERS = [
  { code: "vvip", en: "VVIP", ar: "شخصية بالغة الأهمية", color: "#e0b864" },
  { code: "vip", en: "VIP", ar: "شخصية مهمة", color: "#a78bda" },
  { code: "speaker", en: "Speaker", ar: "متحدث", color: "var(--accent)" },
  { code: "delegate", en: "Delegate", ar: "مندوب", color: "#5abf6e" },
  { code: "press", en: "Press", ar: "صحافة", color: "var(--danger)" },
  { code: "observer", en: "Observer", ar: "مراقب", color: "var(--ink-mute)" },
];

function LegacyTierPicker({ value, onChange, isAr }) {
  const current = (value || "").toLowerCase();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
      {LEGACY_TIERS.map((t) => {
        const selected = current === t.code;
        return (
          <div
            key={t.code}
            onClick={() => onChange(t.code)}
            style={{
              padding: "10px", borderRadius: 10, cursor: "pointer", textAlign: "center",
              border: `1px solid ${selected ? t.color : "var(--glass-border)"}`,
              background: selected ? "var(--accent-soft)" : "var(--surface-soft-2)",
              fontSize: 13, fontWeight: selected ? 600 : 400,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: t.color,
              }} />
              {isAr ? t.ar : t.en}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function GuestModal({
  open,
  onClose,
  guest,
  activeEventId,
  eventStartDate,
  eventEndDate,
  nationalities,
  organizations,
  serviceLevels,
  templates,
  sessions,
  lang,
  onSaved,
  initialStep = 1,
}) {
  const isAr = lang === "ar";
  const isEdit = !!guest;
  const { can } = useAuth();
  const { events, activeEvent } = useEvents();
  const canOverrideRules = can("ServiceLevels.OverrideRules");

  // Which flow this event runs. A guest always belongs to one event, so the
  // model is read from that event rather than passed down through every call
  // site of this modal.
  const eventForGuest =
    (guest?.eventId && (events || []).find((e) => e.id === guest.eventId)) || activeEvent;
  const usesServiceLevels = eventForGuest?.guestModel === "fixed";

  const [step, setStep] = useState(1);
  const [form, setForm] = useState(() => guestToForm(guest));
  const [templateId, setTemplateId] = useState(
    guest?.invitationTemplateId || null,
  );
  const [guestSessions, setGuestSessions] = useState(
    new Set(guest?.sessionIds || []),
  );
  const [step1Errors, setStep1Errors] = useState({});
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  // Raw GET /travel/guest/{id} response; hydrated into `travel` below once
  // travelLookups is available too (it may still be loading when this
  // resolves — deriving from both avoids a race where roomTypeId can't be
  // resolved yet).
  const [rawTravel, setRawTravel] = useState(null);
  const [travel, setTravel] = useState(EMPTY_TRAVEL);
  const [travelLookups, setTravelLookups] = useState({});

  // Reset/prefill whenever the modal opens for a (possibly different) guest —
  // covers switching between two different edit targets and going from edit
  // back to create.
  useEffect(() => {
    if (!open) return;
    setForm(guestToForm(guest));
    setTemplateId(guest?.invitationTemplateId || null);
    setGuestSessions(new Set(guest?.sessionIds || []));
    setStep(initialStep);
    setStep1Errors({});
    setRawTravel(null);
    if (guest?.id) {
      getGuestTravel(guest.id)
        .then(setRawTravel)
        .catch(() => setRawTravel(null));
    }
  }, [open, guest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTravel(
      rawTravel ? hydrateTravel(rawTravel, travelLookups) : EMPTY_TRAVEL,
    );
  }, [rawTravel, travelLookups]);

  // Guarded on `open` — this component gets mounted once and toggled via the
  // `open` prop by some callers, so a bare `[]` dep would fire these (and the
  // 8 parallel requests inside getTravelLookups) on every mount regardless of
  // whether the dialog is actually visible yet.
  //
  // getGuestEnums() used to be fetched here for the tier picker; the picker now
  // reads real ServiceLevel rows passed in as a prop, so the call is gone.
  useEffect(() => {
    if (!open) return;
    getTravelLookups()
      .then(setTravelLookups)
      .catch(() => setTravelLookups({}));
  }, [open]);

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // Arrival/departure are bounded by the event's own start/end date, with a
  // week of slack on each side — not by session selection.
  const dateWindowMin = useMemo(
    () => addDaysIso(eventStartDate, -DATE_MARGIN_DAYS),
    [eventStartDate],
  );
  const dateWindowMax = useMemo(
    () => addDaysIso(eventEndDate, DATE_MARGIN_DAYS),
    [eventEndDate],
  );

  // If the active event (and therefore the window) changes while a date was
  // already picked, drop dates that no longer fall within the new window
  // instead of leaving a stale, invalid value.
  useEffect(() => {
    if (!dateWindowMin && !dateWindowMax) return;
    setForm((p) => {
      const outOfRange = (d) =>
        !!d &&
        ((dateWindowMin && d < dateWindowMin) ||
          (dateWindowMax && d > dateWindowMax));
      const arrivalBad = outOfRange(p.arrivalDate);
      const departureBad = outOfRange(p.departureDate);
      if (!arrivalBad && !departureBad) return p;
      return {
        ...p,
        arrivalDate: arrivalBad ? "" : p.arrivalDate,
        departureDate: departureBad ? "" : p.departureDate,
      };
    });
  }, [dateWindowMin, dateWindowMax]);

  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoUploading(true);
    try {
      const url = await uploadImageFile(file);
      setF("photoUrl", url);
    } catch (err) {
      toast.fromError(
        err,
        isAr ? "فشل تحميل الصورة" : "Failed to upload photo",
      );
    } finally {
      setPhotoUploading(false);
    }
  }

  function handleClose() {
    setStep(1);
    setStep1Errors({});
    onClose();
  }

  function handleNext() {
    if (step === 1) {
      const errs = {};
      if (!form.firstName.trim()) errs.firstName = true;
      if (!form.lastName.trim()) errs.lastName = true;
      const email = form.email.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!email || !emailRegex.test(email)) {
        errs.email = true;
      }
      if (Object.keys(errs).length) {
        setStep1Errors(errs);
        return;
      }
    }
    if (step === 3) {
      const travelErr = validateTravel(travel, isAr);
      if (travelErr) {
        toast.error(travelErr);
        return;
      }
    }
    setStep((s) => s + 1);
  }

  async function handleSave() {
    const travelErr = validateTravel(travel, isAr);
    if (travelErr) {
      toast.error(travelErr);
      return;
    }

    // Stop here rather than letting the backend 409 — same rules, friendlier
    // moment. The override path is only offered to those who hold the permission.
    if (ruleViolations.length > 0 && !(canOverrideRules && form.overrideServiceLevelRules)) {
      toast.error(canOverrideRules
        ? (isAr
          ? "قواعد مستوى الخدمة غير مستوفاة — فعّل التجاوز للحفظ على أي حال."
          : "This service level's rules aren't met — tick the override to save anyway.")
        : (isAr
          ? "قواعد مستوى الخدمة غير مستوفاة، وتحتاج صلاحية للتجاوز."
          : "This service level's rules aren't met, and you don't have override permission."));
      setStep(2);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email || null,
        guestType: form.guestType,
        organizationId: form.organizationId || null,
        nationalityId: form.nationalityId || null,
        // Omitted on a flexible event: the server ignores it there, and
        // sending one would imply an assignment nothing enforces.
        serviceLevelId: usesServiceLevels ? (form.serviceLevelId || null) : null,
        // Only sent when there's actually something to waive, so a stale tick
        // can't record a phantom override on a clean save.
        overrideServiceLevelRules: ruleViolations.length > 0 && form.overrideServiceLevelRules,
        serviceLevelOverrideReason:
          ruleViolations.length > 0 && form.overrideServiceLevelRules
            ? (form.serviceLevelOverrideReason || null)
            : null,
        arrivalDate: form.arrivalDate || null,
        departureDate: form.departureDate || null,
        photoUrl: stripSasToken(form.photoUrl) || null,
        accreditationRequired: form.accreditationRequired,
        invitationTemplateId: templateId || null,
        sessionIds: Array.from(guestSessions),
      };

      let guestId = guest?.id;
      if (isEdit) {
        await updateGuest(guest.id, payload);
      } else {
        const created = await createGuest({
          ...payload,
          eventId: activeEventId,
        });
        guestId = created?.id;
      }

      if (guestId && anyTravelEnabled(travel)) {
        try {
          await saveGuestTravel(
            guestId,
            buildTravelPayload(travel, travelLookups),
          );
        } catch {
          toast.error(
            isEdit
              ? isAr
                ? "تم تحديث الضيف لكن تعذّر حفظ بيانات السفر"
                : "Guest updated, but travel details failed to save"
              : isAr
                ? "تم حفظ الضيف لكن تعذّر حفظ بيانات السفر"
                : "Guest saved, but travel details failed to save",
          );
        }
      }

      onSaved?.();
      handleClose();
      toast.success(
        isEdit
          ? isAr
            ? "تم تحديث بيانات الضيف"
            : "Guest updated successfully"
          : templateId
            ? isAr
              ? "تمت إضافة الضيف وإرسال الدعوة"
              : "Guest added & invitation sent"
            : isAr
              ? "تمت إضافة الضيف بنجاح"
              : "Guest added successfully",
      );
    } catch (err) {
      toast.fromError(
        err,
        isEdit
          ? isAr
            ? "حدث خطأ أثناء تحديث الضيف"
            : "Error updating guest"
          : isAr
            ? "حدث خطأ أثناء إضافة الضيف"
            : "Error adding guest",
      );
    } finally {
      setSaving(false);
    }
  }

  const guestTypeOpts = useMemo(
    () =>
      GUEST_TYPES.map((gt) => ({
        value: gt,
        label: gt.charAt(0).toUpperCase() + gt.slice(1),
      })),
    [],
  );

  const nationalityOpts = useMemo(
    () =>
      nationalities.map((n) => ({
        value: n.id,
        label: `${n.flag} ${isAr ? n.nameAr : n.name}`,
      })),
    [nationalities, isAr],
  );

  const organizationOpts = useMemo(
    () =>
      (organizations || []).map((o) => ({
        value: o.id,
        label: isAr ? (o.nameAr || o.name) : o.name,
      })),
    [organizations, isAr],
  );

  const selectedLevel = useMemo(
    () => (serviceLevels || []).find((l) => l.id === form.serviceLevelId) || null,
    [serviceLevels, form.serviceLevelId],
  );

  // Rules are evaluated client-side from data we already have (the level's
  // capacity/headcount + this form's own field values), so the warning appears
  // as you type instead of only on submit. The backend re-validates on save —
  // this is a convenience, never the enforcement point.
  const ruleViolations = useMemo(() => {
    // A flexible event enforces nothing. This matters on an event switched from
    // fixed to flexible: its guests keep their old serviceLevelId, so a level
    // would still resolve here and its rules would still block the save.
    if (!usesServiceLevels) return [];
    if (!selectedLevel) return [];
    const out = [];

    // On edit, a guest already on this level doesn't count against its capacity.
    const alreadyHere = isEdit && guest?.serviceLevelId === selectedLevel.id;
    if (!alreadyHere && selectedLevel.capacity != null && selectedLevel.guestCount >= selectedLevel.capacity) {
      out.push(isAr
        ? `"${selectedLevel.name}" ممتلئ (${selectedLevel.guestCount} / ${selectedLevel.capacity}).`
        : `"${selectedLevel.name}" is at capacity (${selectedLevel.guestCount} / ${selectedLevel.capacity}).`);
    }

    const FIELD_LABELS = {
      email: isAr ? "البريد الإلكتروني" : "Email",
      nationalityId: isAr ? "الجنسية" : "Nationality",
      organizationId: isAr ? "المؤسسة" : "Organization",
      photoUrl: isAr ? "الصورة" : "Photo",
      arrivalDate: isAr ? "تاريخ الوصول" : "Arrival date",
      departureDate: isAr ? "تاريخ المغادرة" : "Departure date",
    };
    const missing = (selectedLevel.requiredGuestFields || [])
      .filter((key) => !String(form[key] ?? "").trim())
      .map((key) => FIELD_LABELS[key] || key);

    if (missing.length > 0) {
      out.push(isAr
        ? `"${selectedLevel.name}" يتطلب: ${missing.join("، ")}.`
        : `"${selectedLevel.name}" requires: ${missing.join(", ")}.`);
    }

    return out;
  }, [usesServiceLevels, selectedLevel, form, isAr, isEdit, guest?.serviceLevelId]);

  // Step 2 is named after whichever classifier the event actually uses, so the
  // stepper doesn't promise a Service Level on a flexible event.
  const stepLabels = isAr
    ? ["المعلومات الشخصية", usesServiceLevels ? "مستوى الخدمة والجلسات" : "التصنيف والجلسات", "السفر والإقامة", "الدعوة"]
    : ["Personal Info", usesServiceLevels ? "Service Level & Sessions" : "Tier & Sessions", "Travel", "Invitation"];

  const inputStyle = {
    width: "100%",
    background: "var(--surface-soft-3)",
    border: "1px solid var(--glass-border)",
    borderRadius: 8,
    padding: "9px 12px",
    color: "var(--ink)",
    fontSize: 13,
  };
  const errorBorder = { ...inputStyle, border: "1px solid #e05050" };
  const errMsg = { fontSize: 11, color: "#e05050", marginTop: 3 };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content
          className="modal-solid"
          style={contentStyle}
          onInteractOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
        >
          {/* Header */}
          <div
            style={{
              padding: "18px 24px",
              borderBottom: "1px solid var(--glass-border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexShrink: 0,
            }}
          >
            <div>
              <Dialog.Title
                style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600 }}
              >
                {isEdit
                  ? isAr
                    ? "تعديل الضيف"
                    : "Edit Guest"
                  : isAr
                    ? "ضيف جديد"
                    : "Add New Guest"}
                {isEdit && (
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 400,
                      color: "var(--ink-mute)",
                      marginLeft: 8,
                    }}
                  >
                    {guest.fullName}
                  </span>
                )}
              </Dialog.Title>
              <div style={{ display: "flex", alignItems: "center" }}>
                {stepLabels.map((label, i) => {
                  const s = i + 1,
                    done = step > s,
                    active = step === s;
                  return (
                    <React.Fragment key={i}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            display: "grid",
                            placeItems: "center",
                            fontSize: 11,
                            fontWeight: 700,
                            flexShrink: 0,
                            background: done
                              ? "var(--accent-deep)"
                              : active
                                ? "var(--accent)"
                                : "var(--surface-soft-4)",
                            color: done || active ? "#fff" : "var(--ink-mute)",
                          }}
                        >
                          {done ? <Icon name="check" size={11} /> : s}
                        </div>
                        <span
                          style={{
                            fontSize: 11.5,
                            whiteSpace: "nowrap",
                            color: active
                              ? "var(--accent)"
                              : done
                                ? "var(--ink-dim)"
                                : "var(--ink-mute)",
                            fontWeight: active ? 600 : 400,
                          }}
                        >
                          {label}
                        </span>
                      </div>
                      {i < stepLabels.length - 1 && (
                        <div
                          style={{
                            width: 18,
                            height: 1,
                            background: done
                              ? "var(--accent-deep)"
                              : "var(--glass-border)",
                            margin: "0 5px",
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="icon-btn"
                style={{ marginTop: 2, flexShrink: 0 }}
              >
                <Icon name="close" size={14} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            {/* STEP 1 — Personal Info */}
            {step === 1 && (
              <>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        width: 84,
                        height: 84,
                        borderRadius: "50%",
                        overflow: "hidden",
                        background: "var(--surface-soft-3)",
                        border: "1px solid var(--glass-border)",
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      {form.photoUrl ? (
                        <img
                          src={form.photoUrl}
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
                          size={26}
                          style={{ color: "var(--ink-faint)" }}
                        />
                      )}
                    </div>
                    <label
                      style={{
                        position: "absolute",
                        bottom: -2,
                        right: -2,
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: "var(--accent)",
                        display: "grid",
                        placeItems: "center",
                        cursor: photoUploading ? "default" : "pointer",
                        border: "2px solid var(--bg)",
                        opacity: photoUploading ? 0.6 : 1,
                      }}
                    >
                      <Icon name="upload" size={12} style={{ color: "#fff" }} />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoSelect}
                        disabled={photoUploading}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                    {photoUploading
                      ? isAr
                        ? "جارٍ التحميل…"
                        : "Uploading…"
                      : isAr
                        ? "صورة الوجه (اختياري)"
                        : "Facial photo"}
                  </div>
                  {form.photoUrl && !photoUploading && (
                    <button
                      onClick={() => setF("photoUrl", "")}
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
                      {isAr ? "إزالة الصورة" : "Remove photo"}
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
                  {[
                    {
                      label: isAr ? "الاسم الأول" : "First Name",
                      key: "firstName",
                      ph: isAr ? "مثال: خالد" : "e.g. Khalid",
                    },
                    {
                      label: isAr ? "الاسم الأخير" : "Last Name",
                      key: "lastName",
                      ph: isAr ? "مثال: المنصوري" : "e.g. Al-Mansouri",
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
                        style={step1Errors[f.key] ? errorBorder : inputStyle}
                      />
                      {step1Errors[f.key] && (
                        <div style={errMsg}>{isAr ? "مطلوب" : "Required"}</div>
                      )}
                    </div>
                  ))}
                </div>
                <div>
                  <FieldLabel>
                    {isAr ? "البريد الإلكتروني" : "Email"} *
                  </FieldLabel>
                  <input
                    type="email"
                    placeholder="name@organization.com"
                    value={form.email}
                    onChange={(e) => {
                      setF("email", e.target.value);
                      setStep1Errors((p) => ({ ...p, email: false }));
                    }}
                    style={step1Errors.email ? errorBorder : inputStyle}
                  />
                  {step1Errors.email && (
                    <div style={errMsg}>{isAr ? "مطلوب" : "Required"}</div>
                  )}
                </div>
                <div>
                  <FieldLabel>{isAr ? "نوع الضيف" : "Guest Type"}</FieldLabel>
                  <Select
                    value={form.guestType}
                    onChange={(v) => setF("guestType", v)}
                    options={guestTypeOpts}
                  />
                </div>
                <div>
                  <FieldLabel>{isAr ? "المؤسسة" : "Organization"}</FieldLabel>
                  <Select
                    value={form.organizationId}
                    onChange={(v) => setF("organizationId", v)}
                    options={organizationOpts}
                    placeholder={isAr ? "— اختر —" : "— Select —"}
                    isClearable
                  />
                </div>
                <div>
                  <FieldLabel>{isAr ? "الجنسية" : "Nationality"}</FieldLabel>
                  <Select
                    value={form.nationalityId}
                    onChange={(v) => setF("nationalityId", v)}
                    options={nationalityOpts}
                    placeholder={isAr ? "— اختر —" : "— Select —"}
                    isClearable
                  />
                </div>
              </>
            )}

            {/* STEP 2 — Sessions, Tier & Accreditation */}
            {step === 2 && (
              <>
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <label
                      style={{
                        fontSize: 10.5,
                        color: "var(--ink-mute)",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                      }}
                    >
                      {isAr ? "الجلسات (اختياري)" : "Sessions (optional)"}
                    </label>
                    {sessions.length > 0 && (
                      <button
                        onClick={() =>
                          setGuestSessions((prev) =>
                            prev.size === sessions.length
                              ? new Set()
                              : new Set(sessions.map((s) => s.id)),
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 11,
                          color: "var(--accent)",
                          padding: 0,
                        }}
                      >
                        {guestSessions.size === sessions.length
                          ? isAr
                            ? "إلغاء الكل"
                            : "Deselect all"
                          : isAr
                            ? "تحديد الكل"
                            : "Select all"}
                      </button>
                    )}
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    {sessions.map((s) => {
                      const checked = guestSessions.has(s.id);
                      return (
                        <div
                          key={s.id}
                          onClick={() =>
                            setGuestSessions((prev) => {
                              const n = new Set(prev);
                              n.has(s.id) ? n.delete(s.id) : n.add(s.id);
                              return n;
                            })
                          }
                          style={{
                            padding: "8px 12px",
                            borderRadius: 9,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                            border: `1px solid ${checked ? "var(--accent)" : "var(--glass-border)"}`,
                            background: checked
                              ? "rgba(26,174,196,0.08)"
                              : "var(--surface-soft-2)",
                          }}
                        >
                          <div
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 4,
                              border: `2px solid ${checked ? "var(--accent)" : "var(--glass-border)"}`,
                              background: checked
                                ? "var(--accent)"
                                : "transparent",
                              display: "grid",
                              placeItems: "center",
                              flexShrink: 0,
                              marginTop: 1,
                            }}
                          >
                            {checked && (
                              <Icon
                                name="check"
                                size={9}
                                style={{ color: "#fff" }}
                              />
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12.5,
                                fontWeight: checked ? 500 : 400,
                              }}
                            >
                              {s.title}
                            </div>
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--ink-mute)",
                                marginTop: 2,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <span style={{ fontFamily: "var(--mono)" }}>
                                {s.date} · {s.time}
                              </span>
                              {s.venueName || s.room
                                ? ` · ${[s.venueName, s.room].filter(Boolean).join(" · ")}`
                                : ""}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {sessions.length === 0 && (
                      <div
                        style={{
                          padding: "12px",
                          textAlign: "center",
                          color: "var(--ink-mute)",
                          fontSize: 12,
                          border: "1px dashed var(--glass-border)",
                          borderRadius: 9,
                        }}
                      >
                        {isAr
                          ? "لا توجد جلسات لهذه الفعالية"
                          : "No sessions for this event yet"}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <SectionLabel>
                    {usesServiceLevels
                      ? (isAr ? "مستوى الخدمة" : "Service Level")
                      : (isAr ? "التصنيف" : "Tier")}
                  </SectionLabel>
                  {/* A flexible event has no service levels, so it gets the
                      original tier picker back: a plain label with no bundled
                      services, no capacity and no required-field rules. */}
                  {!usesServiceLevels ? (
                    <LegacyTierPicker
                      value={form.tier}
                      onChange={(v) => setF("tier", v)}
                      isAr={isAr}
                    />
                  ) : (serviceLevels || []).length === 0 ? (
                    <div style={{
                      padding: "12px 14px", borderRadius: 10, fontSize: 12.5, color: "#e0c47e",
                      background: "rgba(224,196,126,0.12)", border: "1px solid rgba(224,196,126,0.4)",
                    }}>
                      <Icon name="alert" size={13} />{" "}
                      {isAr
                        ? "لا توجد مستويات خدمة لهذه الفعالية — أضفها من صفحة مستويات الخدمة أولاً."
                        : "This event has no service levels yet — add some on the Service Levels page first."}
                    </div>
                  ) : (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                        {serviceLevels.map((lvl) => {
                          const selected = form.serviceLevelId === lvl.id;
                          const full = lvl.capacity != null && lvl.guestCount >= lvl.capacity;
                          return (
                            <div
                              key={lvl.id}
                              onClick={() => setF("serviceLevelId", lvl.id)}
                              title={full ? (isAr ? "ممتلئ" : "At capacity") : undefined}
                              style={{
                                padding: "10px",
                                borderRadius: 10,
                                cursor: "pointer",
                                textAlign: "center",
                                border: `1px solid ${selected ? (lvl.color || "var(--accent)") : "var(--glass-border)"}`,
                                background: selected
                                  ? `${lvl.color || "#8d0134"}1f`
                                  : "var(--surface-soft-2)",
                                fontSize: 13,
                                fontWeight: selected ? 600 : 400,
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                                <span style={{
                                  width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                                  background: lvl.color || "var(--ink-mute)",
                                }} />
                                {(isAr ? lvl.nameAr : null) || lvl.name}
                              </div>
                              {lvl.capacity != null && (
                                <div style={{
                                  fontSize: 10, marginTop: 3, fontFamily: "var(--mono)",
                                  color: full ? "#e0c47e" : "var(--ink-faint)",
                                }}>
                                  {lvl.guestCount} / {lvl.capacity}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* What this level includes — read-only, inherited by the guest. */}
                      {selectedLevel && (selectedLevel.services || []).length > 0 && (
                        <div style={{
                          marginTop: 10, padding: "10px 12px", borderRadius: 10,
                          background: "var(--surface-soft-2)", border: "1px solid var(--glass-border)",
                        }}>
                          <div style={{
                            fontSize: 10, color: "var(--ink-mute)", textTransform: "uppercase",
                            letterSpacing: "0.08em", marginBottom: 6,
                          }}>
                            {isAr ? "يشمل" : "Includes"}
                          </div>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {selectedLevel.services.map((s) => (
                              <span key={s.serviceId} className="chip" style={{ fontSize: 10.5 }}>
                                <Icon name="check" size={10} style={{ color: "#5abf6e" }} />
                                {(isAr ? s.serviceNameAr : null) || s.serviceName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rule violations — blocking unless the user may override. */}
                      {ruleViolations.length > 0 && (
                        <div style={{
                          marginTop: 10, padding: "10px 12px", borderRadius: 10, fontSize: 12.5,
                          color: "#e0c47e", background: "rgba(224,196,126,0.12)",
                          border: "1px solid rgba(224,196,126,0.4)",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, marginBottom: 6 }}>
                            <Icon name="alert" size={13} />
                            {isAr ? "قواعد المستوى" : "Level rules"}
                          </div>
                          <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 3 }}>
                            {ruleViolations.map((v, i) => <li key={i}>{v}</li>)}
                          </ul>

                          {canOverrideRules ? (
                            <>
                              <label style={{
                                display: "flex", alignItems: "center", gap: 8, marginTop: 10,
                                cursor: "pointer", color: "var(--ink)",
                              }}>
                                <input
                                  type="checkbox"
                                  checked={form.overrideServiceLevelRules}
                                  onChange={(e) => setF("overrideServiceLevelRules", e.target.checked)}
                                  style={{ accentColor: "var(--accent)", cursor: "pointer" }}
                                />
                                {isAr ? "تجاوز القواعد وحفظ على أي حال" : "Override the rules and save anyway"}
                              </label>
                              {form.overrideServiceLevelRules && (
                                <input
                                  style={{ ...inputStyle, marginTop: 8 }}
                                  value={form.serviceLevelOverrideReason}
                                  placeholder={isAr ? "سبب التجاوز (اختياري، يُسجَّل)" : "Reason for the override (optional, recorded)"}
                                  onChange={(e) => setF("serviceLevelOverrideReason", e.target.value)}
                                />
                              )}
                            </>
                          ) : (
                            <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--ink-mute)" }}>
                              {isAr
                                ? "تحتاج صلاحية تجاوز القواعد لإضافة هذا الضيف لهذا المستوى."
                                : "You need override permission to place this guest on this level."}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10.5,
                      color: "var(--ink-mute)",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      marginBottom: 8,
                    }}
                  >
                    {isAr ? "الاعتماد" : "Accreditation"}
                  </label>
                  <div style={{ display: "flex", gap: 10 }}>
                    {[
                      { value: false, en: "Not Required", ar: "غير مطلوب" },
                      { value: true, en: "Required", ar: "مطلوب" },
                    ].map((opt) => (
                      <div
                        key={String(opt.value)}
                        onClick={() => setF("accreditationRequired", opt.value)}
                        style={{
                          flex: 1,
                          padding: "12px 14px",
                          borderRadius: 10,
                          cursor: "pointer",
                          textAlign: "center",
                          border: `1px solid ${form.accreditationRequired === opt.value ? "var(--accent)" : "var(--glass-border)"}`,
                          background:
                            form.accreditationRequired === opt.value
                              ? "rgba(26,174,196,0.12)"
                              : "var(--surface-soft-2)",
                          fontSize: 13,
                          fontWeight:
                            form.accreditationRequired === opt.value
                              ? 600
                              : 400,
                        }}
                      >
                        {isAr ? opt.ar : opt.en}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* STEP 3 — Travel & Stay */}
            {step === 3 && (
              <>
                <TravelAccordion
                  travel={travel}
                  onChange={setTravel}
                  lookups={travelLookups}
                  isAr={isAr}
                  dateMinDate={dateWindowMin}
                  dateMaxDate={dateWindowMax}
                  eventMinDate={eventStartDate}
                  eventMaxDate={eventEndDate}
                />
              </>
            )}

            {/* STEP 4 — Invitation */}
            {step === 4 && (
              <>
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 10,
                    }}
                  >
                    <label
                      style={{
                        fontSize: 10.5,
                        color: "var(--ink-mute)",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                      }}
                    >
                      {isAr
                        ? "قالب الدعوة (اختياري)"
                        : "Invitation Template (optional)"}
                    </label>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--ink-faint)",
                        fontStyle: "italic",
                      }}
                    >
                      {isAr
                        ? "أنشئ القوالب من وحدة الدعوة"
                        : "Manage templates in Invitation lifecycle"}
                    </span>
                  </div>
                  {!form.email && (
                    <div
                      style={{
                        marginBottom: 10,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "rgba(224,196,126,0.1)",
                        border: "1px solid rgba(224,196,126,0.3)",
                        fontSize: 12,
                        color: "#e0c47e",
                      }}
                    >
                      {isAr
                        ? "لا يوجد بريد إلكتروني — لن يتم إرسال الدعوة"
                        : "No email entered — invitation won't be sent"}
                    </div>
                  )}
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 7 }}
                  >
                    <div
                      onClick={() => setTemplateId(null)}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        border: `1px solid ${!templateId ? "var(--accent)" : "var(--glass-border)"}`,
                        background: !templateId
                          ? "rgba(26,174,196,0.1)"
                          : "var(--surface-soft-2)",
                      }}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 5,
                          border: `2px solid ${!templateId ? "var(--accent)" : "var(--glass-border)"}`,
                          background: !templateId
                            ? "var(--accent)"
                            : "transparent",
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        {!templateId && (
                          <Icon
                            name="check"
                            size={10}
                            style={{ color: "#fff" }}
                          />
                        )}
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: !templateId ? 600 : 400,
                          }}
                        >
                          {isAr ? "بدون دعوة" : "No invitation"}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--ink-mute)" }}>
                          {isAr
                            ? "إضافة الضيف فقط"
                            : "No email sent (automatically accepted)"}
                        </div>
                      </div>
                    </div>
                    {templates.map((tmpl) => (
                      <div
                        key={tmpl.id}
                        onClick={() => setTemplateId(tmpl.id)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          cursor: "pointer",
                          border: `1px solid ${templateId === tmpl.id ? tmpl.color || "var(--accent)" : "var(--glass-border)"}`,
                          background:
                            templateId === tmpl.id
                              ? (tmpl.color || "var(--accent)") + "18"
                              : "var(--surface-soft-2)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: tmpl.color || "var(--accent)",
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: templateId === tmpl.id ? 600 : 400,
                            }}
                          >
                            {isAr ? tmpl.nameAr || tmpl.name : tmpl.name}
                          </span>
                          <span
                            style={{
                              marginLeft: "auto",
                              fontSize: 10.5,
                              color: "var(--ink-mute)",
                              fontFamily: "var(--mono)",
                            }}
                          >
                            {tmpl.language}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--ink-mute)",
                            marginLeft: 18,
                            marginTop: 3,
                            fontStyle: "italic",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isAr ? tmpl.subjectAr || tmpl.subject : tmpl.subject}
                        </div>
                      </div>
                    ))}
                    {templates.length === 0 && (
                      <div
                        style={{
                          padding: "12px 14px",
                          borderRadius: 10,
                          background: "var(--surface-soft-2)",
                          border: "1px dashed var(--glass-border)",
                          fontSize: 12,
                          color: "var(--ink-mute)",
                          textAlign: "center",
                        }}
                      >
                        {isAr
                          ? 'لا توجد قوالب — أنشئها من وحدة "دورة حياة الدعوة"'
                          : "No templates — create them in the Invitation lifecycle module"}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "14px 24px",
              borderTop: "1px solid var(--glass-border)",
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <button
              className="btn"
              onClick={() => (step > 1 ? setStep(step - 1) : handleClose())}
            >
              {step > 1 ? (
                <>
                  <Icon name="arrowLeft" size={13} /> {isAr ? "السابق" : "Back"}
                </>
              ) : isAr ? (
                "إلغاء"
              ) : (
                "Cancel"
              )}
            </button>
            {step < 4 ? (
              <button className="btn primary" onClick={handleNext}>
                {isAr ? "التالي" : "Next"} <Icon name="arrow" size={13} />
              </button>
            ) : (
              <button
                className="btn primary"
                onClick={handleSave}
                disabled={saving}
              >
                <Icon name="check" size={13} />
                {saving
                  ? isAr
                    ? "جارٍ الحفظ…"
                    : "Saving…"
                  : isEdit
                    ? isAr
                      ? "حفظ التغييرات"
                      : "Save Changes"
                    : templateId
                      ? isAr
                        ? "إضافة وإرسال دعوة"
                        : "Add & Send Invite"
                      : isAr
                        ? "إضافة الضيف"
                        : "Add Guest"}
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
