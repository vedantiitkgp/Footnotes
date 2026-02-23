import React, { useRef, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMemoir } from '../context/MemoirContext.jsx';
import { useAmbientSound } from '../hooks/useAmbientSound.js';
import EssayRenderer from '../components/memoir/EssayRenderer.jsx';
import RouteMap from '../components/memoir/RouteMap.jsx';
import TripStatsCard from '../components/memoir/TripStatsCard.jsx';
import StickyAudioPlayer from '../components/audio/StickyAudioPlayer.jsx';
import ExportPanel from '../components/memoir/ExportPanel.jsx';
import WhatIfSection from '../components/memoir/WhatIfSection.jsx';
import './MemoirPage.css';

const PAGE_TRANSITION = {
  initial:   { opacity: 0 },
  animate:   { opacity: 1, transition: { duration: 0.6 } },
  exit:      { opacity: 0, transition: { duration: 0.3 } },
};

export default function MemoirPage() {
  const { sessionId } = useParams();
  const navigate      = useNavigate();
  const { state, dispatch } = useMemoir();
  const memoirRef     = useRef(null);
  const essayRef      = useRef(null);
  // Start hydrating if this session's data isn't already in context
  const alreadyLoaded = state.sessionId === sessionId && state.isComplete;
  const [hydrating, setHydrating] = useState(!!sessionId && !alreadyLoaded);
  const [hydrateFailed, setHydrateFailed] = useState(false);

  const { essay, structure, postcards, audioUrl, stats, whatIf } = state;
  const locations  = structure?.locations || [];
  const photoFiles = state.stats?.photoFiles  || [];

  const [audioPlaying, setAudioPlaying] = useState(false);
  useAmbientSound(locations, audioPlaying);

  // Reset word/line highlights when audio changes (new memoir or URL change)
  useEffect(() => { essayRef.current?.reset(); }, [audioUrl]);

  // Track which sessionId is currently loaded so we can detect session switches
  const loadedSessionRef = useRef(
    (state.sessionId === sessionId && state.isComplete) ? sessionId : null
  );

  // Fetch memoir from API when: first load (refresh/share), or switching to a different session
  useEffect(() => {
    if (!sessionId) return;
    if (loadedSessionRef.current === sessionId) return; // already have this session's data

    // Reset any stale context from a different session
    dispatch({ type: 'RESET' });
    setHydrating(true);
    setHydrateFailed(false);

    fetch(`/api/memoir/${sessionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        loadedSessionRef.current = sessionId;
        if (!data) { setHydrateFailed(true); return; }
        dispatch({ type: 'SET_SESSION', payload: sessionId });
        dispatch({ type: 'APPEND_TEXT', payload: data.essay });
        dispatch({ type: 'SET_STRUCTURE', payload: data.structure });
        data.postcards.forEach((p) => dispatch({ type: 'ADD_POSTCARD', payload: p }));
        if (data.audioUrl) dispatch({ type: 'SET_AUDIO', payload: data.audioUrl });
        if (data.stats) dispatch({ type: 'SET_STATS', payload: data.stats });
        if (data.whatIf?.length) dispatch({ type: 'SET_WHAT_IF', payload: data.whatIf });
        dispatch({ type: 'SET_COMPLETE' });
      })
      .catch(() => setHydrateFailed(true))
      .finally(() => setHydrating(false));
  }, [sessionId]);

  if (hydrating) {
    return (
      <div className="memoir-empty">
        <p>Loading your memoir…</p>
      </div>
    );
  }

  if (hydrateFailed || (!essay && !state.isComplete)) {
    return (
      <div className="memoir-empty">
        <p>No memoir found. <button onClick={() => navigate('/upload')}>Create one →</button></p>
      </div>
    );
  }

  return (
    <motion.div className="memoir-page" {...PAGE_TRANSITION}>
      {/* Sticky Audio Player */}
      {audioUrl && (
        <StickyAudioPlayer
          audioUrl={audioUrl}
          onTimeUpdate={(t, d) => essayRef.current?.highlight(t, d)}
          onPlayStateChange={setAudioPlaying}
        />
      )}

      {/* Hero */}
      <header className="memoir-hero">
        <div className="memoir-hero__inner container">
          <p className="memoir-hero__eyebrow">your memoir</p>
          <h1 className="memoir-hero__title">
            {structure?.chapters?.[0]?.title || 'A Journey in Words'}
          </h1>
          {locations.length > 0 && (
            <p className="memoir-hero__locations">
              {locations.slice(0, 5).join(' · ')}
            </p>
          )}
          <div className="memoir-hero__divider" />
          <ExportPanel sessionId={sessionId} memoirRef={memoirRef} />
        </div>
      </header>

      {/* Main content */}
      <main className="memoir-main container" ref={memoirRef}>
        {/* Stats */}
        {stats && (
          <section className="memoir-section">
            <TripStatsCard stats={stats} />
          </section>
        )}

        {/* Map */}
        {locations.length > 0 && (
          <section className="memoir-section">
            <h2 className="memoir-section__heading">Your route</h2>
            <RouteMap locations={locations} essay={essay} />
          </section>
        )}

        {/* Essay */}
        <section className="memoir-section memoir-section--essay">
          <EssayRenderer
            ref={essayRef}
            essay={essay}
            postcards={postcards}
            photoFiles={photoFiles}
            sessionId={sessionId}
            locations={locations}
          />
        </section>

        {/* What If */}
        {whatIf?.length > 0 && (
          <section className="memoir-section">
            <WhatIfSection items={whatIf} />
          </section>
        )}

        {/* Footer */}
        <footer className="memoir-footer">
          <div className="gold-divider" />
          <p className="memoir-footer__text">
            Created with <span className="text-gold">Memoir</span> · Powered by Gemini AI
          </p>
          <button className="memoir-footer__new" onClick={() => navigate('/upload')}>
            Create another memoir →
          </button>
        </footer>
      </main>
    </motion.div>
  );
}
