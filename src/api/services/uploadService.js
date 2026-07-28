import axios from 'axios';
import { apiClient, CLIENT_APP, CLIENT_APP_HEADER } from '../apiClient';
import { API_BASE_URL, API_TIMEOUT } from '../../config/env';
import { ENDPOINTS } from '../endpoints';

// The upload endpoint returns a URL with a short-lived SAS token, which is what
// makes the local preview loadable. Never persist that token: strip it before
// sending the URL to the API — the backend re-signs blob URLs on every read
// (Core/Middlewares/BlobSasMiddleware.cs).
export const stripSasToken = (url) => (url ? String(url).split('?')[0] : url);

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
    { timeout: API_TIMEOUT, headers: { 'Content-Type': 'application/json', [CLIENT_APP_HEADER]: CLIENT_APP } },
  );
  return res.data?.data?.imageUrl ?? res.data?.imageUrl;
}
