import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AuthView from './views/AuthView';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { EventsProvider } from './events/EventsContext';
import VenueFullScreenView from './views/venue/VenueFullScreenView.jsx';
import InvitationResponseView from './views/InvitationResponseView.jsx';
import UserInviteAcceptView from './views/UserInviteAcceptView.jsx';
import './style.css';

// Auth gate: a stored session (real sign-in or "Explore demo") shows the app
// shell; otherwise the sign-in page.
function Gate() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <App /> : <AuthView />;
}

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
      <Toaster position="top-right" richColors closeButton theme="dark" />
    </React.StrictMode>
  );
} else if (screenParams.get('screen') === 'userInvite') {
  // Public admin-invited-user accept page — reached from the tokenised link
  // in the invite email. Rendered outside AuthProvider/Gate: the invitee has
  // no login yet, and the API endpoints it hits are [AllowAnonymous].
  root.render(
    <React.StrictMode>
      <UserInviteAcceptView token={screenParams.get('token')} />
      <Toaster position="top-right" richColors closeButton theme="dark" />
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <AuthProvider>
        <EventsProvider>
          <Gate />
        </EventsProvider>
      </AuthProvider>
      <Toaster position="top-right" richColors closeButton theme="dark" />
    </React.StrictMode>
  );
}
