// frontend/src/components/map/MapComponent.tsx

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import "leaflet.markercluster";
import {
  Issue,
  Coordinates,
  IssueCategory,
  FacilityObject,
  ObjectType,
} from "../../../types";
import { CATEGORY_COLORS } from "../../constants";
import {
  Car,
  Droplets,
  Zap,
  GraduationCap,
  Stethoscope,
  Trash2,
  HelpCircle,
  Building2,
  School,
  Hospital,
  Stethoscope as HealthIcon,
} from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ChoroplethLayer,
  ChoroplethLegend,
} from "../analytics/ChoroplethLayer";
import { RegionBorderLayer } from "./RegionBorderLayer";

// ── Leaflet default icon fix (ESM) ────────────────────────────────────────────

if (L.Icon && L.Icon.Default) {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  });
}

// ── Icon cache ────────────────────────────────────────────────────────────────
// Each unique icon variant is built exactly ONCE and reused for all markers.

const iconCache = new Map<string, L.DivIcon>();

function getCachedIcon(key: string, creator: () => L.DivIcon): L.DivIcon {
  if (!iconCache.has(key)) iconCache.set(key, creator());
  return iconCache.get(key)!;
}

// ── Category icons (issue markers) ───────────────────────────────────────────

function getCategoryIcon(category: IssueCategory) {
  switch (category) {
    case IssueCategory.ROADS:
      return <Car size={16} strokeWidth={2.5} color="white" />;
    case IssueCategory.WATER:
      return <Droplets size={16} strokeWidth={2.5} color="white" />;
    case IssueCategory.ELECTRICITY:
      return <Zap size={16} strokeWidth={2.5} color="white" />;
    case IssueCategory.EDUCATION:
      return <GraduationCap size={16} strokeWidth={2.5} color="white" />;
    case IssueCategory.HEALTH:
      return <Stethoscope size={16} strokeWidth={2.5} color="white" />;
    case IssueCategory.WASTE:
      return <Trash2 size={16} strokeWidth={2.5} color="white" />;
    default:
      return <HelpCircle size={16} strokeWidth={2.5} color="white" />;
  }
}

