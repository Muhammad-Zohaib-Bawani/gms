// Shared shell copy — used by App.jsx's own AppHeader/ProfileMenu and by
// EventSwitcher. Split out so those files don't need to import from App.jsx
// (which would be circular, since App.jsx imports them).
export const SHELL_I18N = {
  en: {
    gms: "GMS",
    guestMgmt: "Guest Management",
    switchEvent: "Switch event",
    inSession: "In session",
    eventName: "23rd Doha Forum",
    eventMeta: "7–9 December · Sheraton Grand",
    daysOut: "D-2",
    searchPlaceholder: "Search guests, sessions, bookings…",
    userName: "Amira Hassan",
    userRole: "Protocol Lead · MOFA",
    switchTo: (m) => `Switch to ${m} mode`,
  },
  ar: {
    gms: "GMS",
    guestMgmt: "إدارة الضيوف",
    switchEvent: "تبديل الحدث",
    inSession: "قيد الانعقاد",
    eventName: "منتدى الدوحة الـ ٢٣",
    eventMeta: "٧–٩ ديسمبر · شيراتون الكبرى",
    daysOut: "−٢ يوم",
    searchPlaceholder: "بحث في الضيوف والجلسات والحجوزات…",
    userName: "أميرة حسن",
    userRole: "رئيسة البروتوكول · وزارة الخارجية",
    switchTo: (m) => `التبديل إلى الوضع ${m === "dark" ? "الداكن" : "الفاتح"}`,
  },
};
