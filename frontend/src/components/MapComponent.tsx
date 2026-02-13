// frontend/src/components/MapComponent.tsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import 'leaflet.markercluster';
import { Issue, Coordinates, IssueCategory, Organization, Infrastructure, Severity } from '../../types';
import { CATEGORY_COLORS } from '../constants';
import { Car, Droplets, Zap, GraduationCap, Stethoscope, Trash2, HelpCircle, Building2, School, Hospital, Construction, Waves, ArrowRight } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

// Fix for Leaflet default icons in ESM environment
if (L.Icon && L.Icon.Default) {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  });
}

function VisualPinIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 7 13 7 13s7-7.75 7-13c0-4.42-3.58-8-8-8zm0 11c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"/>
    </svg>
  );
}

function getCategoryIcon(category: IssueCategory) {
  switch (category) {
    case IssueCategory.ROADS: return <Car size={16} strokeWidth={2.5} color="white" />;
    case IssueCategory.WATER: return <Droplets size={16} strokeWidth={2.5} color="white" />;
    case IssueCategory.ELECTRICITY: return <Zap size={16} strokeWidth={2.5} color="white" />;
    case IssueCategory.EDUCATION: return <GraduationCap size={16} strokeWidth={2.5} color="white" />;
    case IssueCategory.HEALTH: return <Stethoscope size={16} strokeWidth={2.5} color="white" />;
    case IssueCategory.WASTE: return <Trash2 size={16} strokeWidth={2.5} color="white" />;
    default: return <HelpCircle size={16} strokeWidth={2.5} color="white" />;
  }
}

// 4 DIFFERENT ICONS FOR ORGANIZATIONS AND INFRASTRUCTURE
function getOrgIcon(type: IssueCategory, size: number = 18) {
  switch (type) {
    case IssueCategory.EDUCATION:
      return <School size={size} strokeWidth={2.5} color="white" />;
    case IssueCategory.HEALTH:
      return <Hospital size={size} strokeWidth={2.5} color="white" />;
    default:
      return <Building2 size={size} strokeWidth={2.5} color="white" />;
  }
}

function getInfraIcon(type: string, size: number = 18) {
  if (type === 'Roads') {
    return <Construction size={size} strokeWidth={2.5} color="white" />;
  } else if (type === 'Water & Sewage') {
    return <Waves size={size} strokeWidth={2.5} color="white" />;
  }
  return <Building2 size={size} strokeWidth={2.5} color="white" />;
}

// Get colors for different types
function getOrgColor(type: IssueCategory): string {
  switch (type) {
    case IssueCategory.EDUCATION: return '#10b981'; // Green
    case IssueCategory.HEALTH: return '#ef4444'; // Red
    default: return '#4f46e5'; // Indigo
  }
}

function getInfraColor(type: string): string {
  if (type === 'Roads') return '#f59e0b'; // Amber
  if (type === 'Water & Sewage') return '#06b6d4'; // Cyan
  return '#6366f1'; // Indigo
}

// ─────────────────────────────────────────────────────────────────────────────
// MODULE-LEVEL ICON CACHE
//
// Creating icons is expensive: renderToStaticMarkup runs React's server renderer
// for every SVG, and L.divIcon allocates DOM. With 15k+ markers this becomes the
// primary performance bottleneck — especially when zoom changes re-trigger it.
//
// This cache means each unique icon variant (type + state) is built exactly ONCE
// per browser session, then reused forever.
//
// Key format:
//   issue_{category}_{0|1}         (0 = full icon, 1 = zoomed-out dot)
//   org_{type}_{count}             (count capped at 99)
//   infra_{type}
// ─────────────────────────────────────────────────────────────────────────────
const iconCache = new Map<string, L.DivIcon>();

function getCachedIcon(key: string, creator: () => L.DivIcon): L.DivIcon {
  if (!iconCache.has(key)) {
    iconCache.set(key, creator());
  }
  return iconCache.get(key)!;
}

