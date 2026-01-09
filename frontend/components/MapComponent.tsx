
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import 'leaflet.markercluster';
import { Issue, Coordinates, IssueCategory, Organization, Severity } from '../types';
import { CATEGORY_COLORS, MOCK_ORGANIZATIONS } from '../constants';
import { Car, Droplets, Zap, GraduationCap, Stethoscope, Trash2, HelpCircle, Building2, School, Hospital, ArrowRight } from 'lucide-react';
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

function getOrgIcon(type: IssueCategory, size: number = 18) {
  switch (type) {
    case IssueCategory.EDUCATION: return <School size={size} strokeWidth={2.5} color="white" />;
    case IssueCategory.HEALTH: return <Hospital size={size} strokeWidth={2.5} color="white" />;
    default: return <Building2 size={size} strokeWidth={2.5} color="white" />;
  }
}

function createCustomIcon(category: IssueCategory, isZoomedOut: boolean) {
  const color = CATEGORY_COLORS[category] || '#64748b';
  
  if (isZoomedOut) {
    const svg = `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="6" fill="${color}" stroke="white" stroke-width="2.5" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/></svg>`;
    return L.divIcon({ html: svg, className: '', iconSize: [18, 18], iconAnchor: [9, 9] });
  } else {
    const iconSvg = renderToStaticMarkup(getCategoryIcon(category));
    const svg = `
      <div style="background-color: ${color}; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
        ${iconSvg}
      </div>
      <div style="width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 10px solid white; position: absolute; bottom: -8px; left: 12px;"></div>
    `;
    return L.divIcon({ html: svg, className: '', iconSize: [38, 48], iconAnchor: [19, 48] });
  }
}

