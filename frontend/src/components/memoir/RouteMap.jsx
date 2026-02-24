import { useState, useEffect, Suspense, lazy } from 'react';
import './RouteMap.css';

const LeafletMap = lazy(() => import('./LeafletMap.jsx'));

export default function RouteMap({ locations = [], essay = '', sessionId = '' }) {
  const storageKey = sessionId ? `memoir-removed-pins:${sessionId}` : null;

  const [allPoints, setAllPoints] = useState([]);
  const [removed, setRemoved]     = useState(() => {
    if (!storageKey) return [];
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; }
  });
  const [geocoding, setGeocoding] = useState(false);

  // Persist removed pins to localStorage whenever they change
  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(removed));
  }, [removed, storageKey]);

  // Geocode all location strings via backend proxy (Nominatim, throttled 1/s)
  useEffect(() => {
    if (!locations.length) { setAllPoints([]); return; }

    setGeocoding(true);
    const params = locations
      .slice(0, 8)
      .map((l) => `q=${encodeURIComponent(l)}`)
      .join('&');

    fetch(`/api/geocode?${params}`)
      .then((r) => r.json())
      .then((data) => setAllPoints(data))
      .catch(() => setAllPoints([]))
      .finally(() => setGeocoding(false));
  }, [locations.join('||')]);

  const visiblePoints = allPoints.filter((p) => !removed.find((r) => r.name === p.name));

  function handleRemove(point) {
    setRemoved((prev) => [...prev, point]);
  }
  function handleRestore(point) {
    setRemoved((prev) => prev.filter((r) => r.name !== point.name));
  }

  if (locations.length === 0) {
    return (
      <div className="route-map route-map--empty">
        <p>Route map will appear once locations are detected.</p>
      </div>
    );
  }

  if (geocoding) {
    return (
      <div className="route-map route-map--loading">
        <p className="route-map__locations-label">Plotting your route…</p>
      </div>
    );
  }

  if (allPoints.length === 0) {
    return (
      <div className="route-map route-map--fallback">
        <p className="route-map__locations-label">Locations visited</p>
        <p className="route-map__locations">{locations.join(' · ')}</p>
      </div>
    );
  }

  return (
    <div className="route-map">
      <div className="route-map__side-left" />
      <div className="route-map__side-right" />

      <Suspense fallback={<div className="route-map__loading">Loading map…</div>}>
        <LeafletMap points={visiblePoints} essay={essay} onRemove={handleRemove} />
      </Suspense>

      {/* Removed pins — click to restore */}
      {removed.length > 0 && (
        <div className="route-map__removed">
          <span className="route-map__removed-label">Hidden pins:</span>
          {removed.map((p) => (
            <button
              key={p.name}
              className="route-map__restore-chip"
              onClick={() => handleRestore(p)}
              title="Restore to map"
            >
              {p.name} +
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
