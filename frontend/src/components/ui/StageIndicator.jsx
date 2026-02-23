import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './StageIndicator.css';

const STAGES = [
  { id: 'analyzing', label: 'Analysing photos' },
  { id: 'writing',   label: 'Writing memoir' },
  { id: 'postcards', label: 'Generating postcards' },
  { id: 'audio',     label: 'Recording voiceover' },
  { id: 'complete',  label: 'Memoir ready' },
];

export default function StageIndicator({ currentStage }) {
  const currentIndex = STAGES.findIndex((s) => s.id === currentStage);

  return (
    <div className="stage-indicator">
      {STAGES.map((stage, i) => {
        const done    = i < currentIndex;
        const active  = i === currentIndex;
        return (
          <div
            key={stage.id}
            className={`stage ${done ? 'stage--done' : ''} ${active ? 'stage--active' : ''}`}
          >
            <div className="stage__dot">
              {done && <span className="stage__check">✓</span>}
              {active && (
                <motion.span
                  className="stage__pulse"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0.2, 0.8] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
              )}
            </div>
            <span className="stage__label">{stage.label}</span>
          </div>
        );
      })}
    </div>
  );
}
