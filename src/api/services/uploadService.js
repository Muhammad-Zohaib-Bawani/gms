import axios from 'axios';
import { apiClient } from '../apiClient';
import { API_BASE_URL, API_TIMEOUT } from '../../config/env';
import { ENDPOINTS } from '../endpoints';

// Backend expects raw base64 — strip the "data:image/png;base64," prefix.
async function toUploadBody(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { base64Image: dataUrl.slice(dataUrl.indexOf(',') + 1), fileName: file.name };
}

// Uploads via the generic blob-storage endpoint. Returns the public image URL.
export async function uploadImageFile(file) {
  const res = await apiClient.post(ENDPOINTS.upload.image, await toUploadBody(file));
  return res?.imageUrl;
}

// Same endpoint, deliberately unauthenticated — bare axios so apiClient's
// request interceptor doesn't attach the Bearer token, and its response
// interceptor doesn't unwrap for us either.
export async function uploadImageFileAnon(file) {
  const res = await axios.post(
    `${API_BASE_URL}${ENDPOINTS.upload.image}`,
    await toUploadBody(file),
    { timeout: API_TIMEOUT, headers: { 'Content-Type': 'application/json' } },
  );
  return res.data?.data?.imageUrl ?? res.data?.imageUrl;
}
