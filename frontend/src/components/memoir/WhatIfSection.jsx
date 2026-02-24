import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './WhatIfSection.css';

export default function WhatIfSection({ items }) {
  const [revealed, setRevealed] = useState({});

  if (!items?.length) return null;

  return (
    <section className="whatif">
      <div className="whatif__header">
        <span className="whatif__eyebrow">but wait…</span>
        <h2 className="whatif__title">What If?</h2>
        <p className="whatif__subtitle">Six questions your travel companions are too polite to ask.</p>
      </div>

      <div className="whatif__cards">
        {items.map((item, i) => (
          <motion.div
            key={i}
            className="whatif__card"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.12, duration: 0.5, ease: 'easeOut' }}
          >
            <span className="whatif__num">{String(i + 1).padStart(2, '0')}</span>
            <p className="whatif__question">{item.question}</p>

            <AnimatePresence mode="wait">
              {revealed[i] ? (
                <motion.p
                  key="answer"
                  className="whatif__answer"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.35 }}
                >
                  {item.answer}
                </motion.p>
              ) : (
                <motion.button
                  key="btn"
                  className="whatif__reveal"
                  onClick={() => setRevealed((p) => ({ ...p, [i]: true }))}
                  exit={{ opacity: 0 }}
                >
                  Reveal fate →
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
