import { useState, useEffect, useCallback } from 'react';
import './PhotoReel.css';

export default function PhotoReel({ photoUrls = [] }) {
  const [open, setOpen]           = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(null);

  const total = photoUrls.length;

  const prev = useCallback(() => setLightboxIdx((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setLightboxIdx((i) => (i + 1) % total), [total]);
  const closeLightbox = useCallback(() => setLightboxIdx(null), []);

  // Keyboard nav in lightbox
  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e) => {
      if      (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'Escape')     closeLightbox();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, prev, next, closeLightbox]);

  // Escape to close panel (when no lightbox open)
  useEffect(() => {
    if (!open || lightboxIdx !== null) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, lightboxIdx]);

  if (!total) return null;

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

      {/* Toggle tab — always visible on right edge */}
      <button
        className={`photo-reel__tab ${open ? 'photo-reel__tab--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close photos' : 'Open photos'}
      >
        <span className="photo-reel__tab-grid" aria-hidden="true" />
        <span className="photo-reel__tab-text">Photos</span>
        <span className="photo-reel__tab-count">{total}</span>
      </button>

      {/* Backdrop — click outside to close panel */}
      {open && <div className="photo-reel__backdrop" onClick={() => setOpen(false)} />}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div className="photo-reel__lightbox" onClick={closeLightbox}>
          <button className="photo-reel__lb-close" onClick={closeLightbox} aria-label="Close lightbox">✕</button>

          <button
            className="photo-reel__lb-nav photo-reel__lb-nav--prev"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Previous photo"
          >‹</button>

          <img
            src={photoUrls[lightboxIdx]}
            alt={`Photo ${lightboxIdx + 1} of ${total}`}
            className="photo-reel__lb-img"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            className="photo-reel__lb-nav photo-reel__lb-nav--next"
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Next photo"
          >›</button>

          <div className="photo-reel__lb-counter">{lightboxIdx + 1} / {total}</div>
        </div>
      )}
    </>
  );
}
