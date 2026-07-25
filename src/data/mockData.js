// GMS mock data
export const FIRST = ["Amal","Khalid","Sara","Mohammed","Layla","Yousef","Fatima","Hassan","Mariam","Omar","Noor","Tariq","Reem","Ali","Hind","Saeed","Aisha","Faisal","Rania","Ahmed","Dana","Ibrahim","Lina","Zayed","Hala","Karim","Maya","Nasser","Yara","Salim"];
export const LAST = ["Al-Mansouri","Al-Thani","Al-Khalifa","Al-Sayed","Hamdan","El-Bashir","Al-Naimi","Khoury","Al-Ansari","Al-Mahmoud","Haddad","Saleh","Al-Marri","Sultan","Al-Suwaidi","Aziz","Al-Otaibi","Nazari","Karam","Al-Kuwari"];
export const ORGS = ["Ministry of Foreign Affairs","Embassy of Japan","Brookings Institution","UNESCO","Chatham House","World Bank","Council on Foreign Relations","Asia Society","RAND Corporation","Le Monde Diplomatique","Al Jazeera","Atlantic Council","Carnegie Endowment","IISS","African Union","ASEAN Secretariat"];
export const COUNTRIES = ["Qatar","Japan","France","Germany","UK","USA","Egypt","Türkiye","Saudi Arabia","UAE","Indonesia","Brazil","India","Kenya","Rwanda","Singapore","Norway","Spain","Mexico","Pakistan"];
const ROLES = ["Minister","Ambassador","Senior Advisor","Director","Researcher","Editor-in-Chief","Special Envoy","Head of Delegation","Press","Chief Executive"];
export const SESSIONS = [
  { id: "S-001", title: "Opening Plenary — The Innovation Imperative", date: "2025-12-07", time: "09:00", venue: "Sheraton Grand, Doha", room: "Al Mayassa Hall", speaker: "FM Qatar", capacity: 800 },
  { id: "S-002", title: "Reimagining Multilateralism", date: "2025-12-07", time: "11:30", venue: "Sheraton Grand, Doha", room: "Pearl Auditorium", speaker: "Panel", capacity: 400 },
  { id: "S-003", title: "AI and the Public Square", date: "2025-12-08", time: "14:00", venue: "Sheraton Grand, Doha", room: "Studio 4", speaker: "Panel", capacity: 200 },
  { id: "S-004", title: "Climate & Capital", date: "2025-12-08", time: "16:30", venue: "Sheraton Grand, Doha", room: "Pearl Auditorium", speaker: "Keynote", capacity: 400 },
  { id: "S-005", title: "Closing Reception · Protocol Dinner", date: "2025-12-09", time: "19:30", venue: "Sheraton Grand, Doha", room: "Sheraton Grand Ballroom", speaker: "", capacity: 600 },
  { id: "S-006", title: "Energy Transitions", date: "2025-12-08", time: "09:00", venue: "Sheraton Grand, Doha", room: "Al Mayassa Hall", speaker: "Panel", capacity: 800 },
  { id: "S-007", title: "Diplomacy in the Digital Era", date: "2025-12-07", time: "14:30", venue: "Sheraton Grand, Doha", room: "Studio 4", speaker: "Keynote", capacity: 200 },
  { id: "S-008", title: "Trade Corridors of the Future", date: "2025-12-09", time: "10:00", venue: "Sheraton Grand, Doha", room: "Pearl Auditorium", speaker: "Panel", capacity: 400 },
];
const SESSION_IDS = SESSIONS.map(s => s.id);

