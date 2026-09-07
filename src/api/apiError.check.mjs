// Self-check for the API response normalization. Plain node, no test runner:
//   node Frontend/src/api/apiError.check.mjs
import assert from 'node:assert/strict';
import { ApiError, collectErrors, errorFrom, unwrap } from './apiError.js';

const res = (data, status = 200) => ({ data, status });

async function throwsApiError(response) {
  try {
    await unwrap(response);
  } catch (err) {
    assert.ok(err instanceof ApiError, 'expected an ApiError');
    return err;
  }
  assert.fail('expected unwrap to throw');
}

// A successful envelope hands back only the payload.
assert.deepEqual(await unwrap(res({ success: true, message: 'ok', data: { id: 7 } })), { id: 7 });

// The whole point: HTTP 200 + success:false is an error, not `null`.
const business = await throwsApiError(res({
  success: false, message: 'Guest is already on this event', data: null,
  errors: ['Duplicate email'], errorCode: 'GUEST_ALREADY_ON_EVENT',
}));
assert.equal(business.message, 'Guest is already on this event');
assert.equal(business.errorCode, 'GUEST_ALREADY_ON_EVENT');
assert.deepEqual(business.errors, ['Duplicate email']);
assert.equal(business.status, 200);

// A real error status carries through too.
assert.equal((await throwsApiError(res({ success: false, message: 'Conflict' }, 409))).status, 409);

// success:false with no message still produces something showable.
assert.equal((await throwsApiError(res({ success: false }))).message, 'Request failed');

// An envelope with no `data` key is returned whole rather than as undefined.
assert.deepEqual(await unwrap(res({ success: true, message: 'ok' })), { success: true, message: 'ok' });

// Bodies that aren't envelopes pass straight through.
assert.deepEqual(await unwrap(res([1, 2, 3])), [1, 2, 3]);
assert.equal(await unwrap(res(null)), null);

// A failure on a `responseType: 'blob'` download must not become a saved file.
const errBlob = new Blob([JSON.stringify({ success: false, message: 'Event not found' })],
  { type: 'application/json' });
assert.equal((await throwsApiError(res(errBlob))).message, 'Event not found');

// ...while the actual spreadsheet is left untouched.
const xlsx = new Blob(['PK'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
assert.equal(await unwrap(res(xlsx)), xlsx);

// ValidationProblemDetails: the field message beats the generic title.
const validation = errorFrom({
  title: 'One or more validation errors occurred.',
  errors: { Email: ["'Email' must not be empty."], Name: ['Too long'] },
}, 400);
assert.equal(validation.message, "'Email' must not be empty.");
assert.deepEqual(validation.errors, ["'Email' must not be empty.", 'Too long']);

// Nothing usable in the body -> the caller's fallback.
assert.equal(errorFrom(undefined, 500, 'Network Error').message, 'Network Error');
assert.deepEqual(collectErrors({ errors: null }), []);

console.log('apiError checks passed');