function createCustomIcon(category: IssueCategory, isZoomedOut: boolean) {
  return getCachedIcon(`issue_${category}_${isZoomedOut ? 1 : 0}`, () => {
    const color = CATEGORY_COLORS[category] || '#64748b';

    if (isZoomedOut) {
      const svg = `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="6" fill="${color}" stroke="white" stroke-width="2.5" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/></svg>`;
      return L.divIcon({ html: svg, className: '', iconSize: [18, 18], iconAnchor: [9, 9] });
    } else {
      const iconSvg = renderToStaticMarkup(getCategoryIcon(category));
      const svg = `
        <div style="background-color: ${color}; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
          ${iconSvg}
        </div>
        <div style="width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 10px solid white; position: absolute; bottom: -8px; left: 12px;"></div>
      `;
      return L.divIcon({ html: svg, className: '', iconSize: [38, 48], iconAnchor: [19, 48] });
    }
  });
}

// Fixed-size org icon — zoom parameter removed.
// Previously icons were recreated on every zoom tick to change size.
// Now they use a single fixed size; the cluster group handles visual density.
function createOrgIcon(unresolvedCount: number, type: IssueCategory) {
  const countKey = unresolvedCount > 99 ? 99 : unresolvedCount;
  return getCachedIcon(`org_${type}_${countKey}`, () => {
    const color = getOrgColor(type);
    const baseSize = 40;
    const borderRadius = 12;
    const badgeSize = 20;
    const badgeFontSize = 10;

    const iconSvg = renderToStaticMarkup(getOrgIcon(type, 18));

    const badgeSvg = unresolvedCount > 0 ? `
      <div style="position: absolute; top: -7px; right: -7px; background: #ef4444; color: white; border-radius: 50%; width: ${badgeSize}px; height: ${badgeSize}px; display: flex; align-items: center; justify-content: center; font-size: ${badgeFontSize}px; font-weight: 900; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 10;">
        ${countKey >= 99 ? '99+' : unresolvedCount}
      </div>
    ` : '';

    const html = `
      <div class="org-marker-glow" style="position: relative; background-color: ${color}; width: ${baseSize}px; height: ${baseSize}px; border-radius: ${borderRadius}px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 4px 12px -2px rgba(79, 70, 229, 0.4);">
        ${iconSvg}
        ${badgeSvg}
      </div>
    `;
    return L.divIcon({ html, className: '', iconSize: [baseSize, baseSize], iconAnchor: [baseSize / 2, baseSize / 2] });
  });
}

// Fixed-size infra icon — zoom parameter removed.
function createInfraIcon(type: string) {
  return getCachedIcon(`infra_${type}`, () => {
    const color = getInfraColor(type);
    const baseSize = 32;
    const borderRadius = 8;

    const iconSvg = renderToStaticMarkup(getInfraIcon(type, 14));
    const html = `
      <div style="position: relative; background-color: ${color}; width: ${baseSize}px; height: ${baseSize}px; border-radius: ${borderRadius}px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 4px 12px -2px rgba(0,0,0,0.3);">
        ${iconSvg}
      </div>
    `;
    return L.divIcon({ html, className: '', iconSize: [baseSize, baseSize], iconAnchor: [baseSize / 2, baseSize / 2] });
  });
}

