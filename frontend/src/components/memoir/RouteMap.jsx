import { useState, useEffect, Suspense, lazy } from 'react';
import './RouteMap.css';

const LeafletMap = lazy(() => import('./LeafletMap.jsx'));

export default function RouteMap({ locations = [], essay = '' }) {
  const [points, setPoints] = useState([]);
  const [geocoding, setGeocoding] = useState(false);

  // Geocode all location strings via backend proxy (Nominatim, throttled 1/s)
  useEffect(() => {
    if (!locations.length) { setPoints([]); return; }

    setGeocoding(true);
    const params = locations
      .slice(0, 8)
      .map((l) => `q=${encodeURIComponent(l)}`)
      .join('&');

    fetch(`/api/geocode?${params}`)
      .then((r) => r.json())
      .then((data) => setPoints(data))
      .catch(() => setPoints([]))
      .finally(() => setGeocoding(false));
  }, [locations.join('||')]);

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

  if (points.length === 0) {
    return (
      <div className="route-map route-map--fallback">
        <p className="route-map__locations-label">Locations visited</p>
        <p className="route-map__locations">{locations.join(' · ')}</p>
      </div>
    );
  }

  return (
    <div className="route-map">
      {/* Side fades */}
      <div className="route-map__side-left" />
      <div className="route-map__side-right" />

      <Suspense fallback={<div className="route-map__loading">Loading map…</div>}>
        <LeafletMap points={points} essay={essay} />
      </Suspense>
    </div>
  );
}
