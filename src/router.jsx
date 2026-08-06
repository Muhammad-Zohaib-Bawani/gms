import React from 'react';
import { createBrowserRouter, Navigate, Outlet, useOutletContext, useParams, useLocation } from 'react-router-dom';
import App from './App';
import AuthView from './views/AuthView';
import { useAuth } from './auth/AuthContext';
import { KEY_PATH } from './nav';

import DashboardView from './views/DashboardView';
import InvitationsView from './views/InvitationsView';
import GuestsView from './views/GuestsView';
import ServiceOpsView from './views/ServiceOpsView';
import TravelView from './views/TravelView';
import AccreditationView from './views/AccreditationView';
import SeatingView from './views/SeatingView';
import MeetingsView from './views/MeetingsView';
import VenueConfigView from './views/VenueConfigView';
import EventsView from './views/EventsView';
import AccountRequestsView from './views/AccountRequestsView';
import UserAccessView from './views/UserAccessView';
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

// Each routed module + the permission that gates it. Paths come from KEY_PATH
// so the sidebar links and the routes always agree.
const MODULE_ROUTES = [
  { key: 'dashboard',       Component: DashboardView,       permission: 'Dashboard.View' },
  { key: 'invitations',     Component: InvitationsView,     permission: 'Invitations.View' },
  { key: 'guests',          Component: GuestsView,          permission: 'Guests.View' },
  { key: 'serviceLevels',   Component: ServiceLevelsView,   permission: 'ServiceLevels.View' },
  { key: 'services',        Component: ServicesView,        permission: 'Services.View' },
  // One page for every service: TravelView renders the three built-in relational
  // ones (Core/Constants/SystemServices.cs) on its own tabs and embeds
  // ServiceOpsView for each dynamic one. /service-ops is kept, unlinked, so an
  // existing bookmark still lands somewhere sensible.
  { key: 'travel',          Component: TravelView,          permission: 'Travel.View' },
  { key: 'serviceOps',      Component: ServiceOpsView,      permission: 'Travel.View' },
  { key: 'accreditation',   Component: AccreditationView,   permission: 'Accreditation.View' },
  { key: 'seating',         Component: SeatingView,         permission: 'Seating.View' },
  { key: 'meetings',        Component: MeetingsView,        permission: 'Meetings.View' },
  { key: 'venueConfig',     Component: VenueConfigView,     permission: 'Venue.View' },
  { key: 'events',          Component: EventsView,          permission: 'Events.View' },
  { key: 'accountRequests', Component: AccountRequestsView, permission: 'AccountRequests.View' },
  { key: 'userAccess',      Component: UserAccessView,      permission: 'UserAccess.Manage' },
  { key: 'users',           Component: UsersView,           permission: 'Users.View' },
  { key: 'organizations',   Component: OrganizationsView,   permission: 'Organizations.View' },
  { key: 'venues',          Component: VenuesView,          permission: 'Venue.View' },
  { key: 'vehicles',        Component: VehiclesView,        permission: 'Travel.View' },
  { key: 'fleetProviders',  Component: FleetProvidersView,  permission: 'Travel.View' },
  { key: 'fleetBookings',   Component: FleetBookingsView,   permission: 'Travel.View' },
  { key: 'roomInventory',   Component: AccommodationInventoryView, permission: 'Travel.View' },
  { key: 'supportChat',     Component: SupportChatView,     permission: 'SupportChat.View' },
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

function GuestDetailAdapter() {
  const ctx = useOutletContext();
  const { id } = useParams();
  return <GuestDetailView guestId={id} lang={ctx.lang} />;
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

// A permission gate for a single module route. Falls back to the index redirect
// (first accessible module) when the user lacks the permission.
function Guard({ permission, children }) {
  const { can } = useAuth();
  if (permission && !can(permission)) return <Navigate to="/" replace />;
  return children;
}

// "/" → first module the user can actually see.
function IndexRedirect() {
  const { can } = useAuth();
  const first = MODULE_ROUTES.find((m) => !m.permission || can(m.permission));
  return <Navigate to={first ? KEY_PATH[first.key] : '/dashboard'} replace />;
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
          <Guard permission={m.permission}>
            <ModuleAdapter Component={m.Component} />
          </Guard>
        ),
      })),
      {
        path: 'lookups/:lookupKey',
        element: (
          <Guard permission="Lookups.View">
            <LookupAdapter />
          </Guard>
        ),
      },
      {
        path: 'guests/:id',
        element: (
          <Guard permission="Guests.View">
            <GuestDetailAdapter />
          </Guard>
        ),
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
