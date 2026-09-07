// Role Access — Read/Write per role, per menu/submenu. The tree itself is
// database-owned (the Permissions table); nothing here invents a menu.
import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// The signed-in user's own tree + flags. Drives navigation and every
// canRead/canWrite check in the UI (see auth/AccessContext).
export const getMyAccess = () => apiClient.get(ENDPOINTS.roleAccess.me);

// The whole tree with one role's flags — every row, including the ones the role
// cannot reach, so the admin screen has something to switch on.
export const getRoleAccess = (roleId) => apiClient.get(ENDPOINTS.roleAccess.byRole(roleId));

// Full replace: anything absent from `items` is revoked.
// items: [{ permissionId, read, write }]
export const setRoleAccess = (roleId, items) =>
  apiClient.put(ENDPOINTS.roleAccess.byRole(roleId), { items });
