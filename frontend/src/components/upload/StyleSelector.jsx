import React from 'react';
import './StyleSelector.css';

const STYLES = [
  { id: 'literary',     label: 'Literary',     desc: 'Lyrical prose, rich metaphors' },
  { id: 'journal',      label: 'Journal',       desc: 'Personal, intimate diary tone' },
  { id: 'journalistic', label: 'Journalistic',  desc: 'Vivid, reportage-style narrative' },
  { id: 'poetic',       label: 'Poetic',        desc: 'Verse-prose hybrid, evocative' },
];

export default function StyleSelector({ value, onChange }) {
  return (
    <div className="style-selector">
      <p className="style-selector__label">Writing style</p>
      <div className="style-selector__grid">
        {STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`style-option ${value === s.id ? 'style-option--active' : ''}`}
            onClick={() => onChange(s.id)}
          >
            <span className="style-option__name">{s.label}</span>
            <span className="style-option__desc">{s.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
