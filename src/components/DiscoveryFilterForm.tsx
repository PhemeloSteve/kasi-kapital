"use client";

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

  const field =
    "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30";

  return (
    <form ref={formRef} method="get" className="space-y-3 rounded-lg border border-slate-200 p-4">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor="q" className="block text-sm font-medium text-slate-800">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            maxLength={80}
            defaultValue={filters.query ?? ""}
            placeholder="Bakery, chickens, Soweto…"
            className={field}
          />
        </div>
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-slate-800">
            Kind of business
          </label>
          <select
            id="category"
            name="category"
            defaultValue={filters.category ?? ""}
            className={field}
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
              <label htmlFor="radius" className="block text-sm font-medium text-slate-800">
                Within
              </label>
              <select
                id="radius"
                name="radius"
                defaultValue={filters.near?.radiusKm ?? DEFAULT_RADIUS_KM}
                className="mt-1 rounded-md border border-slate-300 px-3 py-2"
              >
                {radiusOptions.map((km) => (
                  <option key={km} value={km}>
                    {km} km of me
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setCoords(null)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Don&apos;t use my location
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={findNearMe}
            disabled={geo.status === "asking"}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60"
          >
            {geo.status === "asking" ? "Finding you…" : "Near me"}
          </button>
        )}
        <button
          type="submit"
          className="rounded-md bg-brand px-5 py-2 font-medium text-white hover:bg-brand-dark"
        >
          Search
        </button>
        {(filters.query || filters.category || filters.near) && (
          <Link href="?" className="py-2 text-sm text-slate-600 underline">
            Clear all
          </Link>
        )}
      </div>

      <p role="status" className="text-xs text-slate-600">
        {geo.status === "failed" && geo.message}
        {geo.status !== "failed" &&
          coords &&
          "Using your approximate area (about 1 km). It is not stored."}
      </p>
    </form>
  );
}
