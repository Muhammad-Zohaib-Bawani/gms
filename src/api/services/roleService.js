// Roles service. Reads are open to any signed-in user (several screens need the
// role roster for a dropdown); creating one needs WRITE on the Role Access menu,
// which the backend enforces.
import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

export const listRoles = () => apiClient.get(ENDPOINTS.roles.base);

// A new role starts with NO access at all — not a copy of anything. Grants are
// made afterwards through PUT /role-access/{roleId}, so there is exactly one
// place access is handed out.
// payload: { name, code, description, portalAccess }
export const createRole = (payload) => apiClient.post(ENDPOINTS.roles.base, payload);

// Code is the stable identifier the backend matches on and cannot be edited
// later, so it is derived from the name rather than typed freehand: lowercase,
// non-alphanumerics collapsed to single dashes, no leading/trailing dash.
export const slugifyRoleCode = (name) =>
  (name || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
