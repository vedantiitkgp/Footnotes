import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import './LandingPage.css';

const FEATURES = [
  { icon: '⊡', title: 'Photo Analysis',    desc: 'Gemini Vision reads your photos, detecting locations, moods, and timeline.' },
  { icon: '✦', title: 'Literary Essay',    desc: 'A streaming AI-generated travel essay in your chosen prose style.' },
  { icon: '◈', title: 'AI Postcards',      desc: 'Imagen 4 fills narrative gaps with evocative travel postcards.' },
  { icon: '◷', title: 'Audio Voiceover',   desc: 'Gemini TTS narrates your memoir in a rich, cinematic voice.' },
];

const CONTAINER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const ITEM = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

const PAGE_TRANSITION = {
  initial:   { opacity: 0 },
  animate:   { opacity: 1, transition: { duration: 0.6 } },
  exit:      { opacity: 0, transition: { duration: 0.3 } },
};

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <motion.div className="landing" {...PAGE_TRANSITION}>
      {/* Background ornament */}
      <div className="landing__bg-orb" aria-hidden="true" />

      {/* Nav */}
      <nav className="landing__nav container">
        <span className="landing__brand">✦ Memoir</span>
      </nav>

      {/* Hero */}
      <section className="landing__hero container">
        <motion.p
          className="landing__eyebrow"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.1, duration: 0.5 } }}
        >
          Your travel photos deserve a story
        </motion.p>

        <motion.h1
          className="landing__headline"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.2, duration: 0.6 } }}
        >
          Transform memories<br />
          into a <em>memoir</em>
        </motion.h1>

        <motion.p
          className="landing__sub"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0, transition: { delay: 0.35, duration: 0.5 } }}
        >
          Upload your trip photos and a short description. Our AI crafts a literary
          travel essay — with an interactive map, AI-generated postcards, and an
          audio voiceover — streamed to you in real time.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1, transition: { delay: 0.5, duration: 0.4 } }}
        >
          <button className="landing__cta" onClick={() => navigate('/upload')}>
            Begin your memoir →
          </button>
        </motion.div>
      </section>

      {/* Features */}
      <section className="landing__features container">
        <hr className="gold-divider" />
        <motion.div
          className="landing__features-grid"
          variants={CONTAINER}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
        >
          {FEATURES.map((f) => (
            <motion.div key={f.title} className="feature-card" variants={ITEM}>
              <span className="feature-card__icon">{f.icon}</span>
              <h3 className="feature-card__title">{f.title}</h3>
              <p className="feature-card__desc">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* CTA strip */}
      <section className="landing__cta-strip container">
        <p className="landing__cta-strip-text">
          Ready to preserve your journey?
        </p>
        <button className="landing__cta landing__cta--sm" onClick={() => navigate('/upload')}>
          Create my memoir
        </button>
      </section>

      <footer className="landing__footer container">
        <p>Built with Gemini 2.0 Flash · Imagen 4 · Gemini TTS</p>
      </footer>
    </motion.div>
  );
}
