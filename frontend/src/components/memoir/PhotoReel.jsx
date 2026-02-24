import { useState, useEffect, useCallback, useRef } from 'react';
import './PhotoReel.css';

// ── Per-photo note helpers ────────────────────────────────────────────────────
function getNoteKey(url)        { return `photo-note:${url.slice(0, 180)}`; }
function loadNote(url)          { return url ? (localStorage.getItem(getNoteKey(url)) || '') : ''; }
function persistNote(url, text) { localStorage.setItem(getNoteKey(url), text); }

// ── Extra photos per-session ──────────────────────────────────────────────────
function extraKey(sessionId)       { return `memoir-extra-photos:${sessionId}`; }
function loadExtra(sessionId)      {
  if (!sessionId) return [];
  try { return JSON.parse(localStorage.getItem(extraKey(sessionId)) || '[]'); } catch { return []; }
}
function saveExtra(sessionId, arr) {
  if (!sessionId) return;
  try { localStorage.setItem(extraKey(sessionId), JSON.stringify(arr)); }
  catch (e) { console.warn('[PhotoReel] localStorage quota exceeded:', e); }
}

// ── Compress image via canvas before storing ──────────────────────────────────
function compressImage(dataUrl, maxPx = 1200, quality = 0.72) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else                { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl); // fallback: store as-is
    img.src = dataUrl;
  });
}

// ── QR code (skip for data URLs) ──────────────────────────────────────────────
function qrUrl(photoUrl) {
  if (photoUrl.startsWith('data:')) return null;
  const full = window.location.origin + photoUrl;
  return `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(full)}&bgcolor=f9f4e8&color=2d1a0a&margin=4`;
}

export default function PhotoReel({ photoUrls = [], sessionId }) {
  const [open, setOpen]               = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [flipped, setFlipped]         = useState(false);
  const [noteText, setNoteText]       = useState('');
  const [extraPhotos, setExtraPhotos] = useState(() => loadExtra(sessionId));
  const [addError, setAddError]       = useState('');
  const fileInputRef                  = useRef(null);

  const allPhotos = [...photoUrls, ...extraPhotos];
  const total     = allPhotos.length;

  useEffect(() => { saveExtra(sessionId, extraPhotos); }, [extraPhotos, sessionId]);

  const prev = useCallback(() => setLightboxIdx((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setLightboxIdx((i) => (i + 1) % total), [total]);
  const closeLightbox = useCallback(() => { setLightboxIdx(null); setFlipped(false); }, []);

  useEffect(() => {
    if (lightboxIdx === null) return;
    setFlipped(false);
    setNoteText(loadNote(allPhotos[lightboxIdx]));
  }, [lightboxIdx]);

  function handleNoteChange(e) {
    const text = e.target.value;
    setNoteText(text);
    if (lightboxIdx !== null) persistNote(allPhotos[lightboxIdx], text);
  }

  // ── Add extra photos (compressed before storing) ─────────────────────────
  async function handleAddPhotos(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setAddError('');

    for (const file of files) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const compressed = await compressImage(ev.target.result);
        setExtraPhotos((prev) => [...prev, compressed]);
      };
      reader.readAsDataURL(file);
    }

    e.target.value = '';
  }

  function removeExtraPhoto(dataUrl) {
    setExtraPhotos((prev) => prev.filter((u) => u !== dataUrl));
    // Close lightbox if the removed photo is currently open
    if (lightboxIdx !== null && allPhotos[lightboxIdx] === dataUrl) closeLightbox();
  }

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e) => {
      const typing = e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT';
      if (typing) { if (e.key === 'Escape') closeLightbox(); return; }
      if      (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'Escape')     closeLightbox();
      else if (e.key === 'f' || e.key === 'F') setFlipped((f) => !f);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, prev, next, closeLightbox]);

  useEffect(() => {
    if (!open || lightboxIdx !== null) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, lightboxIdx]);

  if (!total && !sessionId) return null;

  const currentUrl = lightboxIdx !== null ? allPhotos[lightboxIdx] : null;
  const qr         = currentUrl ? qrUrl(currentUrl) : null;

  return (
    <>
      {/* Slide-in panel */}
      <div className={`photo-reel__panel ${open ? 'photo-reel__panel--open' : ''}`}>
        <div className="photo-reel__header">
          <span className="photo-reel__title">{total} photo{total !== 1 ? 's' : ''}</span>
          <button className="photo-reel__panel-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
        </div>

        <div className="photo-reel__grid">
          {allPhotos.map((url, i) => (
            <button
              key={i}
              className="photo-reel__thumb-btn"
              onClick={() => setLightboxIdx(i)}
              aria-label={`Open photo ${i + 1}`}
            >
              <img src={url} alt="" className="photo-reel__thumb" loading="lazy" />
              {/* Remove button only for user-added photos */}
              {url.startsWith('data:') && (
                <button
                  className="photo-reel__thumb-remove"
                  onClick={(e) => { e.stopPropagation(); removeExtraPhoto(url); }}
                  title="Remove photo"
                  aria-label="Remove photo"
                >×</button>
              )}
            </button>
          ))}
        </div>

        {/* Add photos button */}
        <div className="photo-reel__add-wrap">
          {addError && <p className="photo-reel__add-error">{addError}</p>}
          <label className="photo-reel__add-btn">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleAddPhotos}
              hidden
            />
            + Add photos
          </label>
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
            {/* Front */}
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

            {/* Back: postcard */}
            <div className="photo-reel__card-face photo-reel__card-back">
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

              <div className="postcard-divider" />

              <div className="postcard-right">
                <div className="postcard-to">
                  <span className="postcard-to__label">To</span>
                  <span className="postcard-to__line" />
                  <span className="postcard-to__line" />
                  <span className="postcard-to__line" />
                </div>

                <div className="postcard-stamp">
                  <div className="postcard-stamp__inner">
                    {qr ? (
                      <>
                        <img src={qr} alt="QR code" className="postcard-stamp__qr" loading="lazy" />
                        <span className="postcard-stamp__label">SCAN</span>
                      </>
                    ) : (
                      <span className="postcard-stamp__label" style={{ fontSize: '0.55rem', padding: '8px' }}>LOCAL PHOTO</span>
                    )}
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
