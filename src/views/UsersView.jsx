import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useAuth } from '../auth/AuthContext';
import { apiClient } from '../api/apiClient';
import { ENDPOINTS } from '../api/endpoints';
import { deleteUser, inviteUser, resendInvite, adminSetPassword, updateUser, getPendingUsers } from '../api/services/userAccessService';
import { listRoles } from '../api/services/roleService';
import { getNationalities } from '../api/services/nationalityService';
import { getDriverTypes } from '../api/services/lookupService';
import { getVehicles } from '../api/services/vehicleService';
import { uploadImageFileAnon, stripSasToken } from '../api/services/uploadService';
import { toast } from '../lib/toast';
import { fmtDate } from '../lib/date';
import DataTable from '../components/ui/DataTable';
import ActionMenu from '../components/ui/ActionMenu';
import Select from '../components/ui/Select';
import { nationalityOptionLabel } from '../components/FlagIcon';
import DateField from '../components/ui/DateField';
import { Icon } from '../components/Icons';
// Country-code picker + validation (libphonenumber-js under the hood).
import PhoneInput, { isValidPhoneNumber, parsePhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { toCsv, downloadCsv } from '../lib/csvExport';

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

// Portal-wide DD-MM-YYYY — see lib/date.
const formatDate = (val) => fmtDate(val);

const inputStyle = {
  width: '100%', background: 'var(--surface-soft-3)', border: '1px solid var(--glass-border)',
  borderRadius: 8, padding: '9px 12px', color: 'var(--ink)', fontSize: 13, boxSizing: 'border-box',
};
const labelStyle = {
  display: 'block', fontSize: 10.5, color: 'var(--ink-mute)', textTransform: 'uppercase',
  letterSpacing: '0.12em', marginBottom: 5,
};

function ModalShell({ title, subtitle, onClose, children, width = 460 }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="card glass modal-solid" style={{ width, maxWidth: '94vw', maxHeight: '88vh', padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
            {subtitle && <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 3 }}>{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" size={14} /></button>
        </div>
        <div style={{ padding: '20px 24px', overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  );
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
      <div className="card glass modal-solid" style={{ width: 400, maxWidth: '94vw', padding: '28px 28px 24px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
          Delete user?
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-mute)', lineHeight: 1.6, marginBottom: 22 }}>
This will permanently delete{' '}
          <strong style={{ color: 'var(--ink)' }}>
            {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}
          </strong>{' '}
          {user.email}. This action cannot be undone.
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
              background: 'var(--danger-bg)', color: 'var(--danger)',
              border: '1px solid var(--danger-border)',
            }}>
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── InviteUserModal ─────────────────────────────────────────────────────────

// Stored as "+971 501234567" — one column, but the space lets the backend hand
// the driver app the dial code and the national number as separate fields.
function splitPhone(e164) {
  if (!e164) return null;
  const parsed = parsePhoneNumber(e164);
  return parsed ? `+${parsed.countryCallingCode} ${parsed.nationalNumber}` : e164;
}

const EMPTY_INVITE = {
  firstName: '', lastName: '', email: '', phone: '', roleId: '',
  driverType: '', driverLicenseNumber: '', driverLicenseExpiry: '',
  driverNationalityId: '', driverPhotoUrl: '', assignedVehicleId: '',
};

// Enum values from the backend (DriverType.cs / VehicleUsageType.cs). An open
// driver roams, so they keep one fixed car of their own; a fixed driver is tied to
// a guest and draws an open pool car per trip, so no car is stored for them here.
const DRIVER_TYPE_OPEN = 2;
const VEHICLE_USAGE_FIXED = 1;

function InviteUserModal({ open, onClose, roles, nationalities, driverTypes, activeEventId, onInvited }) {
  const [form, setForm] = useState(EMPTY_INVITE);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);

  useEffect(() => { if (open) setForm(EMPTY_INVITE); }, [open]);

  const isOpenDriver = Number(form.driverType) === DRIVER_TYPE_OPEN;

  // Only fixed cars nobody else holds can be handed to an open driver, and the
  // server enforces the same rule — this just keeps an impossible pick off the list.
  // Scoped to the active event, so the cars offered are the ones this event's fleet
  // providers supply (plus in-house cars, which belong to no provider and serve every
  // event — the same ForEvent rule the fleet screens use).
  useEffect(() => {
    if (!open || !isOpenDriver) { setVehicles([]); return; }
    let cancelled = false;
    setVehiclesLoading(true);
    getVehicles(activeEventId, { usageType: VEHICLE_USAGE_FIXED, unassigned: true })
      .then((r) => { if (!cancelled) setVehicles(Array.isArray(r) ? r : []); })
      .catch(() => { if (!cancelled) setVehicles([]); })
      .finally(() => { if (!cancelled) setVehiclesLoading(false); });
    return () => { cancelled = true; };
  }, [open, isOpenDriver, activeEventId]);

  if (!open) return null;

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const selectedRole = roles.find((r) => r.id === form.roleId);
  const isDriver = selectedRole?.code === 'driver';

  const roleOpts = roles.map((r) => ({ value: r.id, label: r.name }));
  const nationalityOpts = nationalities.map((n) => ({ value: n.id, label: n.name, code: n.code }));
  const driverTypeOpts = driverTypes.map((d) => ({ value: d.value, label: d.name }));

  // Upload happens immediately on pick; only the resulting URL is sent with the
  // invite. Anonymous upload — the image endpoint takes no token.
  async function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoUploading(true);
    try {
      const url = await uploadImageFileAnon(file);
      if (!url) throw new Error('Upload returned no URL');
      setF('driverPhotoUrl', url);
    } catch (err) {
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setPhotoUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.roleId) {
      toast.warning('First name, last name, email and role are required');
      return;
    }
    if (isDriver && (!form.driverLicenseNumber.trim() || !form.driverType)) {
      toast.warning('License number and driver type are required for a driver');
      return;
    }
    if (isDriver && isOpenDriver && !form.assignedVehicleId) {
      toast.warning('An open driver needs a fixed vehicle assigned');
      return;
    }
    if (form.phone && !isValidPhoneNumber(form.phone)) {
      toast.warning('Enter a valid phone number for the selected country');
      return;
    }
    setSaving(true);
    try {
      const created = await inviteUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: splitPhone(form.phone),
        roleId: form.roleId,
        // Driver fields go in a nested object; omitted entirely for other roles.
        ...(isDriver ? {
          driverProfile: {
            driverType: Number(form.driverType),
            // Only sent for an open driver — the server rejects it on a fixed one.
            assignedVehicleId: isOpenDriver ? form.assignedVehicleId : null,
            licenseNumber: form.driverLicenseNumber.trim(),
            licenseExpiry: form.driverLicenseExpiry || null,
            nationalityId: form.driverNationalityId || null,
            photoUrl: stripSasToken(form.driverPhotoUrl.trim()) || null,
          },
        } : {}),
      });
      if (created?.inviteEmailSent === false) {
        // Includes the provider's own reason (quota, rejected recipient, …) —
        // without it "no email arrived" gives the admin nothing to act on.
        toast.warning(
          `User created, but the invite email to ${form.email.trim()} could not be sent — use Resend Invite to try again.`
          + (created.inviteEmailError ? ` ${created.inviteEmailError}` : ''),
        );
      } else {
        toast.success(`Invite sent to ${form.email.trim()}`);
      }
      onInvited?.();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Could not send the invite');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Invite User" subtitle="They'll get an email to set their password and sign in" onClose={onClose} width={520}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>First name *</label>
            <input style={inputStyle} value={form.firstName} onChange={(e) => setF('firstName', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Last name *</label>
            <input style={inputStyle} value={form.lastName} onChange={(e) => setF('lastName', e.target.value)} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Email *</label>
          <input type="email" style={inputStyle} value={form.email} onChange={(e) => setF('email', e.target.value)} placeholder="name@organisation.gov" />
        </div>
        <div>
          <label style={labelStyle}>Phone</label>
          <PhoneInput
            international
            defaultCountry="SA"
            value={form.phone}
            onChange={(v) => setF('phone', v || '')}
            style={{ ...inputStyle, display: 'flex', gap: 8, padding: '4px 10px' }}
            numberInputProps={{ style: { background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 13, width: '100%' } }}
          />
        </div>
        <div>
          <label style={labelStyle}>Role *</label>
          <Select value={form.roleId} onChange={(v) => setF('roleId', v)} options={roleOpts} placeholder="— Select —" />
        </div>

        {isDriver && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px', borderRadius: 10, border: '1px dashed var(--glass-border)', background: 'var(--surface-soft-2)' }}>
            <div style={{ fontSize: 11, color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Driver details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Driver type *</label>
                <Select value={form.driverType} onChange={(v) => setF('driverType', v)} options={driverTypeOpts} placeholder="— Select —" />
              </div>
              {isOpenDriver && (
                <div>
                  <label style={labelStyle}>Vehicle *</label>
                  <Select
                    value={form.assignedVehicleId}
                    onChange={(v) => setF('assignedVehicleId', v || '')}
                    options={vehicles.map((v) => ({
                      value: v.id,
                      label: [v.vehicleNumber, v.vehicleModel].filter(Boolean).join(' · '),
                    }))}
                    placeholder={vehiclesLoading ? 'Loading…' : '— Select —'}
                    isDisabled={vehiclesLoading}
                  />
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>
                    {vehiclesLoading || vehicles.length
                      ? "Fixed vehicles from this event's fleet, not already assigned to a driver"
                      : 'No free fixed vehicle for this event — mark one as Fixed under Fleet first'}
                  </div>
                </div>
              )}
              <div>
                <label style={labelStyle}>Nationality</label>
                <Select value={form.driverNationalityId} onChange={(v) => setF('driverNationalityId', v)} options={nationalityOpts} formatOptionLabel={nationalityOptionLabel} placeholder="— Select —" isClearable />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>License number *</label>
                <input style={inputStyle} value={form.driverLicenseNumber} onChange={(e) => setF('driverLicenseNumber', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>License expiry</label>
                <DateField value={form.driverLicenseExpiry} onChange={(v) => setF('driverLicenseExpiry', v || '')} clearable />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Photo</label>
              {/* Same single-field dropzone as the vehicle image: the whole block
                  is the label, so a click anywhere opens the picker. */}
              <label style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%', boxSizing: 'border-box', padding: 10,
                background: 'var(--surface-soft-3)', borderRadius: 10,
                border: `1px ${form.driverPhotoUrl ? 'solid' : 'dashed'} var(--glass-border)`,
                cursor: photoUploading ? 'default' : 'pointer', opacity: photoUploading ? 0.6 : 1,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                  background: 'var(--surface-soft-2)', display: 'grid', placeItems: 'center',
                }}>
                  {form.driverPhotoUrl
                    ? <img src={form.driverPhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Icon name="image" size={18} style={{ color: 'var(--ink-faint)' }} />}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="upload" size={13} style={{ color: 'var(--ink-mute)' }} />
                    {photoUploading
                      ? 'Uploading…'
                      : form.driverPhotoUrl ? 'Click to change photo' : 'Click to upload driver photo'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>Optional — PNG or JPG</div>
                </div>

                {form.driverPhotoUrl && !photoUploading && (
                  <button
                    type="button" className="icon-btn" title="Remove"
                    // Inside a label, so stop the click from re-opening the picker.
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setF('driverPhotoUrl', ''); }}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                )}

                <input type="file" accept="image/*" onChange={handlePhotoSelect} disabled={photoUploading} style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? 'Sending…' : 'Send Invite'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── EditUserModal ───────────────────────────────────────────────────────────

// Only what PUT /v1/users/{id} accepts. Email stays read-only (sign-in identity),
// and driver details are set at invite time — not editable here yet.
function EditUserModal({ user, roles, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) { setForm(null); return; }
    // roleId is the reliable source; fall back to matching the role's name or
    // code so the dropdown still preselects if the list response omits the id.
    const matched = roles.find((r) => r.id === user.roleId)
      || roles.find((r) => r.name === user.roleName)
      || roles.find((r) => r.code && r.code === user.role);
    setForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      // Stored as "+971 501234567"; PhoneInput wants bare E.164.
      phone: (user.phone || '').replace(/\s+/g, ''),
      roleId: matched?.id || '',
      isActive: user.isActive !== false,
    });
  }, [user, roles]);

  if (!user || !form) return null;

  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const roleOpts = roles.map((r) => ({ value: r.id, label: r.name }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.warning('First and last name are required');
      return;
    }
    if (form.phone && !isValidPhoneNumber(form.phone)) {
      toast.warning('Enter a valid phone number for the selected country');
      return;
    }
    setSaving(true);
    try {
      await updateUser(user.id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: splitPhone(form.phone),
        roleId: form.roleId || null,
        isActive: form.isActive,
      });
      toast.success('User updated');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Could not update the user');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Edit User" subtitle={user.email} onClose={onClose} width={520}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={labelStyle}>First name *</label>
            <input style={inputStyle} value={form.firstName} onChange={(e) => setF('firstName', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Last name *</label>
            <input style={inputStyle} value={form.lastName} onChange={(e) => setF('lastName', e.target.value)} />
          </div>
        </div>
        <div>
          <label style={labelStyle}>Email</label>
          <input style={{ ...inputStyle, opacity: 0.6 }} value={user.email || ''} readOnly disabled />
        </div>
        <div>
          <label style={labelStyle}>Phone</label>
          <PhoneInput
            international
            defaultCountry="SA"
            value={form.phone}
            onChange={(v) => setF('phone', v || '')}
            style={{ ...inputStyle, display: 'flex', gap: 8, padding: '4px 10px' }}
            numberInputProps={{ style: { background: 'transparent', border: 'none', outline: 'none', color: 'var(--ink)', fontSize: 13, width: '100%' } }}
          />
        </div>
        <div>
          <label style={labelStyle}>Role</label>
          <Select value={form.roleId} onChange={(v) => setF('roleId', v)} options={roleOpts} placeholder="— Select —" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => setF('isActive', e.target.checked)} />
          Active — an inactive account cannot sign in
        </label>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── SetPasswordModal ────────────────────────────────────────────────────────

function SetPasswordModal({ user, onClose, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) { setPassword(''); setConfirm(''); } }, [user]);

  if (!user) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 8) { toast.warning('Password must be at least 8 characters'); return; }
    if (password !== confirm) { toast.warning('Passwords do not match'); return; }
    setSaving(true);
    try {
      await adminSetPassword(user.id, password);
      toast.success(`Password updated for ${user.firstName || user.email}`);
      onDone?.();
    } catch (err) {
      toast.error(err.message || 'Could not update the password');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Set Password" subtitle={`For ${[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email}`} onClose={onClose} width={400}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={labelStyle}>New password</label>
          <input type="password" style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoFocus />
        </div>
        <div>
          <label style={labelStyle}>Confirm password</label>
          <input type="password" style={inputStyle} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving…' : 'Set Password'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── UsersView ────────────────────────────────────────────────────────────────

const col = createColumnHelper();
const TABS = ['all', 'pending'];

// activeEventId comes from the router outlet context — the driver invite form uses
// it to offer only the vehicles this event's fleet providers supply.
export default function UsersView({ activeEventId }) {
  const { user: me, can, isDemo } = useAuth();

  // The page's own rows — one server page at a time, not the whole table.
  // Which endpoint fills it depends on the active tab: /users for All,
  // /users/pending for Pending (a genuinely different query server-side, not
  // a client-side filter over the same list).
  const [rows, setRows]           = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize]   = useState(10);
  const [search, setSearch]       = useState('');
  // Just for the "Pending (N)" tab label/page-sub — independent of whichever
  // tab/page is currently loaded.
  const [pendingCount, setPendingCount] = useState(0);
  const [roles, setRoles]         = useState([]);
  const [nationalities, setNationalities] = useState([]);
  const [driverTypes, setDriverTypes] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('all');
  const [toDelete, setToDelete]   = useState(null);
  const [deleting, setDeleting]   = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [resendingId, setResendingId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const canCreate = can('Users.Create');
  const canUpdate = can('Users.Update');
  const canDelete = can('Users.Delete');

  const load = useCallback(async () => {
    if (isDemo) {
      setRows(tab === 'pending' ? [] : DEMO_USERS);
      setTotalRows(tab === 'pending' ? 0 : DEMO_USERS.length);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (tab === 'pending') {
        const res = await getPendingUsers({ pageNumber: pageIndex + 1, pageSize, search });
        setRows((res?.items ?? []).map((u) => ({ ...u, isPending: true })));
        setTotalRows(res?.totalCount ?? 0);
      } else {
        const res = await apiClient.get(ENDPOINTS.users.base, {
          params: { pageNumber: pageIndex + 1, pageSize, search: search || undefined },
        });
        setRows(res?.items ?? []);
        setTotalRows(res?.totalCount ?? 0);
      }
    } catch (err) {
      toast.error(err.message || 'Could not load users');
    } finally {
      setLoading(false);
    }
  }, [isDemo, tab, pageIndex, pageSize, search]);

  useEffect(() => { load(); }, [load]);
  // Switching tabs or searching starts over from page 1 — staying on, say,
  // page 3 of "All" and flipping to "Pending" would otherwise ask the server
  // for a page that likely doesn't exist for the new list.
  useEffect(() => { setPageIndex(0); }, [tab, search]);

  const loadPendingCount = useCallback(async () => {
    if (isDemo) { setPendingCount(0); return; }
    try {
      const res = await getPendingUsers({ pageNumber: 1, pageSize: 1 });
      setPendingCount(res?.totalCount ?? 0);
    } catch { /* cosmetic badge only */ }
  }, [isDemo]);
  useEffect(() => { loadPendingCount(); }, [loadPendingCount]);

  useEffect(() => {
    // Roles feed both the invite form and the edit form.
    if (isDemo || !(canCreate || canUpdate)) return;
    listRoles().then((r) => setRoles(Array.isArray(r) ? r : (r?.items || []))).catch(() => {});
    getNationalities().then((r) => setNationalities(Array.isArray(r) ? r : [])).catch(() => {});
    getDriverTypes().then((r) => setDriverTypes(Array.isArray(r) ? r : [])).catch(() => {});
  }, [isDemo, canCreate, canUpdate]);

  async function handleDelete() {
    if (!toDelete) return;
    if (isDemo) { toast.success('User deleted (demo)'); setToDelete(null); return; }
    setDeleting(true);
    try {
      await deleteUser(toDelete.id);
      toast.success(`${toDelete.firstName || toDelete.email} deleted`);
      setToDelete(null);
      await load();
      loadPendingCount();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  async function handleResend(u) {
    setResendingId(u.id);
    try {
      await resendInvite(u.id);
      toast.success(`Invite resent to ${u.email}`);
    } catch (err) {
      toast.error(err.message || 'Could not resend the invite');
    } finally {
      setResendingId(null);
    }
  }

  function handleInvited() {
    load();
    loadPendingCount();
  }

  async function handleExport() {
    setExporting(true);
    try {
      let all = rows;
      if (!isDemo) {
        if (tab === 'pending') {
          const res = await getPendingUsers({ pageNumber: 1, pageSize: Math.max(totalRows, 1), search });
          all = (res?.items ?? []).map((u) => ({ ...u, isPending: true }));
        } else {
          const res = await apiClient.get(ENDPOINTS.users.base, {
            params: { pageNumber: 1, pageSize: Math.max(totalRows, 1), search: search || undefined },
          });
          all = res?.items ?? [];
        }
      }
      const headers = ['First Name', 'Last Name', 'Email', 'Role', 'Status', 'Joined', 'Driver License Number'];
      const csvRows = all.map((u) => [
        u.firstName, u.lastName, u.email, u.roleName,
        u.isPending ? 'Pending' : (u.isActive ? 'Active' : 'Inactive'),
        formatDate(u.createdAt), u.driverProfile?.licenseNumber || '',
      ]);
      downloadCsv(`users-${tab}.csv`, toCsv(headers, csvRows));
    } catch (err) {
      toast.error(err.message || 'Could not export users');
    } finally {
      setExporting(false);
    }
  }

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
      cell: ({ row: { original: u }, getValue }) => {
        const role = getValue();
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {role ? (
              <span style={{
                fontSize: 11.5, padding: '3px 10px', borderRadius: 20, width: 'fit-content',
                background: 'rgba(26,174,196,0.10)', color: 'var(--accent)',
                border: '1px solid rgba(26,174,196,0.25)', whiteSpace: 'nowrap',
              }}>{role}</span>
            ) : <span style={{ color: 'var(--ink-faint)' }}>—</span>}
            {u.driverProfile?.licenseNumber && (
              <span style={{ fontSize: 10.5, color: 'var(--ink-mute)', fontFamily: 'var(--mono)' }}>
                {u.driverProfile.licenseNumber}
              </span>
            )}
          </div>
        );
      },
    }),

    col.accessor('isActive', {
      header: 'Status',
      size: 100,
      cell: ({ row: { original: u } }) => {
        if (u.isPending) {
          return (
            <span style={{
              fontSize: 11.5, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
              background: 'rgba(224,196,126,0.12)', color: '#e0c47e', border: '1px solid rgba(224,196,126,0.3)',
            }}>
              Pending
            </span>
          );
        }
        const active = u.isActive;
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

    // Actions column
    col.display({
      id: 'actions',
      size: 60,
      enableSorting: false,
      header: '',
      cell: ({ row: { original: u } }) => {
        const isSelf  = u.id === me?.id;
        const isAdmin = u.roleName?.toLowerCase() === 'administrator';

       return (
  <ActionMenu
    items={[
      u.isPending && canCreate && {
        label: resendingId === u.id ? 'Sending…' : 'Resend invite',
        icon: 'refresh',
        disabled: resendingId === u.id,
        onClick: () => handleResend(u),
      },

      // !u.isPending && canUpdate && {
      //   label: 'Set password',
      //   icon: 'shield',
      //   onClick: () => setPasswordTarget(u),
      // },

      canDelete && {
        label: isSelf
          ? 'Cannot delete yourself'
          : isAdmin
            ? 'Cannot delete the admin account'
            : 'Delete',
        icon: 'trash',
        danger: true,
        disabled: isSelf || isAdmin,
        onClick: () => setToDelete(u),
      },
    ]}
  />
);
      },
    }),
  ], [canCreate, canDelete, me?.id, resendingId]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <div className="page-sub">
            {loading ? 'Loading…' : `${totalRows} ${tab === 'pending' ? 'pending invite' : 'account'}${totalRows !== 1 ? 's' : ''}`}
            {tab !== 'pending' && pendingCount > 0 && !loading && ` · ${pendingCount} pending`}
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={handleExport} disabled={exporting}>
            <Icon name="download" size={14} /> {exporting ? 'Exporting…' : 'Export'}
          </button>
          {canCreate && (
            <button className="btn primary" onClick={() => setShowInvite(true)}>
              <Icon name="plus" size={14} /> Invite User
            </button>
          )}
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        {TABS.map((t) => (
          <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
            {t === 'pending' ? `Pending${pendingCount ? ` (${pendingCount})` : ''}` : 'All Users'}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Keyed by tab so switching between All/Pending remounts the table
            instead of keeping its old page — the rows come from a fresh
            server query either way. */}
        <DataTable
          key={tab}
          columns={columns}
          data={rows}
          loading={loading}
          searchPlaceholder="Search by name, email or role…"
          searchValue={search}
          onSearchChange={setSearch}
          emptyText={tab === 'pending' ? 'No pending invites' : 'No users found'}
          manualPagination
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalRows={totalRows}
          onPageChange={setPageIndex}
          onPageSizeChange={(n) => { setPageSize(n); setPageIndex(0); }}
        />
      </div>

      <DeleteModal
        user={toDelete}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        busy={deleting}
      />

      <InviteUserModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        roles={roles}
        nationalities={nationalities}
        driverTypes={driverTypes}
        activeEventId={activeEventId}
        onInvited={handleInvited}
      />

      <EditUserModal
        user={editTarget}
        roles={roles}
        onClose={() => setEditTarget(null)}
        onSaved={load}
      />

      <SetPasswordModal
        user={passwordTarget}
        onClose={() => setPasswordTarget(null)}
        onDone={() => setPasswordTarget(null)}
      />
    </>
  );
}