function HeatmapLayer({ issues, show, zoomLevel }: { issues: Issue[], show: boolean, zoomLevel: number }) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    // Cleanup existing layer safely
    if (layerRef.current) {
      if (map.hasLayer(layerRef.current)) {
        map.removeLayer(layerRef.current);
      }
      layerRef.current = null;
    }

    if (!show || issues.length === 0) return;

    const heatLayerFunc = (L as any).heatLayer;
    if (typeof heatLayerFunc !== 'function') return;

    const heatPoints: [number, number, number][] = issues
      .filter(i => {
          const lat = parseFloat(i.lat as any);
          const lng = parseFloat(i.lng as any);
          return !isNaN(lat) && !isNaN(lng) && i.status !== 'Resolved';
      })
      .map(i => {
        let weight = 10;
        switch (i.severity) {
          case Severity.LOW: weight = 10; break;
          case Severity.MEDIUM: weight = 30; break;
          case Severity.HIGH: weight = 80; break;
          case Severity.CRITICAL: weight = 200; break;
        }
        
        const orgMultiplier = i.organizationId ? 2.5 : 1.0;
        const votesMultiplier = 1 + (Math.log10(Math.max(0, i.votes) + 1) * 1.5);
        
        const finalWeight = Math.min(1000, weight * orgMultiplier * votesMultiplier);
        return [i.lat, i.lng, finalWeight];
      });

    if (heatPoints.length === 0) return;

    const radius = Math.round(Math.max(15, (zoomLevel - 10) * 4 + 25));
    const blur = Math.round(Math.max(10, radius * 0.75));
    const dynamicMax = Math.max(50, 2500 / Math.pow(1.6, Math.max(0, zoomLevel - 11)));

    try {
      const heatLayer = heatLayerFunc(heatPoints, {
        radius: radius,      
        blur: blur,        
        maxZoom: 18,
        max: dynamicMax, 
        minOpacity: 0.15, 
        gradient: {
          0.1: '#3b82f6',
          0.3: '#10b981',
          0.5: '#fbbf24',
          0.7: '#f97316',
          1.0: '#ef4444'
        }
      });
      
      heatLayer.addTo(map);
      layerRef.current = heatLayer;

      return () => {
        if (layerRef.current && map.hasLayer(layerRef.current)) {
          map.removeLayer(layerRef.current);
          layerRef.current = null;
        }
      };
    } catch (e) {
      console.warn("Heatmap rendering bypassed to prevent canvas crash:", e);
    }
  }, [map, issues, show, zoomLevel]);

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLUSTER GROUP ARCHITECTURE — 3-effect pattern
//
// The root performance problem was: ALL THREE cluster groups had zoomLevel in
// their marker-population effect deps. Every zoom event triggered:
//   clearLayers() → remove all N markers from DOM
//   createIcon() × N → N renderToStaticMarkup calls
//   addLayers() → re-insert all N markers into DOM
//
// For 15k infrastructure items this is catastrophic on every scroll.
//
// Fix: Split into three separate effects per group:
//   1. [map]         — create cluster group ONCE, destroy on unmount
//   2. [map, hidden] — toggle map visibility without touching markers
//   3. [data]        — repopulate markers only when data actually changes
//   +  [zoomLevel]   — (issues only) update icons when threshold 14 is crossed
//
// Result: zoom events no longer trigger any marker operations.
// ─────────────────────────────────────────────────────────────────────────────

