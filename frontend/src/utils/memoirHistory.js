const STORAGE_KEY = 'memoir_history';
const MAX_ENTRIES = 20;

export function saveToHistory(sessionId, title, locations, createdAt = new Date().toISOString()) {
  const history = getHistory().filter((e) => e.sessionId !== sessionId);
  history.unshift({ sessionId, title, locations, createdAt });
  if (history.length > MAX_ENTRIES) history.splice(MAX_ENTRIES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // storage full or unavailable — silently skip
  }
}

export function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function removeFromHistory(sessionId) {
  const history = getHistory().filter((e) => e.sessionId !== sessionId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}
