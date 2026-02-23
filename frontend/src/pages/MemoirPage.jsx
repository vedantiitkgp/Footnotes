import React, { useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMemoir } from '../context/MemoirContext.jsx';
import EssayRenderer from '../components/memoir/EssayRenderer.jsx';
import RouteMap from '../components/memoir/RouteMap.jsx';
import TripStatsCard from '../components/memoir/TripStatsCard.jsx';
import StickyAudioPlayer from '../components/audio/StickyAudioPlayer.jsx';
import ExportPanel from '../components/memoir/ExportPanel.jsx';
import './MemoirPage.css';

const PAGE_TRANSITION = {
  initial:   { opacity: 0 },
  animate:   { opacity: 1, transition: { duration: 0.6 } },
  exit:      { opacity: 0, transition: { duration: 0.3 } },
};

export default function MemoirPage() {
  const { sessionId } = useParams();
  const navigate      = useNavigate();
  const { state }     = useMemoir();
  const memoirRef     = useRef(null);

  const { essay, structure, postcards, audioUrl, stats } = state;
  const locations  = structure?.locations || [];
  const photoFiles = state.stats?.photoFiles  || [];

  if (!essay && !state.isComplete) {
    return (
      <div className="memoir-empty">
        <p>No memoir found. <button onClick={() => navigate('/upload')}>Create one →</button></p>
      </div>
    );
  }

  return (
    <motion.div className="memoir-page" {...PAGE_TRANSITION}>
      {/* Sticky Audio Player */}
      {audioUrl && <StickyAudioPlayer audioUrl={audioUrl} />}

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
            <RouteMap locations={locations} />
          </section>
        )}

        {/* Essay */}
        <section className="memoir-section memoir-section--essay">
          <EssayRenderer
            essay={essay}
            postcards={postcards}
            photoFiles={photoFiles}
            sessionId={sessionId}
            locations={locations}
          />
        </section>

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
