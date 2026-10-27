"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { Circle, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

export type MapPoint = { lat: number; lng: number };

function ClickToPick({ onPick }: { onPick: (point: MapPoint) => void }) {
  useMapEvents({ click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

function Focus({ focus }: { focus: MapPoint | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.setView([focus.lat, focus.lng], Math.max(map.getZoom(), 12));
  }, [focus, map]);
  return null;
}

type Props = { point: MapPoint | null; focus: MapPoint | null; onPick: (point: MapPoint) => void };

/** Click-to-choose map. Loaded only in the browser (Leaflet needs `window`). */
export default function LocationMap({ point, focus, onPick }: Props) {
  return (
    <MapContainer
      center={[-28.5, 24.7]}
      zoom={5}
      scrollWheelZoom={false}
      className="h-64 w-full rounded-md"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToPick onPick={onPick} />
      <Focus focus={focus} />
      {point && (
        <Circle
          center={[point.lat, point.lng]}
          radius={600}
          pathOptions={{ color: "#0f766e", fillOpacity: 0.3 }}
        />
      )}
    </MapContainer>
  );
}
