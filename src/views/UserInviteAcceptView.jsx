import React, { useEffect, useState } from "react";
import { Icon } from "../components/Icons";
import toast from "../lib/toast";
import {
  getUserInvite,
  acceptUserInvite,
} from "../api/services/userInviteService";

// Standalone, no-login page shown to a user an admin invited, reached from the
// "Set Up My Account" link in their email (?screen=userInvite&token=...).
// Renders outside the auth gate — see main.jsx.
export default function UserInviteAcceptView({ token }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("This invite link is invalid.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    getUserInvite(token)
      .then((res) => {
        if (!cancelled) setInvite(res);
      })
      .catch(() => {
        if (!cancelled) setError("This invite link is invalid or has expired.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) {
      toast.warning("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.warning("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await acceptUserInvite(token, password, confirmPassword);
      setDone(true);
    } catch (err) {
      toast.error(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const goToSignIn = () => {
    window.location.href = window.location.origin;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "var(--bg-1, #0a1c24)",
        fontFamily: "var(--sans, system-ui, sans-serif)",
        color: "var(--ink, #e6f0f3)",
      }}
    >
      <div
        style={{
          width: 440,
          maxWidth: "94vw",
          background: "var(--glass-bg, rgba(10,28,36,0.92))",
          border: "1px solid var(--glass-border, rgba(255,255,255,0.08))",
          borderRadius: 16,
          padding: "32px 30px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {loading && (
          <div
            style={{
              textAlign: "center",
              color: "var(--ink-mute)",
              padding: "30px 0",
            }}
          >
            Loading…
          </div>
        )}

        {!loading && error && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "var(--danger-bg)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px",
              }}
            >
              <Icon name="close" size={22} style={{ color: "var(--danger)" }} />
            </div>
            <div style={{ fontSize: 15, color: "var(--ink-dim)" }}>{error}</div>
          </div>
        )}

        {!loading && !error && invite && (done || invite.alreadyAccepted) ? (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "rgba(90,191,110,0.15)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto 16px",
              }}
            >
              <Icon name="check" size={22} style={{ color: "#5abf6e" }} />
            </div>
            <div style={{ fontSize: 15, marginBottom: 20 }}>
              {done
                ? "Your account is set up. You can now sign in."
                : "This invite has already been accepted — you can sign in."}
            </div>

            {invite?.roleName != "driver" && (
              <button
                onClick={goToSignIn}
                style={{
                  width: "100%",
                  padding: "13px",
                  borderRadius: 10,
                  border: "none",
                  cursor: "pointer",
                  background: "var(--accent, #8d0134)",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                Go to Sign In
              </button>
            )}
          </div>
        ) : (
          !loading &&
          !error &&
          invite && (
            <>
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div
                  style={{
                    fontFamily: "var(--serif, Georgia, serif)",
                    fontSize: 24,
                    fontWeight: 400,
                    margin: "0 0 6px",
                  }}
                >
                  Welcome, {invite.firstName || "there"}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-mute)" }}>
                  {invite.email}
                </div>
                {invite.roleName && (
                  <div
                    style={{
                      display: "inline-block",
                      marginTop: 10,
                      fontSize: 11.5,
                      padding: "3px 10px",
                      borderRadius: 20,
                      background: "rgba(26,174,196,0.10)",
                      color: "var(--accent)",
                      border: "1px solid rgba(26,174,196,0.25)",
                    }}
                  >
                    {invite.roleName}
                  </div>
                )}
              </div>

              <form
                onSubmit={handleSubmit}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10.5,
                      color: "var(--ink-mute)",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      marginBottom: 5,
                    }}
                  >
                    Set a password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoFocus
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      background: "var(--surface-soft-3)",
                      border: "1px solid var(--glass-border)",
                      borderRadius: 10,
                      padding: "11px 13px",
                      color: "var(--ink)",
                      fontSize: 14,
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 10.5,
                      color: "var(--ink-mute)",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      marginBottom: 5,
                    }}
                  >
                    Confirm password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      background: "var(--surface-soft-3)",
                      border: "1px solid var(--glass-border)",
                      borderRadius: 10,
                      padding: "11px 13px",
                      color: "var(--ink)",
                      fontSize: 14,
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: "100%",
                    padding: "13px",
                    borderRadius: 10,
                    border: "none",
                    cursor: "pointer",
                    background: "var(--accent, #8d0134)",
                    color: "#fff",
                    fontSize: 15,
                    fontWeight: 600,
                    opacity: submitting ? 0.6 : 1,
                  }}
                >
                  {submitting ? "Setting up…" : "Activate Account"}
                </button>
              </form>
            </>
          )
        )}
      </div>
    </div>
  );
}
