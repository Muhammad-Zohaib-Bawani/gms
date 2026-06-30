import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AuthView from './views/AuthView';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { EventsProvider } from './events/EventsContext';
import './style.css';

// Auth gate: a stored session (real sign-in or "Explore demo") shows the app
// shell; otherwise the sign-in page.
function Gate() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <App /> : <AuthView />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <EventsProvider>
        <Gate />
      </EventsProvider>
    </AuthProvider>
    <Toaster position="top-right" richColors closeButton theme="dark" />
  </React.StrictMode>
);
