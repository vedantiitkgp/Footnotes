// Run: node backend/services/withRetry.test.mjs
import assert from 'node:assert/strict';
import { withRetry } from './withRetry.js';

const quotaErr = (quotaId) => Object.assign(
  new Error(`got status: 429 RESOURCE_EXHAUSTED {"quotaId":"${quotaId}"}`),
  { status: 429 },
);

let calls = 0;
await assert.rejects(() => withRetry(
  async () => { calls++; throw quotaErr('GenerateRequestsPerDayPerProjectPerModel-FreeTier'); },
  { baseDelayMs: 1 },
));
assert.equal(calls, 1, 'per-day quota must NOT be retried — retries burn more of an empty budget');

calls = 0;
await assert.rejects(() => withRetry(
  async () => { calls++; throw quotaErr('GenerateRequestsPerMinutePerProjectPerModel-FreeTier'); },
  { baseDelayMs: 1 },
));
assert.equal(calls, 3, 'per-minute quota should still use all attempts');

// 503 UNAVAILABLE is transient capacity pressure — the short-horizon case.
// Observed in production: an unretried 503 failed a whole memoir instantly.
const unavailableErr = () => Object.assign(
  new Error('got status: 503 Service Unavailable. {"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}'),
  { status: 503 },
);

calls = 0;
await assert.rejects(() => withRetry(
  async () => { calls++; throw unavailableErr(); },
  { baseDelayMs: 1 },
));
assert.equal(calls, 3, '503 UNAVAILABLE must be retried — it clears in seconds');

calls = 0;
assert.equal(await withRetry(async () => { calls++; return 'ok'; }), 'ok');
assert.equal(calls, 1, 'success path must not retry');

console.log('withRetry: all checks passed');
