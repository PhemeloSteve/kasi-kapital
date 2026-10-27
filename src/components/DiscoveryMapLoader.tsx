"use client";

import dynamic from "next/dynamic";
import type { MapBusiness } from "./DiscoveryMap";

// Leaflet needs the browser's `window`, so the map is only ever loaded there.
const DiscoveryMap = dynamic(() => import("./DiscoveryMap"), {
  ssr: false,
  loading: () => (
    <p className="flex h-72 items-center justify-center rounded-md bg-slate-100 text-sm text-slate-600">
      Loading map…
    </p>
  ),
});

export function DiscoveryMapLoader(props: {
  businesses: MapBusiness[];
  origin: { lat: number; lng: number } | null;
}) {
  return <DiscoveryMap {...props} />;
}
