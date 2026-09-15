// Run: node backend/services/chunkText.test.mjs
//
// Deepgram /v1/speak hard-caps a request at 2000 characters. Memoir essays are
// 4-5k, so every real memoir depends on this splitter being correct — a bug
// here is invisible to any short smoke test.
import assert from 'node:assert/strict';
import { chunkText } from './ttsService.js';

const LIMIT = 1900;
const words = (s) => s.replace(/\s+/g, ' ').trim();

// 1. Realistic essay-length input: every chunk must fit, nothing may be lost.
const essay = Array.from({ length: 220 },
  (_, i) => `This is sentence number ${i} of a travel memoir about a long journey.`).join(' ');
assert.ok(essay.length > 4000, 'fixture should exceed one request');

const chunks = chunkText(essay);
assert.ok(chunks.length > 1, 'long essay must split into multiple chunks');
for (const c of chunks) {
  assert.ok(c.length <= LIMIT, `chunk of ${c.length} exceeds ${LIMIT}`);
  assert.ok(c.trim().length > 0, 'no empty chunks — Deepgram rejects them');
}
assert.equal(words(chunks.join(' ')), words(essay), 'no text lost or duplicated across chunks');

// 2. Short text stays a single chunk.
assert.deepEqual(chunkText('Just one short line.'), ['Just one short line.']);

// 3. A single sentence longer than the limit still gets split.
const runOn = 'word '.repeat(900).trim();   // ~4500 chars, no sentence breaks
const hard  = chunkText(runOn);
assert.ok(hard.length > 1, 'over-long sentence must be hard-split');
for (const c of hard) assert.ok(c.length <= LIMIT, `hard-split chunk ${c.length} > ${LIMIT}`);

// 4. Exactly-at-limit input does not produce an empty trailing chunk.
for (const c of chunkText('a'.repeat(LIMIT))) assert.ok(c.length > 0);

console.log(`chunkText: all checks passed (${chunks.length} chunks for ${essay.length} chars)`);
