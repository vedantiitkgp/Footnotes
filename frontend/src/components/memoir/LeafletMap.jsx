import React from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons for bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const markerHtmlStyle = `
  width: 12px; height: 12px;
  background: #c9a96e;
  border-radius: 50%;
  border: 2px solid #0a0a0a;
  box-shadow: 0 0 8px rgba(201,169,110,0.6);
`;

const goldIcon = L.divIcon({
  className: '',
  html: `<div style="${markerHtmlStyle}"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
  popupAnchor: [0, -8],
});

export default function LeafletMap({ points }) {
  const center   = points[Math.floor(points.length / 2)].coords;
  const polyline = points.map((p) => p.coords);

  return (
    <MapContainer
      center={center}
      zoom={points.length === 1 ? 6 : 4}
      style={{ height: '380px', width: '100%', borderRadius: '8px' }}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        maxZoom={19}
      />
      {polyline.length > 1 && (
        <Polyline
          positions={polyline}
          color="#c9a96e"
          weight={2}
          opacity={0.75}
          dashArray="8 5"
        />
      )}
      {points.map((p, i) => (
        <Marker key={i} position={p.coords} icon={goldIcon}>
          <Popup>{p.name}</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
