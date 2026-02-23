import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getHistory, removeFromHistory } from '../utils/memoirHistory.js';
import './HistoryPage.css';

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -20, transition: { duration: 0.3 } },
};

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// Merge server list + localStorage, deduplicate by sessionId, sort newest first
function mergeEntries(serverList, localList) {
  const map = new Map();
  for (const e of localList) map.set(e.sessionId, e);
  for (const e of serverList) map.set(e.sessionId, { ...map.get(e.sessionId), ...e });
  return [...map.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState(() => getHistory());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/memoir/')
      .then((r) => r.ok ? r.json() : [])
      .then((serverList) => {
        setEntries(mergeEntries(serverList, getHistory()));
      })
      .catch(() => {
        setEntries(getHistory());
      })
      .finally(() => setLoading(false));
  }, []);

  function handleRemove(sessionId) {
    removeFromHistory(sessionId);
    setEntries((prev) => prev.filter((e) => e.sessionId !== sessionId));
  }

  return (
    <motion.div className="history-page" {...PAGE_TRANSITION}>
      <div className="history-page__header container">
        <Link to="/upload" className="history-page__back">← Back to upload</Link>
        <h1 className="history-page__title">My Memoirs</h1>
        <p className="history-page__subtitle">Your past creations, ready to revisit.</p>
      </div>

      <main className="history-page__main container">
        {loading ? (
          <div className="history-empty">
            <p className="history-empty__text">Loading…</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="history-empty">
            <p className="history-empty__text">No memoirs yet — create your first one.</p>
            <button className="history-empty__cta" onClick={() => navigate('/upload')}>
              Create a memoir →
            </button>
          </div>
        ) : (
          <div className="history-grid">
            {entries.map((entry) => (
              <div key={entry.sessionId} className="history-card">
                <div className="history-card__body">
                  <h2 className="history-card__title">{entry.title}</h2>
                  {entry.locations?.length > 0 && (
                    <div className="history-card__locations">
                      {entry.locations.slice(0, 5).map((loc) => (
                        <span key={loc} className="history-card__pill">{loc}</span>
                      ))}
                    </div>
                  )}
                  <p className="history-card__date">{formatDate(entry.createdAt)}</p>
                </div>
                <div className="history-card__actions">
                  <Link
                    to={`/memoir/${entry.sessionId}`}
                    className="history-card__open"
                  >
                    Open →
                  </Link>
                  <button
                    className="history-card__remove"
                    onClick={() => handleRemove(entry.sessionId)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </motion.div>
  );
}
