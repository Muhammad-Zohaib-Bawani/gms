import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

export const getNationalities = () => apiClient.get(ENDPOINTS.nationalities.base);
