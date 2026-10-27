"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";

export type MapBusiness = { id: string; name: string; lat: number; lng: number };
type Origin = { lat: number; lng: number } | null;

function FitToResults({ businesses, origin }: { businesses: MapBusiness[]; origin: Origin }) {
  const map = useMap();
  useEffect(() => {
    const points: L.LatLngTuple[] = businesses.map((b) => [b.lat, b.lng]);
    if (origin) points.push([origin.lat, origin.lng]);
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0] as L.LatLngTuple, 12);
    else map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 13 });
  }, [businesses, origin, map]);
  return null;
}

/** Map of the current results. Markers are approximate areas, matching what founders chose to share. */
export default function DiscoveryMap({
  businesses,
  origin,
}: {
  businesses: MapBusiness[];
  origin: Origin;
}) {
  return (
    <MapContainer
      center={[-28.5, 24.7]}
      zoom={5}
      scrollWheelZoom={false}
      className="h-72 w-full rounded-md"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToResults businesses={businesses} origin={origin} />
      {origin && (
        <Circle
          center={[origin.lat, origin.lng]}
          radius={900}
          pathOptions={{ color: "#475569", fillOpacity: 0.2 }}
        />
      )}
      {businesses.map((b) => (
        <CircleMarker
          key={b.id}
          center={[b.lat, b.lng]}
          radius={10}
          pathOptions={{ color: "#0f766e", fillColor: "#0f766e", fillOpacity: 0.75 }}
        >
          <Popup>
            <a href={`/businesses/${b.id}`} className="font-medium">
              {b.name}
            </a>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
