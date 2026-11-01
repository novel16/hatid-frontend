"use client";

import { useState } from "react";
import {
  Check,
  CheckCheck,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCw,
} from "lucide-react";
import type { Address, Customer } from "@/lib/prototype/types";
import { saveAddressPin } from "@/lib/prototype/domain";
import { useActions } from "@/components/providers";
import { Badge, Button, CheckField, Field, Modal } from "@/components/ui";
import { CityMap } from "@/components/city-map";

export function LocationDialog({
  customer,
  address,
  onClose,
  afterDelivery = false,
}: {
  customer: Customer;
  address: Address;
  onClose: () => void;
  afterDelivery?: boolean;
}) {
  const { commit, notify } = useActions();
  const [step, setStep] = useState<"offer" | "review">("offer");
  const [latitude, setLatitude] = useState(String(address.latitude ?? 7.4478));
  const [longitude, setLongitude] = useState(
    String(address.longitude ?? 125.8078),
  );
  const [source, setSource] = useState("Sample reading");
  const [readingAt, setReadingAt] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [replace, setReplace] = useState(false);
  const hasPin = address.latitude !== null && address.longitude !== null;

  function readDeviceLocation() {
    if (!navigator.geolocation) {
      notify("GPS isn’t available. You can skip this step.", true);
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(String(position.coords.latitude));
        setLongitude(String(position.coords.longitude));
        setAccuracy(position.coords.accuracy);
        setReadingAt(new Date(position.timestamp).toISOString());
        setSource("Fresh device reading");
        setLoading(false);
        setStep("review");
      },
      () => {
        setLoading(false);
        notify(
          "Couldn’t get a fresh location. Retry or skip; your delivery stays saved.",
          true,
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        step === "offer"
          ? "Make the next visit easier?"
          : "Review the customer location"
      }
      description={`${customer.name} · ${address.label}`}
    >
      {step === "offer" ? (
        <>
          <div className="dialog-body location-offer">
            <span className="location-offer-icon">
              <MapPin size={34} />
            </span>
            <h3>Save this address pin, only if you want.</h3>
            <p>
              {afterDelivery
                ? "Delivery and payment are already saved. This optional step won’t change them."
                : "Review a fresh location or correct the pin before confirming."}
            </p>
            <div className="location-options">
              <Button onClick={readDeviceLocation} disabled={loading}>
                <LocateFixed size={17} />
                {loading ? "Getting a fresh reading…" : "Use my current GPS"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setStep("review");
                  setReadingAt(new Date().toISOString());
                  setSource("Sample reading");
                  setAccuracy(null);
                }}
              >
                <Navigation size={16} />
                Preview sample location
              </Button>
            </div>
            <p className="small-muted">
              GPS is requested only when you choose “Use my current GPS”.
            </p>
          </div>
          <footer className="dialog-footer">
            <span className="small-muted">
              <CheckCheck size={14} />
              {afterDelivery
                ? "Delivery is safe to skip"
                : "Changes require confirmation"}
            </span>
            <Button variant="secondary" onClick={onClose}>
              Skip for now
              <ArrowIcon />
            </Button>
          </footer>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (hasPin && !replace) return;
            if (
              commit(
                (state) =>
                  saveAddressPin(
                    state,
                    customer.id,
                    address.id,
                    Number(latitude),
                    Number(longitude),
                  ),
                "Address pin confirmed. Delivery remains saved.",
              )
            )
              onClose();
          }}
        >
          <div className="dialog-body form-stack">
            <CityMap compact />
            <div className="location-reading">
              <Badge tone={source === "Sample reading" ? "amber" : "green"}>
                {source}
              </Badge>
              <span>
                {accuracy !== null
                  ? `Accuracy ±${Math.round(accuracy)} m · `
                  : ""}
                {readingAt
                  ? new Date(readingAt).toLocaleTimeString("en-PH", {
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : ""}
              </span>
              <button
                type="button"
                className="text-link"
                onClick={readDeviceLocation}
                disabled={loading}
              >
                <RefreshCw size={14} />
                Retry GPS
              </button>
            </div>
            <div className="form-grid">
              <Field label="Latitude" required>
                <input
                  type="number"
                  required
                  step="any"
                  min={-90}
                  max={90}
                  value={latitude}
                  onChange={(event) => {
                    setLatitude(event.target.value);
                    setSource("Manually corrected");
                    setAccuracy(null);
                  }}
                />
              </Field>
              <Field label="Longitude" required>
                <input
                  type="number"
                  required
                  step="any"
                  min={-180}
                  max={180}
                  value={longitude}
                  onChange={(event) => {
                    setLongitude(event.target.value);
                    setSource("Manually corrected");
                    setAccuracy(null);
                  }}
                />
              </Field>
            </div>
            {hasPin && (
              <div className="notice notice-amber">
                <MapPin size={18} />
                <div>
                  <strong>This address already has a pin.</strong>
                  <p>
                    Current: {address.latitude?.toFixed(5)},{" "}
                    {address.longitude?.toFixed(5)}. Review before replacing it.
                  </p>
                  <CheckField checked={replace} onChange={setReplace}>
                    Replace the saved pin for this address
                  </CheckField>
                </div>
              </div>
            )}
            <p className="small-muted">
              The map is a schematic prototype preview. The coordinates above
              are the values you’re confirming.
            </p>
          </div>
          <footer className="dialog-footer">
            <Button variant="secondary" onClick={onClose}>
              Skip location
            </Button>
            <Button type="submit" disabled={hasPin && !replace}>
              <Check size={16} />
              Confirm address pin
            </Button>
          </footer>
        </form>
      )}
    </Modal>
  );
}

function ArrowIcon() {
  return <span aria-hidden="true">→</span>;
}
