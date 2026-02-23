import React, { useMemo } from 'react';
import './PhotoGrid.css';

export default function PhotoGrid({ files, onRemove }) {
  const previews = useMemo(
    () => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })),
    [files]
  );

  if (files.length === 0) return null;

  return (
    <div className="photo-grid">
      {previews.map(({ file, url }, i) => (
        <div key={file.name + file.size} className="photo-grid__item">
          <img src={url} alt={file.name} className="photo-grid__img" />
          <button
            type="button"
            className="photo-grid__remove"
            onClick={() => onRemove(i)}
            aria-label="Remove photo"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
