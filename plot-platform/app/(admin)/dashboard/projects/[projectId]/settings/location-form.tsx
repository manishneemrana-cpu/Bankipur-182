"use client";

import { useActionState } from "react";

import { updateLocation, type ActionState } from "./actions";

const initialState: ActionState = {};

export function LocationForm({
  projectId,
  address,
  city,
  state,
  lat,
  lng,
}: {
  projectId: string;
  address: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
}) {
  const [formState, formAction, pending] = useActionState(
    updateLocation.bind(null, projectId),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Address
        <input
          name="address"
          defaultValue={address ?? ""}
          className="h-9 rounded-md border border-input px-2"
        />
      </label>
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          City
          <input
            name="city"
            defaultValue={city ?? ""}
            className="h-9 rounded-md border border-input px-2"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          State
          <input
            name="state"
            defaultValue={state ?? ""}
            className="h-9 rounded-md border border-input px-2"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Latitude
          <input
            name="lat"
            type="number"
            step="any"
            defaultValue={lat ?? ""}
            className="h-9 rounded-md border border-input px-2"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Longitude
          <input
            name="lng"
            type="number"
            step="any"
            defaultValue={lng ?? ""}
            className="h-9 rounded-md border border-input px-2"
          />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Lat/lng power the Location map on the public site and are the projection
        origin for GeoJSON/KML layout imports.
      </p>
      {formState.error ? (
        <p className="text-sm text-destructive">{formState.error}</p>
      ) : null}
      {formState.success ? (
        <p className="text-success-foreground text-sm">Saved.</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-fit rounded-md border border-input px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save location"}
      </button>
    </form>
  );
}
