import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useSSE } from '../hooks/useSSE.js';
import { useMemoir } from '../context/MemoirContext.jsx';
import { saveToHistory } from '../utils/memoirHistory.js';
import ProgressBar from '../components/ui/ProgressBar.jsx';
import StageIndicator from '../components/ui/StageIndicator.jsx';
import './LoadingPage.css';

const PAGE_TRANSITION = {
  initial:   { opacity: 0 },
  animate:   { opacity: 1, transition: { duration: 0.5 } },
  exit:      { opacity: 0, transition: { duration: 0.3 } },
};

export default function LoadingPage() {
  const { sessionId } = useParams();
  const navigate      = useNavigate();
  const { state, dispatch } = useMemoir();

  const sseUrl = sessionId ? `/api/generate/${sessionId}` : null;

  useSSE(sseUrl, {
    progress: (data) => dispatch({ type: 'SET_PROGRESS', payload: data }),

    text_chunk: (data) => dispatch({ type: 'APPEND_TEXT', payload: data.text }),

    structure: (data) => dispatch({ type: 'SET_STRUCTURE', payload: data }),

    postcard: (data) => dispatch({ type: 'ADD_POSTCARD', payload: data }),

    audio: (data) => dispatch({ type: 'SET_AUDIO', payload: data.url }),

    stats: (data) => dispatch({ type: 'SET_STATS', payload: data }),

    complete: () => {
      dispatch({ type: 'SET_COMPLETE' });
      const title = state.structure?.chapters?.[0]?.title || 'A Journey in Words';
      const locations = state.structure?.locations || [];
      saveToHistory(sessionId, title, locations);
      navigate(`/memoir/${sessionId}`, { replace: true });
    },

    error: (data) => {
      dispatch({ type: 'SET_ERROR', payload: data });
    },
  });

  const { progress, error } = state;
  const { stage, percent, message } = progress;

  return (
    <motion.div className="loading-page" {...PAGE_TRANSITION}>
      <div className="loading-page__content">
        <motion.div
          className="loading-page__logo"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          ✦
        </motion.div>

        <h1 className="loading-page__title">Crafting your memoir</h1>
        <p className="loading-page__subtitle">
          {message || 'Our AI is reading your photos and building your story…'}
        </p>

        <div className="loading-page__progress">
          <ProgressBar percent={percent} />
          <span className="loading-page__pct">{percent}%</span>
        </div>

        <StageIndicator currentStage={stage} />

        {error && (
          <div className="loading-page__error">
            <p>Something went wrong: {error.message}</p>
            <button onClick={() => navigate('/upload')} className="loading-page__retry">
              Try again
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
