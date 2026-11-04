"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, LocateFixed, MapPin } from "lucide-react";
import { useActions } from "@/components/providers";
import { Button, CheckField, Field, Modal } from "@/components/ui";
import { GeoMap, type GeoMarker } from "@/components/geo-map";
import {
  ApiError,
  validationMessage,
  type ApiAddress,
  type ApiDelivery,
} from "@/lib/api";
import {
  hasCoordinates,
  isFreshReading,
  readCurrentLocation,
  type GpsReading,
  type MapPoint,
} from "@/lib/maps";

/** Offer optional GPS only after a saved handover; Skip/error never reverses its parcel receipt. */
export function AccountLocationDialog({
  parcelId,
  address: initialAddress,
  customerName,
  onSaved,
  onClose,
}: {
  parcelId: number;
  address: ApiAddress;
  customerName: string;
  onSaved: (stop: ApiDelivery) => void;
  onClose: () => void;
}) {
  const { request, notify } = useActions();
  const [address, setAddress] = useState(initialAddress);
  const [reading, setReading] = useState<GpsReading | null>(null);
  const [draft, setDraft] = useState({ latitude: "", longitude: "" });
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [replace, setReplace] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [error, setError] = useState("");
  const version = useRef(0);
  const point = {
    latitude: Number(draft.latitude),
    longitude: Number(draft.longitude),
  };
  const valid =
    draft.latitude !== "" && draft.longitude !== "" && hasCoordinates(point);
  const existing = hasCoordinates(address);
  const markers: GeoMarker[] = valid
    ? [{ ...point, key: "review", label: `${customerName} · reviewed pin` }]
    : [];
  if (existing)
    markers.push({
      latitude: address.latitude!,
      longitude: address.longitude!,
      key: "saved",
      label: "Currently saved address pin",
    });

  /** Ignore a late phone reading or API write after Skip/navigation/account change. */
  useEffect(() => {
    return () => {
      version.current += 1;
    };
  }, []);

  /** Read the phone only after Review/Retry and retain the actual timestamp and accuracy. */
  async function locate() {
    if (locating || saving) return;
    const current = version.current;
    setLocating(true);
    setError("");
    setReviewed(false);
    try {
      const value = await readCurrentLocation();
      if (current !== version.current) return;
      setReading(value);
      setDraft({
        latitude: value.latitude.toFixed(7),
        longitude: value.longitude.toFixed(7),
      });
    } catch (cause) {
      if (current === version.current) setError(validationMessage(cause));
    } finally {
      if (current === version.current) setLocating(false);
    }
  }

  /** A map correction remains an unconfirmed draft and requires another explicit review. */
  function correct(value: MapPoint) {
    setDraft({
      latitude: value.latitude.toFixed(7),
      longitude: value.longitude.toFixed(7),
    });
    setReviewed(false);
  }

  /** Reload a conflicting pin before allowing another replacement; preserve the rider's draft. */
  async function reloadPin() {
    const current = version.current;
    setSaving(true);
    try {
      const { data } = await request<{ data: ApiDelivery }>(
        `/deliveries/${parcelId}`,
      );
      if (current !== version.current) return;
      setAddress(data.address);
      setReplace(false);
      setReviewed(false);
      setConflict(false);
      setError("");
    } catch (cause) {
      if (current === version.current) setError(validationMessage(cause));
    } finally {
      if (current === version.current) setSaving(false);
    }
  }

  /** Save through the delivered parcel's evidence rather than a general-purpose directory GPS write. */
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      saving ||
      !reading ||
      !valid ||
      !reviewed ||
      (existing && !replace) ||
      conflict
    )
      return;
    if (!isFreshReading(reading)) {
      setError(
        "This reading is stale. Retry current location before confirming.",
      );
      setReviewed(false);
      return;
    }
    const current = version.current;
    setSaving(true);
    setError("");
    try {
      const { data } = await request<{ data: ApiDelivery }>(
        `/deliveries/${parcelId}/location`,
        "POST",
        {
          ...point,
          gps_latitude: reading.latitude,
          gps_longitude: reading.longitude,
          accuracy: reading.accuracy,
          captured_at: reading.captured_at,
          review_confirmed: reviewed,
          replace_confirmed: replace,
          expected_version: address.location_version,
        },
      );
      if (current !== version.current) return;
      onSaved(data);
      notify("Reviewed location saved to this customer address.");
      onClose();
    } catch (cause) {
      if (current === version.current) {
        setError(validationMessage(cause));
        setConflict(cause instanceof ApiError && cause.status === 409);
      }
    } finally {
      if (current === version.current) setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={
        /** A pending write finishes before the optional dialog closes. */ () => {
          if (!saving) onClose();
        }
      }
      title="Delivery saved. Save this address location?"
      description={`${customerName} · ${address.label}. Your delivery and confirmed payment are already saved.`}
    >
      <form onSubmit={confirm}>
        <div className="dialog-body form-stack">
          <div className="notice notice-blue">
            <MapPin size={20} />
            <p>
              Review a fresh phone reading, correct it if needed, then confirm.
              Skip keeps your delivery and payment.
            </p>
          </div>
          {error && (
            <div className="notice notice-amber" role="alert">
              <p>{error}</p>
              {conflict && (
                <Button
                  variant="secondary"
                  disabled={saving}
                  onClick={reloadPin}
                >
                  Reload current saved pin
                </Button>
              )}
            </div>
          )}
          <Button
            variant="secondary"
            disabled={locating || saving}
            onClick={locate}
          >
            <LocateFixed size={17} />
            {locating
              ? "Reading current location…"
              : reading
                ? "Retry current location"
                : "Review current location"}
          </Button>
          {reading && (
            <>
              <p className="small-muted">
                Phone accuracy ±{Math.round(reading.accuracy)} m · Captured{" "}
                {new Date(reading.captured_at).toLocaleTimeString()}
              </p>
              {reading.accuracy > 100 && (
                <p className="notice notice-amber">
                  This reading has low accuracy. Retry outdoors or carefully
                  correct the pin before confirming.
                </p>
              )}
              <div className="form-grid">
                <Field label="Latitude" required>
                  <input
                    type="number"
                    min={-90}
                    max={90}
                    step="any"
                    required
                    value={draft.latitude}
                    disabled={saving}
                    onChange={
                      /** Editing coordinates invalidates the previous review confirmation. */ (
                        event,
                      ) => {
                        setDraft({ ...draft, latitude: event.target.value });
                        setReviewed(false);
                      }
                    }
                  />
                </Field>
                <Field label="Longitude" required>
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    step="any"
                    required
                    value={draft.longitude}
                    disabled={saving}
                    onChange={
                      /** Keep every address's coordinates separate until save. */ (
                        event,
                      ) => {
                        setDraft({ ...draft, longitude: event.target.value });
                        setReviewed(false);
                      }
                    }
                  />
                </Field>
              </div>
              {existing && (
                <div className="notice notice-amber">
                  <p>
                    Current pin: {address.latitude!.toFixed(6)},{" "}
                    {address.longitude!.toFixed(6)}.
                  </p>
                  <CheckField checked={replace} onChange={setReplace}>
                    Replace this address’s current saved pin
                  </CheckField>
                </div>
              )}
              {mapOpen ? (
                <GeoMap
                  compact
                  markers={markers}
                  selectedKey="review"
                  onPick={saving ? undefined : correct}
                />
              ) : (
                <Button
                  variant="ghost"
                  onClick={
                    /** Map tiles are optional; coordinates can be confirmed without spending map credits. */ () =>
                      setMapOpen(true)
                  }
                >
                  Open map to review / correct pin
                </Button>
              )}
              <CheckField checked={reviewed} onChange={setReviewed}>
                I reviewed the reading, accuracy and coordinates, and confirm
                this pin marks this customer’s address.
              </CheckField>
            </>
          )}
        </div>
        <footer className="dialog-footer">
          <Button variant="secondary" disabled={saving} onClick={onClose}>
            Skip location
          </Button>
          <Button
            type="submit"
            disabled={
              saving ||
              locating ||
              !reading ||
              !valid ||
              !reviewed ||
              (existing && !replace) ||
              conflict
            }
          >
            <Check size={16} />
            {saving ? "Saving reviewed pin…" : "Confirm address pin"}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
