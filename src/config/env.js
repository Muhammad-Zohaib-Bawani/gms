// Central runtime config. Values come from Vite env vars (see .env.example).
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
export const API_TIMEOUT = Number(import.meta.env.VITE_API_TIMEOUT) || 20000;

// localStorage key holding ONLY { accessToken, refreshToken }.
export const AUTH_STORAGE_KEY = 'gms-auth';
