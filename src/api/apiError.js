// Response-shape normalization for the backend API, kept out of apiClient.js so
// it can run (and be checked) without Vite's import.meta.env. apiClient wires
// these into the axios interceptors; nothing else should need them directly.

// Normalized error thrown to callers (services/components catch this).
export class ApiError extends Error {
  constructor(message, { status, errors, errorCode } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors || [];
    // Machine-readable ApiResponse.errorCode when the backend sent one
    // (GUEST_ALREADY_ON_EVENT, GUEST_EMAIL_CONFLICT, SERVICE_LEVEL_RULE, ...) —
    // callers branch on this instead of matching the message text.
    this.errorCode = errorCode || null;
  }
}

// Three error-body shapes reach us: the ApiResponse envelope
// ({ success, message, errors: [] }), ASP.NET's ValidationProblemDetails
// ({ title, errors: { Field: [msg] } }) from a request rejected during model
// binding, and nothing at all when the request never landed.
export function collectErrors(data) {
  const e = data?.errors;
  if (!e) return [];
  if (Array.isArray(e)) return e.filter(Boolean).map(String);
  // ValidationProblemDetails keys errors by field name.
  if (typeof e === 'object') return Object.values(e).flat().filter(Boolean).map(String);
  return [String(e)];
}

export function errorFrom(data, status, fallback) {
  const errors = collectErrors(data);
  // The envelope's message first, then the first field error — ProblemDetails'
  // `title` is the generic "One or more validation errors occurred." and is
  // worse than the actual field message, so it only wins if there is no other.
  const message = data?.message || errors[0] || data?.title || fallback || 'Request failed';
  return new ApiError(message, { status, errors, errorCode: data?.errorCode });
}

// A `responseType: 'blob'` request (the import-template downloads) gets its
// error envelope as a Blob too. Left unread, a failure would be handed to the
// caller as a perfectly valid "file" and saved as a broken .xlsx.
export async function jsonFromBlob(body) {
  if (typeof Blob === 'undefined' || !(body instanceof Blob)) return null;
  if (body.type && !body.type.includes('json')) return null;
  try {
    return JSON.parse(await body.text());
  } catch {
    return null;
  }
}

// Turn a 2xx axios response into the value the caller wants, or throw.
export async function unwrap(response) {
  let body = response.data;

  const fromBlob = await jsonFromBlob(body);
  if (fromBlob) body = fromBlob;

  if (body && typeof body === 'object' && 'success' in body) {
    // ApiResponse.ErrorResponse() reports business failures as HTTP 200 with
    // success:false (only NotFound/Conflict/Unauthorized/ServerError carry a
    // real status), so the FLAG — not the status code — decides whether this is
    // an error. Without this, every one of those failures unwrapped to
    // `data: null` and the caller's success path ran on nothing.
    if (body.success === false) throw errorFrom(body, response.status, 'Request failed');
    return 'data' in body ? body.data : body;
  }
  return body;
}
