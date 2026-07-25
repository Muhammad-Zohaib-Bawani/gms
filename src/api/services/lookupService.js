import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Code-defined guest option sets (tier, type, statuses) for form dropdowns.
// Returns { GuestTier: [...], GuestType: [...], GuestInvitationStatus: [...], GuestAccreditationStatus: [...] }
// All DB-backed reference data now lives in dedicated endpoints (travel + venue).
export const getGuestEnums = () => apiClient.get(ENDPOINTS.lookups.guestEnums);
