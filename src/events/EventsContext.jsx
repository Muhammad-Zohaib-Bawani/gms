import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { listEvents } from '../api/services/eventService';

const EventsContext = createContext(null);

// Only "ready" events appear in the Switch-event menu: active + completed.
// (planning = still being set up / draft, and cancelled, are hidden.)
export const SWITCHABLE_STATUSES = ['active', 'completed'];

const ACTIVE_KEY = 'gms-active-event';

// Demo fallback (no backend) — keeps the original three branded events.
const DEMO_EVENTS = [
  { id: 'doha-forum', key: 'doha-forum', title: 'Doha Forum', subtitle: '22nd Edition · 7–9 Dec', status: 'active', accent: '#8d0134', secondary: '#c21857', logoDark: 'assets/doha-forum-logo-white.png', logoLight: 'assets/doha-forum-logo.png' },
  { id: 'qef', key: 'qef', title: 'Qatar Economic Forum', subtitle: 'Powered by Bloomberg · May', status: 'active', accent: '#c9943a', secondary: '#e8c068', logoDark: 'assets/qef-logo-white.png', logoLight: 'assets/qef-logo-white.png' },
  { id: 'qabf', key: 'qabf', title: 'Qatar–Africa Business Forum', subtitle: 'Doha · October', status: 'active', accent: '#3d7ab5', secondary: '#6aabdf', logoDark: 'assets/qabf-logo.png', logoLight: 'assets/qabf-logo.png' },
];

// Map a backend EventResponse → the normalized shape the switcher/theme use.
function normalize(dto) {
  const subtitle = dto.theme
    || [dto.startDate, dto.endDate].filter(Boolean).join(' → ')
    || dto.type
    || '';
  return {
    id: dto.id,
    key: dto.appKey || dto.id,
    title: dto.title,
    subtitle,
    status: dto.status,
    accent: dto.themeAccent || '#8d0134',
    secondary: dto.themeSecondary || '#e0c47e',
    logoDark: dto.logoDarkUrl || '',
    logoLight: dto.logoLightUrl || '',
    image: dto.imageUrl || '',
  };
}

export function EventsProvider({ children }) {
  const { isAuthenticated, isDemo } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeEventId, setActiveEventIdState] = useState(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || null; } catch { return null; }
  });

  const setActiveEventId = useCallback((id) => {
    setActiveEventIdState(id);
    try { if (id) localStorage.setItem(ACTIVE_KEY, id); } catch {}
  }, []);

  const reload = useCallback(async () => {
    if (isDemo) {
      setEvents(DEMO_EVENTS);
      setActiveEventIdState((prev) => (DEMO_EVENTS.some((e) => e.id === prev) ? prev : DEMO_EVENTS[0].id));
      setLoading(false);
      return;
    }
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const page = await listEvents({ pageSize: 100 });
      const visible = (page?.items || [])
        .map(normalize)
        .filter((e) => SWITCHABLE_STATUSES.includes(e.status));
      setEvents(visible);
      setActiveEventIdState((prev) => (visible.some((e) => e.id === prev) ? prev : visible[0]?.id || null));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isDemo]);

  useEffect(() => { reload(); }, [reload]);

  // The Events admin dispatches this after create/edit/delete/status changes.
  useEffect(() => {
    const onChanged = () => reload();
    window.addEventListener('gms-events-changed', onChanged);
    return () => window.removeEventListener('gms-events-changed', onChanged);
  }, [reload]);

  const activeEvent = useMemo(
    () => events.find((e) => e.id === activeEventId) || events[0] || null,
    [events, activeEventId]
  );

  const value = useMemo(
    () => ({ events, activeEvent, activeEventId: activeEvent?.id || null, setActiveEventId, loading, reload }),
    [events, activeEvent, setActiveEventId, loading, reload]
  );

  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

export function useEvents() {
  const ctx = useContext(EventsContext);
  if (!ctx) throw new Error('useEvents must be used within an EventsProvider');
  return ctx;
}
