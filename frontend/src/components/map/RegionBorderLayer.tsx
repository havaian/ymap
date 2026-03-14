// frontend/src/components/map/RegionBorderLayer.tsx
//
// When a region is selected:
//   1. Draws the outer region boundary (thick dashed blue ring)
//   2. Draws inner district grid lines (thin, no fill)
//   3. Flies the map to fit the region bounds
//
// Fetches:
//   GET /api/regions/:code          → outer region polygon
//   GET /api/analytics/choropleth?regionCode=X&metric=composite
//                                   → district polygons (fill stripped)
//
// Both layers are non-interactive — they don't intercept clicks.
// Cleans up completely when regionCode becomes null.

import React, { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { regionsAPI } from "../../services/api";
import { analyticsAPI } from "../../services/analyticsApi";

interface RegionBorderLayerProps {
  regionCode: number | null;
}

export const RegionBorderLayer: React.FC<RegionBorderLayerProps> = ({
  regionCode,
}) => {
  const map = useMap();
  const outerRef = useRef<L.GeoJSON | null>(null);
  const innerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    // Always clean up first
    if (outerRef.current) {
      map.removeLayer(outerRef.current);
      outerRef.current = null;
    }
    if (innerRef.current) {
      map.removeLayer(innerRef.current);
      innerRef.current = null;
    }

    if (regionCode == null) return;

    let cancelled = false;

    // ── Outer region border ──────────────────────────────
    regionsAPI
      .getByCode(regionCode)
      .then((res) => {
        if (cancelled) return;
        const geom = res.data?.data?.geometry;
        if (!geom) return;

        const layer = L.geoJSON(
          {
            type: "Feature",
            properties: {},
            geometry: geom,
          } as GeoJSON.Feature,
          {
            style: {
              color: "#3b82f6", // blue-500
              weight: 2.5,
              opacity: 1,
              fillOpacity: 0,
              dashArray: "10 6",
            },
            interactive: false,
          }
        );

        layer.addTo(map);
        outerRef.current = layer;

        // Fly to fit region
        try {
          const bounds = layer.getBounds();
          if (bounds.isValid()) {
            map.flyToBounds(bounds, {
              padding: [48, 48],
              duration: 1.0,
              maxZoom: 10,
            });
          }
        } catch {
          /* edge-case geometry */
        }
      })
      .catch(() => {
        /* non-critical */
      });

    // ── Inner district grid ──────────────────────────────
    analyticsAPI
      .getChoropleth({ regionCode, metric: "composite" })
      .then((res) => {
        if (cancelled) return;
        const data =
          res.data?.type === "FeatureCollection" ? res.data : res.data?.data;
        if (!data?.features?.length) return;

        const layer = L.geoJSON(data, {
          style: {
            color: "#60a5fa", // blue-400 — lighter than outer ring
            weight: 1,
            opacity: 0.55,
            fillOpacity: 0,
            dashArray: "",
          },
          interactive: false,
        });

        layer.addTo(map);
        layer.bringToBack();
        innerRef.current = layer;
      })
      .catch(() => {
        /* non-critical */
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionCode]);

  return null;
};
