import React from 'react';

export const ICON_PATHS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
  invitation: <><path d="M3 6.5l9 6 9-6"/><rect x="3" y="5" width="18" height="14" rx="2"/></>,
  guests: <><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M15 20c0-2.5 1.8-4.5 4-4.5"/></>,
  travel: <><path d="M21 12l-2 1-7-2L8 14l-2-0.5 1.5-3-3-2L6 8l3 1 4-3 2 0.5-2 3 5 1z"/><path d="M4 20h16"/></>,
  badge: <><rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="2.5"/><path d="M8 16h8"/></>,
  seating: <><circle cx="12" cy="12" r="4"/><circle cx="12" cy="3.5" r="1.5"/><circle cx="12" cy="20.5" r="1.5"/><circle cx="3.5" cy="12" r="1.5"/><circle cx="20.5" cy="12" r="1.5"/><circle cx="6" cy="6" r="1.5"/><circle cx="18" cy="6" r="1.5"/><circle cx="6" cy="18" r="1.5"/><circle cx="18" cy="18" r="1.5"/></>,
  meetings: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/><path d="M8 14h2M14 14h2M8 17h8"/></>,
  protocol: <><path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-0.5-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/></>,
  reports: <><path d="M4 20V8M10 20V4M16 20v-8M22 20H2"/></>,
  bell: <><path d="M6 8a6 6 0 0112 0v4l1.5 3h-15L6 12z"/><path d="M10 18a2 2 0 004 0"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  filter: <><path d="M4 5h16l-6 8v6l-4-2v-4z"/></>,
  download: <><path d="M12 4v12M7 11l5 5 5-5M4 20h16"/></>,
  upload: <><path d="M12 20V8M7 13l5-5 5 5M4 4h16"/></>,
  close: <><path d="M6 6l12 12M18 6L6 18"/></>,
  check: <><path d="M5 12l4 4 10-10"/></>,
  arrow: <><path d="M5 12h14M13 5l7 7-7 7"/></>,
  arrowLeft: <><path d="M19 12H5M11 5l-7 7 7 7"/></>,
  more: <><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 4 3 14 0 18M12 3c-3 4-3 14 0 18"/></>,
  flight: <><path d="M21 12l-9-2-3-6h-2l1.5 6L3 12l1 2 4.5-1L11 17l-1.5 3h2l3-3 5.5-1z"/></>,
  hotel: <><path d="M3 20V7l9-4 9 4v13M3 20h18M9 14h6M9 17h6M9 11h6"/></>,
  car: <><path d="M5 17h14M5 17l1.5-5h11L19 17M5 17v3h2v-3M19 17v3h-2v-3M7 12h10"/><circle cx="8" cy="17" r="0.8"/><circle cx="16" cy="17" r="0.8"/></>,
  qr: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3M20 14v7M14 20h3"/></>,
  message: <><path d="M21 12c0 4.4-4 8-9 8-1.6 0-3-0.3-4.3-0.9L3 20l1.2-3.7C3.4 15 3 13.5 3 12c0-4.4 4-8 9-8s9 3.6 9 8z"/></>,
  star: <><path d="M12 3l2.6 5.5 6 0.9-4.3 4.3 1 6L12 17l-5.3 2.7 1-6L3.4 9.4l6-0.9z"/></>,
  shield: <><path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-0.5-8-4-8-9V7z"/></>,
  power: <><path d="M12 3v9M6 7a8 8 0 1012 0"/></>,
  drag: <><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></>,
  moon: <><path d="M21 13.5A8.5 8.5 0 1110.5 3a6.5 6.5 0 0010.5 10.5z"/></>,
  refresh: <><path d="M3 12a9 9 0 0015-6.7L21 8M21 4v4h-4M21 12a9 9 0 01-15 6.7L3 16M3 20v-4h4"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  alert: <><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18.5v0.1"/></>,
  x: <><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></>,
  finance: <><path d="M3 17l5-5 4 3 7-8M21 7v5h-5"/></>,
  wallet: <><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 14h2"/></>,
  doc: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h6"/></>,
  signature: <><path d="M3 17c2-1 4-3 5-6s2-5 4-5 2 4 0 7-3 4-3 4 2 0 5-2 5-3 7-3"/><path d="M3 21h18"/></>,
  venue: <><rect x="3" y="10" width="18" height="11" rx="1.5"/><path d="M3 10l9-7 9 7"/><path d="M9 21v-7h6v7"/><path d="M12 13v2"/></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M8 2v4M16 2v4"/><path d="M7 13h2v2H7z"/><path d="M11 13h2v2h-2z"/><path d="M15 13h2v2h-2z"/><path d="M7 17h2v2H7z"/><path d="M11 17h2v2h-2z"/></>,
  trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></>,
  edit: <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></>,
  menu: <><path d="M3 6h18M3 12h18M3 18h18"/></>,
};

export function Icon({ name, size = 16, className = "", style }) {
  const p = ICON_PATHS[name];
  if (!p) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>{p}</svg>
  );
}

export default Icon;
