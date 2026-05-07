/**
 * Centralized translations for all GMS views.
 * Each view reads strings via getTranslations(lang).
 *
 * Usage:
 *   const t = getTranslations(lang); // returns the strings object for that lang
 *   const isAr = lang === 'ar';
 *   t.guests.title  -> "Guest directory" or "دليل الضيوف"
 */

export const toArDigits = (n) =>
  String(n).replace(/[0-9]/g, d => "٠١٢٣٤٥٦٧٨٩"[+d]);

const STRINGS = {
  en: {
    common: {
      all: "All",
      of: "of",
      guests: "guests",
      forum: "Doha Forum 2025",
      importCsv: "Import CSV",
      export: "Export",
      addGuest: "Add guest",
      message: "Message",
      issueAccreditation: "Issue accreditation",
      selected: "selected",
      showing: "Showing",
      page: "Page",
      searchGuests: "Search name, organization, country…",
      live: "Live",
      save: "Save",
      cancel: "Cancel",
      edit: "Edit",
      delete: "Delete",
      more: "More",
    },
    guests: {
      title: ["Guest", "directory"],
      sub: (n, total) => `${n} of ${total} guests · Doha Forum 2025`,
      cols: { guest: "Guest", tier: "Tier", country: "Country", status: "Status", arrival: "Arrival", hotel: "Hotel", accreditation: "Accreditation" },
      tier: "Tier", status: "Status",
      issued: "Issued", pending: "Pending",
    },
    invitations: {
      title: ["Invitations &", "outreach"],
      sub: "Send · track · follow up across all guest tiers",
      templates: "Templates",
      newTemplate: "New template",
      languages: "Languages",
      sent: "Sent",
      opened: "Opened",
      accepted: "Accepted",
      recentQueue: "Recent send queue",
      sendNew: "Send new batch",
      cols: { batch: "Batch", template: "Template", recipients: "Recipients", sent_: "Sent", opens: "Opens", rsvp: "RSVP", status: "Status", actions: "" },
      rsvpFunnel: "RSVP funnel — last 14 days",
      statuses: { delivered: "Delivered", scheduled: "Scheduled", draft: "Draft", sending: "Sending" },
    },
    travel: {
      title: ["Travel &", "logistics"],
      sub: "Flights · hotels · ground transport across the delegation",
      kpi: { arrivals: "Arrivals today", arrivalsHelp: "Across DOH + private terminals", hotelOcc: "Hotel occupancy", hotelHelp: "of 1,512 confirmed rooms", carsDispatched: "Cars dispatched", carsHelp: "of 386 scheduled today", flagged: "Flagged itineraries", flaggedHelp: "missing visas + delays" },
      arrivalsToday: "Arrivals today · Hamad International",
      addArrival: "Add arrival",
      cols: { guest: "Guest", flight: "Flight", origin: "From", eta: "ETA", terminal: "Terminal", meet: "Meet & greet", car: "Car", status: "Status" },
      hotels: "Hotel allocation",
      rooms: "rooms",
      free: "free",
    },
    accreditation: {
      title: ["Accreditation &", "badges"],
      sub: "Issue · revoke · reprint across all delegations and venues",
      kpi: { issued: "Badges issued", issuedHelp: "of 2,147 expected", pendingPhoto: "Pending photo", pendingHelp: "guests need biometric capture", securityCleared: "Security cleared", securityHelp: "background checks complete", flagged: "Flagged for review", flaggedHelp: "items requiring action" },
      queue: "Issuance queue",
      runBatch: "Run batch print",
      zones: "Access zones",
      cols: { guest: "Guest", tier: "Tier", photo: "Photo", security: "Security", badge: "Badge", actions: "" },
    },
    seating: {
      title: ["Seating &", "protocol"],
      sub: "Plenary · banquets · bilateral rooms · order of precedence",
      events: "Events",
      plenary: "Plenary hall",
      banquet: "Gala dinner",
      bilateral: "Bilateral rooms",
    },
    meetings: {
      title: ["Meetings &", "bilaterals"],
      sub: "Bilateral schedules · room booking · follow-up notes",
      scheduled: "Scheduled meetings",
      rooms: "Available rooms",
      upcoming: "Upcoming today",
    },
    protocol: {
      title: ["Protocol &", "precedence"],
      sub: "Order of precedence · gifts · cultural notes",
      order: "Order of precedence",
      gifts: "Gifts ledger",
    },
    financials: {
      title: ["Financials &", "spend"],
      sub: "Budget tracking · vendor payments · forecast",
      budget: "Budget overview",
      spent: "Spent",
      remaining: "Remaining",
      vendors: "Vendor payments",
    },
    reports: {
      title: ["Reports &", "analytics"],
      sub: "Custom reports · exports · saved views",
      saved: "Saved reports",
      recentExports: "Recent exports",
    },
  },
  ar: {
    common: {
      all: "الكل",
      of: "من",
      guests: "ضيف",
      forum: "منتدى الدوحة ٢٠٢٥",
      importCsv: "استيراد CSV",
      export: "تصدير",
      addGuest: "إضافة ضيف",
      message: "رسالة",
      issueAccreditation: "إصدار اعتماد",
      selected: "محدد",
      showing: "عرض",
      page: "صفحة",
      searchGuests: "بحث بالاسم أو المؤسسة أو الدولة…",
      live: "مباشر",
      save: "حفظ",
      cancel: "إلغاء",
      edit: "تعديل",
      delete: "حذف",
      more: "المزيد",
    },
    guests: {
      title: ["دليل", "الضيوف"],
      sub: (n, total) => `${toArDigits(n)} من ${toArDigits(total)} ضيف · منتدى الدوحة ٢٠٢٥`,
      cols: { guest: "الضيف", tier: "الفئة", country: "الدولة", status: "الحالة", arrival: "الوصول", hotel: "الفندق", accreditation: "الاعتماد" },
      tier: "الفئة", status: "الحالة",
      issued: "مُصدر", pending: "في الانتظار",
    },
    invitations: {
      title: ["الدعوات", "والتواصل"],
      sub: "إرسال · متابعة · مراجعة عبر جميع فئات الضيوف",
      templates: "القوالب",
      newTemplate: "قالب جديد",
      languages: "اللغات",
      sent: "مُرسلة",
      opened: "مفتوحة",
      accepted: "مقبولة",
      recentQueue: "طابور الإرسال الأخير",
      sendNew: "إرسال دفعة جديدة",
      cols: { batch: "الدفعة", template: "القالب", recipients: "المستلمون", sent_: "أُرسلت", opens: "فتحات", rsvp: "الرد", status: "الحالة", actions: "" },
      rsvpFunnel: "قمع الرد — آخر ١٤ يومًا",
      statuses: { delivered: "مُسلمة", scheduled: "مجدولة", draft: "مسودة", sending: "قيد الإرسال" },
    },
    travel: {
      title: ["السفر", "واللوجستيات"],
      sub: "رحلات · فنادق · نقل بري لكامل الوفد",
      kpi: { arrivals: "وصول اليوم", arrivalsHelp: "عبر مطار حمد + محطات خاصة", hotelOcc: "إشغال الفنادق", hotelHelp: "من ١٬٥١٢ غرفة مؤكدة", carsDispatched: "السيارات المُرسلة", carsHelp: "من ٣٨٦ مجدولة اليوم", flagged: "مسارات مُعلّمة", flaggedHelp: "تأشيرات ناقصة + تأخيرات" },
      arrivalsToday: "وصول اليوم · مطار حمد الدولي",
      addArrival: "إضافة وصول",
      cols: { guest: "الضيف", flight: "الرحلة", origin: "من", eta: "الوصول المتوقع", terminal: "المحطة", meet: "استقبال", car: "سيارة", status: "الحالة" },
      hotels: "توزيع الفنادق",
      rooms: "غرفة",
      free: "متاحة",
    },
    accreditation: {
      title: ["الاعتماد", "والشارات"],
      sub: "إصدار · إلغاء · إعادة طباعة عبر جميع الوفود والقاعات",
      kpi: { issued: "الشارات المُصدرة", issuedHelp: "من ٢٬١٤٧ متوقعة", pendingPhoto: "بانتظار الصورة", pendingHelp: "ضيف يحتاج تسجيل حيوي", securityCleared: "موافقة أمنية", securityHelp: "اكتمال التدقيق الأمني", flagged: "للمراجعة", flaggedHelp: "بنود تحتاج إجراء" },
      queue: "طابور الإصدار",
      runBatch: "طباعة دفعة",
      zones: "مناطق الوصول",
      cols: { guest: "الضيف", tier: "الفئة", photo: "صورة", security: "أمن", badge: "الشارة", actions: "" },
    },
    seating: {
      title: ["الجلوس", "والبروتوكول"],
      sub: "الجلسات العامة · الولائم · القاعات الثنائية · ترتيب الأسبقية",
      events: "الفعاليات",
      plenary: "القاعة العامة",
      banquet: "العشاء الرسمي",
      bilateral: "غرف ثنائية",
    },
    meetings: {
      title: ["الاجتماعات", "الثنائية"],
      sub: "جداول ثنائية · حجز قاعات · ملاحظات المتابعة",
      scheduled: "اجتماعات مجدولة",
      rooms: "قاعات متاحة",
      upcoming: "قادمة اليوم",
    },
    protocol: {
      title: ["البروتوكول", "والأسبقية"],
      sub: "ترتيب الأسبقية · الهدايا · ملاحظات ثقافية",
      order: "ترتيب الأسبقية",
      gifts: "سجل الهدايا",
    },
    financials: {
      title: ["الماليات", "والمصروفات"],
      sub: "متابعة الميزانية · مدفوعات الموردين · التوقعات",
      budget: "نظرة عامة على الميزانية",
      spent: "المصروف",
      remaining: "المتبقي",
      vendors: "مدفوعات الموردين",
    },
    reports: {
      title: ["التقارير", "والتحليلات"],
      sub: "تقارير مخصصة · تصدير · مشاهدات محفوظة",
      saved: "تقارير محفوظة",
      recentExports: "آخر التصديرات",
    },
  },
};

export function getTranslations(lang) {
  return STRINGS[lang === "ar" ? "ar" : "en"];
}

export function fmtNum(n, lang) {
  const s = Number(n).toLocaleString("en-US");
  return lang === "ar" ? toArDigits(s) : s;
}