function createCustomIcon(category: IssueCategory, isZoomedOut: boolean) {
  return getCachedIcon(`issue_${category}_${isZoomedOut ? 1 : 0}`, () => {
    const color = CATEGORY_COLORS[category] || "#64748b";
    if (isZoomedOut) {
      const svg = `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="6" fill="${color}" stroke="white" stroke-width="2.5" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/></svg>`;
      return L.divIcon({
        html: svg,
        className: "",
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
    }
    const iconSvg = renderToStaticMarkup(getCategoryIcon(category));
    const html = `
      <div style="background-color: ${color}; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
        ${iconSvg}
      </div>
      <div style="width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 10px solid white; position: absolute; bottom: -8px; left: 12px;"></div>
    `;
    return L.divIcon({
      html,
      className: "",
      iconSize: [38, 48],
      iconAnchor: [19, 48],
    });
  });
}

// ── Object icons (facility markers) ──────────────────────────────────────────

const OBJECT_COLOR: Record<ObjectType | string, string> = {
  school: "#4f46e5",
  kindergarten: "#0891b2",
  health_post: "#059669",
};

const OBJECT_LABEL: Record<ObjectType | string, string> = {
  school: "Школа",
  kindergarten: "Детский сад",
  health_post: "ФАП",
};

function getObjectIcon(objectType: string, size = 18) {
  switch (objectType) {
    case "school":
      return <School size={size} strokeWidth={2.5} color="white" />;
    case "kindergarten":
      return <Building2 size={size} strokeWidth={2.5} color="white" />;
    case "health_post":
      return <Hospital size={size} strokeWidth={2.5} color="white" />;
    default:
      return <Building2 size={size} strokeWidth={2.5} color="white" />;
  }
}

function createObjectIcon(objectType: string, unresolvedCount: number) {
  const countKey = Math.min(unresolvedCount, 99);
  return getCachedIcon(`obj_${objectType}_${countKey}`, () => {
    const color = OBJECT_COLOR[objectType] || "#4f46e5";
    const baseSize = 40;
    const iconSvg = renderToStaticMarkup(getObjectIcon(objectType, 18));
    const badgeSvg =
      unresolvedCount > 0
        ? `<div style="position:absolute;top:-7px;right:-7px;background:#ef4444;color:white;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2);z-index:10;">${
            countKey >= 99 ? "99+" : unresolvedCount
          }</div>`
        : "";
    const html = `
      <div style="position:relative;background-color:${color};width:${baseSize}px;height:${baseSize}px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 4px 12px -2px ${color}66;">
        ${iconSvg}${badgeSvg}
      </div>
    `;
    return L.divIcon({
      html,
      className: "",
      iconSize: [baseSize, baseSize],
      iconAnchor: [baseSize / 2, baseSize / 2],
    });
  });
}

// ── HeatmapLayer ──────────────────────────────────────────────────────────────

function HeatmapLayer({
  issues,
  show,
  zoomLevel,
}: {
  issues: Issue[];
  show: boolean;
  zoomLevel: number;
}) {
  const map = useMap();
  const heatRef = useRef<any>(null);

  useEffect(() => {
    if (!show) {
      if (heatRef.current) {
        map.removeLayer(heatRef.current);
        heatRef.current = null;
      }
      return;
    }
    const points = issues.map(
      (i) => [i.lat, i.lng, 0.5] as [number, number, number]
    );
    if (heatRef.current) {
      heatRef.current.setLatLngs(points);
    } else {
      heatRef.current = (L as any)
        .heatLayer(points, { radius: 25, blur: 15, maxZoom: 17 })
        .addTo(map);
    }
    return () => {
      if (heatRef.current) {
        map.removeLayer(heatRef.current);
        heatRef.current = null;
      }
    };
  }, [issues, show, map]);

  return null;
}

// ── Issue marker cluster group ────────────────────────────────────────────────

function MarkerClusterGroup({ issues, onIssueClick, zoomLevel, hidden }: any) {
  const map = useMap();
  const clusterGroupRef = useRef<any>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const issuesRef = useRef<Issue[]>([]);
  const prevZoomedOutRef = useRef<boolean>(zoomLevel < 14);
  const onIssueClickRef = useRef(onIssueClick);
  useEffect(() => {
    onIssueClickRef.current = onIssueClick;
  }, [onIssueClick]);

  useEffect(() => {
    const mcFunc = (L as any).markerClusterGroup;
    if (typeof mcFunc !== "function") return;
    clusterGroupRef.current = mcFunc({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 80,
      disableClusteringAtZoom: 15,
      animate: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const color =
          count >= 50 ? "#ef4444" : count >= 10 ? "#f59e0b" : "#10b981";
        return L.divIcon({
          html: `<div class="cluster-anim-pulse" style="background:${color};width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:14px;border:3px solid white;box-shadow:0 4px 15px rgba(0,0,0,0.2);">${count}</div>`,
          className: "custom-cluster-wrapper",
          iconSize: L.point(38, 38),
        });
      },
    });
    return () => {
      if (clusterGroupRef.current) {
        if (map.hasLayer(clusterGroupRef.current))
          map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [map]);

  useEffect(() => {
    if (!clusterGroupRef.current) return;
    if (hidden) {
      if (map.hasLayer(clusterGroupRef.current))
        map.removeLayer(clusterGroupRef.current);
    } else {
      if (!map.hasLayer(clusterGroupRef.current))
        map.addLayer(clusterGroupRef.current);
    }
  }, [map, hidden]);

  useEffect(() => {
    const cg = clusterGroupRef.current;
    if (!cg) return;
    cg.clearLayers();
    markersRef.current = [];
    issuesRef.current = [];
    if (hidden) return;

    issuesRef.current = issues;
    const isZoomedOut = zoomLevel < 14;
    prevZoomedOutRef.current = isZoomedOut;

    const markers = issues.map((issue: Issue) => {
      const marker = L.marker([issue.lat, issue.lng], {
        icon: createCustomIcon(issue.category, isZoomedOut),
      });
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onIssueClickRef.current(issue);
      });
      return marker;
    });

    markersRef.current = markers;
    cg.addLayers(markers);
  }, [issues, hidden]);

  // Zoom icon swap — only when threshold 14 is crossed
  useEffect(() => {
    const isZoomedOut = zoomLevel < 14;
    if (isZoomedOut === prevZoomedOutRef.current) return;
    prevZoomedOutRef.current = isZoomedOut;
    markersRef.current.forEach((marker, i) => {
      const issue = issuesRef.current[i];
      if (issue) marker.setIcon(createCustomIcon(issue.category, isZoomedOut));
    });
  }, [zoomLevel]);

  return null;
}

// ── Object (facility) cluster group ──────────────────────────────────────────

function ObjectClusterGroup({
  objects,
  onObjectClick,
  hidden,
  objectUnresolvedCounts,
}: any) {
  const map = useMap();
  const clusterGroupRef = useRef<any>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const objectsRef = useRef<FacilityObject[]>([]);

  const onObjectClickRef = useRef(onObjectClick);
  useEffect(() => {
    onObjectClickRef.current = onObjectClick;
  }, [onObjectClick]);

  const countsRef = useRef(objectUnresolvedCounts);
  useEffect(() => {
    countsRef.current = objectUnresolvedCounts;
  }, [objectUnresolvedCounts]);

  // Effect 1: Create cluster group once
  useEffect(() => {
    const mcFunc = (L as any).markerClusterGroup;
    if (typeof mcFunc !== "function") return;
    clusterGroupRef.current = mcFunc({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 60,
      disableClusteringAtZoom: null,
      animate: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const color =
          count >= 100 ? "#7c3aed" : count >= 50 ? "#6366f1" : "#4f46e5";
        const size = count >= 100 ? 48 : count >= 50 ? 44 : 38;
        return L.divIcon({
          html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:${
            size > 40 ? "16px" : "14px"
          };border:3px solid white;box-shadow:0 4px 15px ${color}66;">${count}</div>`,
          className: "custom-obj-cluster-wrapper",
          iconSize: L.point(size, size),
        });
      },
    });
    return () => {
      if (clusterGroupRef.current) {
        if (map.hasLayer(clusterGroupRef.current))
          map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [map]);

  // Effect 2: Toggle visibility
  useEffect(() => {
    if (!clusterGroupRef.current) return;
    if (hidden) {
      if (map.hasLayer(clusterGroupRef.current))
        map.removeLayer(clusterGroupRef.current);
    } else {
      if (!map.hasLayer(clusterGroupRef.current))
        map.addLayer(clusterGroupRef.current);
    }
  }, [map, hidden]);

  // Effect 3: Repopulate markers when object list changes
  useEffect(() => {
    const cg = clusterGroupRef.current;
    if (!cg) return;
    cg.clearLayers();
    markersRef.current = [];
    objectsRef.current = [];
    if (hidden) return;

    objectsRef.current = objects;

    const markers = objects.map((obj: FacilityObject) => {
      const unresolvedCount = countsRef.current[obj.id] || 0;
      const marker = L.marker([obj.lat, obj.lng], {
        icon: createObjectIcon(obj.objectType, unresolvedCount),
      });

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onObjectClickRef.current(obj);
      });

      const label = OBJECT_LABEL[obj.objectType] || obj.objectType;
      const color = OBJECT_COLOR[obj.objectType] || "#4f46e5";
      const iconSvg = renderToStaticMarkup(getObjectIcon(obj.objectType, 14));

      marker.bindPopup(
        `
        <div class="p-4 min-w-[200px] bg-white dark:bg-slate-800 transition-colors">
          <div class="flex items-center gap-2 mb-2">
            <div class="p-1.5 rounded-lg" style="background-color:${color}20;color:${color};">${iconSvg}</div>
            <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">${label}</span>
          </div>
          <div class="font-black text-slate-900 dark:text-white text-base leading-tight mb-1">${
            obj.name
          }</div>
          ${
            obj.tuman
              ? `<div class="text-[11px] text-slate-500 dark:text-slate-400 font-bold">${obj.tuman}</div>`
              : ""
          }
        </div>
      `,
        { closeButton: false, offset: [0, -5] }
      );

      marker.on("mouseover", (e) => {
        e.target.openPopup();
      });
      marker.on("mouseout", (e) => {
        e.target.closePopup();
      });
      return marker;
    });

    markersRef.current = markers;
    cg.addLayers(markers);
  }, [objects, hidden]);

  // Effect 4: Update badge icons when unresolved counts change
  useEffect(() => {
    if (!markersRef.current.length) return;
    objectsRef.current.forEach((obj, i) => {
      const marker = markersRef.current[i];
      if (marker)
        marker.setIcon(
          createObjectIcon(obj.objectType, objectUnresolvedCounts[obj.id] || 0)
        );
    });
  }, [objectUnresolvedCounts]);

  return null;
}

// ── Map utilities ─────────────────────────────────────────────────────────────

function MapController({
  onMapClick,
  setZoomLevel,
  userLocation,
  triggerLocate,
}: any) {
  const map = useMap();
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
    zoomend(e) {
      setZoomLevel(e.target.getZoom());
    },
  });
  useEffect(() => {
    if (userLocation && triggerLocate > 0) {
      map.flyTo([userLocation.lat, userLocation.lng], 16, { duration: 1.5 });
    }
  }, [triggerLocate, userLocation, map]);
  return null;
}

