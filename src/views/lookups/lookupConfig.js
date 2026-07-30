// Admin-managed reference data. Each lookup is a dedicated table with a
// GET (list) + POST (create) endpoint. `columns` drives the table, `fields`
// drives the Add form. No edit/delete — the backend exposes create only.
import {
  getFlightClasses, createFlightClass,
  getRoomTypes, createRoomType,
  getVehicleTypes, createVehicleType,
  getHotels, createHotel,
  getAirports, createAirport,
  getLocations,
} from '../../api/services/travelService';
import { stripSasToken } from '../../api/services/uploadService';
import {
  getVenueTypes, createVenueType,
  getElementTypes, createElementType,
} from '../../api/services/venueService';

const NAME = { key: 'name', label: { en: 'Name', ar: 'الاسم' } };
const NAME_AR = { key: 'nameAr', label: { en: 'Name (Arabic)', ar: 'الاسم بالعربية' } };
const ADDRESS = { key: 'address', label: { en: 'Address', ar: 'العنوان' } };
const CODE = { key: 'code', label: { en: 'Code', ar: 'الرمز' } };
const CITY = { key: 'city', label: { en: 'City', ar: 'المدينة' } };
const COUNTRY = { key: 'country', label: { en: 'Country', ar: 'الدولة' } };
const CONTINENT = { key: 'continent', label: { en: 'Continent', ar: 'القارة' } };
const TYPE = { key: 'type', label: { en: 'Type', ar: 'النوع' } };
// Uploads to blob storage and stores the URL — see LookupsView's ImageField.
const IMAGE = { key: 'imageUrl', label: { en: 'Image', ar: 'الصورة' }, type: 'image' };

// Flight types are not here on purpose: they're the FlightType enum
// (inbound/outbound/return), not admin-managed rows.
export const LOOKUP_DEFS = [
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
    key: 'vehicle-types', label: { en: 'Vehicle Types', ar: 'أنواع المركبات' },
    list: getVehicleTypes, create: (f) => createVehicleType(f.name),
    columns: [NAME], fields: [{ ...NAME, required: true }],
  },
  {
    key: 'hotels', label: { en: 'Hotels', ar: 'الفنادق' },
    list: getHotels,
    create: (f) => createHotel({ name: f.name, address: f.address, imageUrl: stripSasToken(f.imageUrl) || null }),
    columns: [IMAGE, NAME, ADDRESS],
    fields: [{ ...NAME, required: true }, ADDRESS, IMAGE],
  },
  {
    key: 'airports', label: { en: 'Airports', ar: 'المطارات' },
    list: getAirports,
    create: (f) => createAirport({
      code: f.code, city: f.city, country: f.country, continent: f.continent,
      locationId: f.locationId || null,
    }),
    columns: [CODE, CITY, COUNTRY, CONTINENT],
    fields: [
      { ...CODE, required: true },
      { ...CITY, required: true },
      COUNTRY,
      CONTINENT,
      // Optional link to a Location row — dropdown fed by GET /lookups/locations.
      {
        key: 'locationId', label: { en: 'Location', ar: 'الموقع' },
        optionsFrom: getLocations, optionLabel: (x) => x.address,
      },
    ],
  },
  {
    key: 'locations', label: { en: 'Locations', ar: 'المواقع' },
    list: getLocations,
    // Add flow is the Leaflet picker (map click → lat/lng + reverse-geocoded
    // address), not a text form — so no `create`/`fields` here.
    customAdd: 'location-picker',
    columns: [ADDRESS, TYPE],
    fields: [],
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
