// Run: node backend/services/googlePhotos.test.mjs
//
// Covers the parts that are testable without a real OAuth client: the SSRF
// allowlist, extension mapping, and the limits that replace multer's on a
// source that bypasses it entirely.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isGooglePhotosUrl, extFromMime, downloadPickedItems } from './googlePhotos.js';

// ── 1. SSRF allowlist ───────────────────────────────────────────────────────
assert.equal(isGooglePhotosUrl('https://lh3.googleusercontent.com/abc'), true);
assert.equal(isGooglePhotosUrl('https://googleusercontent.com/x'), true);

const rejected = [
  ['https://evilgoogleusercontent.com/x', 'suffix match must require the leading dot'],
  ['https://googleusercontent.com.evil.com/x', 'attacker-controlled parent domain'],
  ['https://googleusercontent.com@evil.com/x', 'userinfo, not host — substring checks miss this'],
  ['http://lh3.googleusercontent.com/x', 'https only'],
  ['http://169.254.169.254/latest/meta-data/', 'cloud metadata endpoint'],
  ['file:///etc/passwd', 'non-http scheme'],
  ['', 'empty'],
  [null, 'null'],
  ['not a url', 'unparseable'],
];
for (const [url, why] of rejected) {
  assert.equal(isGooglePhotosUrl(url), false, `must reject ${JSON.stringify(url)} — ${why}`);
}

// ── 2. Extension mapping ────────────────────────────────────────────────────
assert.equal(extFromMime('image/jpeg'), '.jpg');
assert.equal(extFromMime('image/png'), '.png');
assert.equal(extFromMime('image/heic'), '.heic');
assert.equal(extFromMime('image/jpeg;charset=utf-8'), '.jpg', 'must strip parameters');
assert.equal(extFromMime('IMAGE/PNG'), '.png', 'must be case-insensitive');
assert.equal(extFromMime('video/mp4'), '.jpg', 'unreachable in practice, must not throw');
assert.equal(extFromMime(undefined), '.jpg');

// Every extension we can emit must be understood by supabase.js's MIME map,
// or Storage tags the object application/octet-stream.
const SUPABASE_KNOWN = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.heic'];
for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif', 'anything/else']) {
  assert.ok(
    SUPABASE_KNOWN.includes(extFromMime(mime)),
    `extFromMime(${mime}) produced an extension supabase.js cannot type`,
  );
}

// ── 3. Download limits, with fetch stubbed ──────────────────────────────────
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gphotos-test-'));
fs.mkdirSync(path.join(tmp, 'photos'), { recursive: true });

let calls = [];
let bodyReads = 0;
const realFetch = globalThis.fetch;

const mkRes = ({ status = 200, headers = {}, body = Buffer.from('X') }) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  arrayBuffer: async () => {
    bodyReads++;
    return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
  },
});

const stub = (responder) => {
  calls = [];
  bodyReads = 0;
  globalThis.fetch = async (url, opts) => { calls.push(url); return responder(url, opts); };
};

const item = (over = {}) => ({
  baseUrl: 'https://lh3.googleusercontent.com/ok',
  mimeType: 'image/jpeg',
  ...over,
});

// 3a. A disallowed baseUrl is never fetched at all.
stub(() => mkRes({ headers: { 'content-type': 'image/jpeg' } }));
let out = await downloadPickedItems(tmp, [item({ baseUrl: 'https://evil.com/x' })], 'tok');
assert.equal(out.filenames.length, 0);
assert.equal(calls.length, 0, 'disallowed host must be rejected before any network call');

// 3b. Oversized by Content-Length is skipped without reading the body.
stub(() => mkRes({ headers: { 'content-type': 'image/jpeg', 'content-length': String(21 * 1024 * 1024) } }));
out = await downloadPickedItems(tmp, [item()], 'tok');
assert.equal(out.filenames.length, 0, 'oversized item must be skipped');
assert.equal(bodyReads, 0, 'must not buffer a response already known to be too large');

// 3c. The response content-type is authoritative, not the client's claim.
stub(() => mkRes({ headers: { 'content-type': 'video/mp4' } }));
out = await downloadPickedItems(tmp, [item({ mimeType: 'image/jpeg' })], 'tok');
assert.equal(out.filenames.length, 0, 'client-claimed mimeType must not override the response header');

// 3d. Partial failure keeps the survivors, in the order they were picked.
stub((url) => (url.includes('/two')
  ? mkRes({ status: 500 })
  : mkRes({
      headers: { 'content-type': 'image/png' },
      body: Buffer.from(url.includes('/one') ? 'AAA' : 'CCC'),
    })));
out = await downloadPickedItems(tmp, [
  item({ baseUrl: 'https://lh3.googleusercontent.com/one' }),
  item({ baseUrl: 'https://lh3.googleusercontent.com/two' }),
  item({ baseUrl: 'https://lh3.googleusercontent.com/three' }),
], 'tok');

assert.equal(out.filenames.length, 2, 'the two good items must survive');
assert.equal(out.failed, 1);
const contents = out.filenames.map((f) => fs.readFileSync(path.join(tmp, 'photos', f), 'utf8'));
assert.deepEqual(contents, ['AAA', 'CCC'], 'order must match the pick order — it drives the photo reel');
for (const f of out.filenames) {
  assert.ok(!f.includes('/') && !f.includes('\\'), 'filenames must be bare, no directory component');
  assert.ok(f.endsWith('.png'), 'extension must come from the response content-type');
}

// 3e. A 401 surfaces distinctly so the UI can say "pick again".
stub(() => mkRes({ status: 401 }));
out = await downloadPickedItems(tmp, [item()], 'tok');
assert.equal(out.filenames.length, 0);
assert.equal(out.authExpired, true, 'expired token must be distinguishable from a generic failure');

globalThis.fetch = realFetch;
fs.rmSync(tmp, { recursive: true, force: true });

console.log('googlePhotos: all checks passed');