function MarkerClusterGroup({ issues, onIssueClick, zoomLevel, hidden }: any) {
  const map = useMap();
  const clusterGroupRef = useRef<any>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const issuesRef = useRef<Issue[]>([]);
  // Track the last zoom state used for icon rendering to skip redundant updates
  const prevZoomedOutRef = useRef<boolean>(zoomLevel < 14);

  // Stable ref for click callback — prevents stale closures when issues array changes
  const onIssueClickRef = useRef(onIssueClick);
  useEffect(() => { onIssueClickRef.current = onIssueClick; }, [onIssueClick]);

  // Effect 1: Create cluster group once on mount, clean up on unmount
  useEffect(() => {
    const markerClusterFunc = (L as any).markerClusterGroup;
    if (typeof markerClusterFunc !== 'function') return;

    clusterGroupRef.current = markerClusterFunc({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 80, 
      disableClusteringAtZoom: 15,
      animate: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let color = '#10b981'; 
        if (count >= 10 && count < 50) color = '#f59e0b';
        else if (count >= 50) color = '#ef4444';
        return L.divIcon({
          html: `<div class="cluster-anim-pulse" style="background: ${color}; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 14px; border: 3px solid white; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">${count}</div>`,
          className: 'custom-cluster-wrapper',
          iconSize: L.point(38, 38)
        });
      }
    });

    return () => {
      if (clusterGroupRef.current) {
        if (map.hasLayer(clusterGroupRef.current)) map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [map]);

  // Effect 2: Toggle visibility without touching markers
  useEffect(() => {
    if (!clusterGroupRef.current) return;
    if (hidden) {
      if (map.hasLayer(clusterGroupRef.current)) map.removeLayer(clusterGroupRef.current);
    } else {
      if (!map.hasLayer(clusterGroupRef.current)) map.addLayer(clusterGroupRef.current);
    }
  }, [map, hidden]);

  // Effect 3: Repopulate markers only when issue DATA changes — NOT on zoom
  useEffect(() => {
    const cg = clusterGroupRef.current;
    if (!cg) return;

    cg.clearLayers();
    markersRef.current = [];
    issuesRef.current = [];

    if (hidden) return;

    const isZoomedOut = zoomLevel < 14;
    prevZoomedOutRef.current = isZoomedOut;

    const freeIssues = issues.filter((i: Issue) => !i.organizationId && i.lat && i.lng);
    issuesRef.current = freeIssues;

    const markers = freeIssues.map((issue: Issue) => {
      const marker = L.marker([issue.lat, issue.lng], {
        icon: createCustomIcon(issue.category, isZoomedOut)
      });
      // Use ref so click always calls the latest handler without rebinding
      marker.on('click', () => onIssueClickRef.current(issue));
      return marker;
    });

    markersRef.current = markers;
    cg.addLayers(markers);
  }, [issues, hidden]); // zoomLevel intentionally NOT here — handled by effect 4

  // Effect 4: Update icons only when zoom crosses the dot↔full threshold (zoom 14).
  // Uses setIcon() which is O(n) but orders of magnitude faster than clearLayers+addLayers.
  useEffect(() => {
    const isZoomedOut = zoomLevel < 14;
    // Early return if the visual state hasn't actually changed
    if (isZoomedOut === prevZoomedOutRef.current) return;
    prevZoomedOutRef.current = isZoomedOut;

    markersRef.current.forEach((marker, i) => {
      const issue = issuesRef.current[i];
      if (issue) marker.setIcon(createCustomIcon(issue.category, isZoomedOut));
    });
  }, [zoomLevel]);

  return null;
}

function OrganizationClusterGroup({ organizations, onOrgClick, zoomLevel, hidden, orgUnresolvedCounts }: any) {
  const map = useMap();
  const clusterGroupRef = useRef<any>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const orgsRef = useRef<Organization[]>([]);

  // Stable refs for callbacks and counts
  const onOrgClickRef = useRef(onOrgClick);
  useEffect(() => { onOrgClickRef.current = onOrgClick; }, [onOrgClick]);

  // Keep counts ref current so the data effect always uses latest values
  // without needing orgUnresolvedCounts in its deps (which would force full marker recreation)
  const orgCountsRef = useRef(orgUnresolvedCounts);
  useEffect(() => { orgCountsRef.current = orgUnresolvedCounts; }, [orgUnresolvedCounts]);

  // Effect 1: Create cluster group once
  useEffect(() => {
    const markerClusterFunc = (L as any).markerClusterGroup;
    if (typeof markerClusterFunc !== 'function') return;

    clusterGroupRef.current = markerClusterFunc({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 60,
      disableClusteringAtZoom: null,
      animate: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let color = '#4f46e5';
        let size = 38;
        
        if (count >= 100) {
          color = '#7c3aed';
          size = 48;
        } else if (count >= 50) {
          color = '#6366f1';
          size = 44;
        }

        return L.divIcon({
          html: `<div style="background: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: ${size > 40 ? '16px' : '14px'}; border: 3px solid white; box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);">${count}</div>`,
          className: 'custom-org-cluster-wrapper',
          iconSize: L.point(size, size)
        });
      }
    });

    return () => {
      if (clusterGroupRef.current) {
        if (map.hasLayer(clusterGroupRef.current)) map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [map]);

  // Effect 2: Toggle visibility
  useEffect(() => {
    if (!clusterGroupRef.current) return;
    if (hidden) {
      if (map.hasLayer(clusterGroupRef.current)) map.removeLayer(clusterGroupRef.current);
    } else {
      if (!map.hasLayer(clusterGroupRef.current)) map.addLayer(clusterGroupRef.current);
    }
  }, [map, hidden]);

  // Effect 3: Repopulate markers only when organization list changes.
  // orgUnresolvedCounts is accessed via ref (always current, not a dep).
  // Icon badge counts are handled separately in effect 4.
  useEffect(() => {
    const cg = clusterGroupRef.current;
    if (!cg) return;

    cg.clearLayers();
    markersRef.current = [];
    orgsRef.current = [];

    if (hidden) return;

    orgsRef.current = organizations;
    const arrowSvg = renderToStaticMarkup(<ArrowRight size={10} />);

    const markers = organizations.map((org: Organization) => {
      const unresolvedCount = orgCountsRef.current[org.id] || 0;
      const marker = L.marker([org.lat, org.lng], {
        icon: createOrgIcon(unresolvedCount, org.type)
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onOrgClickRef.current(org);
      });

      const iconSvg = renderToStaticMarkup(getOrgIcon(org.type, 14));
      const popupContent = `
        <div class="p-4 min-w-[200px] bg-white dark:bg-slate-800 transition-colors">
            <div class="flex items-center gap-2 mb-2">
              <div class="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                ${iconSvg}
              </div>
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                ${org.type}
              </span>
            </div>
            <div class="font-black text-slate-900 dark:text-white text-base leading-tight mb-1">${org.name}</div>
            <div class="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-3">${org.address}</div>
            
            <div class="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/50">
              <div class="flex flex-col">
                 <span class="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 mb-0.5">Активные задачи</span>
                 <span class="text-sm font-black ${unresolvedCount > 0 ? 'text-red-500' : 'text-green-500'}">
                   ${unresolvedCount}
                 </span>
              </div>
              <div class="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest group">
                Подробнее ${arrowSvg}
              </div>
            </div>
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: false,
        offset: [0, -5],
        className: 'org-popup'
      });

      marker.on('mouseover', (e) => { e.target.openPopup(); });
      marker.on('mouseout', (e) => { e.target.closePopup(); });

      return marker;
    });

    markersRef.current = markers;
    cg.addLayers(markers);
  }, [organizations, hidden]); // orgUnresolvedCounts NOT here — handled in effect 4

  // Effect 4: Update only the badge icons when issue counts change.
  // This runs when issues are resolved/reopened without recreating all org markers.
  // Note: popup count text may be slightly stale; the badge icon is always current.
  useEffect(() => {
    if (!markersRef.current.length) return;
    orgsRef.current.forEach((org, i) => {
      const marker = markersRef.current[i];
      if (marker) marker.setIcon(createOrgIcon(orgUnresolvedCounts[org.id] || 0, org.type));
    });
  }, [orgUnresolvedCounts]);

  return null;
}

function InfrastructureClusterGroup({ infrastructure, onInfraClick, zoomLevel, hidden }: any) {
  const map = useMap();
  const clusterGroupRef = useRef<any>(null);

  // Stable ref for optional click callback
  const onInfraClickRef = useRef(onInfraClick);
  useEffect(() => { onInfraClickRef.current = onInfraClick; }, [onInfraClick]);

  // Effect 1: Create cluster group once
  useEffect(() => {
    const markerClusterFunc = (L as any).markerClusterGroup;
    if (typeof markerClusterFunc !== 'function') return;

    clusterGroupRef.current = markerClusterFunc({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 60,
      disableClusteringAtZoom: null,
      animate: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let color = '#f59e0b'; // Amber for infrastructure
        let size = 38;
        
        if (count >= 100) {
          color = '#dc2626'; // Red
          size = 48;
        } else if (count >= 50) {
          color = '#ea580c'; // Orange
          size = 44;
        }

        return L.divIcon({
          html: `<div style="background: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: ${size > 40 ? '16px' : '14px'}; border: 3px solid white; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4);">${count}</div>`,
          className: 'custom-infra-cluster-wrapper',
          iconSize: L.point(size, size)
        });
      }
    });

    return () => {
      if (clusterGroupRef.current) {
        if (map.hasLayer(clusterGroupRef.current)) map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [map]);

  // Effect 2: Toggle visibility
  useEffect(() => {
    if (!clusterGroupRef.current) return;
    if (hidden) {
      if (map.hasLayer(clusterGroupRef.current)) map.removeLayer(clusterGroupRef.current);
    } else {
      if (!map.hasLayer(clusterGroupRef.current)) map.addLayer(clusterGroupRef.current);
    }
  }, [map, hidden]);

  // Effect 3: Repopulate markers only when infrastructure data changes.
  // No zoom dependency — icons are fixed size, clustering handles visual density.
  useEffect(() => {
    const cg = clusterGroupRef.current;
    if (!cg) return;

    cg.clearLayers();

    if (hidden) return;

    const markers = infrastructure.map((infra: Infrastructure) => {
      const marker = L.marker([infra.lat, infra.lng], {
        icon: createInfraIcon(infra.type)
      });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (onInfraClickRef.current) onInfraClickRef.current(infra);
      });

      const iconSvg = renderToStaticMarkup(getInfraIcon(infra.type, 14));
      const popupContent = `
        <div class="p-4 min-w-[200px] bg-white dark:bg-slate-800 transition-colors">
            <div class="flex items-center gap-2 mb-2">
              <div class="p-1.5 rounded-lg" style="background-color: ${getInfraColor(infra.type)}20; color: ${getInfraColor(infra.type)};">
                ${iconSvg}
              </div>
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                ${infra.type}
              </span>
            </div>
            <div class="font-black text-slate-900 dark:text-white text-base leading-tight mb-1">${infra.name}</div>
            ${infra.address ? `<div class="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-3">${infra.address}</div>` : ''}
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: false,
        offset: [0, -5],
        className: 'infra-popup'
      });

      marker.on('mouseover', (e) => { e.target.openPopup(); });
      marker.on('mouseout', (e) => { e.target.closePopup(); });

      return marker;
    });

    cg.addLayers(markers);
  }, [infrastructure, hidden]); // zoomLevel intentionally NOT here

  return null;
}

function MapController({ onMapClick, setZoomLevel, userLocation, triggerLocate }: any) {
  const map = useMap();
  useMapEvents({
    click(e) { onMapClick(e.latlng); },
    zoomend(e) { setZoomLevel(e.target.getZoom()); }
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
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [map]);
  
  return null;
}

interface MapComponentProps {
  issues: Issue[];
  organizations: Organization[];
  infrastructure: Infrastructure[];
  center: [number, number];
  onIssueClick: (issue: Issue) => void;
  onMapClick: (coords: Coordinates) => void;
  onOrgClick: (org: Organization) => void;
  onInfraClick?: (infra: Infrastructure) => void;
  isAdding: boolean;
  showOrgs: boolean;
  showInfrastructure: boolean;
  showHeatmap: boolean;
  userLocation: Coordinates | null;
  triggerLocate: number; 
  isDark: boolean;
}

export const MapComponent: React.FC<MapComponentProps> = ({ 
  issues, organizations, infrastructure, center, onIssueClick, onMapClick, onOrgClick, onInfraClick, isAdding, showOrgs, showInfrastructure, showHeatmap, userLocation, triggerLocate, isDark 
}) => {
  const [zoomLevel, setZoomLevel] = useState(13);

  const orgUnresolvedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    issues.forEach(issue => {
        if (issue.organizationId && issue.status !== 'Resolved') {
            counts[issue.organizationId] = (counts[issue.organizationId] || 0) + 1;
        }
    });
    return counts;
  }, [issues]);

  const tileUrl = isDark 
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  return (
    <div className="w-full h-full relative">
      <MapContainer 
        center={center} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }} 
        zoomControl={false}
        markerZoomAnimation={true}
      >
        <MapSizeHandler />
        <TileLayer
          key={tileUrl}
          url={tileUrl}
        />
        
        <HeatmapLayer issues={issues} show={showHeatmap} zoomLevel={zoomLevel} />

        <MarkerClusterGroup 
          issues={issues} 
          onIssueClick={onIssueClick} 
          zoomLevel={zoomLevel} 
          hidden={showHeatmap}
        />

        <OrganizationClusterGroup
          organizations={organizations}
          onOrgClick={onOrgClick}
          zoomLevel={zoomLevel}
          hidden={!showOrgs || showHeatmap}
          orgUnresolvedCounts={orgUnresolvedCounts}
        />

        <InfrastructureClusterGroup
          infrastructure={infrastructure}
          onInfraClick={onInfraClick}
          zoomLevel={zoomLevel}
          hidden={!showInfrastructure || showHeatmap}
        />

        {userLocation && (
          <Marker 
            position={[userLocation.lat, userLocation.lng]}
            icon={L.divIcon({
              html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"></div>`,
              className: '', iconSize: [16, 16], iconAnchor: [8, 8]
            })}
          />
        )}

        {isAdding && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
                <div className="relative">
                   <VisualPinIcon size={48} className="text-blue-600 drop-shadow-2xl mb-4 animate-pulse" />
                </div>
            </div>
        )}

        <MapController onMapClick={onMapClick} setZoomLevel={setZoomLevel} userLocation={userLocation} triggerLocate={triggerLocate} />
      </MapContainer>
    </div>
  );
};