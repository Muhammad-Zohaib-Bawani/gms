import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Icon } from '../components/Icons';
import { useAuth } from '../auth/AuthContext';
import { useAccess } from '../auth/AccessContext';
import { listRoles, createRole, slugifyRoleCode } from '../api/services/roleService';
import { getRoleAccess, setRoleAccess } from '../api/services/roleAccessService';
import { toast } from '../lib/toast';
import Modal from '../components/ui/Modal';
import { Skeleton } from '../components/ds';
import './role-access.css';


const NON_PORTAL_ROLES = ['guest', 'driver'];

// ─── helpers ─────────────────────────────────────────────────────────────────

// Walk the tree, parents before children.
function walk(nodes, fn, depth = 0, parent = null) {
  for (const n of nodes || []) {
    fn(n, depth, parent);
    walk(n.children, fn, depth + 1, n);
  }
}

function flatten(nodes) {
  const out = [];
  walk(nodes, (n, depth, parent) => out.push({ node: n, depth, parent }));
  return out;
}

// Every node at or under this one, itself included.
function subtree(node) {
  const out = [];
  walk([node], (n) => out.push(n));
  return out;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function RoleRow({ role, selected, onClick }) {
  return (
    <button onClick={onClick} className={`ra-role${selected ? ' selected' : ''}`}>
      <div style={{ minWidth: 0 }}>
        <div className="ra-role-name">{role.name}</div>
        <div className="ra-role-code">{role.code}</div>
      </div>
      <span className="ra-role-count">{role.userCount ?? 0}</span>
    </button>
  );
}

// A Read/Write pair. Only rows with a page of their own get one — a section
// heading has nothing to read or write, and it shows up in the menu by itself
// whenever one of its children is allowed. `disabled` means "this admin may look
// but not change".
function RwPair({ flags, onToggle, disabled, compact }) {
  const f = flags || { read: false, write: false };
  return (
    <div className={`ra-rw${compact ? ' compact' : ''}${disabled ? ' locked' : ''}`} onClick={(e) => e.stopPropagation()}>
      <label className="ra-rw-item" title="Can view this page">
        <input
          type="checkbox"
          disabled={disabled}
          checked={!!f.read}
          // Clearing Read clears Write too: write access to a page nobody can
          // open is not a state worth being able to save.
          onChange={(e) => onToggle({ read: e.target.checked, write: e.target.checked ? f.write : false })}
        />
        <span>Read</span>
      </label>
      <label className="ra-rw-item" title="Can create, edit and delete">
        <input
          type="checkbox"
          disabled={disabled}
          checked={!!f.write}
          // Ticking Write implies Read — the server treats a write claim as
          // satisfying a read, so the boxes should not suggest otherwise.
          onChange={(e) => onToggle({ read: e.target.checked ? true : f.read, write: e.target.checked })}
        />
        <span>Write</span>
      </label>
    </div>
  );
}

// A submenu with no children of its own.
function Tile({ node, flags, onToggle, mayEdit }) {
  const f = flags[node.permissionId] || {};
  const on = f.read || f.write;
  return (
    <div className={`ra-tile${on ? ' on' : ''}`}>
      <div className="ra-tile-head">
        <div className="ra-tile-name">{node.name}</div>
        <div className="ra-tile-sub">{node.path || '—'}</div>
      </div>
      {node.path ? (
        <RwPair flags={f} onToggle={(v) => onToggle(node.permissionId, v)} disabled={!mayEdit} compact />
      ) : (
        // A childless row with no path is a data mistake (a heading with nothing
        // under it), not something to offer checkboxes for.
        <span className="ra-tile-none">No page to grant</span>
      )}
    </div>
  );
}

// A group: an accordion header and its children in a grid below. No Read/Write
// of its own — see RwPair. That holds even for a row that is ALSO a page
// (Services is the page at /travel and the parent of one row per service tab):
// its access is derived from its children at save time, so there is no second
// box to remember. The header count is how many of the pages under it are
// granted, which is the only thing worth knowing about a heading.
// `level` only drives the styling — the nesting itself is recursive.
function Group({ node, flags, open, onOpenChange, onToggle, mayEdit, level = 0 }) {
  const kids = node.children || [];
  // Its own row is left out: it is not a box anyone can tick here.
  const pages = subtree(node).filter((n) => n.path && n !== node);
  const granted = pages.filter((n) => flags[n.permissionId]?.read || flags[n.permissionId]?.write).length;
  const isOpen = !!open[node.permissionId];

  return (
    <div className={`ra-group level-${level}`}>
      <button
        type="button"
        className="ra-group-head"
        onClick={() => onOpenChange(node.permissionId, !isOpen)}
      >
        <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={12} />
        <span className="ra-group-name">{node.name}</span>
        <span className="ra-group-count">{granted}/{pages.length}</span>
      </button>

      {isOpen && (
        <div className="ra-grid">
          {kids.map((c) => (c.children?.length ? (
            // Full width: a nested group needs its own grid, and half a grid
            // cell is not enough room for one.
            <div key={c.permissionId} className="ra-span">
              <Group
                node={c}
                flags={flags}
                open={open}
                onOpenChange={onOpenChange}
                onToggle={onToggle}
                mayEdit={mayEdit}
                level={level + 1}
              />
            </div>
          ) : (
            <Tile key={c.permissionId} node={c} flags={flags} onToggle={onToggle} mayEdit={mayEdit} />
          )))}
        </div>
      )}
    </div>
  );
}

// Stand-in for the matrix while a role's tree is loading. Shaped like the real
// thing — accordion headers with a grid of tiles under the first — so the card
// does not resize when the response lands.
function MatrixSkeleton() {
  return (
    <div className="ra-fieldset" aria-hidden="true">
      {[0, 1, 2].map((section) => (
        <div key={section} className="ra-group level-0">
          <div className="ra-group-head ra-skel-head">
            <Skeleton w={12} h={12} r={3} />
            <Skeleton w={section === 0 ? 120 : 96} h={11} r={3} />
          </div>
          {section === 0 && (
            <div className="ra-grid">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="ra-tile">
                  <div className="ra-tile-head">
                    <Skeleton w="62%" h={11} r={3} />
                    <Skeleton w="80%" h={9} r={3} style={{ marginTop: 6 }} />
                  </div>
                  <Skeleton w={110} h={13} r={4} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RoleListSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="ra-role" style={{ cursor: 'default' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <Skeleton w={`${52 + ((i * 11) % 28)}%`} h={11} r={3} />
            <Skeleton w="34%" h={9} r={3} style={{ marginTop: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Name, code, description, portal access. No access list here on purpose: the
// role is created empty and then granted on the right-hand side, so there is one
// place access is handed out rather than two.
function NewRoleModal({ open, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  // Once the admin edits the code by hand, stop overwriting it from the name.
  const [codeTouched, setCodeTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [portalAccess, setPortalAccess] = useState(true);
  const [saving, setSaving] = useState(false);

  // Remount-free reset: the modal stays mounted between opens.
  useEffect(() => {
    if (!open) return;
    setName(''); setCode(''); setCodeTouched(false);
    setDescription(''); setPortalAccess(true); setSaving(false);
  }, [open]);

  const effectiveCode = codeTouched ? code : slugifyRoleCode(name);
  const valid = name.trim().length > 0 && effectiveCode.length > 0;

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const role = await createRole({
        name: name.trim(),
        code: effectiveCode,
        description: description.trim() || null,
        portalAccess,
      });
      toast.success(`Role "${name.trim()}" created`);
      onCreated(role);
    } catch (err) {
      // The backend returns a 409 with its own sentence for a duplicate code,
      // which is the only thing the admin can act on.
      toast.fromError(err, 'Could not create the role');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Role"
      subtitle="Created with no access — grant its menus next"
      width={440}
      footer={(
        <>
          <button className="btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn primary" onClick={submit} disabled={!valid || saving}>
            <Icon name="check" size={13} /> {saving ? 'Creating…' : 'Create Role'}
          </button>
        </>
      )}
    >
      <div className="ra-form">
        <label className="ra-field">
          <span>Name<em>*</em></span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            placeholder="Protocol Officer"
          />
        </label>

        <label className="ra-field">
          <span>Code<em>*</em></span>
          <input
            value={effectiveCode}
            onChange={(e) => { setCodeTouched(true); setCode(slugifyRoleCode(e.target.value)); }}
            placeholder="protocol-officer"
          />
          <small>
            Derived from the name. Permanent once saved — the backend matches roles
            on it, so it cannot be renamed later.
          </small>
        </label>

        <label className="ra-field">
          <span>Description</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this role is for"
          />
        </label>

        <label className="ra-check">
          <input
            type="checkbox"
            checked={portalAccess}
            onChange={(e) => setPortalAccess(e.target.checked)}
          />
          <span>
            Can sign in to this portal
            <small>Turn off for app-only roles (drivers, guests) that never open the admin portal.</small>
          </span>
        </label>
      </div>
    </Modal>
  );
}

// ─── main view ────────────────────────────────────────────────────────────────

export default function RoleAccessView() {
  const { isDemo } = useAuth();
  const { canWrite } = useAccess();
  const mayEdit = canWrite('role-access');

  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [selectedRole, setSelectedRole] = useState(null);
  const [tree, setTree] = useState([]);
  // { [permissionId]: { read, write } } — the edit buffer, seeded from the response.
  const [flags, setFlags] = useState({});
  // { [permissionId]: bool } — which accordions are expanded.
  const [open, setOpen] = useState({});
  const [loadingMenus, setLoadingMenus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNewRole, setShowNewRole] = useState(false);

  useEffect(() => {
    // Demo mode has no backend at all (see AuthContext) — an honest empty state
    // rather than fabricated roles.
    if (isDemo) { setRoles([]); setLoadingRoles(false); return; }
    setLoadingRoles(true);
    listRoles()
      .then((r) => setRoles(Array.isArray(r) ? r : (r?.items || [])))
      .catch(() => toast.error('Could not load roles'))
      .finally(() => setLoadingRoles(false));
  }, [isDemo]);

  // Seeds both the edit buffer and the accordion state from a response.
  const applyTree = useCallback((nodes) => {
    setTree(nodes);
    const nextFlags = {};
    const nextOpen = {};
    // Only the first accordion starts open — enough to show what the screen is
    // without dumping the whole matrix of checkboxes on arrival. Everything else
    // is one click away, and Expand opens the lot.
    let firstAccordion = true;
    walk(nodes, (n, depth) => {
      nextFlags[n.permissionId] = { read: !!n.read, write: !!n.write };
      if (!n.children?.length) return;
      nextOpen[n.permissionId] = depth === 0 && firstAccordion;
      // Walk is depth-first with parents first, so the first top-level group it
      // reaches is the first section on screen. A leading top-level row with no
      // children is skipped above and does not consume the one open slot.
      if (depth === 0) firstAccordion = false;
    });
    setFlags(nextFlags);
    setOpen(nextOpen);
  }, []);

  const loadAccess = useCallback(async (role) => {
    setSelectedRole(role);
    setTree([]);
    setFlags({});
    if (isDemo) return;
    setLoadingMenus(true);
    try {
      const data = await getRoleAccess(role.id);
      applyTree(data?.permissions || []);
    } catch (err) {
      toast.fromError(err, 'Could not load role access');
    } finally {
      setLoadingMenus(false);
    }
  }, [isDemo, applyTree]);

  const rows = useMemo(() => flatten(tree), [tree]);

  const toggle = (permissionId, value) => {
    if (!mayEdit) return;
    setFlags((prev) => ({ ...prev, [permissionId]: value }));
  };

  const onOpenChange = (permissionId, next) =>
    setOpen((prev) => ({ ...prev, [permissionId]: next }));

  // What actually gets sent, and what the counters report. A row that is both a
  // page and a parent (Services is the page at /travel and the parent of one row
  // per service tab) shows no boxes of its own: granting a service tab without
  // the page it lives on is not a state worth being able to save, so the page is
  // switched on here whenever any tab under it is. Deepest-first, reading what
  // has already been derived, so a nested one of these still rolls up.
  const effective = useMemo(() => {
    const out = {};
    for (const { node } of rows) {
      if (!node.path) continue;
      out[node.permissionId] = {
        read: !!flags[node.permissionId]?.read,
        write: !!flags[node.permissionId]?.write,
      };
    }
    for (const { node } of [...rows].reverse()) {
      if (!node.path || !node.children?.length) continue;
      const kids = subtree(node).filter((n) => n.path && n !== node);
      const self = out[node.permissionId];
      out[node.permissionId] = {
        read: self.read || kids.some((n) => out[n.permissionId]?.read || out[n.permissionId]?.write),
        write: self.write || kids.some((n) => out[n.permissionId]?.write),
      };
    }
    return out;
  }, [rows, flags]);

  // Bulk helpers touch only rows that have a page — headings have nothing to grant.
  const setAll = (value) => {
    if (!mayEdit) return;
    setFlags((prev) => {
      const next = { ...prev };
      for (const { node } of rows) if (node.path) next[node.permissionId] = { ...value };
      return next;
    });
  };

  const expandAll = (value) =>
    setOpen(Object.fromEntries(
      rows.filter(({ node }) => node.children?.length)
          .map(({ node }) => [node.permissionId, value])));

  async function save() {
    if (!selectedRole) return;
    if (isDemo) { toast.success('Role access updated (demo)'); return; }
    setSaving(true);
    try {
      // Send every row, flags and all: the endpoint is a full replace, so an
      // omitted row is a revoke and sending the whole tree keeps that explicit.
      // Headings go out false/false — they are not grantable here, and that also
      // clears any stale grant a hand-run script may have left on one.
      const items = rows.map(({ node }) => ({
        permissionId: node.permissionId,
        read: !!effective[node.permissionId]?.read,
        write: !!effective[node.permissionId]?.write,
      }));
      const updated = await setRoleAccess(selectedRole.id, items);
      // Keep whatever the admin had expanded — reseeding it would collapse the
      // section they were working in every time they hit Save.
      const keepOpen = open;
      applyTree(updated?.permissions || tree);
      setOpen(keepOpen);
      toast.success(`Access updated for ${selectedRole.name}`);
    } catch (err) {
      toast.fromError(err, 'Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  const filteredRoles = roles.filter((r) => {
    if (NON_PORTAL_ROLES.includes((r.code || '').toLowerCase())) return false;
    const q = search.trim().toLowerCase();
    return !q || r.name?.toLowerCase().includes(q) || r.code?.toLowerCase().includes(q);
  });

  const readCount = rows.filter(({ node }) => effective[node.permissionId]?.read).length;
  const writeCount = rows.filter(({ node }) => effective[node.permissionId]?.write).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Role Access</h1>
          <div className="page-sub">
            Choose which menus each role can read and which it can change
          </div>
        </div>
      </div>

      {/* `split-pane` collapses this to one column below 768px — a fixed 280px
          first column left the detail pane ~50px wide on a phone. */}
      <div className="split-pane ra-layout">

        {/* ── Left: role list ── */}
        <div className="card" style={{ padding: 12 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roles…"
            className="ra-search"
          />

          {mayEdit && (
            <button className="btn ra-new-role" onClick={() => setShowNewRole(true)}>
              <Icon name="plus" size={13} /> New Role
            </button>
          )}

          {loadingRoles ? (
            <RoleListSkeleton />
          ) : filteredRoles.length === 0 ? (
            <div className="ra-empty">No roles found</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredRoles.map((r) => (
                <RoleRow
                  key={r.id}
                  role={r}
                  selected={selectedRole?.id === r.id}
                  onClick={() => loadAccess(r)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Right: the access matrix ── */}
        <div>
          {!selectedRole ? (
            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ marginBottom: 12, color: 'var(--ink-mute)' }}>
                <Icon name="protocol" size={28} />
              </div>
              <div style={{ color: 'var(--ink-mute)', fontSize: 14 }}>
                Select a role to manage its menu access
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 20 }}>
              {/* Header */}
              <div className="ra-head">
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{selectedRole.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-mute)', marginTop: 2 }}>
                    {selectedRole.code} · {selectedRole.userCount ?? 0} user(s)
                  </div>
                </div>
                <div className="ra-actions">
                  {rows.length > 0 && (
                    <>
                      <span style={{ fontSize: 11.5, color: 'var(--ink-mute)' }}>
                        {readCount} read · {writeCount} write
                      </span>
                      <button className="btn ra-btn-sm" onClick={() => expandAll(true)}>Expand</button>
                      <button className="btn ra-btn-sm" onClick={() => expandAll(false)}>Collapse</button>
                    </>
                  )}
                  {mayEdit && (
                    <>
                      <button className="btn ra-btn-sm" onClick={() => setAll({ read: true, write: true })}>All</button>
                      <button className="btn ra-btn-sm" onClick={() => setAll({ read: true, write: false })}>Read only</button>
                      <button className="btn ra-btn-sm" onClick={() => setAll({ read: false, write: false })}>None</button>
                      <button
                        className="btn primary"
                        disabled={saving || loadingMenus}
                        onClick={save}
                        style={{ padding: '7px 18px', fontSize: 13, opacity: saving ? 0.7 : 1 }}
                      >
                        {saving ? 'Saving…' : 'Save Access'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Info banner */}
              <div className="ra-note">
                <strong style={{ color: 'var(--accent)' }}>Read</strong> lets the role open the page.{' '}
                <strong style={{ color: 'var(--accent)' }}>Write</strong> lets it create, edit and delete
                there — read alone never implies it. Section headings have no boxes: they have no page of
                their own, and one shows up in the menu by itself whenever any page under it is allowed.
                {!mayEdit && <> You have read-only access to this screen, so the boxes are locked.</>}
              </div>

              {loadingMenus ? (
                <MatrixSkeleton />
              ) : rows.length === 0 ? (
                <div className="ra-empty" style={{ padding: 28 }}>
                  No menus are configured in the Permissions table yet.
                </div>
              ) : (
                <div className="ra-fieldset">
                  {tree.map((n) => (n.children?.length ? (
                    <Group
                      key={n.permissionId}
                      node={n}
                      flags={flags}
                      open={open}
                      onOpenChange={onOpenChange}
                      onToggle={toggle}
                      mayEdit={mayEdit}
                    />
                  ) : (
                    // A top-level row with a page and no children: no accordion
                    // to open, so it sits on its own as a single tile.
                    <div key={n.permissionId} className="ra-grid">
                      <Tile node={n} flags={flags} onToggle={toggle} mayEdit={mayEdit} />
                    </div>
                  )))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <NewRoleModal
        open={showNewRole}
        onClose={() => setShowNewRole(false)}
        onCreated={(role) => {
          setShowNewRole(false);
          // Refresh the list, then open the new role straight away: a role with
          // no access is useless, so the next thing to do is always grant it.
          listRoles()
            .then((r) => setRoles(Array.isArray(r) ? r : (r?.items || [])))
            .catch(() => {});
          if (role?.id) loadAccess(role);
        }}
      />
    </div>
  );
}
