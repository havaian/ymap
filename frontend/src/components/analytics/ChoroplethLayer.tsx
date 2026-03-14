/**
 * ChoroplethLayer
 *
 * Leaflet GeoJSON overlay that colors district polygons by a selected metric.
 * Fetches from /api/analytics/choropleth?metric=composite|issues|infrastructure|budget|crops
 *
 * Used inside <MapContainer> alongside existing marker cluster groups.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { analyticsAPI } from "../../services/analyticsApi";

interface ChoroplethLayerProps {
  show: boolean;
  metric?: string; // composite | issues | infrastructure | budget | crops
  regionCode?: number;
  opacity?: number;
  onDistrictClick?: (districtId: string, name: any, scores: any) => void;
}

// Score → color (green = good, red = bad)
function getColor(value: number): string {
  if (value >= 80) return "#059669"; // emerald-600
  if (value >= 60) return "#16a34a"; // green-600
  if (value >= 45) return "#ca8a04"; // yellow-600
  if (value >= 30) return "#ea580c"; // orange-600
  if (value >= 15) return "#dc2626"; // red-600
  return "#991b1b"; // red-800
}

function getStyle(feature: any, opacity: number) {
  const value = feature.properties.value ?? 0;
  return {
    fillColor: getColor(value),
    weight: 1.5,
    opacity: 0.8,
    color: "#475569", // slate-600 border
    fillOpacity: opacity,
    dashArray: "",
  };
}

function highlightStyle() {
  return {
    weight: 3,
    color: "#3b82f6",
    fillOpacity: 0.7,
    dashArray: "",
  };
}

export const ChoroplethLayer: React.FC<ChoroplethLayerProps> = ({
  show,
  metric = "composite",
  regionCode,
  opacity = 0.5,
  onDistrictClick,
}) => {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const [geojson, setGeojson] = useState<any>(null);
  const onClickRef = useRef(onDistrictClick);

  useEffect(() => {
    onClickRef.current = onDistrictClick;
  }, [onDistrictClick]);

  // Fetch GeoJSON
  useEffect(() => {
    if (!show) return;

    const params: any = { metric };
    if (regionCode) params.regionCode = regionCode;

    analyticsAPI
      .getChoropleth(params)
      .then((res) => {
        // Response is already GeoJSON (not wrapped in data.data)
        const data =
          res.data?.type === "FeatureCollection" ? res.data : res.data?.data;
        if (data?.features) {
          setGeojson(data);
        }
      })
      .catch((err) => console.error("Choropleth fetch error:", err));
  }, [show, metric, regionCode]);

  // Render / remove layer
  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (!show || !geojson?.features?.length) return;

    const layer = L.geoJSON(geojson, {
      style: (feature) => getStyle(feature, opacity),
      onEachFeature: (feature, layer) => {
        const props = feature.properties;
        const name = props.name?.en || props.name?.uz || props.name?.ru || "—";
        const score = props.value ?? 0;

        // Tooltip on hover
        layer.bindTooltip(
          `<div style="font-family: system-ui; font-size: 12px;">
                        <strong>${name}</strong><br/>
                        <span style="font-size: 18px; font-weight: 900; color: ${getColor(
                          score
                        )}">${score}</span>
                        <span style="font-size: 10px; color: #94a3b8;"> / 100</span>
                    </div>`,
          { sticky: true, direction: "top", offset: [0, -10] }
        );

        // Highlight on hover
        layer.on("mouseover", (e) => {
          const target = e.target;
          target.setStyle(highlightStyle());
          target.bringToFront();
        });

        layer.on("mouseout", (e) => {
          if (layerRef.current) {
            layerRef.current.resetStyle(e.target);
          }
        });

        // Click → drill down
        layer.on("click", () => {
          if (onClickRef.current) {
            onClickRef.current(props.districtId, props.name, props.scores);
          }
        });
      },
    });

    layer.addTo(map);
    // Put behind markers
    layer.bringToBack();
    layerRef.current = layer;

    return () => {
      if (layerRef.current && map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, show, geojson, opacity, metric]);

  return null;
};

/**
 * ChoroplethLegend
 * Floating legend overlay showing the color scale
 */
export const ChoroplethLegend: React.FC<{ metric: string }> = ({ metric }) => {
  const labels: Record<string, string> = {
    composite: "Общий балл",
    issues: "Обращения",
    infrastructure: "Инфраструктура",
    budget: "Бюджет",
    crops: "Агро",
  };

  const grades = [80, 60, 45, 30, 15, 0];

  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-xl p-3 shadow-lg border border-slate-200 dark:border-slate-700">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
        {labels[metric] || metric}
      </p>
      <div className="space-y-1">
        {grades.map((g, i) => (
          <div key={g} className="flex items-center gap-2">
            <div
              className="w-4 h-3 rounded-sm"
              style={{ backgroundColor: getColor(g) }}
            />
            <span className="text-[10px] font-bold text-slate-500">
              {i === 0
                ? `${g}+`
                : i === grades.length - 1
                ? `0–${grades[i - 1]}`
                : `${g}–${grades[i - 1]}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
