import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import AppToaster from './components/ui/AppToaster.jsx';
import { AuthProvider } from './auth/AuthContext';
import { AccessProvider } from './auth/AccessContext';
import { EventsProvider } from './events/EventsContext';
import { router } from './router';
import VenueFullScreenView from './views/venue/VenueFullScreenView.jsx';
import InvitationResponseView from './views/InvitationResponseView.jsx';
import UserInviteAcceptView from './views/UserInviteAcceptView.jsx';
// Installs the global pointer listener that lets dialogs animate out of the
// control that opened them. Imported here rather than in ui/Modal so the
// hand-rolled overlays in views that never import <Modal> get it too.
import './lib/clickOrigin';
import './style.css';
// After style.css on purpose: the revamp layer overrides the older component
// styles on equal specificity, so import order is what makes it win.
import './styles/sc-revamp.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

// The venue full-screen viewer opens as its own browser tab (via window.open)
// rather than a router-mounted route — this app has no router, and a bare
// query param avoids needing server-side rewrite rules for a real path. It
// reuses the same origin/localStorage session, so the API calls stay authed.
const screenParams = new URLSearchParams(window.location.search);
if (screenParams.get('screen') === 'venueView') {
  root.render(
    <React.StrictMode>
      <VenueFullScreenView
        venueId={screenParams.get('venueId')}
        eventId={screenParams.get('eventId') || null}
        sessionId={screenParams.get('sessionId') || null}
        lang={screenParams.get('lang') || 'en'}
      />
    </React.StrictMode>
  );
} else if (screenParams.get('screen') === 'invitation') {
  // Public guest invitation accept/reject page — reached from the tokenised
  // link in the invitation email. Rendered outside AuthProvider/Gate: the
  // guest has no login, and the API endpoints it hits are [AllowAnonymous].
  root.render(
    <React.StrictMode>
      <InvitationResponseView
        token={screenParams.get('token')}
        lang={screenParams.get('lang') || 'en'}
      />
      <AppToaster />
    </React.StrictMode>
  );
} else if (screenParams.get('screen') === 'userInvite') {
  // Public admin-invited-user accept page — reached from the tokenised link
  // in the invite email. Rendered outside AuthProvider/Gate: the invitee has
  // no login yet, and the API endpoints it hits are [AllowAnonymous].
  root.render(
    <React.StrictMode>
      <UserInviteAcceptView token={screenParams.get('token')} />
      <AppToaster />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <AuthProvider>
        {/* Inside AuthProvider — role access is fetched off the live session,
            and re-fetched whenever a refresh re-mints the token. */}
        <AccessProvider>
          <EventsProvider>
            <RouterProvider router={router} />
          </EventsProvider>
        </AccessProvider>
      </AuthProvider>
      <AppToaster />
    </React.StrictMode>
  );
}
