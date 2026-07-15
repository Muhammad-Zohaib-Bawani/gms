import React, { useState, useMemo, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Icon } from "../../../components/Icons";
import Select from "../../../components/ui/Select";
import DateField from "../../../components/ui/DateField";
import toast from "../../../lib/toast";
import { createGuest, getGuestEnums } from "../../../api/services/guestService";

const GUEST_TYPES = [
  "dignitary",
  "delegate",
  "media",
  "staff",
  "vip",
  "observer",
];

const EMPTY_GUEST = {
  firstName: "",
  lastName: "",
  email: "",
  guestType: "delegate",
  organization: "",
  nationalityId: "",
  tier: "Delegate",
  invitationStatus: "not_sent",
  arrivalDate: "",
  flightNumber: "",
  hotel: "",
  accreditationStatus: "not_issued",
};
const invitationStatusColors = {
  not_sent: '#9CA3AF',
  sent: '#3B82F6',
  opened: '#F59E0B',
  accepted: '#10B981',
  declined: '#EF4444',
};
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
  background: "var(--glass-bg, rgba(10,28,36,0.92))",
  backdropFilter: "blur(20px)",
  border: "1px solid var(--glass-border)",
  borderRadius: 16,
  boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
  outline: "none",
};

export default function AddGuestModal({
  open,
  onClose,
  activeEventId,
  nationalities,
  templates,
  sessions,
  lang,
  onSaved,
}) {
  const isAr = lang === "ar";

  const [step, setStep] = useState(1);
  const [guest, setGuest] = useState(EMPTY_GUEST);
  const [step1Errors, setStep1Errors] = useState({});
  const [templateId, setTemplateId] = useState(null);
  const [guestSessions, setGuestSessions] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [enums, setEnums] = useState({});

  const setG = (k, v) => setGuest((p) => ({ ...p, [k]: v }));

  function handleClose() {
    setStep(1);
    setGuest(EMPTY_GUEST);
    setStep1Errors({});
    setTemplateId(null);
    setGuestSessions(new Set());
    onClose();
  }

  function handleNext() {
    if (step === 1) {
      const errs = {};
      if (!guest.firstName.trim()) errs.firstName = true;
      if (!guest.lastName.trim()) errs.lastName = true;
      if (Object.keys(errs).length) {
        setStep1Errors(errs);
        return;
      }
    }
    setStep(step + 1);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await createGuest({
        firstName: guest.firstName.trim(),
        lastName: guest.lastName.trim(),
        email: guest.email || null,
        eventId: activeEventId,
        guestType: guest.guestType,
        organization: guest.organization || null,
        nationalityId: guest.nationalityId || null,
        tier: guest.tier,
        invitationStatus: guest.invitationStatus,
        arrivalDate: guest.arrivalDate || null,
        flightNumber: guest.flightNumber || null,
        hotel: guest.hotel || null,
        accreditationStatus: guest.accreditationStatus,
        invitationTemplateId: templateId || null,
        sessionIds: Array.from(guestSessions),
      });
      onSaved?.();
      handleClose();
      toast.success(
        templateId
          ? isAr
            ? "تمت إضافة الضيف وإرسال الدعوة"
            : "Guest added & invitation sent"
          : isAr
            ? "تمت إضافة الضيف بنجاح"
            : "Guest added successfully",
      );
    } catch {
      toast.error(isAr ? "حدث خطأ أثناء إضافة الضيف" : "Error adding guest");
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

  const stepLabels = isAr
    ? ["المعلومات الشخصية", "الفئة والحالة", "السفر والإقامة", "الدعوة"]
    : ["Personal Info", "Tier & Status", "Travel & Stay", "Invitation"];

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
  useEffect(() => {
    getGuestEnums().then(setEnums);
  }, [guest?.id]);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content
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
                {isAr ? "ضيف جديد" : "Add New Guest"}
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
                        value={guest[f.key]}
                        onChange={(e) => {
                          setG(f.key, e.target.value);
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
                    {isAr ? "البريد الإلكتروني" : "Email"}
                  </FieldLabel>
                  <input
                    type="email"
                    placeholder="name@organization.com"
                    value={guest.email}
                    onChange={(e) => setG("email", e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel>{isAr ? "نوع الضيف" : "Guest Type"}</FieldLabel>
                  <Select
                    value={guest.guestType}
                    onChange={(v) => setG("guestType", v)}
                    options={guestTypeOpts}
                  />
                </div>
                <div>
                  <FieldLabel>{isAr ? "المؤسسة" : "Organization"}</FieldLabel>
                  <input
                    placeholder={
                      isAr
                        ? "مثال: وزارة الخارجية"
                        : "e.g. Ministry of Foreign Affairs"
                    }
                    value={guest.organization}
                    onChange={(e) => setG("organization", e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <FieldLabel>{isAr ? "الجنسية" : "Nationality"}</FieldLabel>
                  <Select
                    value={guest.nationalityId}
                    onChange={(v) => setG("nationalityId", v)}
                    options={nationalityOpts}
                    placeholder={isAr ? "— اختر —" : "— Select —"}
                    isClearable
                  />
                </div>
              </>
            )}

            {/* STEP 2 — Tier & Status */}
            {step === 2 && (
              <>
                <div>
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
                    {isAr ? "الفئة" : "Tier"}
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: 8,
                    }}
                  >
                    {enums?.GuestTier?.map((tier) => (
                      <div
                        key={tier.code}
                        onClick={() => setG("tier", tier.code)}
                        style={{
                          padding: "12px 10px",
                          borderRadius: 10,
                          cursor: "pointer",
                          textAlign: "center",
                          border: `1px solid ${guest.tier === tier.code ? "var(--accent)" : "var(--glass-border)"}`,
                          background:
                            guest.tier === tier.code
                              ? "rgba(26,174,196,0.12)"
                              : "var(--surface-soft-2)",
                          fontSize: 13,
                          fontWeight: guest.tier === tier.code ? 600 : 400,
                        }}
                      >
                        {tier.name}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
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
                    {isAr ? "حالة الدعوة" : "Invitation Status"}
                  </label>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {enums?.GuestInvitationStatus?.map((status) => (
                      <div
                        key={status.code}
                        onClick={() => setG("invitationStatus", status.code)}
                        style={{
                          padding: "11px 14px",
                          borderRadius: 10,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          border: `1px solid ${
                            guest.invitationStatus === status.code
                              ? "var(--accent)"
                              : "var(--glass-border)"
                          }`,
                          background:
                            guest.invitationStatus === status.code
                              ? "rgba(26,174,196,0.12)"
                              : "var(--surface-soft-2)",
                        }}
                      >
                        <span
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            background: invitationStatusColors[status.code],
                            flexShrink: 0,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            textTransform: "capitalize",
                            fontWeight:
                              guest.invitationStatus === status.code
                                ? 600
                                : 400,
                          }}
                        >
                          {isAr ? status.nameAr : status.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* STEP 3 — Travel & Stay */}
            {step === 3 && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <FieldLabel>
                      {isAr ? "تاريخ الوصول" : "Arrival Date"}
                    </FieldLabel>
                    <DateField
                      value={guest.arrivalDate}
                      onChange={(v) => setG("arrivalDate", v)}
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                  <div>
                    <FieldLabel>
                      {isAr ? "رقم الرحلة" : "Flight No."}
                    </FieldLabel>
                    <input
                      placeholder="QR 512"
                      value={guest.flightNumber}
                      onChange={(e) => setG("flightNumber", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel>{isAr ? "الفندق" : "Hotel"}</FieldLabel>
                  <input
                    placeholder={
                      isAr ? "مثال: شيراتون الدوحة" : "e.g. Sheraton Grand Doha"
                    }
                    value={guest.hotel}
                    onChange={(e) => setG("hotel", e.target.value)}
                    style={inputStyle}
                  />
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
                    {enums?.GuestAccreditationStatus?.map((s) => (
                      <div
                        key={s.code}
                        onClick={() => setG("accreditationStatus", s.code)}
                        style={{
                          flex: 1,
                          padding: "12px 14px",
                          borderRadius: 10,
                          cursor: "pointer",
                          textAlign: "center",
                          border: `1px solid ${guest.accreditationStatus === s.code ? "var(--accent)" : "var(--glass-border)"}`,
                          background:
                            guest.accreditationStatus === s.code
                              ? "rgba(26,174,196,0.12)"
                              : "var(--surface-soft-2)",
                          fontSize: 13,
                          textTransform: "capitalize",
                          fontWeight:
                            guest.accreditationStatus === s.code ? 600 : 400,
                        }}
                      >
                        {isAr ? s.nameAr : s.name}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* STEP 4 — Invitation & Sessions */}
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
                  {!guest.email && (
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
                            : "Add guest only, no email sent"}
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
