// frontend/src/components/layout/AppHeader.tsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Building2, ShieldCheck } from 'lucide-react';
import { MapPlusIcon } from '../map/MapPlusIcon';
import { LayerPicker, LayerState } from '../map/LayerPicker';
import { User, UserRole } from '../../../types';

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
  isAdminOrgAddingMode, onStartAdminOrgAdd,
}) => {
  const navigate = useNavigate();

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