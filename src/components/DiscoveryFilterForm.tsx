"use client";

import { LocateFixed, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { DiscoveryFilters } from "@/application/ports";
import { DEFAULT_RADIUS_KM, radiusOptions } from "@/application/discovery";
import { categoryIds, categoryLabels } from "@/domain/business-categories";
import { coarsenLocation } from "@/domain/location-privacy";
import { describeGeolocationFailure } from "./geolocation-messages";

type Coords = { lat: number; lng: number };

/** A normal GET form, so every search is a shareable link and works without any scripting. */
export function DiscoveryFilterForm({ filters }: { filters: DiscoveryFilters }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [coords, setCoords] = useState<Coords | null>(
    filters.near ? { lat: filters.near.lat, lng: filters.near.lng } : null,
  );
  const [submitAfterLocating, setSubmitAfterLocating] = useState(false);
  const [geo, setGeo] = useState<{ status: "idle" | "asking" | "failed"; message?: string }>({
    status: "idle",
  });

  // Wait for the hidden fields to hold the new position before sending the search.
  useEffect(() => {
    if (submitAfterLocating) {
      setSubmitAfterLocating(false);
      formRef.current?.requestSubmit();
    }
  }, [submitAfterLocating]);

  function findNearMe() {
    if (!("geolocation" in navigator)) {
      return setGeo({
        status: "failed",
        message: describeGeolocationFailure(null, window.isSecureContext),
      });
    }
    setGeo({ status: "asking" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        // Rounded to about 1 km in the browser, so an exact position never leaves this page.
        setCoords(
          coarsenLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
        );
        setGeo({ status: "idle" });
        setSubmitAfterLocating(true);
      },
      (error) =>
        setGeo({
          status: "failed",
          message: describeGeolocationFailure(error.code, window.isSecureContext),
        }),
      { timeout: 10_000 },
    );
  }

  return (
    <form ref={formRef} method="get" className="card space-y-4 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor="q" className="block text-sm font-medium text-gray-700">
            Search
          </label>
          <div className="relative mt-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
            />
            <input
              id="q"
              name="q"
              type="search"
              maxLength={80}
              defaultValue={filters.query ?? ""}
              placeholder="Bakery, chickens, Soweto…"
              className="input pl-11"
            />
          </div>
        </div>
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
            Kind of business
          </label>
          <select
            id="category"
            name="category"
            defaultValue={filters.category ?? ""}
            className="input mt-1"
          >
            <option value="">All kinds</option>
            {categoryIds.map((id) => (
              <option key={id} value={id}>
                {categoryLabels[id]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {coords ? (
          <>
            <input type="hidden" name="lat" value={coords.lat} />
            <input type="hidden" name="lng" value={coords.lng} />
            <div>
              <label htmlFor="radius" className="block text-sm font-medium text-gray-700">
                Within
              </label>
              <select
                id="radius"
                name="radius"
                defaultValue={filters.near?.radiusKm ?? DEFAULT_RADIUS_KM}
                className="input mt-1 w-auto"
              >
                {radiusOptions.map((km) => (
                  <option key={km} value={km}>
                    {km} km of me
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => setCoords(null)} className="btn-secondary">
              Don&apos;t use my location
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={findNearMe}
            disabled={geo.status === "asking"}
            className="btn-secondary"
          >
            <LocateFixed aria-hidden="true" className="h-4 w-4" />
            {geo.status === "asking" ? "Finding you…" : "Near me"}
          </button>
        )}
        <button type="submit" className="btn-primary px-6">
          Search
        </button>
        {(filters.query || filters.category || filters.near) && (
          <Link href="?" className="py-2.5 text-sm text-gray-600 underline">
            Clear all
          </Link>
        )}
      </div>

      <p role="status" className="text-xs text-gray-500">
        {geo.status === "failed" && geo.message}
        {geo.status !== "failed" &&
          coords &&
          "Using your approximate area (about 1 km). It is not stored."}
      </p>
    </form>
  );
}
