import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, '..', 'temp');
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

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
  setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions.entries()) {
      if (now - session.createdAt > SESSION_TTL_MS) {
        sessions.delete(id);
        const sessionDir = path.join(TEMP_DIR, id);
        fs.rm(sessionDir, { recursive: true, force: true }, (err) => {
          if (err) console.error(`[cleanup] Failed to remove ${sessionDir}:`, err.message);
          else console.log(`[cleanup] Removed expired session ${id}`);
        });
      }
    }
  }, 30 * 60 * 1000); // every 30 minutes
  console.log('[sessionStore] Cleanup cron started (TTL=2h, interval=30min)');
}
