import React, { useMemo, Suspense, lazy } from 'react';
import './RouteMap.css';

// Geocode location names to rough coordinates (built-in lookup for demo)
const LOCATION_COORDS = {
  'paris': [48.8566, 2.3522], 'london': [51.5074, -0.1278],
  'rome': [41.9028, 12.4964], 'tokyo': [35.6762, 139.6503],
  'new york': [40.7128, -74.006], 'barcelona': [41.3851, 2.1734],
  'amsterdam': [52.3676, 4.9041], 'berlin': [52.52, 13.405],
  'marrakech': [31.6295, -7.9811], 'sahara': [23.4162, 25.6628],
  'chefchaouen': [35.1688, -5.2636], 'morocco': [31.7917, -7.0926],
  'iceland': [64.9631, -19.0208], 'reykjavik': [64.1466, -21.9426],
  'bali': [-8.3405, 115.092], 'thailand': [15.87, 100.9925],
  'india': [20.5937, 78.9629], 'greece': [39.0742, 21.8243],
  'spain': [40.4637, -3.7492], 'italy': [41.8719, 12.5674],
  'portugal': [39.3999, -8.2245], 'lisbon': [38.7223, -9.1393],
  'istanbul': [41.0082, 28.9784], 'dubai': [25.2048, 55.2708],
  'singapore': [1.3521, 103.8198], 'hong kong': [22.3193, 114.1694],
  'australia': [-25.2744, 133.7751], 'sydney': [-33.8688, 151.2093],
  'new zealand': [-40.9006, 174.886], 'canada': [56.1304, -106.3468],
  'mexico': [23.6345, -102.5528], 'peru': [-9.19, -75.0152],
  'brazil': [-14.235, -51.9253], 'argentina': [-38.4161, -63.6167],
  'egypt': [26.8206, 30.8025], 'kenya': [-0.0236, 37.9062],
  'south africa': [-30.5595, 22.9375], 'vietnam': [14.0583, 108.2772],
  'japan': [36.2048, 138.2529], 'china': [35.8617, 104.1954],
  'nepal': [28.3949, 84.124], 'tibet': [29.6457, 91.1179],
  'myanmar': [16.8661, 96.1951], 'cambodia': [12.5657, 104.9910],
};

function findCoords(location) {
  const key = location.toLowerCase().trim();
  for (const [name, coords] of Object.entries(LOCATION_COORDS)) {
    if (key.includes(name) || name.includes(key)) return coords;
  }
  return null;
}

// Lazy-load the actual map to avoid SSR/import issues
const LeafletMap = lazy(() => import('./LeafletMap.jsx'));

export default function RouteMap({ locations = [] }) {
  const points = useMemo(() => {
    return locations
      .map((loc) => ({ name: loc, coords: findCoords(loc) }))
      .filter((p) => p.coords !== null);
  }, [locations]);

  if (locations.length === 0) {
    return (
      <div className="route-map route-map--empty">
        <p>Route map will appear once locations are detected.</p>
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
      <Suspense fallback={<div className="route-map__loading">Loading map…</div>}>
        <LeafletMap points={points} />
      </Suspense>
    </div>
  );
}
