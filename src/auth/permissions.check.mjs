// Self-check for permission evaluation. No framework: `node src/auth/permissions.check.mjs`.
// Same convention as jwt.check.mjs — the rules are pure, so they are asserted
// directly rather than through a rendered component.
//
// What this guards is one property: nothing grants access except a claim that is
// actually there. Every "unknown/missing/absent" case below must stay false, or
// the UI starts offering actions the server will reject.
import assert from 'node:assert/strict';
import { createAccessEvaluator, PERM, svcPerm, lookupPerm } from './permissions.js';

const reader = createAccessEvaluator({ read: ['guests', 'services'], write: [] });
const writer = createAccessEvaluator({ read: [], write: ['guests'] });
const both = createAccessEvaluator({ read: ['guests', 'services'], write: ['guests'] });
const nobody = createAccessEvaluator({ read: [], write: [] });
const missing = createAccessEvaluator();          // no user at all
const demo = createAccessEvaluator({ allowAll: true });

// ── Read ───────────────────────────────────────────────────────────────────
assert.equal(reader.canRead(PERM.GUESTS), true);
assert.equal(reader.canWrite(PERM.GUESTS), false, 'read must never imply write');

// ── Write implies read, never the reverse ──────────────────────────────────
assert.equal(writer.canWrite(PERM.GUESTS), true);
assert.equal(writer.canRead(PERM.GUESTS), true, 'a role that may edit a page may open it');
assert.equal(writer.canWrite(PERM.SERVICES), false);

// ── Read + write ───────────────────────────────────────────────────────────
assert.equal(both.canRead(PERM.SERVICES), true);
assert.equal(both.canWrite(PERM.GUESTS), true);
assert.equal(both.canWrite(PERM.SERVICES), false, 'write is per code, not per user');

// ── Fail closed ────────────────────────────────────────────────────────────
assert.equal(nobody.canRead(PERM.GUESTS), false, 'no permissions → no access');
assert.equal(nobody.canWrite(PERM.GUESTS), false);
assert.equal(missing.canRead(PERM.GUESTS), false, 'no user → no access');
assert.equal(missing.canWrite(PERM.GUESTS), false);
assert.equal(both.canRead('not-a-real-module'), false, 'unknown resource → no access');
assert.equal(both.canWrite('not-a-real-module'), false);
assert.equal(both.canRead(undefined), false, 'absent code → no access');
assert.equal(both.canRead(''), false);
assert.equal(both.canRead(null), false);
assert.equal(both.hasPermission(PERM.GUESTS, 'sideways'), true,
  'an unknown LEVEL falls back to read, the weaker of the two — never to write');
assert.equal(both.hasPermission(PERM.SERVICES, 'write'), false);

// Claims arriving as something other than a list must not throw and must not
// grant — userFromToken normalises, but this is the last line of defence.
assert.equal(createAccessEvaluator({ read: 'guests' }).canRead(PERM.GUESTS), false);
assert.equal(createAccessEvaluator({ read: null, write: undefined }).canRead(PERM.GUESTS), false);

// ── Still loading ──────────────────────────────────────────────────────────
// There is no "loading" state to test here by design: claims come from the JWT,
// so before the token is decoded the evaluator simply has no claims — which is
// the `missing` case above, and it denies. That is what makes the flicker
// impossible rather than merely unlikely.
assert.equal(missing.canWrite(PERM.SERVICES), false, 'pre-boot must deny, not grant');

// ── Any-of, matching the server's multi-code policies ──────────────────────
// [HasPermission(AccessLevel.Write, PermissionCodes.Guests, PermissionCodes.Services)]
assert.equal(writer.canWriteAny([PERM.GUESTS, PERM.SERVICES]), true, 'holding either code admits');
assert.equal(reader.canWriteAny([PERM.GUESTS, PERM.SERVICES]), false, 'reading neither admits');
assert.equal(nobody.canWriteAny([PERM.GUESTS, PERM.SERVICES]), false);
assert.equal(both.canReadAny([PERM.USERS, PERM.SERVICES]), true);
assert.equal(both.canReadAny([]), false, 'an empty code list grants nothing');
assert.equal(both.canReadAny(undefined), false);

// ── Derived codes ──────────────────────────────────────────────────────────
assert.equal(svcPerm('Flight'), 'service-flight');
assert.equal(svcPerm(' arrival-departure '), 'service-arrival-departure');
assert.equal(svcPerm(null), 'service-', 'a blank service code must not collide with a real one');
assert.equal(lookupPerm('Airports'), 'lookup-airports');
const svcUser = createAccessEvaluator({ read: [svcPerm('flight')], write: [PERM.SERVICES] });
assert.equal(svcUser.canRead(svcPerm('flight')), true);
assert.equal(svcUser.canRead(svcPerm('transport')), false, 'read is per service');
assert.equal(svcUser.canWrite(PERM.SERVICES), true, 'but write is on the module code');

// ── Demo mode ──────────────────────────────────────────────────────────────
assert.equal(demo.canRead(PERM.GUESTS), true);
assert.equal(demo.canWrite('anything-at-all'), true, 'demo has no backend to disagree with');

console.log('permissions.check.mjs — all assertions passed');
