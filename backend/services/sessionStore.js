import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, '..', 'temp');
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** @type {Map<string, { createdAt: number, data: object }>} */
const sessions = new Map();

export function createSession(sessionId, data = {}) {
  sessions.set(sessionId, { createdAt: Date.now(), data });
  const sessionDir = path.join(TEMP_DIR, sessionId);
  fs.mkdirSync(path.join(sessionDir, 'photos'), { recursive: true });
  fs.mkdirSync(path.join(sessionDir, 'assets'), { recursive: true });
  return sessionDir;
}

export function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  return session.data;
}

export function updateSession(sessionId, updates) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  Object.assign(session.data, updates);
  return true;
}

export function getSessionDir(sessionId) {
  return path.join(TEMP_DIR, sessionId);
}

export function startCleanupCron() {
  // Run once on startup, then every 6 hours
  runCleanup();
  setInterval(runCleanup, 6 * 60 * 60 * 1000);
  console.log('[sessionStore] Cleanup cron started (TTL=7d, interval=6h)');
}

function runCleanup() {
  const now = Date.now();

  // Scan temp dir on disk — works even after server restarts
  if (!fs.existsSync(TEMP_DIR)) return;
  let entries;
  try {
    entries = fs.readdirSync(TEMP_DIR, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const sessionDir = path.join(TEMP_DIR, entry.name);
    const memoirJsonPath = path.join(sessionDir, 'memoir.json');

    let sessionAge;
    if (fs.existsSync(memoirJsonPath)) {
      // Use createdAt from memoir.json for accuracy
      try {
        const data = JSON.parse(fs.readFileSync(memoirJsonPath, 'utf8'));
        sessionAge = now - new Date(data.createdAt).getTime();
      } catch {
        sessionAge = now - fs.statSync(sessionDir).birthtimeMs;
      }
    } else {
      // Fall back to directory mtime
      try {
        sessionAge = now - fs.statSync(sessionDir).mtimeMs;
      } catch {
        continue;
      }
    }

    if (sessionAge > SESSION_TTL_MS) {
      sessions.delete(entry.name);
      fs.rm(sessionDir, { recursive: true, force: true }, (err) => {
        if (err) console.error(`[cleanup] Failed to remove ${sessionDir}:`, err.message);
        else console.log(`[cleanup] Removed expired session ${entry.name}`);
      });
    }
  }
}
