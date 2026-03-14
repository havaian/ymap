// frontend/src/components/map/MapComponent.tsx

import React, { useState, useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import "leaflet.markercluster";
import {
  Issue,
  Coordinates,
  IssueCategory,
  FacilityObject,
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
  Heart,
  ArrowRight,
} from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChoroplethLayer } from "../analytics/ChoroplethLayer";
import { RegionBorderLayer } from "./RegionBorderLayer";

// Fix for Leaflet default icons in ESM environment
if (L.Icon && L.Icon.Default) {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Icon cache — each unique variant built once per session
// ─────────────────────────────────────────────────────────────────────────────
const iconCache = new Map<string, L.DivIcon>();
function getCachedIcon(key: string, creator: () => L.DivIcon): L.DivIcon {
  if (!iconCache.has(key)) iconCache.set(key, creator());
  return iconCache.get(key)!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Object icon helpers
// ─────────────────────────────────────────────────────────────────────────────

function getObjectTypeIcon(objectType: string, size: number) {
  switch (objectType) {
    case "school":
      return <School size={size} strokeWidth={2.5} color="white" />;
    case "health_post":
      return <Heart size={size} strokeWidth={2.5} color="white" />;
    case "kindergarten":
    default:
      return <Building2 size={size} strokeWidth={2.5} color="white" />;
  }
}

// Default color by objectType (used when no verifications yet)
function getObjectTypeColor(objectType: string): string {
  switch (objectType) {
    case "school":
      return "#4f46e5"; // indigo
    case "kindergarten":
      return "#7c3aed"; // violet
    case "health_post":
      return "#0891b2"; // cyan
    default:
      return "#4f46e5";
  }
}

// Verification-based color override
// green ≥70% done, red ≥50% problem, yellow otherwise
function getVerificationColor(
  verif:
    | { doneCount: number; problemCount: number; totalCount: number }
    | undefined
): string | null {
  if (!verif || verif.totalCount === 0) return null;
  if (verif.doneCount / verif.totalCount >= 0.7) return "#10b981"; // emerald
  if (verif.problemCount / verif.totalCount >= 0.5) return "#ef4444"; // red
  return "#f59e0b"; // amber — mixed
}

function createObjectIcon(
  objectType: string,
  unresolvedCount: number,
  verif?: { doneCount: number; problemCount: number; totalCount: number },
  isOvercrowded?: boolean
) {
  const verifColor = getVerificationColor(verif);
  const overcrowdColor = isOvercrowded && !verifColor ? "#f97316" : null;
  const color = verifColor ?? overcrowdColor ?? getObjectTypeColor(objectType);
  const countKey = Math.min(unresolvedCount, 99);
  const verifKey = verif
    ? verif.doneCount >= verif.totalCount * 0.7
      ? "g"
      : verif.problemCount >= verif.totalCount * 0.5
      ? "r"
      : "y"
    : "n";
  const cacheKey = `obj_${objectType}_${countKey}_${verifKey}_${
    isOvercrowded ? "oc" : ""
  }`;

  return getCachedIcon(cacheKey, () => {
    const size = 40;
    const borderRadius = 12;
    const iconSvg = renderToStaticMarkup(getObjectTypeIcon(objectType, 18));

    const badgeSvg =
      unresolvedCount > 0
        ? `
      <div style="position:absolute;top:-7px;right:-7px;background:#ef4444;color:white;border-radius:50%;
                  width:20px;height:20px;display:flex;align-items:center;justify-content:center;
                  font-size:10px;font-weight:900;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.2);z-index:10;">
        ${countKey >= 99 ? "99+" : unresolvedCount}
      </div>`
        : "";

    // Verification status ring (green/red/amber border glow)
    const glowStyle = verifColor
      ? `box-shadow:0 0 0 3px ${verifColor}66, 0 4px 12px -2px ${verifColor}88;`
      : `box-shadow:0 4px 12px -2px rgba(79,70,229,.4);`;

    const html = `
      <div style="position:relative;background-color:${color};width:${size}px;height:${size}px;
                  border-radius:${borderRadius}px;display:flex;align-items:center;justify-content:center;
                  border:2px solid white;${glowStyle}">
        ${iconSvg}
        ${badgeSvg}
      </div>`;
    return L.divIcon({
      html,
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue icon helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function createIssueIcon(category: IssueCategory, isZoomedOut: boolean) {
  return getCachedIcon(`issue_${category}_${isZoomedOut ? 1 : 0}`, () => {
    const color = CATEGORY_COLORS[category] || "#64748b";
    if (isZoomedOut) {
      const svg = `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <circle cx="9" cy="9" r="6" fill="${color}" stroke="white" stroke-width="2.5" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))"/>
      </svg>`;
      return L.divIcon({
        html: svg,
        className: "",
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
    }
    const iconSvg = renderToStaticMarkup(getCategoryIcon(category));
    const html = `
      <div style="background-color:${color};width:38px;height:38px;border-radius:50%;
                  display:flex;align-items:center;justify-content:center;
                  border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,.3);">
        ${iconSvg}
      </div>
      <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;
                  border-top:10px solid white;position:absolute;bottom:-8px;left:12px;"></div>`;
    return L.divIcon({
      html,
      className: "",
      iconSize: [38, 48],
      iconAnchor: [19, 48],
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal utility components
// ─────────────────────────────────────────────────────────────────────────────

function MapSizeHandler() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100);
  }, [map]);
  return null;
}

function TileSeamFix() {
  const map = useMap();
  useEffect(() => {
    const tiles = document.querySelectorAll(".leaflet-tile");
    tiles.forEach((t: any) => {
      t.style.width = "256.5px";
      t.style.height = "256.5px";
    });
  }, [map]);
  return null;
}

function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  useMapEvents({ zoomend: (e) => onZoom(e.target.getZoom()) });
  return null;
}

function MapClickHandler({
  isAdding,
  onClick,
}: {
  isAdding: boolean;
  onClick: (c: Coordinates) => void;
}) {
  useMapEvents({
    click: (e) => {
      if (isAdding) onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// HeatmapLayer
// ─────────────────────────────────────────────────────────────────────────────

function HeatmapLayer({ issues, show }: { issues: Issue[]; show: boolean }) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    if (!show) {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
      return;
    }
    const points = issues.map(
      (i) => [i.lat, i.lng, 0.5] as [number, number, number]
    );
    if (!(L as any).heatLayer) return;
    if (layerRef.current) map.removeLayer(layerRef.current);
    layerRef.current = (L as any)
      .heatLayer(points, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        gradient: { 0.4: "#3b82f6", 0.65: "#f59e0b", 1: "#ef4444" },
      })
      .addTo(map);
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [issues, show, map]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// IssueClusterGroup
// ─────────────────────────────────────────────────────────────────────────────

function IssueClusterGroup({ issues, onIssueClick, zoomLevel }: any) {
  const map = useMap();
  const clusterRef = useRef<any>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const issuesRef = useRef<Issue[]>([]);
  const onClickRef = useRef(onIssueClick);
  const prevZoomRef = useRef(zoomLevel < 14);

  useEffect(() => {
    onClickRef.current = onIssueClick;
  }, [onIssueClick]);

  // Create cluster group once
  useEffect(() => {
    const mcg = (L as any).markerClusterGroup;
    if (typeof mcg !== "function") return;
    clusterRef.current = mcg({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 50,
      animate: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const color =
          count >= 100 ? "#dc2626" : count >= 50 ? "#ea580c" : "#64748b";
        const size = count >= 100 ? 48 : count >= 50 ? 44 : 38;
        return L.divIcon({
          html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;
                             display:flex;align-items:center;justify-content:center;color:white;
                             font-weight:900;font-size:${
                               size > 40 ? "16px" : "14px"
                             };
                             border:3px solid white;box-shadow:0 4px 15px rgba(0,0,0,.3);">${count}</div>`,
          className: "",
          iconSize: L.point(size, size),
        });
      },
    });
    clusterRef.current.addTo(map);
    return () => {
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
        clusterRef.current = null;
      }
    };
  }, [map]);

  // Repopulate markers when issue list changes
  useEffect(() => {
    const cg = clusterRef.current;
    if (!cg) return;
    cg.clearLayers();
    markersRef.current = [];
    issuesRef.current = issues;
    const isZoomedOut = zoomLevel < 14;

    const markers = issues.map((issue: Issue) => {
      const marker = L.marker([issue.lat, issue.lng], {
        icon: createIssueIcon(issue.category, isZoomedOut),
      });
      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onClickRef.current(issue);
      });
      return marker;
    });
    markersRef.current = markers;
    cg.addLayers(markers);
  }, [issues]);

  // Update icons on zoom without recreating markers
  useEffect(() => {
    const isZoomedOut = zoomLevel < 14;
    if (isZoomedOut === prevZoomRef.current) return;
    prevZoomRef.current = isZoomedOut;
    markersRef.current.forEach((marker, i) => {
      const issue = issuesRef.current[i];
      if (issue) marker.setIcon(createIssueIcon(issue.category, isZoomedOut));
    });
  }, [zoomLevel]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ObjectClusterGroup
// ─────────────────────────────────────────────────────────────────────────────

function ObjectClusterGroup({
  objects,
  onObjectClick,
  hidden,
  objectUnresolvedCounts,
  verificationSummary,
}: {
  objects: FacilityObject[];
  onObjectClick: (o: FacilityObject) => void;
  hidden: boolean;
  objectUnresolvedCounts: Record<string, number>;
  verificationSummary: Map<string, any>;
}) {
  const map = useMap();
  const clusterRef = useRef<any>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const objectsRef = useRef<FacilityObject[]>([]);
  const onClickRef = useRef(onObjectClick);
  const unresolvedRef = useRef(objectUnresolvedCounts);
  const verifRef = useRef(verificationSummary);

  useEffect(() => {
    onClickRef.current = onObjectClick;
  }, [onObjectClick]);
  useEffect(() => {
    unresolvedRef.current = objectUnresolvedCounts;
  }, [objectUnresolvedCounts]);
  useEffect(() => {
    verifRef.current = verificationSummary;
  }, [verificationSummary]);

  // Create cluster group once
  useEffect(() => {
    const mcg = (L as any).markerClusterGroup;
    if (typeof mcg !== "function") return;
    clusterRef.current = mcg({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 60,
      animate: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const color =
          count >= 100 ? "#7c3aed" : count >= 50 ? "#6366f1" : "#4f46e5";
        const size = count >= 100 ? 48 : count >= 50 ? 44 : 38;
        return L.divIcon({
          html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;
                             display:flex;align-items:center;justify-content:center;color:white;
                             font-weight:900;font-size:${
                               size > 40 ? "16px" : "14px"
                             };
                             border:3px solid white;box-shadow:0 4px 15px rgba(79,70,229,.4);">${count}</div>`,
          className: "",
          iconSize: L.point(size, size),
        });
      },
    });
    clusterRef.current.addTo(map);
    return () => {
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
        clusterRef.current = null;
      }
    };
  }, [map]);

  // Toggle visibility
  useEffect(() => {
    const cg = clusterRef.current;
    if (!cg) return;
    if (hidden) {
      if (map.hasLayer(cg)) map.removeLayer(cg);
    } else {
      if (!map.hasLayer(cg)) map.addLayer(cg);
    }
  }, [map, hidden]);

  // Repopulate markers when object list changes
  useEffect(() => {
    const cg = clusterRef.current;
    if (!cg) return;
    cg.clearLayers();
    markersRef.current = [];
    objectsRef.current = [];
    if (hidden) return;

    objectsRef.current = objects;
    const arrowSvg = renderToStaticMarkup(<ArrowRight size={10} />);

    const markers = objects.map((obj: FacilityObject) => {
      const unresolvedCount = unresolvedRef.current[obj.id] || 0;
      const verif = verifRef.current.get(obj.id);
      const marker = L.marker([obj.lat, obj.lng], {
        icon: createObjectIcon(
          obj.objectType || "school",
          unresolvedCount,
          verif,
          (obj.capacity ?? 0) > 0 && (obj.enrollment ?? 0) > (obj.capacity ?? 0) // ← добавить
        ),
      });

      marker.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        onClickRef.current(obj);
      });

      const typeLabel: Record<string, string> = {
        school: "Школа",
        kindergarten: "Детский сад",
        health_post: "ФАП/СВП",
      };
      const iconSvg = renderToStaticMarkup(
        getObjectTypeIcon(obj.objectType || "school", 14)
      );
      marker.bindPopup(
        `
        <div class="p-4 min-w-[200px] bg-white dark:bg-slate-800">
          <div class="flex items-center gap-2 mb-2">
            <div class="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600">${iconSvg}</div>
            <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">
              ${typeLabel[obj.objectType || ""] || obj.objectType || ""}
            </span>
          </div>
          <div class="font-black text-slate-900 dark:text-white text-base leading-tight mb-3">
            ${obj.name}
          </div>
          <div class="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/50">
            <div class="flex flex-col">
              <span class="text-[9px] font-black uppercase text-slate-400 mb-0.5">Открытых обращений</span>
              <span class="text-sm font-black ${
                unresolvedCount > 0 ? "text-red-500" : "text-green-500"
              }">
                ${unresolvedCount}
              </span>
            </div>
            <div class="flex items-center gap-1.5 text-blue-600 text-[10px] font-black uppercase tracking-widest">
              Подробнее ${arrowSvg}
            </div>
          </div>
        </div>
      `,
        { closeButton: false, offset: [0, -5], className: "org-popup" }
      );

      marker.on("mouseover", (e) => e.target.openPopup());
      marker.on("mouseout", (e) => e.target.closePopup());
      return marker;
    });

    markersRef.current = markers;
    cg.addLayers(markers);
  }, [objects, hidden]);

  // Update icons when unresolved counts or verification summary changes — no full recreate
  useEffect(() => {
    objectsRef.current.forEach((obj, i) => {
      const marker = markersRef.current[i];
      if (!marker) return;
      const unresolvedCount = objectUnresolvedCounts[obj.id] || 0;
      const verif = verificationSummary.get(obj.id);
      marker.setIcon(
        createObjectIcon(
          obj.objectType || "school",
          unresolvedCount,
          verif,
          (obj.capacity ?? 0) > 0 && (obj.enrollment ?? 0) > (obj.capacity ?? 0) // ← добавить
        )
      );
    });
    // Clear cache entries for these objects so next createObjectIcon picks fresh colors
    iconCache.forEach((_, key) => {
      if (key.startsWith("obj_")) iconCache.delete(key);
    });
  }, [objectUnresolvedCounts, verificationSummary]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// UserLocationMarker
// ─────────────────────────────────────────────────────────────────────────────

function UserLocationMarker({
  userLocation,
  triggerLocate,
}: {
  userLocation: Coordinates | null;
  triggerLocate: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (userLocation && triggerLocate > 0) {
      map.flyTo(
        [userLocation.lat, userLocation.lng],
        Math.max(map.getZoom(), 15),
        { duration: 1 }
      );
    }
  }, [triggerLocate]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// MapComponent
// ─────────────────────────────────────────────────────────────────────────────

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
  showChoropleth: boolean;
  choroplethMetric: string;
  selectedRegionCode?: number | null;
  onDistrictClick?: (districtId: string, name: any, scores: any) => void;
  userLocation: Coordinates | null;
  triggerLocate: number;
  isDark: boolean;
  objectUnresolvedCounts: Record<string, number>;
  verificationSummary: Map<string, any>;
}

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
  showChoropleth,
  choroplethMetric,
  selectedRegionCode,
  onDistrictClick,
  userLocation,
  triggerLocate,
  isDark,
  objectUnresolvedCounts,
  verificationSummary,
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
        <ZoomTracker onZoom={setZoomLevel} />
        <MapClickHandler isAdding={isAdding} onClick={onMapClick} />
        <UserLocationMarker
          userLocation={userLocation}
          triggerLocate={triggerLocate}
        />

        <RegionBorderLayer regionCode={selectedRegionCode ?? null} />

        {/* Heatmap — fully independent of other layers */}
        <HeatmapLayer issues={issues} show={showHeatmap} />

        {/* Choropleth — fully independent of other layers */}
        <ChoroplethLayer
          show={showChoropleth}
          metric={choroplethMetric}
          regionCode={selectedRegionCode ?? undefined}
          onDistrictClick={onDistrictClick}
        />

        {/* Issues */}
        <IssueClusterGroup
          issues={issues}
          onIssueClick={onIssueClick}
          zoomLevel={zoomLevel}
        />

        {/* Objects — fully independent of heatmap and choropleth */}
        <ObjectClusterGroup
          objects={objects}
          onObjectClick={onObjectClick}
          hidden={!showObjects}
          objectUnresolvedCounts={objectUnresolvedCounts}
          verificationSummary={verificationSummary}
        />
      </MapContainer>
    </div>
  );
};
