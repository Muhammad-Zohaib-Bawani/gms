import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Icons';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../api/apiClient';
import { ENDPOINTS } from '../api/endpoints';
import { getUserModuleAccess, setUserModuleAccess } from '../api/services/userAccessService';
import { toast } from '../lib/toast';

// ─── helpers ─────────────────────────────────────────────────────────────────

// Role codes (Core/Constants/Roles.cs) whose users never sign into this portal,
// so they're excluded from the access list entirely.
const NON_PORTAL_ROLES = ['guest', 'driver'];

const DEMO_USERS = [
  { id: '1', firstName: 'Sara',  lastName: 'Ali',    email: 'sara@gms.local',  roleName: 'Event Manager' },
  { id: '2', firstName: 'Khalid',lastName: 'Hassan', email: 'khalid@gms.local',roleName: 'Delegate Relations Manager' },
  { id: '3', firstName: 'Noor',  lastName: 'Ahmed',  email: 'noor@gms.local',  roleName: 'Venue Manager' },
];

const DEMO_MODULES = [
  { slug: 'events',        displayName: 'Events',            isNative: true,  isGranted: false },
  { slug: 'guests',        displayName: 'Delegates',            isNative: false, isGranted: true  },
  { slug: 'invitations',   displayName: 'Invitations',       isNative: false, isGranted: false },
  { slug: 'travel',        displayName: 'Services',isNative: false, isGranted: false },
  { slug: 'accreditation', displayName: 'Accreditation',     isNative: false, isGranted: false },
  { slug: 'venue',         displayName: 'Venue Config',      isNative: false, isGranted: false },
  { slug: 'seating',       displayName: 'Seating',           isNative: false, isGranted: false },
  { slug: 'meetings',      displayName: 'Meetings',          isNative: false, isGranted: false },
  { slug: 'protocol',      displayName: 'Protocol',          isNative: false, isGranted: false },
  { slug: 'financials',    displayName: 'Financials',        isNative: false, isGranted: false },
  { slug: 'reports',       displayName: 'Reports',           isNative: false, isGranted: false },
  { slug: 'dashboard',     displayName: 'Dashboard',         isNative: true,  isGranted: false },
];

// ─── sub-components ───────────────────────────────────────────────────────────

function UserRow({ user, selected, onClick }) {
  const initials = [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        background: selected ? 'hsl(var(--brand-hsl) / 0.10)' : 'transparent',
        border: selected ? '1px solid hsl(var(--brand-hsl) / 0.35)' : '1px solid transparent',
        borderRadius: 8, cursor: 'pointer', width: '100%', textAlign: 'left',
        transition: 'background 0.15s',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: selected ? 'hsl(var(--brand-hsl) / 0.22)' : 'var(--surface-soft-3)',
        color: selected ? 'var(--accent)' : 'var(--ink-mute)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 600,
      }}>
        {initials}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-mute)', marginTop: 1 }}>{user.roleName || user.role?.name || '—'}</div>
      </div>
    </button>
  );
}

function ModuleToggle({ mod, onChange }) {
  const active = mod.isNative || mod.isGranted;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderRadius: 8,
      background: active ? 'hsl(var(--brand-hsl) / 0.06)' : 'var(--surface-soft)',
      border: `1px solid ${active ? 'hsl(var(--brand-hsl) / 0.25)' : 'var(--glass-border)'}`,
      opacity: mod.isNative ? 0.72 : 1,
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{mod.displayName}</div>
        {mod.isNative && (
          <div style={{ fontSize: 10.5, color: 'var(--accent)', marginTop: 1 }}>Included by role</div>
        )}
      </div>

      {mod.isNative ? (
        <span style={{
          fontSize: 10.5, padding: '2px 8px', borderRadius: 20,
          background: 'hsl(var(--brand-hsl) / 0.14)', color: 'var(--accent)',
          border: '1px solid hsl(var(--brand-hsl) / 0.3)',
        }}>Native</span>
      ) : (
        <button
          onClick={() => onChange(!mod.isGranted)}
          style={{
            width: 42, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
            background: mod.isGranted ? 'var(--accent)' : 'var(--surface-soft-3)',
            position: 'relative', transition: 'background 0.2s', flexShrink: 0,
          }}
          title={mod.isGranted ? 'Revoke access' : 'Grant access'}
        >
          <div style={{
            position: 'absolute', top: 3, left: mod.isGranted ? 23 : 3,
            width: 16, height: 16, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
          }} />
        </button>
      )}
    </div>
  );
}

// ─── main view ────────────────────────────────────────────────────────────────

