// Single guest create/edit wizard — driven by the `guest` prop (null = create
// a new participation for `activeEventId`; an object = edit that participation
// in place).
//
// Everything here is EVENT-scoped: `guest.id` is an eventGuestId
// (EventGuest.PublicId), and it's what the update / travel / service-plan calls
// take. The master person is only reached indirectly, through `email`: creating
// with an email that already belongs to a guest reuses that person and adds a
// second participation, which is how "add an existing guest to this event"
// works — both from the Existing Guest tab and from the duplicate-email prompt
// on step 1.
//
// This is the orchestrator: dialog chrome, all shared state/handlers, and
// composition of the per-mode/per-step bodies in ./guestModal/*. Extracted out
// of a single ~2000-line file — see guestModal/guestModal.helpers.jsx and
// src/i18n/modules/guestModal.js for the small pieces and bilingual strings
// that used to live inline here.
import { useState, useMemo, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useEvents } from "../../../events/EventsContext";
import { useAccess } from '../../../auth/AccessContext';
import toast from "../../../lib/toast";
import { isConfirmed } from "../../../lib/serviceStatus";
import {
  createGuest,
  updateGuest,
  getGuestEnums,
  getGuestsFromOtherEvents,
} from "../../../api/services/guestService";
import {
  getTravelLookups,
  getGuestTravel,
  saveGuestTravel,
} from "../../../api/services/travelService";
import { uploadImageFile, stripSasToken } from "../../../api/services/uploadService";
import { addDaysIso } from "../../../lib/date";
import {
  EMPTY_TRAVEL,
  hydrateTravel,
  anyTravelEnabled,
  buildTravelPayload,
} from "./TravelAccordion";
import ImportGuestsPanel from "./ImportGuestsPanel";
import {
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
import { getTranslations } from "../../../i18n/translations";
import { guestModal } from "../../../i18n/modules/guestModal";
import { guestToForm } from "./guestModal/guestModal.helpers";
import GuestModalHeader from "./guestModal/GuestModalHeader";
import GuestModalProgress from "./guestModal/GuestModalProgress";
import GuestModalStep1PersonalInfo from "./guestModal/GuestModalStep1PersonalInfo";
import GuestModalStep2ServiceLevel from "./guestModal/GuestModalStep2ServiceLevel";
import GuestModalStep3Services from "./guestModal/GuestModalStep3Services";
import GuestModalStep4Invitation from "./guestModal/GuestModalStep4Invitation";
import GuestModalFooter from "./guestModal/GuestModalFooter";
import "./guestModal/guest-modal.css";

// One week of slack around the event's own start/end date — a guest may fly
// in up to 7 days before the event starts or leave up to 7 days after it ends.
const DATE_MARGIN_DAYS = 7;

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
  const t = guestModal[isAr ? "ar" : "en"];
  const commonCancel = getTranslations(lang).common.cancel;
  const { canWrite } = useAccess();
  const { events, activeEvent } = useEvents();
  const canOverrideRules = canWrite('service-levels');

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
  // Backend-reported email problem (GUEST_ALREADY_ON_EVENT / GUEST_EMAIL_CONFLICT),
  // shown under the email field rather than only as a toast so it's clear which
  // field is at fault.
  const [emailConflict, setEmailConflict] = useState(null);
  // A participation in ANOTHER event with this exact email — the same person, so
  // saving reuses them instead of creating a duplicate. Informational: the
  // create call already does the right thing, this just says so up front and
  // offers to carry their details over.
  const [existingPerson, setExistingPerson] = useState(null);
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
    setEmailConflict(null);
    setExistingPerson(null);
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

  // Create only: does this email already belong to a guest on some OTHER event?
  // If so the backend will reuse that master Guest rather than making a second
  // person, so the wizard says so before the admin fills in details that would
  // be silently ignored (name/photo stay on the person, not the participation).
  // `other-events` already excludes anyone on THIS event, so a hit here always
  // means "another event" — same-event duplicates surface as the 409 below.
  useEffect(() => {
    if (!open || isEdit || !activeEventId) { setExistingPerson(null); return undefined; }
    const email = form.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setExistingPerson(null); return undefined; }
    let cancelled = false;
    const t = setTimeout(() => {
      getGuestsFromOtherEvents({ currentEventId: activeEventId, search: email, pageSize: 5 })
        .then((r) => {
          if (cancelled) return;
          const hit = (r?.items || []).find(
            (row) => (row.email || "").trim().toLowerCase() === email,
          );
          setExistingPerson(hit || null);
        })
        .catch(() => { if (!cancelled) setExistingPerson(null); });
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, isEdit, activeEventId, form.email]);

  // Copies the person's stored details across so the new participation shows the
  // same human rather than a half-filled duplicate. Only the person-level fields
  // — service level, sessions, accreditation and invitation stay this event's own
  // decision.
  function applyExistingPerson() {
    if (!existingPerson) return;
    setForm((f) => ({
      ...f,
      firstName: existingPerson.firstName || f.firstName,
      lastName: existingPerson.lastName || f.lastName,
      guestType: existingPerson.guestType || f.guestType,
      organizationId: existingPerson.organizationId || f.organizationId,
      nationalityId: existingPerson.nationalityId || f.nationalityId,
      photoUrl: existingPerson.photoUrl || f.photoUrl,
    }));
    setStep1Errors({});
  }

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
        completed: isConfirmed(first.status),
        entryId: first.id,
      };
    });
    if (Object.keys(seeded).length)
      setPendingServices((p) => ({ ...seeded, ...p }));
  }, [editPlan]);

  // "Existing Guest" tab bulk-add — each entry adds a NEW PARTICIPATION for an
  // existing person. Sending their email is what links it: the backend finds
  // that master Guest, reuses their identity and login, and only inserts the
  // EventGuest row, so nobody is duplicated. Personal info comes from the source
  // row; service level, sessionIds and accreditationRequired are whatever was
  // checked/edited per-row in the table, since those belong to THIS event.
  // Travel is never carried over — every added participation starts empty.
  async function handleExistingSubmit(entries, invitationTemplateId) {
    setExistingSaving(true);
    let success = 0,
      failed = 0;
    // Backend reasons (e.g. "This guest is already on this event.") — worth
    // showing, since with a batch the count alone says nothing about which row.
    const reasons = [];
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
      } catch (err) {
        failed++;
        const who = `${e.firstName || ""} ${e.lastName || ""}`.trim() || e.email;
        if (err?.message) reasons.push(`${who}: ${err.message}`);
      }
    }
    setExistingSaving(false);
    onSaved?.();
    if (failed === 0) {
      toast.success(t.existing.added(success));
      handleClose();
    } else {
      toast.warning(t.existing.addedFailed(success, failed), {
        description: reasons.length ? reasons.slice(0, 5).join("\n") : undefined,
      });
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
  // 9 parallel requests inside getTravelLookups) on every mount regardless of
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
      toast.fromError(err, t.save.photoUploadError);
    } finally {
      setPhotoUploading(false);
    }
  }

  function handleClose() {
    setStep(1);
    setStep1Errors({});
    setEmailConflict(null);
    setExistingPerson(null);
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
          ? t.save.rulesNotMetOverridable
          : t.save.rulesNotMetNoPermission,
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

      // The participation everything below is saved against — GuestResponse.id,
      // i.e. an EventGuest.PublicId. On create this is a brand-new participation
      // even when the person already existed (same email, another event).
      let eventGuestId = guest?.id;
      if (isEdit) {
        await updateGuest(guest.id, payload);
      } else {
        const created = await createGuest({
          ...payload,
          eventId: activeEventId,
        });
        eventGuestId = created?.id;
      }

      // Both flows now, because step 3 edits travel in THIS modal either way. Each
      // section carries the booking's own id when it was hydrated, so a save
      // updates that booking rather than adding a second one.
      if (eventGuestId && anyTravelEnabled(travel)) {
        try {
          await saveGuestTravel(
            eventGuestId,
            buildTravelPayload(travel, travelLookups),
          );
        } catch {
          toast.error(
            isEdit ? t.save.travelSaveFailEdit : t.save.travelSaveFailCreate,
          );
        }
      }

      // Services the wizard collected. Sequential on purpose: on a Fixed event
      // the server rejects a service whose predecessor is not yet complete, so
      // they have to go in order, and awaiting each keeps that true.
      if (eventGuestId) {
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
            await saveGuestServiceEntry(eventGuestId, {
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
            toast.error(t.save.serviceSaveFail(slot.name, err?.message || ""));
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
                await saveGuestTravel(eventGuestId, buildTravelPayload({ ...EMPTY_TRAVEL, [key]: snap }));
              }
            } else {
              for (const snap of extras) {
                await saveGuestServiceEntry(eventGuestId, {
                  id: null, serviceId: slot.serviceId, values: snap.values || {}, markCompleted: true,
                });
              }
            }
          } catch (err) {
            toast.error(
              t.save.extraServiceSaveFail(slot.name, err?.message || ""),
            );
          }
        }
      }

      onSaved?.();
      handleClose();
      toast.success(
        isEdit
          ? t.save.guestUpdated
          : templateId
            ? t.save.guestAddedInvite
            : t.save.guestAdded,
      );
    } catch (err) {
      // Same email, same event -> the person is already a participant here.
      // Same email, non-guest portal account -> the address is taken. Both are
      // about the email field, so they're pinned to it and the wizard steps back
      // to where it can be fixed instead of only flashing a toast.
      if (err?.errorCode === "GUEST_ALREADY_ON_EVENT" || err?.errorCode === "GUEST_EMAIL_CONFLICT") {
        setEmailConflict(err.message);
        setStep1Errors((p) => ({ ...p, email: false }));
        setStep(1);
      }
      toast.fromError(
        err,
        isEdit ? t.save.errorUpdating : t.save.errorAdding,
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
        t.step2.levelAtCapacity(
          selectedLevel.name,
          selectedLevel.guestCount,
          selectedLevel.capacity,
        ),
      );
    }

    const FIELD_LABELS = {
      email: t.fields.email,
      nationalityId: t.fields.nationality,
      organizationId: t.fields.organization,
      photoUrl: t.fields.photo,
      arrivalDate: t.fields.arrivalDate,
      departureDate: t.fields.departureDate,
    };
    const missing = (selectedLevel.requiredGuestFields || [])
      .filter((key) => !String(form[key] ?? "").trim())
      .map((key) => FIELD_LABELS[key] || key);

    if (missing.length > 0) {
      out.push(t.step2.levelRequires(selectedLevel.name, missing));
    }

    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevel, form, isAr, isEdit, guest?.serviceLevelId]);

  // Step 2 is named after whichever classifier the event actually uses, so the
  // stepper doesn't promise a Service Level on a flexible event. Steps 2 and 3
  // are labelled for what they actually render ("Sessions, Tier & Accreditation"
  // and "Travel & Stay") rather than the older "Matches & Tier"/"Services".
  const allStepLabels = t.stepLabels;
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

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="guest-modal-overlay" />
        <Dialog.Content
          // `guest-modal-content` is the hook the ≤768px rule uses to turn this
          // fixed 640×700 box into a full-height sheet (styles/sc-revamp.css).
          className="modal-solid guest-modal-content guest-modal-dialog"
          style={mode === "existing" ? { width: 1040 } : undefined}
          onInteractOutside={(e) => e.preventDefault()}
          onFocusOutside={(e) => e.preventDefault()}
        >
          {/* No mode switcher here any more. The three ways to add a guest are
              picked from the "Add Guest" dropdown on the Guests page, so by the
              time this dialog opens the choice is already made — a tab strip
              restating it just crowded the top of all three. `mode` still drives
              which body renders; it now comes in via initialMode and doesn't
              change while the dialog is open. */}

          <GuestModalHeader
            isEdit={isEdit}
            mode={mode}
            guest={guest}
            showWizard={showWizard}
            t={t}
          />

          {showWizard && (
            <GuestModalProgress
              stepLabels={stepLabels}
              activeSteps={activeSteps}
              step={step}
              stepPos={stepPos}
            />
          )}

          {/* Body */}
          <div className="guest-modal-body">
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

            {showWizard && step === 1 && (
              <GuestModalStep1PersonalInfo
                form={form}
                setF={setF}
                step1Errors={step1Errors}
                setStep1Errors={setStep1Errors}
                emailConflict={emailConflict}
                setEmailConflict={setEmailConflict}
                existingPerson={existingPerson}
                applyExistingPerson={applyExistingPerson}
                photoUploading={photoUploading}
                handlePhotoSelect={handlePhotoSelect}
                guestTypeOpts={guestTypeOpts}
                organizationOpts={organizationOpts}
                nationalityOpts={nationalityOpts}
                t={t}
              />
            )}

            {showWizard && step === 2 && (
              <GuestModalStep2ServiceLevel
                sessions={sessions}
                guestSessions={guestSessions}
                setGuestSessions={setGuestSessions}
                serviceLevels={serviceLevels}
                form={form}
                setF={setF}
                selectedLevel={selectedLevel}
                ruleViolations={ruleViolations}
                canOverrideRules={canOverrideRules}
                isAr={isAr}
                t={t}
              />
            )}

            {showWizard && step === 3 && (
              <GuestModalStep3Services
                selectedLevel={selectedLevel}
                wizardSlots={wizardSlots}
                pendingServices={pendingServices}
                setPendingServices={setPendingServices}
                travel={travel}
                setTravel={setTravel}
                travelLookups={travelLookups}
                isFixedEvent={isFixedEvent}
                isEdit={isEdit}
                lang={lang}
                activeEventId={activeEventId}
                eventStartDate={eventStartDate}
                eventEndDate={eventEndDate}
                dateWindowMin={dateWindowMin}
                dateWindowMax={dateWindowMax}
                t={t}
              />
            )}

            {showWizard && step === 4 && (
              <GuestModalStep4Invitation
                form={form}
                templateId={templateId}
                setTemplateId={setTemplateId}
                templates={templates}
                isAr={isAr}
                t={t}
              />
            )}
          </div>

          <GuestModalFooter
            showWizard={showWizard}
            stepPos={stepPos}
            isLastStep={isLastStep}
            isEdit={isEdit}
            templateId={templateId}
            saving={saving}
            onBack={() => {
              if (showWizard && stepPos > 0) setStep(activeSteps[stepPos - 1]);
              else handleClose();
            }}
            onNext={handleNext}
            onSave={handleSave}
            t={t}
            commonCancel={commonCancel}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
