import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import * as authApi from '../api/services/authService';
import { toast } from '../lib/toast';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

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
      <div className="card glass auth-card" style={{ width: 420, maxWidth: '94vw', padding: 0, overflow: 'hidden' }}>
        {/* Brand header */}
        <div style={{ padding: '26px 28px 20px', borderBottom: '1px solid var(--glass-border)', textAlign: 'center' }}>
          <div style={{ display: 'block', alignItems: 'baseline', }}>
            <img src="/assets/logo.svg" alt='QOC Logo' style={{ width: '90px' }}/>
            <br/>
            <span style={{ fontSize: 10, color: 'var(--ink-mute)', letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              Guest Management System
            </span>
          </div>
          {/* <div style={{ fontSize: 12.5, color: 'var(--ink-dim)', marginTop: 8 }}>
            Sign in to your account
          </div> */}
        </div>

        <form onSubmit={handleSignIn}
          style={{ padding: '20px 28px 26px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" className="auth-input" style={inputStyle} value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@organisation.gov" autoComplete="email" required />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input type={showPassword ? 'text' : 'password'}
                className="auth-input"
                style={{ ...inputStyle, paddingRight: 42 }}
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" autoComplete="current-password" required />
              <button type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', top: '50%', insetInlineEnd: 8, transform: 'translateY(-50%)',
                  display: 'grid', placeItems: 'center', width: 30, height: 30,
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  color: 'var(--ink-mute)',
                }}>
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button type="submit" className="btn primary" disabled={busy}
            style={{ justifyContent: 'center', padding: '11px 0', marginTop: 2, opacity: busy ? 0.7 : 1 }}>
            {busy ? 'Please wait…' : 'Sign In'}
          </button>

          <button type="button" onClick={handleForgot}
            style={{ background: 'none', border: 'none', color: 'var(--ink-mute)', fontSize: 12, cursor: 'pointer', alignSelf: 'center' }}>
            Forgot password?
          </button>

          <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', textAlign: 'center', marginTop: 4 }}>
            Don't have an account? Ask an administrator to invite you.
          </div>
        </form>

        {/* Demo escape hatch */}
        {/* <div style={{ padding: '14px 28px', borderTop: '1px solid var(--glass-border)', textAlign: 'center' }}>
          <button type="button" onClick={enterDemo}
            style={{ background: 'none', border: 'none', color: 'var(--ink-dim)', fontSize: 12.5, cursor: 'pointer' }}>
            Explore the demo without signing in →
          </button>
        </div> */}
      </div>
    </div>
  );
}