export default function UserAccessView() {
  const { isDemo } = useAuth();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [modules, setModules] = useState([]); // ModuleAccessItem[]
  const [loadingModules, setLoadingModules] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load user list
  useEffect(() => {
    if (isDemo) { setUsers(DEMO_USERS); setLoadingUsers(false); return; }
    setLoadingUsers(true);
    apiClient.get(ENDPOINTS.users.base, { params: { pageSize: 200 } })
      .then(r => setUsers(r?.items || r || []))
      .catch(() => toast.error('Could not load users'))
      .finally(() => setLoadingUsers(false));
  }, [isDemo]);

  // Load module access when user is selected
  const loadAccess = useCallback(async (user) => {
    setSelectedUser(user);
    setModules([]);
    if (isDemo) { setModules(DEMO_MODULES.map(m => ({ ...m }))); return; }
    setLoadingModules(true);
    try {
      const data = await getUserModuleAccess(user.id);
      setModules(data?.modules || []);
    } catch {
      toast.error('Could not load module access');
    } finally {
      setLoadingModules(false);
    }
  }, [isDemo]);

  function toggleModule(slug, value) {
    setModules(prev => prev.map(m => m.slug === slug ? { ...m, isGranted: value } : m));
  }

  async function save() {
    if (!selectedUser) return;
    if (isDemo) { toast.success('Access updated (demo)'); return; }
    setSaving(true);
    try {
      const grantedModules = modules.filter(m => !m.isNative && m.isGranted).map(m => m.slug);
      const updated = await setUserModuleAccess(selectedUser.id, grantedModules);
      setModules(updated?.modules || modules);
      toast.success(`Access updated for ${selectedUser.firstName || selectedUser.email}`);
    } catch (err) {
      toast.error(err.message || 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  const filteredUsers = users.filter(u => {
    // Guests and drivers have no portal access at all (their roles are
    // PortalAccess=false — guests sign in via VIP-app OTP, drivers via the
    // driver app), so granting them cross-module portal access is meaningless.
    // Matched on the role CODE, which is stable, rather than the display name.
    const roleCode = (u.role || '').toLowerCase();
    if (NON_PORTAL_ROLES.includes(roleCode)) return false;

    const q = search.toLowerCase();
    return !q
      || u.email?.toLowerCase().includes(q)
      || u.firstName?.toLowerCase().includes(q)
      || u.lastName?.toLowerCase().includes(q)
      || u.roleName?.toLowerCase().includes(q)
      || u.role?.name?.toLowerCase().includes(q);
  });

  const grantedCount = modules.filter(m => !m.isNative && m.isGranted).length;
  const nativeCount  = modules.filter(m => m.isNative).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Access</h1>
          <div className="page-sub">Grant read-only visibility to extra modules per user</div>
        </div>
      </div>

      {/* `split-pane` collapses this to one column below 768px — a fixed 280px
          first column left the detail pane ~50px wide on a phone. */}
      <div className="split-pane" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Left: user list ── */}
        <div className="card" style={{ padding: 12 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users…"
            style={{
              width: '100%', boxSizing: 'border-box', marginBottom: 10,
              background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
              borderRadius: 8, padding: '7px 10px', color: 'var(--ink)', fontSize: 13,
            }}
          />

          {loadingUsers ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>Loading…</div>
          ) : filteredUsers.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>No users found</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredUsers.map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  selected={selectedUser?.id === u.id}
                  onClick={() => loadAccess(u)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right: module toggles ── */}
        <div>
          {!selectedUser ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
              <div style={{ color: 'var(--ink-mute)', fontSize: 14 }}>Select a user to manage their module access</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 20 }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>
                    {[selectedUser.firstName, selectedUser.lastName].filter(Boolean).join(' ') || selectedUser.email}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>
                    {selectedUser.roleName || selectedUser.role?.name} · {selectedUser.email}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {modules.length > 0 && (
                    <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>
                      {nativeCount} native · {grantedCount} extra granted
                    </span>
                  )}
                  <button
                    className="btn primary"
                    disabled={saving || loadingModules}
                    onClick={save}
                    style={{ padding: '7px 18px', fontSize: 13, opacity: saving ? 0.7 : 1 }}
                  >
                    {saving ? 'Saving…' : 'Save Access'}
                  </button>
                </div>
              </div>

              {/* Info banner */}
              <div style={{
                marginBottom: 16, padding: '9px 13px', borderRadius: 8,
                background: 'hsl(var(--brand-hsl) / 0.06)', border: '1px solid hsl(var(--brand-hsl) / 0.2)',
                fontSize: 12, color: 'var(--ink-mute)', lineHeight: 1.5,
              }}>
                <strong style={{ color: 'var(--accent)' }}>Read-only grants</strong> — toggling a module on gives this
                user <em>view access only</em> to that module. Action buttons (create, edit, delete) stay hidden.
                Modules marked <strong>Native</strong> are already part of the user's role and cannot be removed here.
              </div>

              {loadingModules ? (
                <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>Loading modules…</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                  {modules.map(mod => (
                    <ModuleToggle
                      key={mod.slug}
                      mod={mod}
                      onChange={v => toggleModule(mod.slug, v)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
