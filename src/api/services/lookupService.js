import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Code-defined guest option sets (tier, type, statuses) for form dropdowns.
// Returns { GuestTier: [...], GuestType: [...], GuestInvitationStatus: [...], GuestAccreditationStatus: [...] }
// All DB-backed reference data now lives in dedicated endpoints (travel + venue).
export const getGuestEnums = () => apiClient.get(ENDPOINTS.lookups.guestEnums);

// Driver engagement types — [{ value: 1, name: 'Fixed', nameAr }, { value: 2, … }].
// `value` is the int posted back as driverProfile.driverType.
export const getDriverTypes = () => apiClient.get(ENDPOINTS.lookups.driverTypes);
