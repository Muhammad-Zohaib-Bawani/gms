import { apiClient } from '../apiClient';
import { ENDPOINTS } from '../endpoints';

// Reads a File into a base64 data URL, then uploads it via the generic
// blob-storage endpoint. Returns the resulting public image URL.
export async function uploadImageFile(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  // Backend expects raw base64 — strip the "data:image/png;base64," prefix.
  const base64Image = dataUrl.slice(dataUrl.indexOf(',') + 1);

  const res = await apiClient.post(ENDPOINTS.upload.image, {
    base64Image,
    fileName: file.name,
  });
  return res?.imageUrl;
}
