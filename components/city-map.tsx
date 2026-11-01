"use client";

import { useState } from "react";
import { LocateFixed, MapPin, Minus, Plus } from "lucide-react";
import type { Stop } from "@/lib/prototype/types";

export function CityMap({
  stops = [],
  selectedKey,
  onSelect,
  compact = false,
}: {
  stops?: Stop[];
  selectedKey?: string;
  onSelect?: (stop: Stop) => void;
  compact?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  return (
    <div className={`city-map ${compact ? "city-map-compact" : ""}`}>
      <div className="map-plane" style={{ transform: `scale(${zoom})` }}>
        <svg
          viewBox="0 0 900 600"
          preserveAspectRatio="xMidYMid slice"
          role="img"
          aria-label="Schematic sample delivery map, not live geographic directions"
        >
          <rect width="900" height="600" fill="#edf0e7" />
          <g fill="#e3e8dc" stroke="#dce3d5" strokeWidth="1">
            <rect x="20" y="28" width="140" height="105" rx="14" />
            <rect x="210" y="28" width="150" height="105" rx="14" />
            <rect x="410" y="28" width="150" height="105" rx="14" />
            <rect x="610" y="28" width="130" height="105" rx="14" />
            <rect x="26" y="190" width="135" height="140" rx="14" />
            <rect x="210" y="190" width="150" height="140" rx="14" />
            <rect x="410" y="190" width="150" height="140" rx="14" />
            <rect x="610" y="190" width="140" height="140" rx="14" />
            <rect x="26" y="390" width="135" height="150" rx="14" />
            <rect x="210" y="390" width="150" height="150" rx="14" />
            <rect x="410" y="390" width="150" height="150" rx="14" />
          </g>
          <path
            d="M790-20C720 80 840 145 785 250S750 460 910 575"
            fill="none"
            stroke="#dceaf0"
            strokeWidth="70"
          />
          <rect
            x="621"
            y="406"
            width="110"
            height="120"
            rx="30"
            fill="#d1e3cc"
          />
          <path
            d="M0 160H760M0 360H800M185 0V600M385 0V600M585 0V600M0 560H900"
            fill="none"
            stroke="#fffdf7"
            strokeWidth="26"
          />
          <path
            d="M0 160H760M0 360H800M185 0V600M385 0V600M585 0V600M0 560H900"
            fill="none"
            stroke="#e5dfcf"
            strokeWidth="1"
          />
          <path
            d="M120 480H185V360H385V160H520"
            fill="none"
            stroke="#fff"
            strokeWidth="10"
            strokeLinejoin="round"
          />
          <path
            d="M120 480H185V360H385V160H520"
            fill="none"
            stroke="#007354"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <g fill="#97a28f" fontSize="12" fontFamily="sans-serif">
            <text x="238" y="94" letterSpacing="2">
              SAN ISIDRO
            </text>
            <text x="430" y="273" letterSpacing="1.8">
              MAGUGPO EAST
            </text>
            <text x="625" y="470">
              Community park
            </text>
            <text x="250" y="153" fontSize="10">
              Mabini Street
            </text>
            <text x="424" y="352" fontSize="10">
              Rizal Street
            </text>
            <text x="197" y="270" fontSize="10" transform="rotate(-90 197 270)">
              Bonifacio Street
            </text>
            <text x="597" y="293" fontSize="10" transform="rotate(-90 597 293)">
              Laurel Avenue
            </text>
          </g>
          <circle cx="120" cy="480" r="19" fill="#007354" opacity="0.13" />
          <circle
            cx="120"
            cy="480"
            r="8"
            fill="#007354"
            stroke="white"
            strokeWidth="4"
          />
          <circle
            cx="520"
            cy="160"
            r="13"
            fill="#007354"
            stroke="white"
            strokeWidth="4"
          />
        </svg>
        {stops.slice(0, 5).map((stop, index) => (
          <button
            key={stop.key}
            className={`map-marker ${selectedKey === stop.key ? "map-marker-selected" : ""}`}
            style={{
              left: `${[58, 43, 68, 29, 71][index]}%`,
              top: `${[27, 47, 53, 28, 70][index]}%`,
            }}
            onClick={() => onSelect?.(stop)}
            aria-label={`Select ${stop.customer.name} on map`}
            title={stop.customer.name}
          >
            <MapPin size={18} fill="currentColor" />
            <span>{index + 1}</span>
          </button>
        ))}
      </div>
      <span className="map-caption">
        <i />
        Route preview · demo map
      </span>
      <div className="map-compass">
        N<span>↑</span>
      </div>
      <div className="map-controls">
        <button
          aria-label="Zoom in"
          onClick={() => setZoom((value) => Math.min(1.8, value + 0.2))}
        >
          <Plus size={18} />
        </button>
        <button
          aria-label="Zoom out"
          onClick={() => setZoom((value) => Math.max(0.8, value - 0.2))}
        >
          <Minus size={18} />
        </button>
        <button aria-label="Center map" onClick={() => setZoom(1)}>
          <LocateFixed size={18} />
        </button>
      </div>
      <div className="map-scale">
        200 m<span />
      </div>
    </div>
  );
}
