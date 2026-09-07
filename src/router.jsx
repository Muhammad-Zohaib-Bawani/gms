import React from 'react';
import { createBrowserRouter, Navigate, Outlet, useOutletContext, useParams, useLocation } from 'react-router-dom';
import App from './App';
import AuthView from './views/AuthView';
import { useAuth } from './auth/AuthContext';
import { useAccess, flattenMenus } from './auth/AccessContext';
import { KEY_PATH } from './nav';

import DashboardView from './views/DashboardView';
import InvitationsView from './views/InvitationsView';
import GuestsView from './views/GuestsView';
import GuestOverviewView from './views/GuestOverviewView';
import ServiceOpsView from './views/ServiceOpsView';
import TravelView from './views/TravelView';
import AccreditationView from './views/AccreditationView';
import SeatingView from './views/SeatingView';
import MeetingsView from './views/MeetingsView';
import VenueConfigView from './views/VenueConfigView';
import EventsView from './views/EventsView';
import RoleAccessView from './views/RoleAccessView';
import UsersView from './views/UsersView';
import OrganizationsView from './views/OrganizationsView';
import ServicesView from './views/ServicesView';
import ServiceLevelsView from './views/ServiceLevelsView';
import VenuesView from './views/VenuesView';
import VehiclesView from './views/VehiclesView';
import FleetProvidersView from './views/FleetProvidersView';
import FleetBookingsView from './views/FleetBookingsView';
import AccommodationInventoryView from './views/AccommodationInventoryView';
import SupportChatView from './views/SupportChatView';
import LookupsView from './views/lookups/LookupsView';
import GuestDetailView from './views/GuestDetailView';

// Permission code → component. The DATABASE decides which of these are
// reachable, what they are called and where they sit in the tree; this table only
// says which component answers a code, because a component cannot come out of a row.
// Paths come from KEY_PATH, so the sidebar links and the routes always agree.
const MODULE_ROUTES = [
  { key: 'dashboard',         Component: DashboardView },
  { key: 'guests',            Component: GuestsView },
  // One page for every service: TravelView renders the three built-in relational
  // ones (Core/Constants/SystemServices.cs) on its own tabs and embeds
  // ServiceOpsView for each dynamic one.
  { key: 'services',          Component: TravelView },
  { key: 'support-chat',      Component: SupportChatView },

  { key: 'accreditation',     Component: AccreditationView },
  { key: 'seating',           Component: SeatingView },
  { key: 'meetings',          Component: MeetingsView },

  { key: 'venue-config',      Component: VenueConfigView },
  { key: 'venues',            Component: VenuesView },

  { key: 'vehicles',          Component: VehiclesView },
  { key: 'fleet-providers',   Component: FleetProvidersView },
  { key: 'fleet-bookings',    Component: FleetBookingsView },

  { key: 'room-inventory',    Component: AccommodationInventoryView },

  { key: 'template-builder',  Component: InvitationsView },
  { key: 'events',            Component: EventsView },
  { key: 'guest-overview',    Component: GuestOverviewView },
  { key: 'organizations',     Component: OrganizationsView },
  { key: 'service-levels',    Component: ServiceLevelsView },
  { key: 'manage-services',   Component: ServicesView },

  { key: 'users',             Component: UsersView },
  { key: 'role-access',       Component: RoleAccessView },
];

// Views read lang / activeEventId / onOpenGuest / gotoView from the layout via
// outlet context, so their existing prop signatures stay unchanged.
function ModuleAdapter({ Component }) {
  const ctx = useOutletContext();
  return <Component {...ctx} />;
}

function LookupAdapter() {
  const ctx = useOutletContext();
  const { lookupKey } = useParams();
  return <LookupsView lookupKey={lookupKey} lang={ctx.lang} />;
}

// /guests/:id — :id is an eventGuestId (EventGuest.PublicId), the participation
// being viewed. A personId here would 404: the cross-event view of a human is
// Guest Overview, not this route.
function GuestDetailAdapter() {
  const ctx = useOutletContext();
  const { id } = useParams();
  return <GuestDetailView eventGuestId={id} lang={ctx.lang} />;
}

// Redirect helpers ----------------------------------------------------------

function RequireAuth() {
  const { isAuthenticated, isBooting } = useAuth();
  const location = useLocation();
  // Startup refresh in flight — deciding either way here would flash the wrong
  // screen (and used to send a returning user straight to /login).
  if (isBooting) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  return <App />; // App is the shell/layout; it renders <Outlet/> for the active module
}

function LoginRoute() {
  const { isAuthenticated, isBooting } = useAuth();
  if (isBooting) return null;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <AuthView />;
}

// Read access to one menu/submenu, enforced on the ROUTE and not just in the
// sidebar: typing the URL is exactly how a hidden page would otherwise be
// reached. The
// server enforces the same thing again, so this only avoids a page of 403s.
// It reads the token's own claims, so it is decided without waiting on a request.
function Guard({ code, children }) {
  const { canRead } = useAccess();
  if (!canRead(code)) return <Navigate to="/" replace />;
  return children;
}

// "/" → the first page this role can actually open, in the database's own nav
// order. Held while the tree loads: redirecting early would land on /dashboard
// for a role that cannot read it, and bounce straight back here.
function IndexRedirect() {
  const { menus, loading, canRead } = useAccess();
  const { isDemo } = useAuth();
  if (loading) return null;
  if (isDemo) return <Navigate to="/dashboard" replace />;

  const first = flattenMenus(menus).find((m) => canRead(m.code));
  return <Navigate to={first?.path || '/dashboard'} replace />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginRoute /> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      { index: true, element: <IndexRedirect /> },
      ...MODULE_ROUTES.map((m) => ({
        path: KEY_PATH[m.key].slice(1), // strip leading "/"
        element: (
          <Guard code={m.key}>
            <ModuleAdapter Component={m.Component} />
          </Guard>
        ),
      })),
      // Kept, unlinked, so an existing bookmark still lands somewhere sensible:
      // the dynamic services now show as tabs inside the Services page.
      {
        path: 'service-ops',
        element: (
          <Guard code="services">
            <ModuleAdapter Component={ServiceOpsView} />
          </Guard>
        ),
      },
      // One route for every lookup screen. The permission code carries which one, so a
      // role granted only "lookup-airports" cannot open /lookups/hotels.
      {
        path: 'lookups/:lookupKey',
        element: <LookupRoute />,
      },
      {
        path: 'guests/:id',
        element: (
          <Guard code="guests">
            <GuestDetailAdapter />
          </Guard>
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

// Declared after the router only for readability — hoisting makes it available
// above. Guards on the per-lookup permission code rather than a blanket "lookups".
function LookupRoute() {
  const { lookupKey } = useParams();
  return (
    <Guard code={`lookup-${lookupKey}`}>
      <LookupAdapter />
    </Guard>
  );
}
