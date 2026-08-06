// Mock data for the Guest Overview UI review. No API is wired yet — this exists
// so the client can see the layout, the filters and the multi-value cases
// (a guest across several events, with several services and sessions) before
// any backend work is committed to.
//
// Shapes mirror what the real endpoint would return, so swapping this for a
// fetch should not move the table code.

export const EVENTS = [
  { id: 'ev-1', name: 'U17 World Volleyball Championship', code: 'U17', start: '2026-12-13', end: '2026-12-18' },
  { id: 'ev-2', name: 'Doha Forum', code: 'DF', start: '2026-11-02', end: '2026-11-04' },
  { id: 'ev-3', name: 'Qatar Economic Forum', code: 'QEF', start: '2027-05-10', end: '2027-05-12' },
];

export const SERVICE_LEVELS = [
  { id: 'lv-1', name: 'VVIP', color: '#e0b864' },
  { id: 'lv-2', name: 'VIP', color: '#a78bda' },
  { id: 'lv-3', name: 'Delegate', color: '#5abf6e' },
  { id: 'lv-4', name: 'Press', color: '#c25c4e' },
];

export const SERVICES = [
  { id: 'sv-1', name: 'Flight', icon: 'flight', system: true },
  { id: 'sv-2', name: 'Accommodation', icon: 'hotel', system: true },
  { id: 'sv-3', name: 'Transport', icon: 'car', system: true },
  { id: 'sv-4', name: 'Lounge Access', icon: 'star' },
  { id: 'sv-5', name: 'Interpreter', icon: 'message' },
];

// The three relational built-ins get a column each; everything else shares the
// generic Services column.
export const SYSTEM_SERVICE = { flight: 'sv-1', accommodation: 'sv-2', transport: 'sv-3' };
export const SYSTEM_SERVICE_IDS = Object.values(SYSTEM_SERVICE);

export const ORGANISATIONS = [
  'Ministry of Foreign Affairs', 'Qatar Olympic Committee', 'MicrosysX',
  'Al Jazeera', 'FIVB', 'Ministry of Interior',
];

