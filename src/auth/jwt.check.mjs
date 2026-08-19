// Self-check for the session-recovery decision. No framework: `node src/auth/jwt.check.mjs`.
// Guards the bug this logic exists for — an expired access token plus a live
// refresh token must mean "refresh", never "signed out".
import assert from 'node:assert/strict';
import { decodeJwt, isTokenExpired, needsBootRefresh, userFromToken } from './jwt.js';

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (claims) => `${b64url({ alg: 'HS256' })}.${b64url(claims)}.sig`;

const now = Math.floor(Date.now() / 1000);
const live = token({ exp: now + 3600, uid: '7', email: 'a@b.c', permission: ['Travel.View'] });
const dead = token({ exp: now - 3600, uid: '7', email: 'a@b.c', permission: 'Travel.View' });

assert.equal(isTokenExpired(live), false);
assert.equal(isTokenExpired(dead), true);
// Inside the 30s skew window a token counts as already expired.
assert.equal(isTokenExpired(token({ exp: now + 10 })), true);

assert.equal(needsBootRefresh({ accessToken: dead, refreshToken: 'r' }), true, 'expired access + refresh → refresh');
assert.equal(needsBootRefresh({ accessToken: live, refreshToken: 'r' }), false, 'live access → no refresh call');
assert.equal(needsBootRefresh({ refreshToken: 'r' }), true, 'refresh only → refresh');
assert.equal(needsBootRefresh({ accessToken: dead }), false, 'no refresh token → nothing to recover');
assert.equal(needsBootRefresh(null), false);

// A single "permission" claim arrives as a string, not an array.
assert.deepEqual(userFromToken(dead).permissions, ['Travel.View']);
assert.equal(decodeJwt('garbage'), null);

console.log('jwt.check.mjs: all assertions passed');
