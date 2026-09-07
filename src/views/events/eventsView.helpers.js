// Shared constants + small helpers for the Events view (src/views/EventsView.jsx
// + src/views/events/*). Moved verbatim out of EventsView.jsx — no logic changed.

export const EVENT_TYPE_ICONS = {
  Conference: "meetings", Forum: "globe", Summit: "protocol", Gala: "star",
  Workshop: "edit", Exhibition: "image", Bilateral: "guests", Ceremony: "badge", default: "meetings",
};
export const EVENT_TYPE_COLORS = {
  Conference: "#8d0134", Forum: "#3aa3b5", Summit: "#9d80c3", Gala: "#e0c47e",
  Workshop: "#c21857", Exhibition: "#e07e7e", Bilateral: "#a3b53a", Ceremony: "#e0a47e", default: "#8d0134",
};

export const INITIAL_EVENTS = [
  {
    id: "EV-001", appKey: "doha-forum", title: "23rd Doha Forum", type: "Forum",
    theme: "Governance & Sustainability", venue: "Sheraton Grand, Doha",
    startDate: "2025-12-07", endDate: "2025-12-09", image: "",
    status: "active",
    sessions: [
      { id: "S-001", title: "Opening Plenary — The Innovation Imperative", date: "2025-12-07", time: "09:00", venue: "Sheraton Grand, Doha", room: "Al Mayassa Hall", speaker: "FM Qatar", capacity: 800 },
      { id: "S-002", title: "Reimagining Multilateralism", date: "2025-12-07", time: "11:30", venue: "Sheraton Grand, Doha", room: "Pearl Auditorium", speaker: "Panel", capacity: 400 },
      { id: "S-003", title: "AI and the Public Square", date: "2025-12-08", time: "14:00", venue: "Sheraton Grand, Doha", room: "Studio 4", speaker: "Panel", capacity: 200 },
      { id: "S-004", title: "Climate & Capital", date: "2025-12-08", time: "16:30", venue: "Sheraton Grand, Doha", room: "Pearl Auditorium", speaker: "Keynote", capacity: 400 },
      { id: "S-005", title: "Closing Reception · Protocol Dinner", date: "2025-12-09", time: "19:30", venue: "Sheraton Grand, Doha", room: "Sheraton Grand Ballroom", speaker: "", capacity: 600 },
    ],
  },
  {
    id: "EV-002", appKey: "qef", title: "Qatar Economic Forum", type: "Forum",
    theme: "Powered by Bloomberg", venue: "Marsa Arabella, Lusail", startDate: "2025-05-20", endDate: "2025-05-22", image: "",
    status: "planning",
    sessions: [
      { id: "S-010", title: "Global Markets Outlook", date: "2025-05-20", time: "09:00", venue: "Marsa Arabella, Lusail", room: "Main Stage", speaker: "Bloomberg Editor", capacity: 1200 },
      { id: "S-011", title: "Energy Transition Panel", date: "2025-05-21", time: "11:00", venue: "Marsa Arabella, Lusail", room: "Side Stage", speaker: "Panel", capacity: 400 },
    ],
  },
  {
    id: "EV-003", appKey: "qabf", title: "Qatar–Africa Business Forum", type: "Conference",
    theme: "Trade Corridors of the Future", venue: "QICCA, Doha", startDate: "2025-10-14", endDate: "2025-10-15", image: "",
    status: "planning",
    sessions: [],
  },
];

export const DEFAULT_UI_THEME = { preset: 'default', accent: '#8d0134', secondary: '#e0c47e', logoDark: '', logoLight: '' };

export function getStoredThemes() {
  try { return JSON.parse(localStorage.getItem('gms-event-themes') || '{}'); } catch(e) { return {}; }
}
export function saveStoredTheme(appKey, theme) {
  const all = getStoredThemes();
  all[appKey] = theme;
  localStorage.setItem('gms-event-themes', JSON.stringify(all));
}