export const NATIONALITIES = [
  { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
];

export const GUEST_TYPES = ['Dignitary', 'Delegate', 'Speaker', 'Press', 'Observer', 'Staff'];

export const MOCK_GUESTS = [
  {
    id: 'g-1',
    firstName: 'Khalid', lastName: 'Al-Mansouri',
    email: 'k.almansouri@mofa.gov.qa', phone: '+974 5512 8890',
    photoUrl: null,
    guestType: 'Dignitary',
    organisation: 'Ministry of Foreign Affairs',
    jobTitle: 'Director of Protocol',
    nationality: { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
    passportNo: 'QA8842119', passportExpiry: '2030-04-18',
    dateOfBirth: '1974-02-11', gender: 'Male',
    // The interesting case: the same person across three events, each with its
    // own level and its own service list.
    events: [
      {
        eventId: 'ev-1', eventName: 'U17 World Volleyball Championship',
        level: { id: 'lv-1', name: 'VVIP', color: '#e0b864' },
        invitation: 'accepted', accreditation: 'issued', badgeNo: 'U17-0042',
        arrival: '2026-12-12', departure: '2026-12-19',
        seat: 'Block A · Row 2 · Seat 5',
        sessions: ['Opening Ceremony', 'Semi Final', 'Finals'],
        services: [
          { id: 'sv-1', name: 'Flight', status: 'completed', summary: 'QR 334 · LHR → DOH',
            details: { 'Flight no.': 'QR 334', Airline: 'Qatar Airways', Route: 'LHR → DOH',
              Departs: '2026-12-12 08:40', Arrives: '2026-12-12 18:15', Class: 'First', Seat: '1A', Terminal: 'T4' } },
          { id: 'sv-2', name: 'Accommodation', status: 'completed', summary: 'Mandarin Oriental · 12–19 Dec',
            details: { Hotel: 'Mandarin Oriental Doha', 'Room type': 'Royal Suite', 'Check-in': '2026-12-12',
              'Check-out': '2026-12-19', Nights: '7', 'Confirmation': 'MO-88213' } },
          { id: 'sv-3', name: 'Transport', status: 'completed', summary: 'S-Class · Driver assigned',
            details: { Vehicle: 'Mercedes S-Class', Plate: 'QA 41822', Driver: 'Ahmed Nasser',
              'Driver phone': '+974 5580 1123', Pickup: 'Hamad Intl · 2026-12-12 18:45',
              Dropoff: 'Mandarin Oriental', Status: 'Confirmed' } },
          { id: 'sv-4', name: 'Lounge Access', status: 'pending', summary: null },
        ],
      },
      {
        eventId: 'ev-2', eventName: 'Doha Forum',
        level: { id: 'lv-2', name: 'VIP', color: '#a78bda' },
        invitation: 'accepted', accreditation: 'issued', badgeNo: 'DF-0871',
        arrival: '2026-11-01', departure: '2026-11-05',
        seat: 'Hall 1 · Table 3',
        sessions: ['Opening Plenary', 'Closing Remarks'],
        services: [
          { id: 'sv-1', name: 'Flight', status: 'completed', summary: 'QR 007 · DOH → CDG',
            details: { 'Flight no.': 'QR 007', Airline: 'Qatar Airways', Route: 'DOH → CDG',
              Departs: '2026-11-01 02:15', Arrives: '2026-11-01 07:40', Class: 'Business', Seat: '2C' } },
          { id: 'sv-3', name: 'Transport', status: 'completed', summary: 'Sedan · On call',
            details: { Vehicle: 'BMW 7 Series', Plate: 'QA 20194', Driver: 'On-call pool',
              Pickup: 'Hamad Intl · 2026-11-01 08:10', Status: 'Confirmed' } },
        ],
      },
      {
        eventId: 'ev-3', eventName: 'Qatar Economic Forum',
        level: { id: 'lv-2', name: 'VIP', color: '#a78bda' },
        invitation: 'sent', accreditation: 'not_issued', badgeNo: null,
        arrival: null, departure: null, seat: null,
        sessions: [],
        services: [{ id: 'sv-1', name: 'Flight', status: 'pending', summary: null }],
      },
    ],
    notes: 'Requires halal catering. Prefers Arabic-speaking driver.',
    createdAt: '2026-08-02T09:14:00', updatedAt: '2026-12-01T16:02:00',
  },
  {
    id: 'g-2',
    firstName: 'Emma', lastName: 'Fournier',
    email: 'emma.fournier@fivb.org', phone: '+33 6 21 44 09 77',
    photoUrl: null,
    guestType: 'Speaker',
    organisation: 'FIVB',
    jobTitle: 'Technical Delegate',
    nationality: { code: 'FR', name: 'France', flag: '🇫🇷' },
    passportNo: 'FR2210984', passportExpiry: '2029-09-30',
    dateOfBirth: '1986-07-23', gender: 'Female',
    events: [
      {
        eventId: 'ev-1', eventName: 'U17 World Volleyball Championship',
        level: { id: 'lv-3', name: 'Delegate', color: '#5abf6e' },
        invitation: 'accepted', accreditation: 'pending', badgeNo: null,
        arrival: '2026-12-11', departure: '2026-12-20',
        seat: null,
        sessions: ['Technical Briefing', 'Opening Ceremony', 'Quarter Final', 'Finals'],
        services: [
          { id: 'sv-1', name: 'Flight', status: 'completed', summary: 'AF 662 · CDG → DOH',
            details: { 'Flight no.': 'AF 662', Airline: 'Air France', Route: 'CDG → DOH',
              Departs: '2026-12-11 14:20', Arrives: '2026-12-11 23:05', Class: 'Economy', Seat: '18F' } },
          { id: 'sv-2', name: 'Accommodation', status: 'pending', summary: null },
          { id: 'sv-5', name: 'Interpreter', status: 'completed', summary: 'FR ↔ EN' },
        ],
      },
    ],
    notes: 'Vegetarian.',
    createdAt: '2026-09-18T11:40:00', updatedAt: '2026-11-28T08:20:00',
  },
  {
    id: 'g-3',
    firstName: 'Takeshi', lastName: 'Yamamoto',
    email: 't.yamamoto@example.jp', phone: '+81 90 8877 1122',
    photoUrl: null,
    guestType: 'Press',
    organisation: 'Al Jazeera',
    jobTitle: 'Senior Correspondent',
    nationality: { code: 'JP', name: 'Japan', flag: '🇯🇵' },
    passportNo: 'JP7719022', passportExpiry: '2028-01-14',
    dateOfBirth: '1991-03-05', gender: 'Male',
    events: [
      {
        eventId: 'ev-1', eventName: 'U17 World Volleyball Championship',
        level: { id: 'lv-4', name: 'Press', color: '#c25c4e' },
        invitation: 'opened', accreditation: 'not_issued', badgeNo: null,
        arrival: '2026-12-13', departure: '2026-12-18',
        seat: 'Press Box · Seat 11',
        sessions: ['Opening Ceremony', 'Finals'],
        services: [{ id: 'sv-2', name: 'Accommodation', status: 'completed', summary: 'Hilton · 13–18 Dec',
          details: { Hotel: 'Hilton Doha', 'Room type': 'Twin', 'Check-in': '2026-12-13',
            'Check-out': '2026-12-18', Nights: '5', Confirmation: 'HD-55190' } }],
      },
    ],
    notes: null,
    createdAt: '2026-10-02T14:05:00', updatedAt: '2026-11-30T10:11:00',
  },
  {
    id: 'g-4',
    firstName: 'Aisha', lastName: 'Rahman',
    email: 'aisha.rahman@qoc.qa', phone: '+974 3344 1090',
    photoUrl: null,
    guestType: 'Staff',
    organisation: 'Qatar Olympic Committee',
    jobTitle: 'Venue Operations Lead',
    nationality: { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
    passportNo: 'QA5590147', passportExpiry: '2031-06-02',
    dateOfBirth: '1989-11-19', gender: 'Female',
    events: [
      {
        eventId: 'ev-1', eventName: 'U17 World Volleyball Championship',
        level: { id: 'lv-3', name: 'Delegate', color: '#5abf6e' },
        invitation: 'accepted', accreditation: 'issued', badgeNo: 'U17-0155',
        arrival: null, departure: null, seat: null,
        sessions: ['Technical Briefing'],
        services: [],
      },
      {
        eventId: 'ev-3', eventName: 'Qatar Economic Forum',
        level: { id: 'lv-3', name: 'Delegate', color: '#5abf6e' },
        invitation: 'not_sent', accreditation: 'not_issued', badgeNo: null,
        arrival: null, departure: null, seat: null,
        sessions: [], services: [],
      },
    ],
    notes: 'Local staff — no travel required.',
    createdAt: '2026-07-21T08:00:00', updatedAt: '2026-10-14T12:45:00',
  },
  {
    id: 'g-5',
    firstName: 'Lucas', lastName: 'Ferreira',
    email: 'lucas.ferreira@example.br', phone: '+55 21 99881 4477',
    photoUrl: null,
    guestType: 'Delegate',
    organisation: 'FIVB',
    jobTitle: 'Team Manager',
    nationality: { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
    passportNo: 'BR3391882', passportExpiry: '2027-12-08',
    dateOfBirth: '1980-05-30', gender: 'Male',
    events: [
      {
        eventId: 'ev-1', eventName: 'U17 World Volleyball Championship',
        level: { id: 'lv-3', name: 'Delegate', color: '#5abf6e' },
        invitation: 'declined', accreditation: 'not_issued', badgeNo: null,
        arrival: null, departure: null, seat: null,
        sessions: [], services: [],
      },
    ],
    notes: 'Declined — sending a deputy.',
    createdAt: '2026-09-30T17:22:00', updatedAt: '2026-11-12T09:03:00',
  },
  {
    id: 'g-6',
    firstName: 'Sarah', lastName: 'Whitfield',
    email: 's.whitfield@example.co.uk', phone: '+44 7700 900412',
    photoUrl: null,
    guestType: 'Observer',
    organisation: 'MicrosysX',
    jobTitle: 'Head of Partnerships',
    nationality: { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
    passportNo: 'GB9080771', passportExpiry: '2032-03-21',
    dateOfBirth: '1993-08-14', gender: 'Female',
    events: [
      {
        eventId: 'ev-2', eventName: 'Doha Forum',
        level: { id: 'lv-2', name: 'VIP', color: '#a78bda' },
        invitation: 'accepted', accreditation: 'issued', badgeNo: 'DF-0910',
        arrival: '2026-11-01', departure: '2026-11-05',
        seat: 'Hall 1 · Table 9',
        sessions: ['Opening Plenary'],
        services: [
          { id: 'sv-1', name: 'Flight', status: 'completed', summary: 'BA 125 · LHR → DOH',
            details: { 'Flight no.': 'BA 125', Airline: 'British Airways', Route: 'LHR → DOH',
              Departs: '2026-11-01 09:30', Arrives: '2026-11-01 19:05', Class: 'Business', Seat: '4A' } },
          { id: 'sv-2', name: 'Accommodation', status: 'completed', summary: 'W Doha · 1–5 Nov',
            details: { Hotel: 'W Doha', 'Room type': 'Executive', 'Check-in': '2026-11-01',
              'Check-out': '2026-11-05', Nights: '4', Confirmation: 'WD-31007' } },
          { id: 'sv-4', name: 'Lounge Access', status: 'completed', summary: 'Al Mourjan' },
        ],
      },
    ],
    notes: null,
    createdAt: '2026-08-29T13:30:00', updatedAt: '2026-11-06T18:55:00',
  },
  {
    id: 'g-7',
    firstName: 'Bilal', lastName: 'Ahmed',
    email: 'bilal.ahmed@moi.gov.qa', phone: '+974 6677 2210',
    photoUrl: null,
    guestType: 'Delegate',
    organisation: 'Ministry of Interior',
    jobTitle: 'Security Liaison',
    nationality: { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
    passportNo: 'PK1120983', passportExpiry: '2029-02-27',
    dateOfBirth: '1984-12-02', gender: 'Male',
    events: [
      {
        eventId: 'ev-1', eventName: 'U17 World Volleyball Championship',
        level: { id: 'lv-2', name: 'VIP', color: '#a78bda' },
        invitation: 'accepted', accreditation: 'revoked', badgeNo: 'U17-0088',
        arrival: '2026-12-12', departure: '2026-12-19',
        seat: 'Block C · Row 1 · Seat 2',
        sessions: ['Opening Ceremony'],
        services: [{ id: 'sv-3', name: 'Transport', status: 'completed', summary: 'SUV · 24h standby',
          details: { Vehicle: 'Toyota Land Cruiser', Plate: 'QA 77310', Driver: 'Yousef Karim',
            'Driver phone': '+974 3390 5521', Pickup: '24h standby', Status: 'Confirmed' } }],
      },
    ],
    notes: 'Badge revoked pending clearance review.',
    createdAt: '2026-10-11T07:48:00', updatedAt: '2026-12-02T11:30:00',
  },
  {
    id: 'g-8',
    firstName: 'Maria', lastName: 'Costa',
    email: 'maria.costa@example.br', phone: '+55 11 98123 5566',
    photoUrl: null,
    guestType: 'Speaker',
    organisation: 'Qatar Olympic Committee',
    jobTitle: 'Sports Scientist',
    nationality: { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
    passportNo: 'BR7742019', passportExpiry: '2030-10-05',
    dateOfBirth: '1990-01-27', gender: 'Female',
    events: [
      {
        eventId: 'ev-3', eventName: 'Qatar Economic Forum',
        level: { id: 'lv-1', name: 'VVIP', color: '#e0b864' },
        invitation: 'sent', accreditation: 'not_issued', badgeNo: null,
        arrival: '2027-05-09', departure: '2027-05-13',
        seat: null,
        sessions: ['Keynote'],
        services: [
          { id: 'sv-1', name: 'Flight', status: 'pending', summary: null },
          { id: 'sv-5', name: 'Interpreter', status: 'pending', summary: null },
        ],
      },
    ],
    notes: null,
    createdAt: '2026-11-20T15:10:00', updatedAt: '2026-12-03T09:00:00',
  },
];
