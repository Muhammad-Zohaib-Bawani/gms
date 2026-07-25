import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../api/apiClient';
import { ENDPOINTS } from '../api/endpoints';
import { deleteUser } from '../api/services/userAccessService';
import { toast } from '../lib/toast';
import DataTable from '../components/ui/DataTable';

// ─── helpers ─────────────────────────────────────────────────────────────────

const DEMO_USERS = [
  { id: '1', firstName: 'System', lastName: 'Administrator', email: 'admin@gms.local',  roleName: 'Administrator', isActive: true,  createdAt: '2026-01-01' },
  { id: '2', firstName: 'Sara',   lastName: 'Ali',           email: 'sara@gms.local',   roleName: 'Event Manager', isActive: true,  createdAt: '2026-05-10' },
  { id: '3', firstName: 'Khalid', lastName: 'Hassan',        email: 'khalid@gms.local', roleName: 'Guest Relations Manager', isActive: true, createdAt: '2026-05-15' },
  { id: '4', firstName: 'Noor',   lastName: 'Ahmed',         email: 'noor@gms.local',   roleName: 'Venue Manager', isActive: false, createdAt: '2026-06-01' },
];

function initials(u) {
  return [u.firstName?.[0], u.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';
}

function formatDate(val) {
  if (!val) return '—';
  const d = new Date(val);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── DeleteModal ─────────────────────────────────────────────────────────────

function DeleteModal({ user, onConfirm, onCancel, busy }) {
  if (!user) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="card glass" style={{ width: 400, maxWidth: '94vw', padding: '28px 28px 24px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
          Delete user?
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', lineHeight: 1.6, marginBottom: 22 }}>
          This will permanently delete{' '}
          <strong style={{ color: 'var(--ink)' }}>
            {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
          </strong>{' '}
          ({user.email}). This action cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancel} disabled={busy}
            style={{ padding: '8px 18px', fontSize: 13 }}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={onConfirm}
            disabled={busy}
            style={{
              padding: '8px 18px', fontSize: 13, opacity: busy ? 0.7 : 1,
              background: 'rgba(224,138,126,0.14)', color: '#e08a7e',
              border: '1px solid rgba(224,138,126,0.35)',
            }}>
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── UsersView ────────────────────────────────────────────────────────────────

const col = createColumnHelper();

export default function UsersView() {
  const { user: me, can, isDemo } = useAuth();

  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [toDelete, setToDelete]   = useState(null);
  const [deleting, setDeleting]   = useState(false);

  const load = useCallback(async () => {
    if (isDemo) { setUsers(DEMO_USERS); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await apiClient.get(ENDPOINTS.users.base, { params: { pageSize: 500 } });
      setUsers(res?.items ?? res ?? []);
    } catch (err) {
      toast.error(err.message || 'Could not load users');
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    if (!toDelete) return;
    if (isDemo) { toast.success('User deleted (demo)'); setToDelete(null); return; }
    setDeleting(true);
    try {
      await deleteUser(toDelete.id);
      toast.success(`${toDelete.firstName || toDelete.email} deleted`);
      setToDelete(null);
      await load();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  const canDelete = can('Users.Delete');

  const columns = useMemo(() => [
    col.display({
      id: 'avatar',
      size: 48,
      enableSorting: false,
      header: '',
      cell: ({ row: { original: u } }) => (
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: 'var(--surface-soft-3)', color: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 600, flexShrink: 0,
        }}>
          {initials(u)}
        </div>
      ),
    }),

    col.accessor(u => `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(), {
      id: 'name',
      header: 'Name',
      cell: ({ row: { original: u }, getValue }) => (
        <div>
          <div style={{ fontWeight: 500 }}>{getValue() || '—'}</div>
          <div style={{ fontSize: 11.5, color: 'var(--ink-mute)', marginTop: 1, fontFamily: 'var(--mono)' }}>
            {u.email}
          </div>
        </div>
      ),
    }),

    col.accessor('roleName', {
      header: 'Role',
      cell: ({ getValue }) => {
        const role = getValue();
        return role ? (
          <span style={{
            fontSize: 11.5, padding: '3px 10px', borderRadius: 20,
            background: 'rgba(141, 1, 52,0.10)', color: 'var(--accent)',
            border: '1px solid rgba(141, 1, 52,0.25)', whiteSpace: 'nowrap',
          }}>{role}</span>
        ) : <span style={{ color: 'var(--ink-faint)' }}>—</span>;
      },
    }),

    col.accessor('isActive', {
      header: 'Status',
      size: 100,
      cell: ({ getValue }) => {
        const active = getValue();
        return (
          <span style={{
            fontSize: 11.5, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
            background: active ? 'rgba(90,191,110,0.12)' : 'rgba(180,180,180,0.10)',
            color: active ? '#5abf6e' : 'var(--ink-mute)',
            border: `1px solid ${active ? 'rgba(90,191,110,0.3)' : 'rgba(180,180,180,0.2)'}`,
          }}>
            {active ? 'Active' : 'Inactive'}
          </span>
        );
      },
    }),

    col.accessor('createdAt', {
      header: 'Joined',
      size: 120,
      cell: ({ getValue }) => (
        <span style={{ color: 'var(--ink-mute)', fontSize: 12 }}>{formatDate(getValue())}</span>
      ),
    }),

    // Actions column — only rendered when user has delete permission
    ...(canDelete ? [
      col.display({
        id: 'actions',
        size: 60,
        enableSorting: false,
        header: '',
        cell: ({ row: { original: u } }) => {
          const isSelf    = u.id === me?.id;
          const isAdmin   = u.roleName?.toLowerCase() === 'administrator';
          const disabled  = isSelf || isAdmin;
          const title     = isSelf   ? 'Cannot delete yourself'
                          : isAdmin  ? 'Cannot delete the admin account'
                          : 'Delete user';
          return (
            <button
              disabled={disabled}
              onClick={e => { e.stopPropagation(); setToDelete(u); }}
              title={title}
              style={{
                background: 'none', border: '1px solid transparent', borderRadius: 6,
                padding: '5px 8px', cursor: disabled ? 'not-allowed' : 'pointer',
                color: disabled ? 'var(--ink-faint)' : '#e08a7e',
                opacity: disabled ? 0.35 : 1,
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'rgba(224,138,126,0.10)'; e.currentTarget.style.borderColor = 'rgba(224,138,126,0.3)'; }}}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
                <polyline points="2,4 14,4" /><path d="M5,4V2h6v2"/><path d="M3,4l1,10h8l1-10"/>
                <line x1="6" y1="7" x2="6" y2="11"/><line x1="10" y1="7" x2="10" y2="11"/>
              </svg>
            </button>
          );
        },
      }),
    ] : []),
  ], [canDelete, me?.id]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <div className="page-sub">
            {loading ? 'Loading…' : `${users.length} account${users.length !== 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <DataTable
          columns={columns}
          data={users}
          loading={loading}
          searchPlaceholder="Search by name, email or role…"
          emptyText="No users found"
          pageSize={15}
        />
      </div>

      <DeleteModal
        user={toDelete}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        busy={deleting}
      />
    </>
  );
}
