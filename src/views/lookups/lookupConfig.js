// Per-category UI config for the generic lookup screens.
// `code`      — whether the item Code column/input is shown and how it's labelled.
// `metaFields`— category-specific fields stored in the item's JSON metadata.
// Category codes match the backend seeded LookupCategory.Code values.

export const LOOKUP_CONFIG = {
  AIRLINE: {
    icon: 'travel',
    code: { show: true, label: 'IATA Code', labelAr: 'رمز الأياتا', placeholder: 'QR' },
    metaFields: [
      { key: 'country', label: 'Country', labelAr: 'الدولة' },
    ],
  },
  AIRPORT: {
    icon: 'travel',
    code: { show: true, label: 'IATA Code', labelAr: 'رمز الأياتا', placeholder: 'DOH' },
    metaFields: [
      { key: 'city',    label: 'City',    labelAr: 'المدينة' },
      { key: 'country', label: 'Country', labelAr: 'الدولة' },
      { key: 'icao',    label: 'ICAO',    labelAr: 'إيكاو' },
    ],
  },
  VEHICLE_TYPE: {
    icon: 'travel',
    code: { show: true, label: 'Code', labelAr: 'الرمز', placeholder: 'SEDAN' },
    metaFields: [
      { key: 'capacity', label: 'Capacity (seats)', labelAr: 'السعة (مقاعد)' },
    ],
  },
  HOTEL: {
    icon: 'venue',
    code: { show: true, label: 'Code', labelAr: 'الرمز', placeholder: 'SHER' },
    metaFields: [
      { key: 'city',    label: 'City',    labelAr: 'المدينة' },
      { key: 'address', label: 'Address', labelAr: 'العنوان' },
    ],
  },
  VENUE_TYPE: {
    icon: 'venue',
    code: { show: true, label: 'Code', labelAr: 'الرمز', placeholder: 'BALLROOM' },
    metaFields: [],
  },
};

// Fallback for any category without an explicit config.
export const DEFAULT_LOOKUP_CONFIG = {
  icon: 'reports',
  code: { show: true, label: 'Code', labelAr: 'الرمز', placeholder: '' },
  metaFields: [],
};

export const getLookupConfig = (categoryCode) =>
  LOOKUP_CONFIG[categoryCode] || DEFAULT_LOOKUP_CONFIG;

// The category list that drives the ADMIN submenu, in display order.
export const LOOKUP_CATEGORIES = [
  { code: 'AIRLINE',      label: { en: 'Airlines',      ar: 'شركات الطيران' } },
  { code: 'AIRPORT',      label: { en: 'Airports',      ar: 'المطارات' } },
  { code: 'VEHICLE_TYPE', label: { en: 'Vehicle Types', ar: 'أنواع المركبات' } },
  { code: 'HOTEL',        label: { en: 'Hotels',        ar: 'الفنادق' } },
  { code: 'VENUE_TYPE',   label: { en: 'Venue Types',   ar: 'أنواع القاعات' } },
];
