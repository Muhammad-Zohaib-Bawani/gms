// Maps between the backend EventResponse/SessionResponse DTOs and the shape
// EventsView already renders (venue/image/uiTheme/sessions[].venue).

import { stripSasToken } from '../services/uploadService';

export function toViewSession(s) {
  return {
    id: s.id,
    title: s.title,
    date: s.date || '',
    time: s.time || '',
    venue: s.venueName || '',
    venueId: s.venueId || '',
    room: s.room || '',
    speaker: s.speaker || '',
    capacity: s.capacity ?? 0,
    image: s.imageUrl || '',
  };
}

export function toViewEvent(dto) {
  const isCustom = !!(dto.themeAccent || dto.logoDarkUrl || dto.logoLightUrl);
  return {
    id: dto.id,
    appKey: dto.appKey,
    title: dto.title,
    type: dto.type || 'Forum',
    theme: dto.theme || '',
    venue: dto.venueName || '',
    venueId: dto.venueId || '',
    startDate: dto.startDate || '',
    endDate: dto.endDate || '',
    image: dto.imageUrl || '',
    status: dto.status || 'planning',
    // Absent means flexible — the backend default, and how an event created
    // before this field existed behaves.
    guestModel: dto.guestModel === 'fixed' ? 'fixed' : 'flexible',
    uiTheme: {
      preset: isCustom ? 'custom' : 'default',
      accent: dto.themeAccent || '#8d0134',
      secondary: dto.themeSecondary || '#e0c47e',
      logoDark: dto.logoDarkUrl || '',
      logoLight: dto.logoLightUrl || '',
    },
    sessions: (dto.sessions || []).map(toViewSession),
  };
}

export function toEventRequest(v) {
  const custom = v.uiTheme?.preset === 'custom';
  return {
    title: v.title,
    type: v.type,
    theme: v.theme || null,
    venueName: v.venue || null,
    venueId: v.venueId || null,
    startDate: v.startDate || null,
    endDate: v.endDate || null,
    status: v.status || 'planning',
    guestModel: v.guestModel === 'fixed' ? 'fixed' : 'flexible',
    // SAS tokens are short-lived — persist the bare blob URL, BlobSasMiddleware
    // re-signs it on read.
    imageUrl: stripSasToken(v.image) || null,
    themeAccent: custom ? v.uiTheme.accent : null,
    themeSecondary: custom ? v.uiTheme.secondary : null,
    logoDarkUrl: custom ? stripSasToken(v.uiTheme.logoDark) : null,
    logoLightUrl: custom ? stripSasToken(v.uiTheme.logoLight) : null,
  };
}

export function toSessionRequest(s) {
  return {
    title: s.title,
    date: s.date || null,
    time: s.time || null,
    venueId: s.venueId || null,
    room: s.room || null,
    speaker: s.speaker || null,
    capacity: Number(s.capacity) || 0,
    // SAS tokens are short-lived — persist the bare blob URL, same as the
    // event's own image (BlobSasMiddleware re-signs it on read).
    imageUrl: stripSasToken(s.image) || null,
  };
}
