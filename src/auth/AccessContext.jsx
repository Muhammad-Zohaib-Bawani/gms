import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getMyAccess } from '../api/services/roleAccessService';

// Role access for the signed-in user: the navigation tree (database-owned) plus
// the Read/Write flags every screen gates on. A node is one row of the
// Permissions table — a menu, or a submenu of one.
//
// Two sources, deliberately:
//  * The JWT's read/write claims answer canRead/canWrite instantly, with no
//    request — the same claims the backend's [HasPermission] policy checks, so
//    the buttons the UI shows and the calls the API accepts can never disagree.
//  * GET /role-access/me supplies the TREE (labels, icons, paths, parentage,
//    order). Claims are a flat code list and cannot describe a hierarchy.
// Until the tree lands, `menus` is empty and the sidebar renders nothing rather
// than guessing — but route guards already work off the claims.
const AccessContext = createContext(null);

// Demo mode has no backend and no token; every check passes so the static UI
// still renders. Mirrors DEMO_USER in AuthContext.
const DEMO = { read: true, write: true };

export function AccessProvider({ children }) {
  const { isAuthenticated, isBooting, isDemo, user, session } = useAuth();
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Re-fetch when the access token changes: a refresh re-mints the claims, and
  // an admin editing this role's access is only visible after that.
  const accessToken = session?.accessToken || null;

  useEffect(() => {
    if (isDemo || isBooting || !isAuthenticated || !accessToken) {
      setMenus([]);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    getMyAccess()
      .then((data) => { if (alive) setMenus(data?.permissions || []); })
      .catch((err) => {
        if (!alive) return;
        // An empty tree is the safe failure: no nav rather than a nav the server
        // would reject anyway.
        setMenus([]);
        setError(err);
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isDemo, isBooting, isAuthenticated, accessToken]);

  // Sets, not arrays: canRead/canWrite are called once per nav item per render.
  const { readable, writable } = useMemo(() => ({
    readable: new Set(user?.read || []),
    writable: new Set(user?.write || []),
  }), [user]);

  // Write is never implied by Read. Read IS implied by Write — a role that may
  // edit a page may obviously open it. Same rule as AccessEvaluator.
  const canRead = useCallback(
    (code) => (isDemo ? DEMO.read : !!code && (readable.has(code) || writable.has(code))),
    [isDemo, readable, writable]
  );
  const canWrite = useCallback(
    (code) => (isDemo ? DEMO.write : !!code && writable.has(code)),
    [isDemo, writable]
  );

  const value = useMemo(
    () => ({ menus, loading, error, canRead, canWrite }),
    [menus, loading, error, canRead, canWrite]
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const ctx = useContext(AccessContext);
  if (!ctx) throw new Error('useAccess must be used within an AccessProvider');
  return ctx;
}

// Flattens the tree to its routable leaves, in nav order. Used for "/" → the
// first page this role can actually open.
export function flattenMenus(menus) {
  const out = [];
  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (n.path) out.push(n);
      walk(n.children);
    }
  };
  walk(menus);
  return out;
}
