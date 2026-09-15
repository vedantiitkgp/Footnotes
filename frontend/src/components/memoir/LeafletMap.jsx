import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ── Force Leaflet to recalculate size after lazy-load ─────────────────────────
function MapInitializer({ points }) {
  const map = useMap();
  useEffect(() => {
    // Small delay ensures the container has its final CSS dimensions
    const t = setTimeout(() => {
      map.invalidateSize();
      if (points.length === 0) return;
      if (points.length === 1) {
        map.setView(points[0].coords, 8);
        return;
      }
      const bounds = L.latLngBounds(points.map((p) => p.coords));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 7 });
    }, 150);
    return () => clearTimeout(t);
  }, [map, points]);
  return null;
}

// ── Animated trail that draws itself ──────────────────────────────────────────
function TrailAnimator({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points.length < 2) return;
    const coords = points.map((p) => p.coords);

    const line = L.polyline([], {
      color: '#c9a96e',
      weight: 2,
      opacity: 0,
      dashArray: '10 7',
    }).addTo(map);

    // Fade in the line first, then draw point by point
    let idx = 0;
    let opacity = 0;
    const fadeIn = setInterval(() => {
      opacity = Math.min(opacity + 0.05, 0.75);
      line.setStyle({ opacity });
      if (opacity >= 0.75) clearInterval(fadeIn);
    }, 40);

    const draw = setInterval(() => {
      if (idx < coords.length) {
        line.addLatLng(coords[idx]);
        idx++;
      } else {
        clearInterval(draw);
      }
    }, 500);

    return () => {
      clearInterval(fadeIn);
      clearInterval(draw);
      map.removeLayer(line);
    };
  }, [map, points]);

  return null;
}

// ── Pulsing custom marker ─────────────────────────────────────────────────────
function pulsingIcon(isFirst, isLast) {
  const size    = isFirst || isLast ? 18 : 12;
  const ringSize = size + 14;
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:${ringSize}px;height:${ringSize}px;">
        <div style="
          position:absolute;top:50%;left:50%;
          width:${ringSize}px;height:${ringSize}px;
          margin:-${ringSize/2}px 0 0 -${ringSize/2}px;
          border:1.5px solid rgba(201,169,110,0.55);
          border-radius:50%;
          animation:map-pulse 2.2s ease-out infinite;
        "></div>
        <div style="
          position:absolute;top:50%;left:50%;
          width:${size}px;height:${size}px;
          margin:-${size/2}px 0 0 -${size/2}px;
          background:${isFirst ? '#e8c97a' : isLast ? '#e8c97a' : '#c9a96e'};
          border-radius:50%;
          border:2px solid #0a0a0a;
          box-shadow:0 0 ${isFirst||isLast?14:8}px rgba(201,169,110,${isFirst||isLast?0.8:0.5});
        "></div>
      </div>`,
    iconSize: [ringSize, ringSize],
    iconAnchor: [ringSize / 2, ringSize / 2],
    popupAnchor: [0, -(ringSize / 2 + 4)],
  });
}

// ── Find a sentence in the essay mentioning a location ───────────────────────
function findExcerpt(essay, name) {
  if (!essay || !name) return null;
  const sentences = essay.split(/(?<=[.!?])\s+/);
  const loc = name.toLowerCase();
  const found = sentences.find((s) => s.toLowerCase().includes(loc));
  return found ? found.trim().slice(0, 110) + (found.trim().length > 110 ? '…' : '') : null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LeafletMap({ points, essay = '', onRemove }) {
  const center = points[Math.floor(points.length / 2)]?.coords ?? [20, 0];

  return (
    <MapContainer
      center={center}
      zoom={5}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={true}
      zoomControl={true}
      attributionControl={false}
    >
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={16}
        maxZoom={19}
      />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={16}
        maxZoom={19}
      />

      <MapInitializer points={points} />
      <TrailAnimator points={points} />

      {points.map((p, i) => {
        const excerpt = findExcerpt(essay, p.name);
        return (
          <Marker
            key={p.name}
            position={p.coords}
            icon={pulsingIcon(i === 0, i === points.length - 1)}
          >
            <Popup>
              <strong style={{ fontFamily: 'var(--font-serif,Georgia)', fontSize: '0.95rem', color: '#e8c97a' }}>
                {p.name}
              </strong>
              {excerpt && (
                <p style={{ margin: '6px 0 0', fontStyle: 'italic', opacity: 0.8, fontSize: '0.8rem', lineHeight: 1.5 }}>
                  "{excerpt}"
                </p>
              )}
              {onRemove && (
                <button
                  onClick={() => onRemove(p)}
                  style={{
                    display: 'block',
                    marginTop: '10px',
                    background: 'none',
                    border: '1px solid rgba(201,169,110,0.35)',
                    color: 'rgba(201,169,110,0.75)',
                    fontSize: '0.72rem',
                    letterSpacing: '0.08em',
                    padding: '3px 9px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  ✕ Remove pin
                </button>
              )}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
