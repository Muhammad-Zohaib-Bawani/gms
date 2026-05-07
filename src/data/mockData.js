// GMS mock data
export const FIRST = ["Amal","Khalid","Sara","Mohammed","Layla","Yousef","Fatima","Hassan","Mariam","Omar","Noor","Tariq","Reem","Ali","Hind","Saeed","Aisha","Faisal","Rania","Ahmed","Dana","Ibrahim","Lina","Zayed","Hala","Karim","Maya","Nasser","Yara","Salim"];
export const LAST = ["Al-Mansouri","Al-Thani","Al-Khalifa","Al-Sayed","Hamdan","El-Bashir","Al-Naimi","Khoury","Al-Ansari","Al-Mahmoud","Haddad","Saleh","Al-Marri","Sultan","Al-Suwaidi","Aziz","Al-Otaibi","Nazari","Karam","Al-Kuwari"];
export const ORGS = ["Ministry of Foreign Affairs","Embassy of Japan","Brookings Institution","UNESCO","Chatham House","World Bank","Council on Foreign Relations","Asia Society","RAND Corporation","Le Monde Diplomatique","Al Jazeera","Atlantic Council","Carnegie Endowment","IISS","African Union","ASEAN Secretariat"];
export const COUNTRIES = ["Qatar","Japan","France","Germany","UK","USA","Egypt","Türkiye","Saudi Arabia","UAE","Indonesia","Brazil","India","Kenya","Rwanda","Singapore","Norway","Spain","Mexico","Pakistan"];
const ROLES = ["Minister","Ambassador","Senior Advisor","Director","Researcher","Editor-in-Chief","Special Envoy","Head of Delegation","Press","Chief Executive"];
export const SESSIONS = ["The Innovation Imperative","Reimagining Multilateralism","Climate & Capital","AI and the Public Square","Energy Transitions","Diplomacy in the Digital Era","Trade Corridors of the Future","Health Sovereignty"];

function rand(arr, seed) { return arr[Math.floor(seededRand(seed) * arr.length)]; }
function seededRand(seed) {
  let x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const TIERS = ["VVIP","VIP","Speaker","Delegate","Press","Observer"];
const STATUSES = ["confirmed","pending","declined","draft"];

export const GUESTS = Array.from({ length: 64 }, (_, i) => {
  const s = i + 1;
  const first = rand(FIRST, s * 1.7);
  const last = rand(LAST, s * 2.3);
  const tier = TIERS[Math.floor(seededRand(s * 3.1) * TIERS.length)];
  const status = STATUSES[Math.floor(seededRand(s * 4.7) * STATUSES.length)];
  return {
    id: "G-" + String(2025000 + i).padStart(7, "0"),
    name: `${first} ${last}`,
    initials: (first[0] + last.replace("Al-","")[0]).toUpperCase(),
    role: rand(ROLES, s * 5.1),
    org: rand(ORGS, s * 6.2),
    country: rand(COUNTRIES, s * 7.3),
    tier,
    status,
    arrival: `Dec ${5 + Math.floor(seededRand(s*8.1)*4)}`,
    flight: `QR ${100 + Math.floor(seededRand(s*9.2)*800)}`,
    hotel: ["Sheraton Grand","Mondrian Doha","Mandarin Oriental","St. Regis","Four Seasons"][Math.floor(seededRand(s*10.1)*5)],
    invited: `Oct ${10 + Math.floor(seededRand(s*11.1)*20)}`,
    accreditation: seededRand(s*12.1) > 0.4 ? "issued" : "pending",
    table: 1 + Math.floor(seededRand(s*13.1) * 20),
  };
});

export const MEETINGS = [
  { id: "M-001", title: "Opening Plenary Briefing", date: "2025-12-07", startTime: "08:00", endTime: "09:00", location: "Al Mayassa Hall", attendees: ["G-2025000","G-2025001","G-2025002","G-2025003"], notes: "Pre-forum protocol briefing for all delegation leads.", color: "#1aaec4" },
  { id: "M-002", title: "VVIP Bilateral — Japan", date: "2025-12-07", startTime: "10:00", endTime: "11:00", location: "Executive Suite A", attendees: ["G-2025004","G-2025005"], notes: "Bilateral between FM Qatar and Ambassador of Japan.", color: "#3aa3b5" },
  { id: "M-003", title: "Press Coordination", date: "2025-12-07", startTime: "12:00", endTime: "12:30", location: "Media Center", attendees: ["G-2025010","G-2025011","G-2025012"], notes: "Coordination with press pool before afternoon sessions.", color: "#5fd1e0" },
  { id: "M-004", title: "AI & Public Square — Speaker Prep", date: "2025-12-08", startTime: "09:00", endTime: "10:30", location: "Studio 4", attendees: ["G-2025020","G-2025021","G-2025022"], notes: "Speaker briefing before main session.", color: "#1aaec4" },
  { id: "M-005", title: "Multilateralism Working Group", date: "2025-12-08", startTime: "14:00", endTime: "16:00", location: "Pearl Auditorium", attendees: ["G-2025030","G-2025031","G-2025032","G-2025033"], notes: "Working group on reimagining multilateral frameworks.", color: "#3aa3b5" },
  { id: "M-006", title: "Protocol Dinner Seating Review", date: "2025-12-08", startTime: "11:00", endTime: "11:30", location: "Protocol Office", attendees: ["G-2025000","G-2025040"], notes: "Final review of closing dinner seating arrangement.", color: "#0a3947" },
  { id: "M-007", title: "Closing Ceremony Rehearsal", date: "2025-12-09", startTime: "08:30", endTime: "09:30", location: "Sheraton Grand Ballroom", attendees: ["G-2025050","G-2025051"], notes: "Run-through of closing ceremony programme.", color: "#1aaec4" },
  { id: "M-008", title: "Post-Forum Debrief", date: "2025-12-09", startTime: "20:00", endTime: "21:00", location: "Executive Lounge", attendees: ["G-2025000","G-2025001","G-2025002"], notes: "Internal debrief with core team.", color: "#5fd1e0" },
];
