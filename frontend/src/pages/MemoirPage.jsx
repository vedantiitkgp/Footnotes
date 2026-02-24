import { useRef, useEffect, useState } from 'react';
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
import PhotoReel from '../components/memoir/PhotoReel.jsx';
import JourneyStitcher from '../components/memoir/JourneyStitcher.jsx';
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

  const { essay, structure, postcards, audioUrl, stats, whatIf, photoUrls } = state;
  const locations  = structure?.locations || [];
  const photoFiles = state.stats?.photoFiles  || [];

  const [audioPlaying, setAudioPlaying] = useState(false);
  useAmbientSound(locations, audioPlaying);

  // ── Editable header ──────────────────────────────────────────────────────
  const HEADER_KEY = sessionId ? `memoir-header:${sessionId}` : null;
  const [headerEdits, setHeaderEdits] = useState(() => {
    if (!HEADER_KEY) return {};
    try { return JSON.parse(localStorage.getItem(HEADER_KEY) || '{}'); } catch { return {}; }
  });
  const [editingField, setEditingField] = useState(null); // 'title' | 'eyebrow'
  const [draftValue,   setDraftValue]   = useState('');

  const displayTitle   = headerEdits.title   ?? (structure?.chapters?.[0]?.title || 'A Journey in Words');
  const displayEyebrow = headerEdits.eyebrow ?? 'your memoir';

  function startEdit(field, current) {
    setEditingField(field);
    setDraftValue(current);
  }

  function commitEdit() {
    if (!editingField) return;
    const trimmed = draftValue.trim();
    const next = trimmed ? { ...headerEdits, [editingField]: trimmed } : headerEdits;
    setHeaderEdits(next);
    if (HEADER_KEY) localStorage.setItem(HEADER_KEY, JSON.stringify(next));
    setEditingField(null);
  }

  function handleEditKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') setEditingField(null);
  }

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
        if (data.photoUrls?.length) dispatch({ type: 'SET_PHOTO_URLS', payload: data.photoUrls });
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

          {/* Editable eyebrow */}
          {editingField === 'eyebrow' ? (
            <input
              className="memoir-hero__eyebrow memoir-hero__eyebrow--input"
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleEditKeyDown}
              autoFocus
              maxLength={60}
            />
          ) : (
            <p
              className="memoir-hero__eyebrow memoir-hero__editable"
              onClick={() => startEdit('eyebrow', displayEyebrow)}
              title="Click to edit"
            >
              {displayEyebrow}
              <span className="memoir-hero__edit-hint">✎</span>
            </p>
          )}

          {/* Editable title */}
          {editingField === 'title' ? (
            <textarea
              className="memoir-hero__title memoir-hero__title--input"
              value={draftValue}
              onChange={(e) => setDraftValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleEditKeyDown}
              autoFocus
              rows={2}
              maxLength={120}
            />
          ) : (
            <h1
              className="memoir-hero__title memoir-hero__editable"
              onClick={() => startEdit('title', displayTitle)}
              title="Click to edit"
            >
              {displayTitle}
              <span className="memoir-hero__edit-hint">✎</span>
            </h1>
          )}

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
            <h2 className="memoir-section__heading">Your spots</h2>
            <RouteMap locations={locations} essay={essay} sessionId={sessionId} />
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

        {/* Journey Stitcher */}
        <section className="memoir-section">
          <JourneyStitcher sessionId={sessionId} />
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

      {/* Fixed photo reel — always on top, independent of scroll */}
      <PhotoReel photoUrls={photoUrls} sessionId={sessionId} />
    </motion.div>
  );
}
