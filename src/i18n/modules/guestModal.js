// Translations for the Add/Edit Guest modal (src/views/guests/modals/GuestModal.jsx
// and src/views/guests/modals/guestModal/*). Moved verbatim out of GuestModal's
// inline `isAr ? "…" : "…"` ternaries — no wording was changed in this move.
export const guestModal = {
  en: {
    header: {
      editGuest: "Edit Guest",
      addExisting: "Add Existing Guest",
      importCsv: "Import Guests from CSV",
      addNew: "Add New Guest",
    },
    fields: {
      firstName: "First Name",
      firstNamePh: "e.g. Khalid",
      lastName: "Last Name",
      lastNamePh: "e.g. Al-Mansouri",
      email: "Email",
      guestType: "Guest Type",
      organization: "Organization",
      nationality: "Nationality",
      photo: "Photo",
      arrivalDate: "Arrival date",
      departureDate: "Departure date",
      required: "Required",
      selectPlaceholder: "— Select —",
    },
    step1: {
      photoUploading: "Uploading…",
      photoOptional: "",
      removePhoto: "Remove photo",
      useExistingDetails: "Use existing guest's details",
      existingPersonMsg: (firstName, lastName, eventTitle) =>
        `${`${firstName || ""} ${lastName || ""}`.trim()} is already a guest on "${eventTitle}". Saving adds that same person to this event — no duplicate is created.`,
    },
    step2: {
      sessionsOptional: "Sessions (optional)",
      selectAll: "Select all",
      deselectAll: "Deselect all",
      noSessions: "No sessions for this event yet",
      serviceLevel: "Service Level",
      noLevels:
        "This event has no service levels yet — add some on the Service Levels page first.",
      atCapacityTitle: "At capacity",
      includes: "Includes",
      levelRules: "Level rules",
      overrideCheckbox: "Override the rules and save anyway",
      overrideReasonPh: "Reason for the override (optional, recorded)",
      needOverridePermission:
        "You need override permission to place this guest on this level.",
      accreditation: "Accreditation",
      accredNotRequired: "Not Required",
      accredRequired: "Required",
      levelAtCapacity: (name, count, cap) =>
        `"${name}" is at capacity (${count} / ${cap}).`,
      levelRequires: (name, missing) =>
        `"${name}" requires: ${missing.join(", ")}.`,
    },
    step3: {
      pickLevelFirst:
        "Pick a service level on the previous step to see its services.",
      noServicesAssigned: (name) =>
        `No services are assigned to "${name}" yet. Add some on the Service Levels page.`,
      fixedHint:
        "Tick a service to add it now, in order. Anything you leave unticked can be added later from New Booking.",
      flexHint: "Tick whichever you want to add now — all of them are optional.",
    },
    step4: {
      templateOptional: "Invitation Template (optional)",
      manageTemplatesHint: "Manage templates in Invitation lifecycle",
      noEmailWarning: "No email entered — invitation won't be sent",
      noInvitation: "No invitation",
      noInvitationDesc: "No email sent (automatically accepted)",
      noTemplates:
        "No templates — create them in the Invitation lifecycle module",
    },
    footer: {
      back: "Back",
      next: "Next",
      saving: "Saving…",
      saveChanges: "Save Changes",
      addSendInvite: "Add & Send Invite",
      addGuest: "Add Guest",
    },
    save: {
      rulesNotMetOverridable:
        "This service level's rules aren't met — tick the override to save anyway.",
      rulesNotMetNoPermission:
        "This service level's rules aren't met, and you don't have override permission.",
      travelSaveFailEdit: "Guest updated, but travel details failed to save",
      travelSaveFailCreate: "Guest saved, but travel details failed to save",
      serviceSaveFail: (name, msg) =>
        `Guest saved, but "${name}" could not be saved: ${msg}`,
      extraServiceSaveFail: (name, msg) =>
        `Guest saved, but an extra "${name}" entry could not be saved: ${msg}`,
      guestUpdated: "Guest updated successfully",
      guestAddedInvite: "Guest added & invitation sent",
      guestAdded: "Guest added successfully",
      errorUpdating: "Error updating guest",
      errorAdding: "Error adding guest",
      photoUploadError: "Failed to upload photo",
    },
    existing: {
      added: (n) => `Added ${n} guest${n === 1 ? "" : "s"}`,
      addedFailed: (success, failed) => `Added ${success} — ${failed} failed`,
    },
    stepLabels: [
      "Personal Info",
      "Service Level & Sessions",
      "Services",
      "Invitation",
    ],
  },
  ar: {
    header: {
      editGuest: "تعديل الضيف",
      addExisting: "إضافة ضيف حالي",
      importCsv: "استيراد ضيوف من CSV",
      addNew: "ضيف جديد",
    },
    fields: {
      firstName: "الاسم الأول",
      firstNamePh: "مثال: خالد",
      lastName: "الاسم الأخير",
      lastNamePh: "مثال: المنصوري",
      email: "البريد الإلكتروني",
      guestType: "نوع الضيف",
      organization: "المؤسسة",
      nationality: "الجنسية",
      photo: "الصورة",
      arrivalDate: "تاريخ الوصول",
      departureDate: "تاريخ المغادرة",
      required: "مطلوب",
      selectPlaceholder: "— اختر —",
    },
    step1: {
      photoUploading: "جارٍ التحميل…",
      photoOptional: "صورة الوجه (اختياري)",
      removePhoto: "إزالة الصورة",
      useExistingDetails: "استخدام بيانات الضيف الحالي",
      existingPersonMsg: (firstName, lastName, eventTitle) =>
        `${firstName || ""} ${lastName || ""} مسجّل بالفعل في "${eventTitle}". سيتم إضافة نفس الشخص إلى هذه الفعالية دون إنشاء ضيف مكرر.`,
    },
    step2: {
      sessionsOptional: "الجلسات (اختياري)",
      selectAll: "تحديد الكل",
      deselectAll: "إلغاء الكل",
      noSessions: "لا توجد جلسات لهذه الفعالية",
      serviceLevel: "مستوى الخدمة",
      noLevels:
        "لا توجد مستويات خدمة لهذه الفعالية — أضفها من صفحة مستويات الخدمة أولاً.",
      atCapacityTitle: "ممتلئ",
      includes: "يشمل",
      levelRules: "قواعد المستوى",
      overrideCheckbox: "تجاوز القواعد وحفظ على أي حال",
      overrideReasonPh: "سبب التجاوز (اختياري، يُسجَّل)",
      needOverridePermission:
        "تحتاج صلاحية تجاوز القواعد لإضافة هذا الضيف لهذا المستوى.",
      accreditation: "الاعتماد",
      accredNotRequired: "غير مطلوب",
      accredRequired: "مطلوب",
      levelAtCapacity: (name, count, cap) =>
        `"${name}" ممتلئ (${count} / ${cap}).`,
      levelRequires: (name, missing) =>
        `"${name}" يتطلب: ${missing.join("، ")}.`,
    },
    step3: {
      pickLevelFirst: "اختر مستوى خدمة في الخطوة السابقة لعرض الخدمات.",
      noServicesAssigned: (name) =>
        `لا توجد خدمات مُسنَدة إلى "${name}" بعد.`,
      fixedHint:
        "ضع علامة على الخدمة لإضافتها الآن — بالترتيب. ما تتركه يمكن إضافته لاحقاً من زر الحجز الجديد.",
      flexHint: "ضع علامة على ما تريد إضافته الآن — كل الخدمات اختيارية.",
    },
    step4: {
      templateOptional: "قالب الدعوة (اختياري)",
      manageTemplatesHint: "أنشئ القوالب من وحدة الدعوة",
      noEmailWarning: "لا يوجد بريد إلكتروني — لن يتم إرسال الدعوة",
      noInvitation: "بدون دعوة",
      noInvitationDesc: "إضافة الضيف فقط",
      noTemplates: 'لا توجد قوالب — أنشئها من وحدة "دورة حياة الدعوة"',
    },
    footer: {
      back: "السابق",
      next: "التالي",
      saving: "جارٍ الحفظ…",
      saveChanges: "حفظ التغييرات",
      addSendInvite: "إضافة وإرسال دعوة",
      addGuest: "إضافة الضيف",
    },
    save: {
      rulesNotMetOverridable:
        "قواعد مستوى الخدمة غير مستوفاة — فعّل التجاوز للحفظ على أي حال.",
      rulesNotMetNoPermission:
        "قواعد مستوى الخدمة غير مستوفاة، وتحتاج صلاحية للتجاوز.",
      travelSaveFailEdit: "تم تحديث الضيف لكن تعذّر حفظ بيانات السفر",
      travelSaveFailCreate: "تم حفظ الضيف لكن تعذّر حفظ بيانات السفر",
      serviceSaveFail: (name, msg) =>
        `تم حفظ الضيف لكن تعذّر حفظ خدمة "${name}": ${msg}`,
      extraServiceSaveFail: (name, msg) =>
        `تم حفظ الضيف لكن تعذّر حفظ إدخال إضافي لخدمة "${name}": ${msg}`,
      guestUpdated: "تم تحديث بيانات الضيف",
      guestAddedInvite: "تمت إضافة الضيف وإرسال الدعوة",
      guestAdded: "تمت إضافة الضيف بنجاح",
      errorUpdating: "حدث خطأ أثناء تحديث الضيف",
      errorAdding: "حدث خطأ أثناء إضافة الضيف",
      photoUploadError: "فشل تحميل الصورة",
    },
    existing: {
      added: (n) => `تمت إضافة ${n} ضيف`,
      addedFailed: (success, failed) => `تمت إضافة ${success} — فشل ${failed}`,
    },
    stepLabels: ["المعلومات الشخصية", "مستوى الخدمة والجلسات", "الخدمات", "الدعوة"],
  },
};
