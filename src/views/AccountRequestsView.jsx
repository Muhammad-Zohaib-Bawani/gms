import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from '../components/Icons';
import { useAuth } from '../auth/AuthContext';
import { listAccountRequests, approveAccountRequest, rejectAccountRequest } from '../api/services/accountRequestService';
import { listRoles } from '../api/services/roleService';
import { toast } from '../lib/toast';
import Select from '../components/ui/Select';

const TABS = ['pending', 'approved', 'rejected'];
const STATUS_COLOR = { pending: '#e0c47e', approved: '#5abf6e', rejected: '#e08a7e' };

export default function AccountRequestsView() {
  const { can, isDemo } = useAuth();
  const canManage = can('AccountRequests.Manage');

  const [tab, setTab] = useState('pending');
  const [rows, setRows] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pick, setPick] = useState({}); // requestId -> roleId

  const reload = useCallback(async () => {
    if (isDemo) { setRows([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const page = await listAccountRequests({ status: tab, pageSize: 100 });
      setRows(page?.items || []);
    } catch (err) {
      setError(err.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [tab, isDemo]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    if (isDemo) return;
    listRoles().then((r) => setRoles(Array.isArray(r) ? r : (r?.items || []))).catch(() => {});
  }, [isDemo]);

  async function approve(id) {
    const row = rows.find((r) => r.id === id);
    const roleId = pick[id] || row?.requestedRoleId || roles[0]?.id;
    if (!roleId) { toast.warning('Pick a role first'); return; }
    try { await approveAccountRequest(id, roleId); toast.success('Account approved'); reload(); }
    catch (err) { toast.error(err.message || 'Approve failed'); }
  }
  async function reject(id) {
    try { await rejectAccountRequest(id, ''); toast.success('Request rejected'); reload(); }
    catch (err) { toast.error(err.message || 'Reject failed'); }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Account Requests</h1>
          <div className="page-sub">Review and approve self-service sign-ups</div>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>Loading…</div>
        ) : error ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#e08a7e', fontSize: 13 }}>
            {error}
            <button className="btn" style={{ display: 'block', margin: '10px auto 0', fontSize: 11 }} onClick={reload}>Retry</button>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--ink-mute)', fontSize: 13 }}>No {tab} requests</div>
        ) : (
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Requested role</th><th>Status</th>{tab === 'pending' && canManage && <th style={{ width: 280 }}>Action</th>}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontSize: 13 }}>{[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td style={{ fontSize: 12.5, fontFamily: 'var(--mono)' }}>{r.email}</td>
                  <td style={{ fontSize: 12 }}>{r.requestedRoleName || <span style={{ color: 'var(--ink-faint)' }}>—</span>}</td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, textTransform: 'capitalize', color: STATUS_COLOR[r.status], background: (STATUS_COLOR[r.status] || '#888') + '18', border: `1px solid ${(STATUS_COLOR[r.status] || '#888')}40` }}>{r.status}</span>
                  </td>
                  {tab === 'pending' && canManage && (
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ minWidth: 160 }}>
                          <Select value={pick[r.id] ?? r.requestedRoleId ?? ''}
                            onChange={(v) => setPick((p) => ({ ...p, [r.id]: v }))}
                            placeholder="Role…"
                            options={roles.map((role) => ({ value: role.id, label: role.name || role.code }))} />
                        </div>
                        <button className="btn primary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => approve(r.id)}>
                          <Icon name="check" size={12} /> Approve
                        </button>
                        <button className="btn" style={{ padding: '4px 10px', fontSize: 11, color: '#e08a7e' }} onClick={() => reject(r.id)}>Reject</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
