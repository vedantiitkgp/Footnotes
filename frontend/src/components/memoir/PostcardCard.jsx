import React, { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import './PostcardCard.css';

const ROTATIONS = [-2.5, 1.8, -1.2, 2.2, -0.8];

export default function PostcardCard({ url, index, location = 'the journey' }) {
  const cardRef    = useRef(null);
  const [saving, setSaving] = useState(false);
  const rotation   = ROTATIONS[index % ROTATIONS.length];

  async function downloadPostcard() {
    if (!cardRef.current || saving) return;
    setSaving(true);
    try {
      const { default: html2canvas } = await import('html2canvas');

      // Pre-fetch the postcard image as a data URL so html2canvas never needs
      // to make its own (potentially CORS-blocked) request for it.
      const imgEl = cardRef.current.querySelector('.postcard__img');
      let originalSrc = null;
      if (imgEl?.src) {
        try {
          originalSrc = imgEl.src;
          const res = await fetch(imgEl.src);
          const blob = await res.blob();
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          imgEl.src = dataUrl;
        } catch (fetchErr) {
          console.warn('[postcard] Image pre-fetch failed:', fetchErr);
        }
      }

      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: false,
        allowTaint: false,
        logging: false,
      });

      // Restore original src before triggering download
      if (originalSrc && imgEl) imgEl.src = originalSrc;

      const link = document.createElement('a');
      link.download = `postcard-${location.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('[postcard] Download failed:', e);
    }
    setSaving(false);
  }

  return (
    <div className="postcard-scene">
      {/* Outer wrapper: entrance + hover */}
      <motion.div
        className="postcard-entrance"
        style={{ rotate: rotation }}
        initial={{ opacity: 0, y: 50, scale: 0.82 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ type: 'spring', stiffness: 80, damping: 13, delay: index * 0.15 }}
        whileHover={{ rotate: 0, scale: 1.04, y: -12, transition: { duration: 0.3, ease: 'easeOut' } }}
      >
        {/* Float wrapper (CSS animation, paused on hover) */}
        <div
          className="postcard-float"
          style={{ animationDelay: `${index * 0.6}s` }}
        >
          {/* The physical card */}
          <div className="postcard" ref={cardRef}>

            {/* Airmail border stripes — top */}
            <div className="postcard__stripe postcard__stripe--top" />

            {/* Image */}
            <div className="postcard__image-wrap">
              <img
                src={url}
                alt={`Postcard from ${location}`}
                className="postcard__img"
                crossOrigin="anonymous"
              />
              {/* Vignette */}
              <div className="postcard__vignette" />
            </div>

            {/* Caption strip */}
            <div className="postcard__caption">
              <div className="postcard__caption-left">
                <p className="postcard__greeting">Greetings from</p>
                <p className="postcard__location">{location}</p>
              </div>
              <div className="postcard__stamp">
                <div className="postcard__stamp-frame">
                  <span className="postcard__stamp-icon">✦</span>
                  <span className="postcard__stamp-word">MEMOIR</span>
                </div>
              </div>
            </div>

            {/* Postmark circle — overlaid on image corner */}
            <div className="postcard__postmark">
              <span className="postcard__postmark-year">2026</span>
              <span className="postcard__postmark-line" />
              <span className="postcard__postmark-label">AIR MAIL</span>
            </div>

            {/* Photo corner marks */}
            <div className="postcard__corner postcard__corner--tl" />
            <div className="postcard__corner postcard__corner--tr" />
            <div className="postcard__corner postcard__corner--bl" />
            <div className="postcard__corner postcard__corner--br" />

            {/* Airmail border stripes — bottom */}
            <div className="postcard__stripe postcard__stripe--bottom" />
          </div>
        </div>

        {/* Save button — outside card so it doesn't appear in export */}
        <button
          className={`postcard__save ${saving ? 'postcard__save--loading' : ''}`}
          onClick={downloadPostcard}
          disabled={saving}
          title="Save postcard as PNG"
        >
          {saving ? '…' : '↓ Save postcard'}
        </button>
      </motion.div>
    </div>
  );
}