function MapSizeHandler() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

function TileSeamFix() {
  useEffect(() => {
    const id = "leaflet-tile-seam-fix";
    if (document.getElementById(id)) return;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `.leaflet-tile { margin-right: -1px !important; margin-bottom: -1px !important; }`;
    document.head.appendChild(style);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);
  return null;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface MapComponentProps {
  issues: Issue[];
  objects: FacilityObject[];
  center: [number, number];
  onIssueClick: (issue: Issue) => void;
  onMapClick: (coords: Coordinates) => void;
  onObjectClick: (obj: FacilityObject) => void;
  isAdding: boolean;
  showObjects: boolean;
  showHeatmap: boolean;
  userLocation: Coordinates | null;
  triggerLocate: number;
  isDark: boolean;
  showChoropleth: boolean;
  choroplethMetric: string;
  onDistrictClick?: (districtId: string, name: any, scores: any) => void;
  selectedRegionCode?: number | null;
  objectUnresolvedCounts: Record<string, number>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const MapComponent: React.FC<MapComponentProps> = ({
  issues,
  objects,
  center,
  onIssueClick,
  onMapClick,
  onObjectClick,
  isAdding,
  showObjects,
  showHeatmap,
  userLocation,
  triggerLocate,
  isDark,
  showChoropleth,
  choroplethMetric,
  onDistrictClick,
  selectedRegionCode,
  objectUnresolvedCounts,
}) => {
  const [zoomLevel, setZoomLevel] = useState(13);

  const tileUrl = isDark
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        markerZoomAnimation={true}
      >
        <MapSizeHandler />
        <TileSeamFix />
        <TileLayer key={tileUrl} url={tileUrl} />

        <RegionBorderLayer regionCode={selectedRegionCode ?? null} />
        <HeatmapLayer
          issues={issues}
          show={showHeatmap}
          zoomLevel={zoomLevel}
        />

        <ChoroplethLayer
          show={showChoropleth && !showHeatmap}
          metric={choroplethMetric}
          regionCode={selectedRegionCode ?? undefined}
          onDistrictClick={onDistrictClick}
        />

        <MarkerClusterGroup
          issues={issues}
          onIssueClick={onIssueClick}
          zoomLevel={zoomLevel}
          hidden={showHeatmap}
        />

        <ObjectClusterGroup
          objects={objects}
          onObjectClick={onObjectClick}
          hidden={!showObjects || showHeatmap}
          objectUnresolvedCounts={objectUnresolvedCounts}
        />

        {userLocation && (
          <Marker
            position={[userLocation.lat, userLocation.lng]}
            icon={L.divIcon({
              html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>`,
              className: "",
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            })}
          />
        )}

        <MapController
          onMapClick={onMapClick}
          setZoomLevel={setZoomLevel}
          userLocation={userLocation}
          triggerLocate={triggerLocate}
        />
      </MapContainer>

      {showChoropleth && !showHeatmap && (
        <div className="absolute bottom-24 left-4 z-[400]">
          <ChoroplethLegend metric={choroplethMetric} />
        </div>
      )}
    </div>
  );
};
