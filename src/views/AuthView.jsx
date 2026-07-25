import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import * as authApi from '../api/services/authService';
import { Icon } from '../components/Icons';
import { toast } from '../lib/toast';
import Select from '../components/ui/Select';

const inputStyle = {
  width: '100%',
  background: 'var(--surface-soft-3)',
  border: '1px solid var(--glass-border)',
  borderRadius: 10,
  padding: '11px 13px',
  color: 'var(--ink)',
  fontSize: 14,
  boxSizing: 'border-box',
};
const labelStyle = {
  display: 'block',
  fontSize: 10.5,
  color: 'var(--ink-mute)',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  marginBottom: 5,
};

export default function AuthView() {
  const { signIn, enterDemo } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [roles, setRoles] = useState([]);
  const [requestedRoleId, setRequestedRoleId] = useState('');
  const [busy, setBusy] = useState(false);
  // Load the roles a person may request (public endpoint) when the tab opens.
  useEffect(() => {
    if (mode !== 'register' || roles.length) return;
    authApi.getRequestableRoles().then((r) => setRoles(Array.isArray(r) ? r : [])).catch(() => {});
  }, [mode, roles.length]);

  async function handleSignIn(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // On success the AuthProvider re-renders the app shell.
    } catch (err) {
      toast.error(err.message || 'Sign in failed. Check your credentials.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!requestedRoleId) { toast.warning('Please choose an account type'); return; }
    setBusy(true);
    try {
      await authApi.requestAccount({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
        requestedRoleId: requestedRoleId || null,
      });
      toast.success('Request submitted. An administrator will review and approve your account.');
      setMode('signin');
      setPassword('');
    } catch (err) {
      toast.error(err.message || 'Could not submit your request.');
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot() {
    if (!email.trim()) { toast.warning('Enter your email first, then click “Forgot password”.'); return; }
    setBusy(true);
    try {
      await authApi.forgotPassword(email.trim());
      toast.info('If that email exists, a password-reset link has been sent.');
    } catch (err) {
      toast.error(err.message || 'Could not send the reset link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20,
      background: 'var(--bg, #06121a)',
    }}>
      <div className="card glass" style={{ width: 420, maxWidth: '94vw', padding: 0, overflow: 'hidden' }}>
        {/* Brand header */}
        <div style={{ padding: '26px 28px 20px', borderBottom: '1px solid var(--glass-border)', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--serif)', fontSize: 30, fontStyle: 'italic', color: 'var(--accent)' }}>GMS</span>
            <span style={{ fontSize: 11, color: 'var(--ink-mute)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              Guest Management
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginTop: 8 }}>
            {mode === 'signin' ? 'Sign in to your account' : 'Request an account'}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '14px 28px 0' }}>
          {[['signin', 'Sign In'], ['register', 'Request account']].map(([k, l]) => (
            <button key={k} onClick={() => { setMode(k);  }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                fontWeight: mode === k ? 600 : 400,
                border: `1px solid ${mode === k ? 'var(--accent)' : 'var(--glass-border)'}`,
                background: mode === k ? 'rgba(141, 1, 52,0.1)' : 'transparent',
                color: mode === k ? 'var(--accent)' : 'var(--ink-mute)',
              }}>
              {l}
            </button>
          ))}
        </div>

        <form onSubmit={mode === 'signin' ? handleSignIn : handleRegister}
          style={{ padding: '20px 28px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {mode === 'register' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>First name</label>
                <input style={inputStyle} value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" />
              </div>
              <div>
                <label style={labelStyle}>Last name</label>
                <input style={inputStyle} value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="family-name" />
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" style={inputStyle} value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@organisation.gov" autoComplete="email" required />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input type="password" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required />
          </div>

          {mode === 'register' && (
            <div>
              <label style={labelStyle}>Requested account type</label>
              <Select value={requestedRoleId} onChange={setRequestedRoleId}
                placeholder="Select a role…"
                options={roles.map(r => ({ value: r.id, label: r.name }))} />
              {requestedRoleId && roles.find(r => r.id === requestedRoleId)?.description && (
                <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 5 }}>
                  {roles.find(r => r.id === requestedRoleId).description}
                </div>
              )}
            </div>
          )}

          <button type="submit" className="btn primary" disabled={busy}
            style={{ justifyContent: 'center', padding: '11px 0', marginTop: 2, opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Request account'}
          </button>

          {mode === 'signin' && (
            <button type="button" onClick={handleForgot}
              style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', fontSize: 12, cursor: 'pointer', alignSelf: 'center' }}>
              Forgot password?
            </button>
          )}
        </form>

        {/* Demo escape hatch */}
        <div style={{ padding: '14px 28px', borderTop: '1px solid var(--glass-border)', textAlign: 'center' }}>
          <button type="button" onClick={enterDemo}
            style={{ background: 'none', border: 'none', color: 'var(--ink-dim)', fontSize: 12.5, cursor: 'pointer' }}>
            Explore the demo without signing in →
          </button>
        </div>
      </div>
    </div>
  );
}
