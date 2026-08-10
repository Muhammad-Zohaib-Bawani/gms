// Single guest create/edit wizard — driven by the `guest` prop (null = create
// a new guest for `activeEventId`; an object = edit that guest in place).
import React, { useState, useMemo, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useEvents } from "../../../events/EventsContext";
import { Icon } from "../../../components/Icons";
import Select from "../../../components/ui/Select";
import { nationalityOptionLabel } from "../../../components/FlagIcon";
import { useAuth } from "../../../auth/AuthContext";
import toast from "../../../lib/toast";
import {
  createGuest,
  updateGuest,
  getGuestEnums,
} from "../../../api/services/guestService";
import {
  getTravelLookups,
  getGuestTravel,
  saveGuestTravel,
} from "../../../api/services/travelService";
import {
  uploadImageFile,
  stripSasToken,
} from "../../../api/services/uploadService";
import { addDaysIso, fmtDate } from "../../../lib/date";
import {
  EMPTY_TRAVEL,
  hydrateTravel,
  anyTravelEnabled,
  buildTravelPayload,
} from "./TravelAccordion";
import ImportGuestsPanel from "./ImportGuestsPanel";
import ServiceAccordion, {
  TRAVEL_SECTION,
  validateServices,
  slotExtras,
} from "../ServiceAccordion";
import {
  getServices,
  saveGuestServiceEntry,
  getGuestServicePlan,
} from "../../../api/services/serviceCatalogService";
import ExistingGuestPicker from "./ExistingGuestPicker";

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
  width: 640,
  maxWidth: "94vw",
  height: 700,
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

// Colour per tier code. Only the colours live here — the codes and their
// bilingual labels come from GET /v1/lookups/enums/guest (GuestEnumCatalog on
// the server), so the vocabulary has one source of truth.
const TIER_COLORS = {
  vvip: "#e0b864",
  vip: "#a78bda",
  speaker: "var(--accent)",
  delegate: "#5abf6e",
  press: "var(--danger)",
  observer: "var(--ink-mute)",
};

