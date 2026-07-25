// Admin-managed reference data. Each lookup is a dedicated table with a
// GET (list) + POST (create) endpoint. `columns` drives the table, `fields`
// drives the Add form. No edit/delete — the backend exposes create only.
import {
  getFlightTypes, createFlightType,
  getFlightClasses, createFlightClass,
  getRoomTypes, createRoomType,
  getHotels, createHotel,
  getLocations,
} from '../../api/services/travelService';
import {
  getVenueTypes, createVenueType,
  getElementTypes, createElementType,
} from '../../api/services/venueService';
import { createLocation } from '../../api/services/locationService';

const NAME = { key: 'name', label: { en: 'Name', ar: 'الاسم' } };
const NAME_AR = { key: 'nameAr', label: { en: 'Name (Arabic)', ar: 'الاسم بالعربية' } };
const ADDRESS = { key: 'address', label: { en: 'Address', ar: 'العنوان' } };
const CODE = { key: 'code', label: { en: 'Code', ar: 'الرمز' } };

export const LOOKUP_DEFS = [
  {
    key: 'flight-types', label: { en: 'Flight Types', ar: 'أنواع الرحلات' },
    list: getFlightTypes, create: (f) => createFlightType(f.name),
    columns: [NAME], fields: [{ ...NAME, required: true }],
  },
  {
    key: 'flight-classes', label: { en: 'Flight Classes', ar: 'درجات الرحلة' },
    list: getFlightClasses, create: (f) => createFlightClass(f.name),
    columns: [NAME], fields: [{ ...NAME, required: true }],
  },
  {
    key: 'room-types', label: { en: 'Room Types', ar: 'أنواع الغرف' },
    list: getRoomTypes, create: (f) => createRoomType(f.name),
    columns: [NAME], fields: [{ ...NAME, required: true }],
  },
  {
    key: 'hotels', label: { en: 'Hotels', ar: 'الفنادق' },
    list: getHotels, create: (f) => createHotel(f.name, f.address),
    columns: [NAME, ADDRESS], fields: [{ ...NAME, required: true }, ADDRESS],
  },
  {
    key: 'locations', label: { en: 'Locations', ar: 'المواقع' },
    list: getLocations,
    create: (f) => createLocation({ latitude: f.latitude, longitude: f.longitude, address: f.address }),
    columns: [ADDRESS],
    fields: [
      ADDRESS,
      { key: 'latitude', label: { en: 'Latitude', ar: 'خط العرض' }, required: true },
      { key: 'longitude', label: { en: 'Longitude', ar: 'خط الطول' }, required: true },
    ],
  },
  {
    key: 'venue-types', label: { en: 'Venue Types', ar: 'أنواع القاعات' },
    list: getVenueTypes, create: (f) => createVenueType(f.name, f.nameAr),
    columns: [NAME, NAME_AR], fields: [{ ...NAME, required: true }, NAME_AR],
  },
  {
    key: 'element-types', label: { en: 'Element Types', ar: 'أنواع العناصر' },
    list: getElementTypes, create: (f) => createElementType(f.code, f.name, f.nameAr),
    columns: [CODE, NAME], fields: [CODE, { ...NAME, required: true }, NAME_AR],
  },
];

export const getLookupDef = (key) => LOOKUP_DEFS.find(d => d.key === key);
