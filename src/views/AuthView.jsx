// Sign-in. Split layout: a QOC-branded art panel and the form.
//
// The art panel's imagery is CSS-only for now (see .login-art in
// styles/qoc-revamp.css — maroon gradient + the QOC pattern + a skyline
// silhouette). Dropping in a real Doha skyline photo is a one-line change:
// add `backgroundImage` to the .login-art rule.
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../auth/AuthContext';
import * as authApi from '../api/services/authService';
import { toast } from '../lib/toast';
import { Icon } from '../components/Icons';
import { Button, FloatingField } from '../components/ds';

const EyeIcon = ({ off }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {off ? (
      <>
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </>
    ) : (
      <>
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

export default function AuthView() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  async function handleSignIn(e) {
    e.preventDefault();
    // Inline validation states rather than a toast for empty fields — the
    // error belongs next to the offending input.
    const next = {};
    if (!email.trim()) next.email = 'Email is required';
    if (!password) next.password = 'Password is required';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await signIn(email.trim(), password);
      // On success the AuthProvider re-renders the app shell.
    } catch (err) {
      const msg = err.message || 'Sign in failed. Check your credentials.';
      setErrors({ password: msg });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot() {
    if (!email.trim()) {
      setErrors({ email: 'Enter your email first' });
      return;
    }
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
    <div className="login-shell">
      {/* ── Branded art panel ── */}
      <div className="login-art">
        <div className="login-art-logo">
          <img src="/assets/logo.svg" alt="Qatar Olympic Committee" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        >
          <h1 className="login-art-title">Qatar Olympic Committee</h1>
          <div className="login-art-sub">Event Guest Management System</div>
        </motion.div>

        <motion.p
          className="login-art-tag"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.22 }}
        >
          Seamless guest management for successful events - invitations,
          accreditation, travel and seating in one place.
        </motion.p>
      </div>

      {/* ── Form ── */}
      <div className="login-form-side">
        <motion.div
          className="login-card"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="login-heading">Welcome back</h2>
          <p className="login-subheading">Sign in to continue to the system</p>

          <form onSubmit={handleSignIn} noValidate>
            <FloatingField
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: null })); }}
              autoComplete="email"
              error={errors.email}
            />

            <div className="float-field" style={{ marginBottom: 8 }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder=" "
                className={`input${errors.password ? ' error' : ''}`}
                style={{ paddingInlineEnd: 44 }}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors((p) => ({ ...p, password: null })); }}
                autoComplete="current-password"
              />
              <label htmlFor="login-password">Password</label>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute', top: 26, insetInlineEnd: 10, transform: 'translateY(-50%)',
                  display: 'grid', placeItems: 'center', width: 30, height: 30,
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  color: 'var(--ink-mute)',
                }}
              >
                <EyeIcon off={showPassword} />
              </button>
              {errors.password && <div className="field-error">{errors.password}</div>}
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, margin: '4px 0 20px',
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink-dim)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', cursor: 'pointer', width: 15, height: 15 }}
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={handleForgot}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 13, fontWeight: 550, cursor: 'pointer', padding: 0 }}
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={busy}
              style={{ width: '100%' }}
            >
              {busy ? 'Signing in…' : 'Sign In'}
              {!busy && <Icon name="arrow" size={15} />}
            </Button>
          </form>

          <div style={{
            marginTop: 26, paddingTop: 18, borderTop: '1px solid var(--glass-border)',
            fontSize: 12.5, color: 'var(--ink-mute)', textAlign: 'center', lineHeight: 1.6,
          }}>
            Don&apos;t have an account? Ask an administrator to invite you.
          </div>

          <div style={{ fontSize: 11, color: 'var(--ink-faint)', textAlign: 'center', marginTop: 20 }}>
            © {new Date().getFullYear()} Qatar Olympic Committee
          </div>
        </motion.div>
      </div>
    </div>
  );
}
