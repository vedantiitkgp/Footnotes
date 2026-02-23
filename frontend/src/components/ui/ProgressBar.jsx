import React from 'react';
import { motion } from 'framer-motion';
import './ProgressBar.css';

export default function ProgressBar({ percent = 0 }) {
  return (
    <div className="progress-bar">
      <motion.div
        className="progress-bar__fill"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        transition={{ type: 'spring', stiffness: 60, damping: 18 }}
      />
    </div>
  );
}
