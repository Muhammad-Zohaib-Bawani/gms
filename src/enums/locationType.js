// Location.type values the backend accepts (sent as the raw string).
export const LOCATION_TYPE = {
  AIRPORT: 'airport',
  HOTEL: 'hotel',
  VENUE: 'venue',
};

// Dropdown options, bilingual labels.
export const LOCATION_TYPE_OPTIONS = [
  { value: LOCATION_TYPE.AIRPORT, label: { en: 'Airport', ar: 'مطار' } },
  { value: LOCATION_TYPE.HOTEL,   label: { en: 'Hotel',   ar: 'فندق' } },
  { value: LOCATION_TYPE.VENUE,   label: { en: 'Venue',   ar: 'قاعة' } },
];

export const locationTypeOptions = (isAr) =>
  LOCATION_TYPE_OPTIONS.map((o) => ({ value: o.value, label: isAr ? o.label.ar : o.label.en }));