function LegacyTierPicker({ value, onChange, isAr, options }) {
  const current = (value || "").toLowerCase();
  if (!options?.length) {
    return (
      <div style={{ fontSize: 12, color: "var(--ink-mute)" }}>
        {isAr ? "جارٍ التحميل…" : "Loading…"}
      </div>
    );
  }
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}
    >
      {options.map((opt) => {
        const t = {
          code: opt.code,
          label: (isAr ? opt.nameAr : null) || opt.name,
          color: TIER_COLORS[opt.code] || "var(--ink-mute)",
        };
        const selected = current === String(t.code).toLowerCase();
        return (
          <div
            key={t.code}
            onClick={() => onChange(t.code)}
            style={{
              padding: "10px",
              borderRadius: 10,
              cursor: "pointer",
              textAlign: "center",
              border: `1px solid ${selected ? t.color : "var(--glass-border)"}`,
              background: selected
                ? "var(--accent-soft)"
                : "var(--surface-soft-2)",
              fontSize: 13,
              fontWeight: selected ? 600 : 400,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: t.color,
                }}
              />
              {t.label}
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
  initialMode = "new",
  initialImportBatchId = null,
}) {
  const isAr = lang === "ar";
  const isEdit = !!guest;
  const { can } = useAuth();
  const { events, activeEvent } = useEvents();
  const canOverrideRules = can("ServiceLevels.OverrideRules");

  // Every event uses service levels in v2; the fixed/flexible model only
  // governs how the level's services must be completed, which is handled on the
  // guest's Services tab. See docs/service-levels-v2.md.

  // Tabs (Add Guest only — editing always goes straight into the "new"
  // wizard on the existing guest). "existing" is a self-contained
  // multi-select table (ExistingGuestPicker) that creates guests directly —
  // it never feeds into the wizard steps below.
  const [mode, setMode] = useState(initialMode);
  const [existingSaving, setExistingSaving] = useState(false);

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
  const [enums, setEnums] = useState({});
  const [rawTravel, setRawTravel] = useState(null);
  const [travel, setTravel] = useState(EMPTY_TRAVEL);
  const [travelLookups, setTravelLookups] = useState({});
  const [servicesCatalog, setServicesCatalog] = useState([]);

  const [pendingServices, setPendingServices] = useState({});

  const [editPlan, setEditPlan] = useState(null);

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
    setMode(initialMode);
    setPendingServices({});
    setEditPlan(null);
    if (guest?.id) {
      getGuestTravel(guest.id)
        .then(setRawTravel)
        .catch(() => setRawTravel(null));
      // Prefills step 3 with what the guest already has, so editing a service is
      // the same accordion as adding one rather than a nested dialog.
      getGuestServicePlan(guest.id)
        .then(setEditPlan)
        .catch(() => setEditPlan(null));
    }
  }, [open, guest?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Seed the accordion from the plan's existing entries — dynamic services only.
  // The built-ins live in `travel`, hydrated from getGuestTravel above.
  //
  // Only the FIRST entry per service is loaded: this accordion is one form per
  // service, so a guest holding two flights can't have both represented here. The
  // Services list on the guest's detail page manages the extras.
  useEffect(() => {
    if (!editPlan?.slots) return;
    const seeded = {};
    editPlan.slots.forEach((s) => {
      if (s.isSystem) return;
      const first = (s.entries || [])[0];
      if (!first) return;
      seeded[s.serviceId] = {
        selected: true,
        values: { ...(first.values || {}) },
        completed: first.status === "completed",
        entryId: first.id,
      };
    });
    if (Object.keys(seeded).length)
      setPendingServices((p) => ({ ...seeded, ...p }));
  }, [editPlan]);

  // "Existing Guest" tab bulk-add — each entry is a brand-new guest for this
  // event (Guest is per-event, no cross-event identity to link to). Personal
  // info comes from the source row; tier, sessionIds and accreditationRequired
  // are whatever was checked/edited per-row in the table. Travel is never
  // carried over — every bulk-added guest starts with no travel/services.
  async function handleExistingSubmit(entries, invitationTemplateId) {
    setExistingSaving(true);
    let success = 0,
      failed = 0;
    for (const e of entries) {
      try {
        await createGuest({
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email || null,
          guestType: e.guestType,
          organizationId: e.organizationId || null,
          nationalityId: e.nationalityId || null,
          serviceLevelId: e.serviceLevelId || null,
          photoUrl: e.photoUrl ? stripSasToken(e.photoUrl) : null,
          accreditationRequired: !!e.accreditationRequired,
          invitationTemplateId: invitationTemplateId || null,
          sessionIds: e.sessionIds,
          eventId: activeEventId,
        });
        success++;
      } catch {
        failed++;
      }
    }
    setExistingSaving(false);
    onSaved?.();
    if (failed === 0) {
      toast.success(
        isAr
          ? `تمت إضافة ${success} ضيف`
          : `Added ${success} guest${success === 1 ? "" : "s"}`,
      );
      handleClose();
    } else {
      toast.warning(
        isAr
          ? `تمت إضافة ${success} — فشل ${failed}`
          : `Added ${success} — ${failed} failed`,
      );
      if (success > 0) handleClose();
    }
  }

  useEffect(() => {
    setTravel(
      rawTravel ? hydrateTravel(rawTravel, travelLookups) : EMPTY_TRAVEL,
    );
  }, [rawTravel, travelLookups]);

  // Guarded on `open` — this component gets mounted once and toggled via the
  // `open` prop by some callers, so a bare `[]` dep would fire these (and the
  // 8 parallel requests inside getTravelLookups) on every mount regardless of
  // whether the dialog is actually visible yet.
  useEffect(() => {
    if (!open) return;
    getGuestEnums()
      .then(setEnums)
      .catch(() => setEnums({}));
    getServices(false)
      .then(setServicesCatalog)
      .catch(() => setServicesCatalog([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    getTravelLookups(activeEventId)
      .then(setTravelLookups)
      .catch(() => setTravelLookups({}));
  }, [open, activeEventId]);

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

  // Only the "new" tab uses the step wizard below — "import" and "existing"
  // are fully self-contained panels that create guests directly.
  const activeSteps = [1, 2, 3, 4];
  const stepPos = activeSteps.indexOf(step);
  const isLastStep = stepPos === activeSteps.length - 1;
  const showWizard = mode === "new";

  // Both the step-3 "Next" and the final Save run this — Save has to as well,
  // since the wizard can be finished from any step.
  function servicesError() {
    // Same rule in both flows now: a ticked service has to be complete, whether it
    // was ticked just now or was already there when the modal opened.
    return validateServices(wizardSlots, pendingServices, travel, isAr);
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
    // No service has to be TICKED to move on — anything left unticked is added
    // later from the guest's Services list. But a ticked one has to be complete:
    // ticking it is the request, so a half-filled form is an error rather than
    // something to silently drop.
    if (step === 3) {
      const err = servicesError();
      if (err) {
        toast.error(err);
        return;
      }
    }
    setStep(activeSteps[stepPos + 1]);
  }

  async function handleSave() {
    const travelErr = servicesError();
    if (travelErr) {
      toast.error(travelErr);
      return;
    }

    // Stop here rather than letting the backend 409 — same rules, friendlier
    // moment. The override path is only offered to those who hold the permission.
    if (
      ruleViolations.length > 0 &&
      !(canOverrideRules && form.overrideServiceLevelRules)
    ) {
      toast.error(
        canOverrideRules
          ? isAr
            ? "قواعد مستوى الخدمة غير مستوفاة — فعّل التجاوز للحفظ على أي حال."
            : "This service level's rules aren't met — tick the override to save anyway."
          : isAr
            ? "قواعد مستوى الخدمة غير مستوفاة، وتحتاج صلاحية للتجاوز."
            : "This service level's rules aren't met, and you don't have override permission.",
      );
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
        // Sent on both guest models — a level is what gives the guest a service
        // checklist at all; the model only decides whether those services are
        // mandatory and ordered (fixed) or optional (flexible).
        serviceLevelId: form.serviceLevelId || null,
        // Only sent when there's actually something to waive, so a stale tick
        // can't record a phantom override on a clean save.
        overrideServiceLevelRules:
          ruleViolations.length > 0 && form.overrideServiceLevelRules,
        serviceLevelOverrideReason:
          ruleViolations.length > 0 && form.overrideServiceLevelRules
            ? form.serviceLevelOverrideReason || null
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

      // Both flows now, because step 3 edits travel in THIS modal either way. Each
      // section carries the booking's own id when it was hydrated, so a save
      // updates that booking rather than adding a second one.
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

      // Services the wizard collected. Sequential on purpose: on a Fixed event
      // the server rejects a service whose predecessor is not yet complete, so
      // they have to go in order, and awaiting each keeps that true.
      if (guestId) {
        for (const slot of wizardSlots) {
          // The built-ins went to the travel endpoint above; the server refuses
          // them here on purpose (SERVICE_STATIC).
          if (slot.isSystem) continue;
          const filled = pendingServices[slot.serviceId];
          // A key existing is not the same as a value being there: opening a
          // service and touching a field (or a date picker normalising itself)
          // leaves blank keys behind. Only real input creates an entry — the
          // others stay pending, which is what having no row already means.
          const hasValue = Object.values(filled?.values || {}).some(
            (v) => String(v ?? "").trim() !== "",
          );
          if (!hasValue) continue;
          try {
            await saveGuestServiceEntry(guestId, {
              // Set when this service already had an entry, so editing updates
              // that row instead of leaving the guest with two of them.
              id: filled.entryId || null,
              serviceId: slot.serviceId,
              values: filled.values,
              // Ticked and past servicesError() means every required field is in,
              // so it's complete whether or not the user pressed Done. Saving it
              // as a draft instead would leave the NEXT service locked on a Fixed
              // event, and the loop below it would then be rejected.
              markCompleted: true,
            });
          } catch (err) {
            // Surfaced with the reason, not a generic line — the API explains
            // sequence and validation failures in a sentence worth reading.
            toast.error(
              isAr
                ? `تم حفظ الضيف لكن تعذّر حفظ خدمة "${slot.name}": ${err?.message || ""}`
                : `Guest saved, but "${slot.name}" could not be saved: ${err?.message || ""}`,
            );
          }
        }

        // Every earlier entry this session's "Add another" queued up, one save
        // call each — always a brand new row, never the ones saved above.
        for (const slot of wizardSlots) {
          const extras = slotExtras(slot, pendingServices);
          if (extras.length === 0) continue;
          try {
            if (slot.isSystem) {
              const key = TRAVEL_SECTION[slot.code];
              for (const snap of extras) {
                await saveGuestTravel(guestId, buildTravelPayload({ ...EMPTY_TRAVEL, [key]: snap }));
              }
            } else {
              for (const snap of extras) {
                await saveGuestServiceEntry(guestId, {
                  id: null, serviceId: slot.serviceId, values: snap.values || {}, markCompleted: true,
                });
              }
            }
          } catch (err) {
            toast.error(
              isAr
                ? `تم حفظ الضيف لكن تعذّر حفظ إدخال إضافي لخدمة "${slot.name}": ${err?.message || ""}`
                : `Guest saved, but an extra "${slot.name}" entry could not be saved: ${err?.message || ""}`,
            );
          }
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

  // Same source as the tier picker — GET /v1/lookups/enums/guest — rather than
  // a hardcoded list duplicating the server's vocabulary.
  const guestTypeOpts = useMemo(
    () =>
      (enums?.GuestType || []).map((gt) => ({
        value: gt.code,
        label: (isAr ? gt.nameAr : null) || gt.name,
      })),
    [enums, isAr],
  );

  const nationalityOpts = useMemo(
    () =>
      nationalities.map((n) => ({
        value: n.id,
        label: (isAr ? n.nameAr : n.name) || n.name,
        code: n.code,
      })),
    [nationalities, isAr],
  );

  const organizationOpts = useMemo(
    () =>
      (organizations || []).map((o) => ({
        value: o.id,
        label: isAr ? o.nameAr || o.name : o.name,
      })),
    [organizations, isAr],
  );

  const selectedLevel = useMemo(
    () =>
      (serviceLevels || []).find((l) => l.id === form.serviceLevelId) || null,
    [serviceLevels, form.serviceLevelId],
  );

  // Rules are evaluated client-side from data we already have (the level's
  // capacity/headcount + this form's own field values), so the warning appears
  // as you type instead of only on submit. The backend re-validates on save —
  // this is a convenience, never the enforcement point.
  const ruleViolations = useMemo(() => {
    if (!selectedLevel) return [];
    const out = [];

    // On edit, a guest already on this level doesn't count against its capacity.
    const alreadyHere = isEdit && guest?.serviceLevelId === selectedLevel.id;
    if (
      !alreadyHere &&
      selectedLevel.capacity != null &&
      selectedLevel.guestCount >= selectedLevel.capacity
    ) {
      out.push(
        isAr
          ? `"${selectedLevel.name}" ممتلئ (${selectedLevel.guestCount} / ${selectedLevel.capacity}).`
          : `"${selectedLevel.name}" is at capacity (${selectedLevel.guestCount} / ${selectedLevel.capacity}).`,
      );
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
      out.push(
        isAr
          ? `"${selectedLevel.name}" يتطلب: ${missing.join("، ")}.`
          : `"${selectedLevel.name}" requires: ${missing.join(", ")}.`,
      );
    }

    return out;
  }, [selectedLevel, form, isAr, isEdit, guest?.serviceLevelId]);

  // Step 2 is named after whichever classifier the event actually uses, so the
  // stepper doesn't promise a Service Level on a flexible event. Steps 2 and 3
  // are labelled for what they actually render ("Sessions, Tier & Accreditation"
  // and "Travel & Stay") rather than the older "Matches & Tier"/"Services".
  const allStepLabels = isAr
    ? ["المعلومات الشخصية", "مستوى الخدمة والجلسات", "الخدمات", "الدعوة"]
    : ["Personal Info", "Service Level & Sessions", "Services", "Invitation"];
  // Mapped through activeSteps (from main) because the wizard can now skip
  // steps — the label list is no longer a fixed 1:1 with what's rendered.
  const stepLabels = activeSteps.map((s) => allStepLabels[s - 1]);

  // The level's services, joined to their form schemas, in completion order.
  //
  // Editing prefers the guest's PLAN: same slots, but it also carries the entries
  // they already hold, so step 3 can open pre-filled instead of blank. It falls
  // back to the level while the plan is loading, or if the level was just changed
  // on step 2 (the plan still describes the old one).
  const wizardSlots = useMemo(() => {
    const byId = new Map((servicesCatalog || []).map((x) => [x.id, x]));
    const levelUnchanged =
      isEdit && guest?.serviceLevelId === form.serviceLevelId;

    if (levelUnchanged && editPlan?.slots?.length) {
      return editPlan.slots.map((s) => ({
        ...s,
        form: s.form?.sections?.length
          ? s.form
          : byId.get(s.serviceId)?.form || { sections: [] },
      }));
    }

    return (selectedLevel?.services || []).map((a) => ({
      ...a,
      form: byId.get(a.serviceId)?.form || { sections: [] },
      // Flight / Accommodation / Transport are built in: static fields, own
      // tables, saved by saveGuestTravel below rather than as a service entry.
      isSystem: byId.get(a.serviceId)?.isSystem ?? !!TRAVEL_SECTION[a.code],
    }));
  }, [
    selectedLevel,
    servicesCatalog,
    isEdit,
    editPlan,
    guest?.serviceLevelId,
    form.serviceLevelId,
  ]);

  // On a Fixed event the order is a rule, so the wizard mirrors the server's
  // gate locally — nothing is saved yet, but you still cannot fill service 2
  // before service 1.
  const isFixedEvent = activeEvent?.guestModel === "fixed";
  const firstIncomplete = wizardSlots.findIndex(
    (x) => !pendingServices[x.serviceId]?.completed,
  );

  const inputStyle = {
    width: "100%",
    background: "var(--surface-soft-3)",
    border: "1px solid var(--glass-border)",
    borderRadius: 8,
    padding: "7px 12px",
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
          style={
            mode === "existing"
              ? { ...contentStyle, width: 1040 }
              : contentStyle
          }
          onInteractOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
        >
          {/* Mode switcher. Was a row of browser-style folder tabs absolutely
              positioned at top:-38, i.e. floating outside the dialog over the
              backdrop — which read as detached, and got worse once the dialog
              became translucent. A segmented control inside the dialog keeps it
              attached to the thing it controls. Add Guest only; never on edit. */}
          {!isEdit && (
            <div className="seg-wrap">
              <div
                className="seg"
                role="tablist"
                aria-label={isAr ? "طريقة الإضافة" : "How to add"}
              >
                {[
                  {
                    key: "new",
                    label: isAr ? "ضيف جديد" : "New Guest",
                    icon: "plus",
                  },
                  {
                    key: "import",
                    label: isAr ? "استيراد ضيوف" : "Import Guest",
                    icon: "upload",
                  },
                  {
                    key: "existing",
                    label: isAr ? "ضيف حالي" : "Existing Guest",
                    icon: "guests",
                  },
                ].map((tab) => {
                  const active = mode === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      className={`seg-btn${active ? " active" : ""}`}
                      onClick={() => {
                        setMode(tab.key);
                        setStep(1);
                      }}
                    >
                      <Icon name={tab.icon} size={13} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Header */}
          <div
            style={{
              padding: "4px 24px 16px",
              // The divider belongs to whichever row is last before the body.
              // With the wizard showing that's the step row; without it (Import
              // / Existing Guest) the title is last and carries it here.
              borderBottom: showWizard
                ? "none"
                : "1px solid var(--glass-border)",
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

          {showWizard && (
            /* Every step carries its label all the time, and the connecting
               bars flex to fill the row — one continuous progress bar
               spanning the full modal width, not a cluster of dots. */
            <div className="wizard-steps" role="group" aria-label="Progress">
              {stepLabels.map((label, i) => {
                const s = activeSteps[i];
                const done = stepPos > i;
                const active = step === s;
                return (
                  <React.Fragment key={i}>
                    <div
                      className={`wizard-step${active ? " active" : ""}${done ? " done" : ""}`}
                      aria-current={active ? "step" : undefined}
                    >
                      <span className="wizard-dot">
                        {done ? <Icon name="check" size={11} /> : s}
                      </span>
                      <span className="wizard-label" title={label}>
                        {label}
                      </span>
                    </div>
                    {i < stepLabels.length - 1 && (
                      <span className={`wizard-bar${done ? " done" : ""}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}

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
            {mode === "import" && (
              <ImportGuestsPanel
                activeEventId={activeEventId}
                lang={lang}
                onImported={onSaved}
                initialBatchId={initialImportBatchId}
              />
            )}

            {mode === "existing" && (
              <ExistingGuestPicker
                activeEventId={activeEventId}
                lang={lang}
                sessions={sessions}
                enums={enums}
                templates={templates}
                saving={existingSaving}
                onSubmit={handleExistingSubmit}
              />
            )}

            {/* STEP 1 — Personal Info */}
            {showWizard && step === 1 && (
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
                        title="Guest Photo"
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
                        : ""}
                  </div>
                  {form.photoUrl && !photoUploading && (
                    <button
                      onClick={() => setF("photoUrl", "")}
                      title=""
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
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <FieldLabel>{isAr ? "نوع الضيف" : "Guest Type"}</FieldLabel>
                    <Select
                      value={form.guestType}
                      onChange={(v) => setF("guestType", v)}
                      options={guestTypeOpts}
                      placeMenu="top"
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
                      placeMenu="top"
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>{isAr ? "الجنسية" : "Nationality"}</FieldLabel>
                  <Select
                    value={form.nationalityId}
                    onChange={(v) => setF("nationalityId", v)}
                    options={nationalityOpts}
                    formatOptionLabel={nationalityOptionLabel}
                    placeholder={isAr ? "— اختر —" : "— Select —"}
                    isClearable
                    placeMenu="top"
                  />
                </div>
              </>
            )}

            {/* STEP 2 — Sessions, Tier & Accreditation */}
            {showWizard && step === 2 && (
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
                                {fmtDate(s.date)} · {s.time}
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
                    {isAr ? "مستوى الخدمة" : "Service Level"}
                  </SectionLabel>
                  {(serviceLevels || []).length === 0 ? (
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: 10,
                        fontSize: 12.5,
                        color: "#e0c47e",
                        background: "rgba(224,196,126,0.12)",
                        border: "1px solid rgba(224,196,126,0.4)",
                      }}
                    >
                      <Icon name="alert" size={13} />{" "}
                      {isAr
                        ? "لا توجد مستويات خدمة لهذه الفعالية — أضفها من صفحة مستويات الخدمة أولاً."
                        : "This event has no service levels yet — add some on the Service Levels page first."}
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr 1fr",
                          gap: 8,
                        }}
                      >
                        {serviceLevels.map((lvl) => {
                          const selected = form.serviceLevelId === lvl.id;
                          const full =
                            lvl.capacity != null &&
                            lvl.guestCount >= lvl.capacity;
                          return (
                            <div
                              key={lvl.id}
                              onClick={() => setF("serviceLevelId", lvl.id)}
                              title={
                                full
                                  ? isAr
                                    ? "ممتلئ"
                                    : "At capacity"
                                  : undefined
                              }
                              style={{
                                padding: "10px",
                                borderRadius: 10,
                                cursor: "pointer",
                                textAlign: "center",
                                border: `1px solid ${selected ? lvl.color || "var(--accent)" : "var(--glass-border)"}`,
                                background: selected
                                  ? `${lvl.color || "#8d0134"}1f`
                                  : "var(--surface-soft-2)",
                                fontSize: 13,
                                fontWeight: selected ? 600 : 400,
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 6,
                                }}
                              >
                                <span
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: "50%",
                                    flexShrink: 0,
                                    background: lvl.color || "var(--ink-mute)",
                                  }}
                                />
                                {(isAr ? lvl.nameAr : null) || lvl.name}
                              </div>
                              {lvl.capacity != null && (
                                <div
                                  style={{
                                    fontSize: 10,
                                    marginTop: 3,
                                    fontFamily: "var(--mono)",
                                    color: full
                                      ? "#e0c47e"
                                      : "var(--ink-faint)",
                                  }}
                                >
                                  {lvl.guestCount} / {lvl.capacity}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* What this level includes — read-only, inherited by the guest. */}
                      {selectedLevel &&
                        (selectedLevel.services || []).length > 0 && (
                          <div
                            style={{
                              marginTop: 10,
                              padding: "10px 12px",
                              borderRadius: 10,
                              background: "var(--surface-soft-2)",
                              border: "1px solid var(--glass-border)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 10,
                                color: "var(--ink-mute)",
                                textTransform: "uppercase",
                                letterSpacing: "0.08em",
                                marginBottom: 6,
                              }}
                            >
                              {isAr ? "يشمل" : "Includes"}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: 5,
                                flexWrap: "wrap",
                              }}
                            >
                              {selectedLevel.services.map((s, i) => (
                                <React.Fragment key={s.serviceId}>
                                  {i > 0 && (
                                    <Icon
                                      name="chevronRight"
                                      size={10}
                                      style={{ color: "var(--ink-faint)" }}
                                    />
                                  )}
                                  <span
                                    className="chip"
                                    style={{ fontSize: 10.5 }}
                                  >
                                    {(isAr ? s.nameAr : null) || s.name}
                                  </span>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Rule violations — blocking unless the user may override. */}
                      {ruleViolations.length > 0 && (
                        <div
                          style={{
                            marginTop: 10,
                            padding: "10px 12px",
                            borderRadius: 10,
                            fontSize: 12.5,
                            color: "#e0c47e",
                            background: "rgba(224,196,126,0.12)",
                            border: "1px solid rgba(224,196,126,0.4)",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              fontWeight: 600,
                              marginBottom: 6,
                            }}
                          >
                            <Icon name="alert" size={13} />
                            {isAr ? "قواعد المستوى" : "Level rules"}
                          </div>
                          <ul
                            style={{
                              margin: 0,
                              paddingInlineStart: 18,
                              display: "flex",
                              flexDirection: "column",
                              gap: 3,
                            }}
                          >
                            {ruleViolations.map((v, i) => (
                              <li key={i}>{v}</li>
                            ))}
                          </ul>

                          {canOverrideRules ? (
                            <>
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  marginTop: 10,
                                  cursor: "pointer",
                                  color: "var(--ink)",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={form.overrideServiceLevelRules}
                                  onChange={(e) =>
                                    setF(
                                      "overrideServiceLevelRules",
                                      e.target.checked,
                                    )
                                  }
                                  style={{
                                    accentColor: "var(--accent)",
                                    cursor: "pointer",
                                  }}
                                />
                                {isAr
                                  ? "تجاوز القواعد وحفظ على أي حال"
                                  : "Override the rules and save anyway"}
                              </label>
                              {form.overrideServiceLevelRules && (
                                <input
                                  style={{ ...inputStyle, marginTop: 8 }}
                                  value={form.serviceLevelOverrideReason}
                                  placeholder={
                                    isAr
                                      ? "سبب التجاوز (اختياري، يُسجَّل)"
                                      : "Reason for the override (optional, recorded)"
                                  }
                                  onChange={(e) =>
                                    setF(
                                      "serviceLevelOverrideReason",
                                      e.target.value,
                                    )
                                  }
                                />
                              )}
                            </>
                          ) : (
                            <div
                              style={{
                                marginTop: 8,
                                fontSize: 11.5,
                                color: "var(--ink-mute)",
                              }}
                            >
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

            {/* STEP 3 — Services from the guest's level */}
            {showWizard && step === 3 && (
              <>
                {!selectedLevel ? (
                  <div className="alert alert-info" style={{ fontSize: 12.5 }}>
                    <Icon name="alert" size={14} />
                    <div>
                      {isAr
                        ? "اختر مستوى خدمة في الخطوة السابقة لعرض الخدمات."
                        : "Pick a service level on the previous step to see its services."}
                    </div>
                  </div>
                ) : wizardSlots.length === 0 ? (
                  <div className="alert alert-warn" style={{ fontSize: 12.5 }}>
                    <Icon name="alert" size={14} />
                    <div>
                      {isAr
                        ? `لا توجد خدمات مُسنَدة إلى "${selectedLevel.name}" بعد.`
                        : `No services are assigned to "${selectedLevel.name}" yet. Add some on the Service Levels page.`}
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 11.5, color: "var(--ink-mute)" }}>
                      {isEdit
                        ? isAr
                          ? "الخدمات المُضافة سابقاً تُعرض هنا للمرجعية فقط ولا يمكن تعديلها — ضع علامة على خدمة جديدة لإضافتها."
                          : "Services already added are shown here for reference and can't be edited — tick another to add it."
                        : isFixedEvent
                          ? isAr
                            ? "ضع علامة على الخدمة لإضافتها الآن — بالترتيب. ما تتركه يمكن إضافته لاحقاً من زر الحجز الجديد."
                            : "Tick a service to add it now, in order. Anything you leave unticked can be added later from New Booking."
                          : isAr
                            ? "ضع علامة على ما تريد إضافته الآن — كل الخدمات اختيارية."
                            : "Tick whichever you want to add now — all of them are optional."}
                    </div>

                    <ServiceAccordion
                      slots={wizardSlots}
                      pending={pendingServices}
                      onPendingChange={setPendingServices}
                      travel={travel}
                      onTravelChange={setTravel}
                      travelLookups={travelLookups}
                      isFixed={isFixedEvent}
                      lang={lang}
                      eventId={activeEventId}
                      eventStart={eventStartDate}
                      eventEnd={eventEndDate}
                      dateMinDate={dateWindowMin}
                      dateMaxDate={dateWindowMax}
                    />
                  </>
                )}
              </>
            )}

            {/* STEP 4 — Invitation */}
            {showWizard && step === 4 && (
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
              onClick={() => {
                if (showWizard && stepPos > 0)
                  setStep(activeSteps[stepPos - 1]);
                else handleClose();
              }}
            >
              {showWizard && stepPos > 0 ? (
                <>
                  <Icon name="arrowLeft" size={13} /> {isAr ? "السابق" : "Back"}
                </>
              ) : isAr ? (
                "إلغاء"
              ) : (
                "Cancel"
              )}
            </button>
            {showWizard && !isLastStep && (
              <button className="btn primary" onClick={handleNext}>
                {isAr ? "التالي" : "Next"} <Icon name="arrow" size={13} />
              </button>
            )}
            {showWizard && isLastStep && (
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