function createOrgIcon(unresolvedCount: number, zoom: number, type: IssueCategory) {
  const color = '#4f46e5'; 
  const baseSize = zoom >= 15 ? 44 : zoom >= 14 ? 34 : 24;
  const iconSize = zoom >= 15 ? 18 : zoom >= 14 ? 14 : 10;
  const borderRadius = zoom >= 15 ? 14 : zoom >= 14 ? 10 : 6;
  const badgeSize = zoom >= 15 ? 22 : zoom >= 14 ? 18 : 14;
  const badgeFontSize = zoom >= 15 ? 11 : zoom >= 14 ? 9 : 7;

  const iconSvg = renderToStaticMarkup(getOrgIcon(type, iconSize));
  
  const badgeSvg = unresolvedCount > 0 ? `
    <div style="position: absolute; top: -${badgeSize/3}px; right: -${badgeSize/3}px; background: #ef4444; color: white; border-radius: 50%; width: ${badgeSize}px; height: ${badgeSize}px; display: flex; align-items: center; justify-content: center; font-size: ${badgeFontSize}px; font-weight: 900; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 10;">
      ${unresolvedCount}
    </div>
  ` : '';

  const svg = `
    <div class="org-marker-glow" style="position: relative; background-color: ${color}; width: ${baseSize}px; height: ${baseSize}px; border-radius: ${borderRadius}px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 4px 12px -2px rgba(79, 70, 229, 0.4); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);">
      ${iconSvg}
      ${badgeSvg}
    </div>
  `;
  return L.divIcon({ html: svg, className: '', iconSize: [baseSize, baseSize], iconAnchor: [baseSize/2, baseSize/2] });
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

    /**
     * СТАБИЛИЗАЦИЯ ИНТЕНСИВНОСТИ:
     * Ограничиваем веса и гарантируем отсутствие NaN/Infinity для предотвращения IndexSizeError.
     */
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
        
        // Клэмпим вес для стабильности отрисовки
        const finalWeight = Math.min(1000, weight * orgMultiplier * votesMultiplier);
        return [i.lat, i.lng, finalWeight];
      });

    if (heatPoints.length === 0) return;

    /**
     * ИСПРАВЛЕНИЕ IndexSizeError:
     * Ошибка часто возникает из-за дробных или отрицательных значений radius/blur 
     * при попытке canvas.getImageData(). Используем Math.round и Math.max(1).
     */
    const radius = Math.round(Math.max(15, (zoomLevel - 10) * 4 + 25));
    const blur = Math.round(Math.max(10, radius * 0.75));
    
    // Динамический порог: чем выше зум, тем "чувствительнее" тепло
    const dynamicMax = Math.max(50, 2500 / Math.pow(1.6, Math.max(0, zoomLevel - 11)));

    try {
      const heatLayer = heatLayerFunc(heatPoints, {
        radius: radius,      
        blur: blur,        
        maxZoom: 18,
        max: dynamicMax, 
        minOpacity: 0.15, 
        gradient: {
          0.1: '#3b82f6', // Холодно
          0.3: '#10b981', // Норма
          0.5: '#fbbf24', // Внимание
          0.7: '#f97316', // Проблема
          1.0: '#ef4444'  // Критический очаг
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

function MarkerClusterGroup({ issues, onIssueClick, zoomLevel, hidden }: any) {
  const map = useMap();
  const clusterGroupRef = useRef<any>(null);

  useEffect(() => {
    const markerClusterFunc = (L as any).markerClusterGroup;
    if (typeof markerClusterFunc !== 'function' || hidden) {
        if (clusterGroupRef.current && map.hasLayer(clusterGroupRef.current)) {
            map.removeLayer(clusterGroupRef.current);
        }
        return;
    };

    if (!clusterGroupRef.current) {
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
        map.addLayer(clusterGroupRef.current);
    }

    return () => {
      if (clusterGroupRef.current && map.hasLayer(clusterGroupRef.current)) {
        map.removeLayer(clusterGroupRef.current);
        clusterGroupRef.current = null;
      }
    };
  }, [map, hidden]);

  useEffect(() => {
    const clusterGroup = clusterGroupRef.current;
    if (!clusterGroup || hidden) return;

    clusterGroup.clearLayers();
    const isZoomedOut = zoomLevel < 14;
    const freeIssues = issues.filter((i: Issue) => !i.organizationId && i.lat && i.lng);

    const markers = freeIssues.map((issue: Issue) => {
      const marker = L.marker([issue.lat, issue.lng], {
        icon: createCustomIcon(issue.category, isZoomedOut)
      });
      marker.on('click', () => onIssueClick(issue));
      return marker;
    });

    clusterGroup.addLayers(markers);
  }, [issues, zoomLevel, onIssueClick, hidden]);

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

interface MapComponentProps {
  issues: Issue[];
  center: [number, number];
  onIssueClick: (issue: Issue) => void;
  onMapClick: (coords: Coordinates) => void;
  onOrgClick: (org: Organization) => void;
  isAdding: boolean;
  showOrgs: boolean;
  showHeatmap: boolean;
  userLocation: Coordinates | null;
  triggerLocate: number; 
  isDark: boolean;
}

export const MapComponent: React.FC<MapComponentProps> = ({ 
  issues, center, onIssueClick, onMapClick, onOrgClick, isAdding, showOrgs, showHeatmap, userLocation, triggerLocate, isDark 
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

  const canShowOrgs = showOrgs && zoomLevel >= 14 && !showHeatmap;

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
        <TileLayer
          key={tileUrl}
          // attribution='&copy; CARTO'
          url={tileUrl}
        />
        
        <HeatmapLayer issues={issues} show={showHeatmap} zoomLevel={zoomLevel} />

        <MarkerClusterGroup 
          issues={issues} 
          onIssueClick={onIssueClick} 
          zoomLevel={zoomLevel} 
          hidden={showHeatmap}
        />

        {canShowOrgs && MOCK_ORGANIZATIONS.map((org) => (
            <Marker
              key={org.id}
              position={[org.lat, org.lng]}
              icon={createOrgIcon(orgUnresolvedCounts[org.id] || 0, zoomLevel, org.type)}
              eventHandlers={{ 
                click: (e) => {
                  L.DomEvent.stopPropagation(e);
                  onOrgClick(org);
                },
                mouseover: (e) => { e.target.openPopup(); },
                mouseout: (e) => { e.target.closePopup(); }
              }}
            >
                <Popup closeButton={false} offset={[0, -5]} className="org-popup">
                  <div className="p-4 min-w-[200px] bg-white dark:bg-slate-800 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
                          {org.type === IssueCategory.EDUCATION ? <School size={14} /> : <Hospital size={14} />}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          {org.type}
                        </span>
                      </div>
                      <div className="font-black text-slate-900 dark:text-white text-base leading-tight mb-1">{org.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold mb-3">{org.address}</div>
                      
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700/50">
                        <div className="flex flex-col">
                           <span className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500 mb-0.5">Активные задачи</span>
                           <span className={`text-sm font-black ${orgUnresolvedCounts[org.id] > 0 ? 'text-red-500' : 'text-green-500'}`}>
                             {orgUnresolvedCounts[org.id] || 0}
                           </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest group">
                          Подробнее <ArrowRight size={10} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                  </div>
                </Popup>
            </Marker>
        ))}

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
