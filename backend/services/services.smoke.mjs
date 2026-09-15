// Smoke check: every service module's entry point must be *callable* without
// tripping a ReferenceError/TypeError from a missing local helper.
//
// Why this exists: `node --check` validates syntax only. A refactor once deleted
// getAI() from ttsService.js; every file still parsed, and the failure surfaced
// only in production as "[tts] Failed: getAI is not defined" — swallowed by the
// service's own catch, so memoirs completed silently without audio.
//
// Run: node backend/services/services.smoke.mjs
import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'smoke-test-not-a-real-key';

const BAD = /is not defined|is not a function|Cannot read propert/i;
const problems = [];

// Services log their failures rather than throwing, so capture both channels.
const seen = [];
const origError = console.error;
const origWarn = console.warn;
console.error = (...a) => seen.push(a.join(' '));
console.warn = (...a) => seen.push(a.join(' '));

const guard = (p) => Promise.race([
  Promise.resolve(p).catch((e) => { if (BAD.test(e?.message || '')) problems.push(e.message); }),
  new Promise((r) => setTimeout(r, 15000)),  // network attempt is fine; just don't hang
]);

const { generateVoiceover } = await import('./ttsService.js');
await guard(generateVoiceover({ text: 'smoke', assetsDir: '/tmp' }));

const { generatePostcard } = await import('./imagenService.js');
await guard(generatePostcard({ gap: 'smoke', locations: [], index: 0, assetsDir: '/tmp' }));

const { analyzePhotos } = await import('./geminiService.js');
await guard(analyzePhotos([]));

console.error = origError;
console.warn = origWarn;

for (const line of seen) if (BAD.test(line)) problems.push(line);

assert.deepEqual(
  problems, [],
  `service module(s) reference a missing helper:\n  ${problems.join('\n  ')}`,
);
console.log(`services smoke: all 3 modules callable (${seen.length} expected API failures ignored)`);
