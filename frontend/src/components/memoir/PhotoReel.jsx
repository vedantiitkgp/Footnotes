import { useState, useEffect, useCallback } from 'react';
import './PhotoReel.css';

// ── localStorage helpers for per-photo notes ──────────────────────────────────
function getNoteKey(url)          { return `photo-note:${url}`; }
function loadNote(url)            { return url ? (localStorage.getItem(getNoteKey(url)) || '') : ''; }
function persistNote(url, text)   { localStorage.setItem(getNoteKey(url), text); }

// ── QR code URL (free public API, no auth needed) ─────────────────────────────
function qrUrl(photoUrl) {
  const full = window.location.origin + photoUrl;
  return `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(full)}&bgcolor=f9f4e8&color=2d1a0a&margin=4`;
}

export default function PhotoReel({ photoUrls = [] }) {
  const [open, setOpen]               = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [flipped, setFlipped]         = useState(false);
  const [noteText, setNoteText]       = useState('');

  const total = photoUrls.length;

  const prev = useCallback(() => setLightboxIdx((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setLightboxIdx((i) => (i + 1) % total), [total]);
  const closeLightbox = useCallback(() => { setLightboxIdx(null); setFlipped(false); }, []);

  // Load saved note + reset flip whenever the active photo changes
  useEffect(() => {
    if (lightboxIdx === null) return;
    setFlipped(false);
    setNoteText(loadNote(photoUrls[lightboxIdx]));
  }, [lightboxIdx]);

  // Persist note on change
  function handleNoteChange(e) {
    const text = e.target.value;
    setNoteText(text);
    if (lightboxIdx !== null) persistNote(photoUrls[lightboxIdx], text);
  }

  // Keyboard navigation — disabled while typing in the notes textarea
  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e) => {
      const typing = e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT';
      if (typing) {
        if (e.key === 'Escape') closeLightbox();
        return;
      }
      if      (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'Escape')     closeLightbox();
      else if (e.key === 'f' || e.key === 'F') setFlipped((f) => !f);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, prev, next, closeLightbox]);

  // Escape closes panel when no lightbox
  useEffect(() => {
    if (!open || lightboxIdx !== null) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, lightboxIdx]);

  if (!total) return null;

  const currentUrl = lightboxIdx !== null ? photoUrls[lightboxIdx] : null;

  return (
    <>
      {/* Slide-in panel */}
      <div className={`photo-reel__panel ${open ? 'photo-reel__panel--open' : ''}`}>
        <div className="photo-reel__header">
          <span className="photo-reel__title">{total} photos</span>
          <button className="photo-reel__panel-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
        </div>
        <div className="photo-reel__grid">
          {photoUrls.map((url, i) => (
            <button
              key={i}
              className="photo-reel__thumb-btn"
              onClick={() => setLightboxIdx(i)}
              aria-label={`Open photo ${i + 1}`}
            >
              <img src={url} alt="" className="photo-reel__thumb" loading="lazy" />
            </button>
          ))}
        </div>
      </div>

      {/* Toggle tab */}
      <button
        className={`photo-reel__tab ${open ? 'photo-reel__tab--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close photos' : 'Open photos'}
      >
        <span className="photo-reel__tab-grid" aria-hidden="true" />
        <span className="photo-reel__tab-text">Photos</span>
        <span className="photo-reel__tab-count">{total}</span>
      </button>

      {open && <div className="photo-reel__backdrop" onClick={() => setOpen(false)} />}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div className="photo-reel__lightbox" onClick={closeLightbox}>

          <button className="photo-reel__lb-close" onClick={closeLightbox} aria-label="Close">✕</button>

          <button
            className="photo-reel__lb-nav photo-reel__lb-nav--prev"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Previous"
          >‹</button>

          {/* 3D flip card */}
          <div
            className={`photo-reel__card ${flipped ? 'photo-reel__card--flipped' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Front: the photo ── */}
            <div className="photo-reel__card-face photo-reel__card-front">
              <img
                src={currentUrl}
                alt={`Photo ${lightboxIdx + 1} of ${total}`}
                className="photo-reel__lb-img"
              />
              <button
                className="photo-reel__flip-trigger"
                onClick={() => setFlipped(true)}
                title="Flip to postcard back (F)"
              >
                ✉ Postcard
              </button>
            </div>

            {/* ── Back: postcard ── */}
            <div className="photo-reel__card-face photo-reel__card-back">
              {/* Left: writing area */}
              <div className="postcard-left">
                <p className="postcard-label">People in this photo</p>
                <textarea
                  className="postcard-notes"
                  placeholder="Who's here? Add names, memories…"
                  value={noteText}
                  onChange={handleNoteChange}
                  spellCheck={false}
                />
                <div className="postcard-lines" aria-hidden="true">
                  {[...Array(5)].map((_, i) => <span key={i} className="postcard-line" />)}
                </div>
              </div>

              {/* Divider */}
              <div className="postcard-divider" />

              {/* Right: address + QR stamp */}
              <div className="postcard-right">
                <div className="postcard-to">
                  <span className="postcard-to__label">To</span>
                  <span className="postcard-to__line" />
                  <span className="postcard-to__line" />
                  <span className="postcard-to__line" />
                </div>

                <div className="postcard-stamp">
                  <div className="postcard-stamp__inner">
                    <img
                      src={qrUrl(currentUrl)}
                      alt="QR code — scan to view on your phone"
                      className="postcard-stamp__qr"
                      loading="lazy"
                    />
                    <span className="postcard-stamp__label">SCAN</span>
                  </div>
                </div>
              </div>

              <button
                className="photo-reel__flip-trigger photo-reel__flip-trigger--back"
                onClick={() => setFlipped(false)}
                title="Flip back to photo (F)"
              >
                ← Photo
              </button>
            </div>
          </div>

          <button
            className="photo-reel__lb-nav photo-reel__lb-nav--next"
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Next"
          >›</button>

          <div className="photo-reel__lb-counter">{lightboxIdx + 1} / {total}</div>
        </div>
      )}
    </>
  );
}