function rand(arr, seed) { return arr[Math.floor(seededRand(seed) * arr.length)]; }
function seededRand(seed) {
  let x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const TIERS = ["VVIP","VIP","Speaker","Delegate","Press","Observer"];
const STATUSES = ["confirmed","pending","declined","draft"];
const EMAIL_DOMAINS = ["mofa.gov.qa","diplomacy.int","brookings.edu","unesco.org","chatham.org","worldbank.org","cfr.org","asiasociety.org","rand.org","lemonde.fr","aljazeera.net","atlanticcouncil.org","carnegieendowment.org","iiss.org","au.int","asean.org"];

export const GUESTS = Array.from({ length: 64 }, (_, i) => {
  const s = i + 1;
  const first = rand(FIRST, s * 1.7);
  const last = rand(LAST, s * 2.3);
  const tier = TIERS[Math.floor(seededRand(s * 3.1) * TIERS.length)];
  const status = STATUSES[Math.floor(seededRand(s * 4.7) * STATUSES.length)];
  const emailLocal = `${first.toLowerCase()}.${last.toLowerCase().replace(/^al-/,"").replace(/[^a-z]/g,"")}`;
  const emailDomain = EMAIL_DOMAINS[Math.floor(seededRand(s * 14.5) * EMAIL_DOMAINS.length)];
  return {
    id: "G-" + String(2025000 + i).padStart(7, "0"),
    name: `${first} ${last}`,
    initials: (first[0] + last.replace("Al-","")[0]).toUpperCase(),
    role: rand(ROLES, s * 5.1),
    org: rand(ORGS, s * 6.2),
    country: rand(COUNTRIES, s * 7.3),
    tier,
    status,
    email: `${emailLocal}@${emailDomain}`,
    arrival: `Dec ${5 + Math.floor(seededRand(s*8.1)*4)}`,
    flight: `QR ${100 + Math.floor(seededRand(s*9.2)*800)}`,
    hotel: ["Sheraton Grand","Mondrian Doha","Mandarin Oriental","St. Regis","Four Seasons"][Math.floor(seededRand(s*10.1)*5)],
    invited: `Oct ${10 + Math.floor(seededRand(s*11.1)*20)}`,
    accreditation: seededRand(s*12.1) > 0.4 ? "issued" : "pending",
    table: 1 + Math.floor(seededRand(s*13.1) * 20),
    sessions: SESSION_IDS.filter((_, j) => seededRand(s * 15.3 + j + 1) > 0.65),
  };
});

export const INVITATION_TEMPLATES = [
  {
    id: "t1", name: "Heads of State · Formal", nameAr: "رؤساء الدول · رسمي",
    lang: "EN/AR", sent: 84, opened: 78, accepted: 62, color: "#5e0022",
    subject: "Your personal invitation to the 23rd Doha Forum",
    subjectAr: "دعوتكم الخاصة لحضور منتدى الدوحة الـ ٢٣",
    opening: "Your Excellency / Your Highness,",
    openingAr: "صاحب الفخامة / صاحب السمو،",
    body: "On behalf of the State of Qatar, it is our distinct honour to invite you to the 23rd Doha Forum, taking place 7–9 December at Sheraton Grand, Doha. The Forum brings together world leaders, thinkers, and innovators to address the most pressing global challenges.",
    bodyAr: "نيابةً عن دولة قطر، يشرفنا أن ندعوكم لحضور النسخة الثالثة والعشرين من منتدى الدوحة، المنعقد في الفترة ٧–٩ ديسمبر في فندق شيراتون الكبرى، الدوحة.",
    tiers: ["VVIP"],
  },
  {
    id: "t2", name: "Speakers · Personal", nameAr: "المتحدثون · شخصي",
    lang: "EN", sent: 132, opened: 128, accepted: 119, color: "#8d0134",
    subject: "Your role as a speaker at the 23rd Doha Forum",
    subjectAr: "دورك كمتحدث في منتدى الدوحة الـ ٢٣",
    opening: "Dear Professor / Dear Colleague,",
    openingAr: "البروفيسور العزيز / الزميل العزيز،",
    body: "We are delighted to confirm your participation as a keynote speaker at the 23rd Doha Forum. Enclosed you will find your session brief, travel information, and accreditation details. Our team will be in touch shortly to coordinate logistics.",
    bodyAr: "يسعدنا تأكيد مشاركتكم كمتحدث رئيسي في منتدى الدوحة الـ ٢٣. مرفق ملخص جلستكم ومعلومات السفر وتفاصيل الاعتماد.",
    tiers: ["Speaker"],
  },
  {
    id: "t3", name: "Press Pool · Brief", nameAr: "كوادر صحفية · موجز",
    lang: "EN/AR/FR", sent: 248, opened: 201, accepted: 180, color: "#c21857",
    subject: "Press accreditation — 23rd Doha Forum",
    subjectAr: "اعتماد الصحافة — منتدى الدوحة الـ ٢٣",
    opening: "Dear Colleague,",
    openingAr: "الزميل العزيز،",
    body: "We are pleased to inform you that your press accreditation request for the 23rd Doha Forum has been approved. Please find your credentials and access details in the attached document. Media check-in opens on 6 December at 08:00.",
    bodyAr: "يسعدنا إبلاغكم بالموافقة على طلب اعتمادكم الصحفي لمنتدى الدوحة الـ ٢٣. يرجى الاطلاع على بياناتكم وتفاصيل الدخول في المرفق.",
    tiers: ["Press"],
  },
  {
    id: "t4", name: "Delegations · Formal", nameAr: "الوفود · رسمي",
    lang: "EN/AR", sent: 612, opened: 544, accepted: 481, color: "#3aa3b5",
    subject: "Official invitation — 23rd Doha Forum",
    subjectAr: "دعوة رسمية — منتدى الدوحة الـ ٢٣",
    opening: "Dear Sir / Madam,",
    openingAr: "السيد / السيدة الفاضلة،",
    body: "The Permanent Committee for Organizing Conferences is pleased to invite you to the 23rd Doha Forum. The event will take place 7–9 December at Sheraton Grand, Doha. Please confirm your attendance at your earliest convenience using the link below.",
    bodyAr: "تتشرف اللجنة الدائمة لتنظيم المؤتمرات بدعوتكم لحضور منتدى الدوحة الـ ٢٣، المنعقد في ٧–٩ ديسمبر في شيراتون الكبرى، الدوحة.",
    tiers: ["VIP", "Delegate", "Observer"],
  },
];

export const MEETINGS = [
  { id: "M-001", title: "Opening Plenary Briefing", date: "2025-12-07", startTime: "08:00", endTime: "09:00", location: "Al Mayassa Hall", attendees: ["G-2025000","G-2025001","G-2025002","G-2025003"], notes: "Pre-forum protocol briefing for all delegation leads.", color: "#8d0134" },
  { id: "M-002", title: "VVIP Bilateral — Japan", date: "2025-12-07", startTime: "10:00", endTime: "11:00", location: "Executive Suite A", attendees: ["G-2025004","G-2025005"], notes: "Bilateral between FM Qatar and Ambassador of Japan.", color: "#3aa3b5" },
  { id: "M-003", title: "Press Coordination", date: "2025-12-07", startTime: "12:00", endTime: "12:30", location: "Media Center", attendees: ["G-2025010","G-2025011","G-2025012"], notes: "Coordination with press pool before afternoon sessions.", color: "#c21857" },
  { id: "M-004", title: "AI & Public Square — Speaker Prep", date: "2025-12-08", startTime: "09:00", endTime: "10:30", location: "Studio 4", attendees: ["G-2025020","G-2025021","G-2025022"], notes: "Speaker briefing before main session.", color: "#8d0134" },
  { id: "M-005", title: "Multilateralism Working Group", date: "2025-12-08", startTime: "14:00", endTime: "16:00", location: "Pearl Auditorium", attendees: ["G-2025030","G-2025031","G-2025032","G-2025033"], notes: "Working group on reimagining multilateral frameworks.", color: "#3aa3b5" },
  { id: "M-006", title: "Protocol Dinner Seating Review", date: "2025-12-08", startTime: "11:00", endTime: "11:30", location: "Protocol Office", attendees: ["G-2025000","G-2025040"], notes: "Final review of closing dinner seating arrangement.", color: "#5e0022" },
  { id: "M-007", title: "Closing Ceremony Rehearsal", date: "2025-12-09", startTime: "08:30", endTime: "09:30", location: "Sheraton Grand Ballroom", attendees: ["G-2025050","G-2025051"], notes: "Run-through of closing ceremony programme.", color: "#8d0134" },
  { id: "M-008", title: "Post-Forum Debrief", date: "2025-12-09", startTime: "20:00", endTime: "21:00", location: "Executive Lounge", attendees: ["G-2025000","G-2025001","G-2025002"], notes: "Internal debrief with core team.", color: "#c21857" },
];
