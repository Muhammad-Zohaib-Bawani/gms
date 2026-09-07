// Translations for the Events view (src/views/EventsView.jsx + src/views/events/*).
// Moved verbatim out of EventsView's `STR = isAr ? {...} : {...}` object —
// no string text was changed in this move.
export const eventsView = {
  en: {
    title: "Events", sub: "Manage events and their sessions",
    newEvent: "New Event", newSession: "New Session",
    sessions: "Sessions", noSessions: "No sessions yet",
    addSession: "Add session", editEvent: "Edit event",
    save: "Save", cancel: "Cancel", delete: "Delete",
    confirmDeleteEvent: "Delete event?", confirmDeleteMsg: "This action cannot be undone.",
    confirm: "Confirm delete",
    fTitle: "Event title", fType: "Type", fTheme: "Theme", fVenue: "Venue",
    fStart: "Start date", fEnd: "End date", fImage: "Cover image", fStatus: "Status",
    fGuestModel: "Guest model",
    gmFixed: "Fixed", gmFlexible: "Flexible",
    gmFixedHint: "Every guest sits on a service level that defines their services and rules (capacity, required fields).",
    gmFlexibleHint: "No service levels and no restrictions — the tier is a free form.",
    gmLockedHint: "You can change this later. Switching to Flexible stops enforcing the rules but never deletes existing level assignments.",
    sTitle: "Session title", sDate: "Date", sTime: "Time", sVenue: "Venue", sRoom: "Room / Hall", sSpeaker: "Speaker", sCapacity: "Capacity", sImage: "Session image",
    status: { active: "Active", planning: "Planning", completed: "Completed", cancelled: "Cancelled" },
    // How the event organises services: Fixed completes them in the level's
    // configured order, Flexible lets them be done in any order.
    guestModel: {
      fixed: "Fixed",
      flexible: "Flexible",
      fixedHint: "Services must be completed in order",
      flexibleHint: "Services can be completed in any order",
    },
    tabs: { all: "All", ongoing: "Ongoing", upcoming: "Upcoming", past: "Past" },
    searchPh: "Search events…",
  },
  ar: {
    title: "الفعاليات", sub: "إدارة الفعاليات والجلسات",
    newEvent: "فعالية جديدة", newSession: "جلسة جديدة",
    sessions: "الجلسات", noSessions: "لا توجد جلسات",
    addSession: "إضافة جلسة", editEvent: "تعديل الفعالية",
    save: "حفظ", cancel: "إلغاء", delete: "حذف",
    confirmDeleteEvent: "حذف الفعالية؟", confirmDeleteMsg: "لا يمكن التراجع عن هذا الإجراء.",
    confirm: "تأكيد الحذف",
    fTitle: "اسم الفعالية", fType: "النوع", fTheme: "الموضوع", fVenue: "المكان",
    fStart: "تاريخ البداية", fEnd: "تاريخ النهاية", fImage: "صورة الغلاف", fStatus: "الحالة",
    fGuestModel: "نموذج الضيوف",
    gmFixed: "ثابت", gmFlexible: "مرن",
    gmFixedHint: "يُصنَّف كل ضيف على مستوى خدمة يحدّد خدماته وقواعده (السعة والحقول المطلوبة).",
    gmFlexibleHint: "بدون مستويات خدمة أو قيود — التصنيف نص حر كما في السابق.",
    gmLockedHint: "يمكن تغيير النموذج لاحقاً. التبديل إلى «مرن» يوقف تطبيق القواعد لكنه لا يحذف تصنيفات الضيوف.",
    sTitle: "عنوان الجلسة", sDate: "التاريخ", sTime: "الوقت", sVenue: "المكان", sRoom: "القاعة", sSpeaker: "المتحدث", sCapacity: "السعة", sImage: "صورة الجلسة",
    status: { active: "نشط", planning: "تخطيط", completed: "مكتمل", cancelled: "ملغى" },
    guestModel: {
      fixed: "ثابت",
      flexible: "مرن",
      fixedHint: "يجب إكمال الخدمات بالترتيب",
      flexibleHint: "يمكن إكمال الخدمات بأي ترتيب",
    },
    tabs: { all: "الكل", ongoing: "جارٍ", upcoming: "قادم", past: "منتهٍ" },
    searchPh: "بحث في الفعاليات…",
  },
};
