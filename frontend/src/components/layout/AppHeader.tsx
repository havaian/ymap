// frontend/src/components/layout/AppHeader.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Building2, ShieldCheck, MapPin, ChevronDown } from 'lucide-react';
import { MapPlusIcon } from '../map/MapPlusIcon';
import { LayerPicker, LayerState } from '../map/LayerPicker';
import { regionsAPI } from '../../services/api';
import { User, UserRole } from '../../../types';

interface Region {
  code: number;
  name: { en: string; ru?: string; uz: string };
}

interface AppHeaderProps {
  currentUser: User;
  onMenuOpen: () => void;
  activeView: string;
  // Layer state — passed straight through to LayerPicker
  layers: LayerState;
  onToggleHeatmap: () => void;
  onToggleChoropleth: () => void;
  onToggleOrgs: () => void;
  onToggleInfrastructure: () => void;
  onToggleStandaloneIssues: () => void;
  onChoroplethMetricChange: (metric: string) => void;
  // Region filter
  selectedRegionCode: number | null;
  onRegionChange: (code: number | null) => void;
  // Admin
  isAdminOrgAddingMode: boolean;
  onStartAdminOrgAdd: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentUser, onMenuOpen, activeView,
  layers,
  onToggleHeatmap, onToggleChoropleth, onToggleOrgs,
  onToggleInfrastructure, onToggleStandaloneIssues,
  onChoroplethMetricChange,
  selectedRegionCode, onRegionChange,
  isAdminOrgAddingMode, onStartAdminOrgAdd,
}) => {
  const navigate = useNavigate();
  const [regions, setRegions] = useState<Region[]>([]);

  // Fetch region list once — lightweight call (no geometry)
  useEffect(() => {
    regionsAPI.getAll()
      .then(res => {
        if (res.data?.success) setRegions(res.data.data);
      })
      .catch(() => {
        // Non-critical — region filter just won't populate
      });
  }, []);

  const selectedRegionName = selectedRegionCode != null
    ? regions.find(r => r.code === selectedRegionCode)?.name?.ru
      || regions.find(r => r.code === selectedRegionCode)?.name?.en
      || `Регион ${selectedRegionCode}`
    : null;

  return (
    <header className="flex-shrink-0 h-16 bg-white dark:bg-slate-900 shadow-sm z-[400] px-6 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 transition-colors duration-300">
      {/* Left: burger + logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuOpen}
          className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition"
        >
          <Menu className="w-5 h-5" />
        </button>
        <MapPlusIcon onClick={() => navigate('/map')} />
        <div className="hidden sm:block">
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-xl text-slate-800 dark:text-slate-100 tracking-tight leading-none">
              Y.<span className="text-blue-600">Map</span>
            </h1>
            {currentUser.role === UserRole.ADMIN && (
              <span className="bg-red-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md flex items-center gap-1">
                <ShieldCheck size={8} /> Admin
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-widest uppercase mt-0.5">
            Социальная инфраструктура
          </p>
        </div>
      </div>

      {/* Right: map controls */}
      {activeView === 'MAP' && (
        <div className="flex items-center gap-2">
          {/* Region selector */}
          <div className="relative">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
              <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
              <select
                value={selectedRegionCode ?? ''}
                onChange={e => onRegionChange(e.target.value ? parseInt(e.target.value) : null)}
                className="appearance-none bg-transparent text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer pr-4 max-w-[120px] md:max-w-[160px]"
              >
                <option value="">Весь Узбекистан</option>
                {regions.map(r => (
                  <option key={r.code} value={r.code}>
                    {r.name.ru || r.name.en}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 dark:text-slate-500 pointer-events-none absolute right-3" />
            </div>
            {/* Active indicator dot */}
            {selectedRegionCode != null && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </div>

          {currentUser.role === UserRole.ADMIN && (
            <button
              onClick={onStartAdminOrgAdd}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition duration-300 ${
                isAdminOrgAddingMode
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-slate-100 dark:bg-slate-800 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">+ Объект</span>
            </button>
          )}

          <LayerPicker
            layers={layers}
            onToggleHeatmap={onToggleHeatmap}
            onToggleChoropleth={onToggleChoropleth}
            onToggleOrgs={onToggleOrgs}
            onToggleInfrastructure={onToggleInfrastructure}
            onToggleStandaloneIssues={onToggleStandaloneIssues}
            onChoroplethMetricChange={onChoroplethMetricChange}
          />
        </div>
      )}
    </header>
  );
};