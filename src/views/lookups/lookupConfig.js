// Admin-managed reference data. Each lookup is a dedicated table with at least
// a GET (list) + POST (create) endpoint. `columns` drives the table, `fields`
// drives the Add form. A lookup gets an Edit row action only once it declares
// `update` (i.e. the backend has a PUT), and Delete only with `remove` — most
// of the name-only lookups are still create-only server-side.
import {
  getFlightClasses, createFlightClass,
  getRoomTypes, createRoomType,
  getVehicleTypes, createVehicleType,
  getHotels, createHotel, updateHotel,
  getAirports, getAirportsPaged, createAirport, updateAirport,
  getLocations,
} from '../../api/services/travelService';
import { stripSasToken } from '../../api/services/uploadService';
import {
  getVenueTypes, createVenueType,
  getElementTypes, createElementType, updateElementType, deleteElementType,
} from '../../api/services/venueService';
import { ELEMENT_TYPE_CODE_OPTIONS } from '../../enums/elementTypeCode';
import { getEventTypes, createEventType } from '../../api/services/eventService';
import { getNationalities } from '../../api/services/nationalityService';
import { LOCATION_TYPE } from '../../enums/locationType';

const NAME = { key: 'name', label: { en: 'Name', ar: 'الاسم' } };
const NAME_AR = { key: 'nameAr', label: { en: 'Name (Arabic)', ar: 'الاسم بالعربية' } };
const ADDRESS = { key: 'address', label: { en: 'Address', ar: 'العنوان' } };
const CODE = { key: 'code', label: { en: 'Code', ar: 'الرمز' } };
const CITY = { key: 'city', label: { en: 'City / Airport Name', ar: 'المدينة/المطار' } };
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
    // Editable, unlike the name-only lookups: the VIP app reads a hotel's address
    // and image, so a typo (or a row from before the address was required) has to
    // be fixable in place. Defining `update` is what puts Edit on the row.
    update: (id, f) => updateHotel(id, { name: f.name, address: f.address, imageUrl: stripSasToken(f.imageUrl) || null }),
    columns: [IMAGE, NAME, ADDRESS],
    // Address is required: the VIP app shows it on the guest's accommodation
    // screen and home check-in card, where a hotel name alone is no use.
    fields: [{ ...NAME, required: true }, { ...ADDRESS, required: true }, IMAGE],
  },
  {
    key: 'airports', label: { en: 'Airports', ar: 'المطارات' },
    list: getAirports,
    // Server-side paged + searched — the airport list runs to 1000+ rows, so it
    // pages/filters on the server rather than loading everything into the table.
    paged: true,
    listPaged: getAirportsPaged,
    create: (f) => createAirport({
      code: f.code, city: f.city, country: f.country, continent: f.continent,
      locationId: f.locationId || null,
    }),
    update: (id, f) => updateAirport(id, {
      code: f.code, city: f.city, country: f.country, continent: f.continent,
      locationId: f.locationId || null,
    }),
    columns: [CODE, CITY, COUNTRY, CONTINENT],
    fields: [
      { ...CODE, required: true },
      { ...CITY, required: true },
      // Country is a plain string column on AirportData (not an FK), so the
      // dropdown's stored value is the nationality's name, not its id —
      // `optionValue` overrides the default optionsFrom behaviour of storing
      // `x.id`. Country and Nationality share one list on purpose: a country
      // name typed free-hand here would drift from the spelling used
      // everywhere else in the app (guest nationality, flags, filters).
      { ...COUNTRY, optionsFrom: getNationalities, optionLabel: (n) => n.name, optionValue: (n) => n.name },
      CONTINENT,
      // Optional link to a Location row — dropdown fed by GET /lookups/locations,
      // plus an "Other" option that opens the map picker (LocationPickerModal)
      // right here instead of requiring a trip to the Locations lookup first.
      // Picking a point there creates a real Location row with Type = "airport"
      // (LOCATION_TYPE.AIRPORT) and this field adopts its id, same as picking
      // an existing one from the list.
      {
        key: 'locationId', label: { en: 'Pickup Location', ar: 'موقع الاستلام' },
        optionsFrom: getLocations, optionLabel: (x) => x.address,
        locationPicker: { defaultType: LOCATION_TYPE.AIRPORT },
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
    key: 'event-types', label: { en: 'Event Types', ar: 'أنواع الفعاليات' },
    list: getEventTypes, create: (f) => createEventType(f.name),
    columns: [NAME], fields: [{ ...NAME, required: true }],
  },
  {
    key: 'venue-types', label: { en: 'Venue Types', ar: 'أنواع القاعات' },
    list: getVenueTypes, create: (f) => createVenueType(f.name, f.nameAr),
    columns: [NAME, NAME_AR], fields: [{ ...NAME, required: true }, NAME_AR],
  },
  {
    key: 'element-types', label: { en: 'Element Types', ar: 'أنواع العناصر' },
    list: getElementTypes,
    create: (f) => createElementType(f.code, f.name, f.nameAr),
    update: (id, f) => updateElementType(id, f.code, f.name, f.nameAr),
    // Safe to remove: nothing FKs to ElementType — a saved layout stores the
    // shape as a plain string — so deleting a row only drops it from the venue
    // editor's palette, leaving canvases already drawn with that code intact.
    remove: (id) => deleteElementType(id),
    columns: [CODE, NAME],
    fields: [
      // Not a free-text field: `code` selects which SVG the venue canvas draws,
      // and an unrecognised value silently renders as a pitch. "Other" is kept
      // as an escape hatch for a code added to the renderer after this list.
      {
        ...CODE, label: { en: 'Shape', ar: 'الشكل' }, required: true,
        options: ELEMENT_TYPE_CODE_OPTIONS, allowOther: true,
        otherLabel: { en: 'Other — type a code…', ar: 'أخرى — أدخل رمزًا…' },
      },
      { ...NAME, required: true },
      NAME_AR,
    ],
  },
];

export const getLookupDef = (key) => LOOKUP_DEFS.find(d => d.key === key);
