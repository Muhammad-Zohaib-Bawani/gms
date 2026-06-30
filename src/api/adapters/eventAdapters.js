// Maps between the backend EventResponse/SessionResponse DTOs and the shape
// EventsView already renders (venue/image/uiTheme/sessions[].venue).

export function toViewSession(s) {
  return {
    id: s.id,
    title: s.title,
    date: s.date || '',
    time: s.time || '',
    venue: s.venueName || '',
    room: s.room || '',
    speaker: s.speaker || '',
    capacity: s.capacity ?? 0,
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
    startDate: dto.startDate || '',
    endDate: dto.endDate || '',
    image: dto.imageUrl || '',
    status: dto.status || 'planning',
    uiTheme: {
      preset: isCustom ? 'custom' : 'default',
      accent: dto.themeAccent || '#1aaec4',
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
    startDate: v.startDate || null,
    endDate: v.endDate || null,
    status: v.status || 'planning',
    imageUrl: v.image || null,
    themeAccent: custom ? v.uiTheme.accent : null,
    themeSecondary: custom ? v.uiTheme.secondary : null,
    logoDarkUrl: custom ? v.uiTheme.logoDark : null,
    logoLightUrl: custom ? v.uiTheme.logoLight : null,
  };
}

export function toSessionRequest(s) {
  return {
    title: s.title,
    date: s.date || null,
    time: s.time || null,
    venueName: s.venue || null,
    room: s.room || null,
    speaker: s.speaker || null,
    capacity: Number(s.capacity) || 0,
  };
}
