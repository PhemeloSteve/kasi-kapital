"use client";

import { Map as MapIcon, X } from "lucide-react";
import { useState } from "react";
import { DiscoveryMapLoader } from "./DiscoveryMapLoader";
import type { MapBusiness } from "./DiscoveryMap";

/** A "View map" button that shows the results on a map. The map only loads when it is opened. */
export function DiscoveryMapPanel({
  businesses,
  origin,
}: {
  businesses: MapBusiness[];
  origin: { lat: number; lng: number } | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="btn-secondary"
      >
        {open ? (
          <X aria-hidden="true" className="h-4 w-4" />
        ) : (
          <MapIcon aria-hidden="true" className="h-4 w-4" />
        )}
        {open ? "Hide map" : "View map"}
      </button>
      {open && (
        <div className="card mt-4 overflow-hidden p-2">
          <DiscoveryMapLoader businesses={businesses} origin={origin} />
          <p className="px-2 pb-1 pt-2 text-xs text-gray-500">
            Markers show an approximate area, not an exact address.
          </p>
        </div>
      )}
    </div>
  );
}
