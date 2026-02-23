import React from 'react';
import './TripStatsCard.css';

export default function TripStatsCard({ stats }) {
  if (!stats) return null;
  const { locations, days, photoCount, wordCount } = stats;

  const items = [
    { label: 'Locations', value: locations, icon: '◈' },
    { label: 'Days', value: days || '—', icon: '◷' },
    { label: 'Photos', value: photoCount, icon: '⊡' },
    { label: 'Words', value: wordCount?.toLocaleString(), icon: '✦' },
  ];

  return (
    <div className="trip-stats">
      {items.map((item) => (
        <div key={item.label} className="trip-stats__item">
          <span className="trip-stats__icon">{item.icon}</span>
          <span className="trip-stats__value">{item.value}</span>
          <span className="trip-stats__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
