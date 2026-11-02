"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useActionState, useState } from "react";
import { saveBusinessAction, type BusinessFormState } from "@/app/business/actions";
import type { BusinessFormValues } from "@/app/business/form-input";
import { categoryIds, categoryLabels } from "@/domain/business-categories";
import { coarsenLocation } from "@/domain/location-privacy";
import { FormField, SelectField, TextAreaField } from "./FormField";
import { describeGeolocationFailure } from "./geolocation-messages";
import type { MapPoint } from "./LocationMap";
import { saCities } from "./saCities";

const LocationMap = dynamic(() => import("./LocationMap"), {
  ssr: false,
  loading: () => (
    <p className="flex h-64 items-center justify-center rounded-md bg-gray-100 text-sm text-gray-600">
      Loading map…
    </p>
  ),
});

const categoryOptions = categoryIds.map((id) => ({ value: id, label: categoryLabels[id] }));

type Props = {
  defaults?: Partial<BusinessFormValues>;
  hasSavedLocation?: boolean;
  isEdit?: boolean;
};

export function BusinessForm({ defaults, hasSavedLocation = false, isEdit = false }: Props) {
  const [state, action, pending] = useActionState<BusinessFormState, FormData>(saveBusinessAction, {
    status: "idle",
  });
  const v = { ...defaults, ...state.values };
  const f = state.fields ?? {};

  // Rounded to ~1 km in the browser, so an exact position never even leaves this page.
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [focus, setFocus] = useState<MapPoint | null>(null);
  const [geo, setGeo] = useState<{
    status: "idle" | "asking" | "done" | "failed";
    message?: string;
  }>({ status: "idle" });

  function choose(next: MapPoint) {
    setPoint(coarsenLocation(next));
  }

  function findMyLocation() {
    if (!("geolocation" in navigator)) {
      return setGeo({
        status: "failed",
        message: describeGeolocationFailure(null, window.isSecureContext),
      });
    }
    setGeo({ status: "asking" });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const here = { lat: position.coords.latitude, lng: position.coords.longitude };
        choose(here);
        setFocus(here);
        setGeo({ status: "done" });
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
    <form action={action} className="space-y-5" noValidate>
      {state.message && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {state.message}
        </p>
      )}

      <FormField
        id="name"
        label="Business name"
        defaultValue={v.name}
        error={f.name}
        maxLength={120}
      />
      <SelectField
        id="category"
        label="What kind of business is it?"
        placeholder="Choose one"
        options={categoryOptions}
        defaultValue={v.category}
        error={f.category}
      />
      <TextAreaField
        id="description"
        label="What do you do?"
        required={false}
        defaultValue={v.description}
        error={f.description}
        maxLength={600}
        hint="A few sentences that help people understand and trust your business."
      />
      <FormField
        id="suburb"
        label="Suburb or town"
        defaultValue={v.suburb}
        error={f.suburb}
        maxLength={80}
        hint="This is shown publicly. Never enter your home address."
      />

      <div className="rounded-xl border border-gray-200 p-3">
        <input type="hidden" name="lat" value={point?.lat ?? ""} />
        <input type="hidden" name="lng" value={point?.lng ?? ""} />
        <p className="text-sm font-medium text-gray-800">
          Show your area on the map <span className="font-normal text-gray-500">(optional)</span>
        </p>
        <p className="mt-1 text-xs text-gray-600">
          Click the map where your business is, or use the buttons. We only save an approximate area
          of about 1 km, never an exact spot.
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={findMyLocation}
            disabled={geo.status === "asking"}
            className="btn-secondary"
          >
            {geo.status === "asking" ? "Finding you…" : "Use my current location"}
          </button>
          <label className="text-sm text-gray-700">
            <span className="sr-only">Jump the map to a city</span>
            <select
              defaultValue=""
              onChange={(event) => {
                const city = saCities.find((c) => c.name === event.target.value);
                if (city) setFocus({ lat: city.lat, lng: city.lng });
              }}
              className="rounded-xl border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="" disabled>
                Jump to a city…
              </option>
              {saCities.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3" role="group" aria-label="Map for choosing your approximate area">
          <LocationMap point={point} focus={focus} onPick={choose} />
        </div>

        <p role="status" className="mt-2 text-xs text-gray-600">
          {point
            ? "Area chosen. It will be saved when you press the save button below. Click the map again to change it."
            : geo.status === "failed"
              ? geo.message
              : hasSavedLocation
                ? "An approximate area is already saved. Choose a new one only if you want to change it."
                : "No area chosen yet."}
        </p>
        {geo.status === "failed" && point && (
          <p className="mt-1 text-xs text-gray-500">{geo.message}</p>
        )}
        {(f.lat || f.lng) && (
          <p role="alert" className="mt-1 text-sm text-red-700">
            {f.lat ?? f.lng}
          </p>
        )}
      </div>

      <fieldset className="space-y-4 rounded-xl border border-gray-200 p-3">
        <legend className="px-1 text-sm font-medium text-gray-800">
          Your online pages <span className="font-normal text-gray-500">(optional)</span>
        </legend>
        <FormField
          id="facebookUrl"
          label="Facebook page"
          type="text"
          inputMode="url"
          required={false}
          defaultValue={v.facebookUrl}
          error={f.facebookUrl}
          placeholder="https://www.facebook.com/yourbusiness"
        />
        <FormField
          id="youtubeUrl"
          label="YouTube channel or video"
          type="text"
          inputMode="url"
          required={false}
          defaultValue={v.youtubeUrl}
          error={f.youtubeUrl}
          placeholder="https://www.youtube.com/@yourbusiness"
        />
        <FormField
          id="linkedinUrl"
          label="LinkedIn page"
          type="text"
          inputMode="url"
          required={false}
          defaultValue={v.linkedinUrl}
          error={f.linkedinUrl}
          placeholder="https://www.linkedin.com/company/yourbusiness"
        />
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary px-5">
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create business profile"}
        </button>
        <Link href="/business" className="text-sm text-gray-600 underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
