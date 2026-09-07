// Translations for the Guests list view (src/views/GuestsView.jsx and
// src/views/guests/list/*). Moved verbatim out of GuestsView.jsx's scattered
// `isAr ? "..." : "..."` ternaries — no string text was changed in this move.
//
// A few keys intentionally share identical text with a sibling key (e.g. the
// "Not Required"/"غير مطلوب" accreditation label appears both as a filter
// option and as a table cell) — that duplication already existed in the
// source as separately-written literals, so it's preserved as separate keys
// here rather than silently merged.
export const guestsView = {
  en: {
    hayyaCompliant: "",
    noEventWarning: "Select an active event to view and manage guests.",
    exportBtn: "Export",
    addGuestBtn: "Add Guest",
    newGuestLabel: "New Guest",
    newGuestHint: "Enter one guest step by step",
    existingGuestLabel: "Existing Guest",
    existingGuestHint: "Copy guests from another event",
    importCsvLabel: "Import from CSV",
    importCsvHint: "Add many guests from a file",
    deleteCount: (n) => `Delete (${n})`,

    searchPlaceholder: "Search guests…",
    filterBtn: "Filter",
    filterPanelTitle: "Filter Guests",
    clearAll: "Clear all",
    serviceLevelLabel: "Service Level",
    allServiceLevels: "All Service Levels",
    invitationStatusLabel: "Invitation Status",
    anyStatus: "Any status",
    organizationLabel: "Organization",
    allOrganizations: "All Organizations",
    nationalityLabel: "Nationality",
    allNationalities: "All Nationalities",
    accreditationFilterLabel: "Accreditation",
    allAccreditation: "All Accreditation",
    accredNotRequiredFilter: "Not Required",
    accredPendingFilter: "Pending",
    accredIssuedFilter: "Issued",

    statusNotSent: "Not Sent",
    statusSent: "Sent",
    statusOpened: "Opened",
    statusAccepted: "Accepted",
    statusDeclined: "Declined",

    listViewTitle: "List view",
    overviewTitle: "Overview",

    colGuest: "Guest",
    colServiceLevel: "Service Level",
    colNationality: "Nationality",
    colInviteStatus: "Invite Status",
    colAccreditation: "Accreditation",
    accredCellNotRequired: "Not Required",
    accredCellIssued: "Issued",
    accredCellPending: "Pending",

    actionView: "View",
    actionMessage: "Message",
    actionSendInvite: "Send Invite",
    actionEdit: "Edit",
    actionDelete: "Delete",

    noGuestsYet: "No guests yet",
    selectEventFirst: "Select an event first",

    loadingText: "Loading…",
    selectGuestToView: "Select a guest to view their details",
    pageOf: (i, total) => `Page ${i} of ${total}`,

    exportFallbackError: "Could not load all guests — exporting the current page only",
    accreditationIssuedToast: "Accreditation issued",
  },
  ar: {
    hayyaCompliant: "متوافق مع نظام هيّا",
    noEventWarning: "يرجى اختيار فعالية أولاً لعرض الضيوف.",
    exportBtn: "تصدير",
    addGuestBtn: "ضيف جديد",
    newGuestLabel: "ضيف جديد",
    newGuestHint: "إدخال ضيف واحد خطوة بخطوة",
    existingGuestLabel: "ضيف حالي",
    existingGuestHint: "انسخ ضيوفاً من فعالية أخرى",
    importCsvLabel: "استيراد من CSV",
    importCsvHint: "أضف عدة ضيوف من ملف",
    deleteCount: (n) => `حذف (${n})`,

    searchPlaceholder: "بحث عن ضيف…",
    filterBtn: "تصفية",
    filterPanelTitle: "تصفية الضيوف",
    clearAll: "مسح الكل",
    serviceLevelLabel: "مستوى الخدمة",
    allServiceLevels: "كل المستويات",
    invitationStatusLabel: "حالة الدعوة",
    anyStatus: "أي حالة",
    organizationLabel: "المؤسسة",
    allOrganizations: "كل المؤسسات",
    nationalityLabel: "الجنسية",
    allNationalities: "كل الجنسيات",
    accreditationFilterLabel: "حالة الاعتماد",
    allAccreditation: "كل حالات الاعتماد",
    accredNotRequiredFilter: "غير مطلوب",
    accredPendingFilter: "قيد الانتظار",
    accredIssuedFilter: "صادر",

    statusNotSent: "لم يُرسل",
    statusSent: "مُرسل",
    statusOpened: "مفتوح",
    statusAccepted: "مقبول",
    statusDeclined: "مرفوض",

    listViewTitle: "عرض القائمة",
    overviewTitle: "عرض التفاصيل",

    colGuest: "الضيف",
    colServiceLevel: "مستوى الخدمة",
    colNationality: "الجنسية",
    colInviteStatus: "حالة الدعوة",
    colAccreditation: "الاعتماد",
    accredCellNotRequired: "غير مطلوب",
    accredCellIssued: "صادر",
    accredCellPending: "معلق",

    actionView: "عرض",
    actionMessage: "رسالة",
    actionSendInvite: "إرسال الدعوة",
    actionEdit: "تعديل",
    actionDelete: "حذف",

    noGuestsYet: "لا يوجد ضيوف بعد",
    selectEventFirst: "اختر فعالية أولاً",

    loadingText: "جارٍ التحميل…",
    selectGuestToView: "اختر ضيفاً لعرض تفاصيله",
    pageOf: (i, total) => `صفحة ${i} من ${total}`,

    exportFallbackError: "تعذّر تحميل كل الضيوف — سيتم تصدير الصفحة الحالية فقط",
    accreditationIssuedToast: "تم إصدار الاعتماد",
  },
};
