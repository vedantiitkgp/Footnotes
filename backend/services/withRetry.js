/**
 * Retry `fn` on 429, shared by the gemini / imagen / tts services.
 *
 * Per-DAY quota exhaustion is never retried. A daily quota cannot refill
 * within the lifetime of a request, so every retry spends another unit of an
 * already-empty budget and makes the outage worse. Google distinguishes the
 * two cases in `quotaId` (…PerDay… vs …PerMinute…), so key off that rather
 * than treating all 429s alike.
 */

function errText(err) {
  if (!err) return '';
  let s = err.message || '';
  try { s += ' ' + JSON.stringify(err); } catch { /* circular — message is enough */ }
  return s;
}

export async function withRetry(fn, { attempts = 3, baseDelayMs = 8000, label = 'genai' } = {}) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const text  = errText(err);
      const is429 = err?.status === 429 || /429|RESOURCE_EXHAUSTED/.test(text);
      // 503 UNAVAILABLE ("this model is experiencing high demand") is the
      // short-horizon case retries exist for — it clears in seconds. Left
      // unretried it fails an entire memoir on the first capacity blip.
      const is503 = err?.status === 503 || /503|UNAVAILABLE/.test(text);
      const retryable = is429 || is503;

      if (is429 && /PerDay/i.test(text)) {
        console.error(`[${label}] daily quota exhausted — not retrying (resets at midnight PT)`);
        throw err;
      }

      if (retryable && i < attempts - 1) {
        // ponytail: fixed backoff ignores the server's own RetryInfo.retryDelay;
        // parse it if per-minute 429s start slipping through.
        const delay = (i + 1) * baseDelayMs;
        console.warn(`[${label}] ${is429 ? 429 : 503} — retrying in ${delay / 1000}s (attempt ${i + 1}/${attempts})`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}
