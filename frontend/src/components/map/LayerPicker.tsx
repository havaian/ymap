// frontend/src/components/map/LayerPicker.tsx

import React, { useState, useRef, useEffect } from 'react';
import {
  Layers, Flame, Building2, Plus,
  Map as MapIcon, ChevronDown, X
} from 'lucide-react';

export interface LayerState {
  showHeatmap: boolean;
  showChoropleth: boolean;
  showOrgs: boolean;
  showInfrastructure: boolean;
  showStandaloneIssues: boolean;
  choroplethMetric: string;
}

interface LayerPickerProps {
  layers: LayerState;
  onToggleHeatmap: () => void;
  onToggleChoropleth: () => void;
  onToggleOrgs: () => void;
  onToggleInfrastructure: () => void;
  onToggleStandaloneIssues: () => void;
  onChoroplethMetricChange: (metric: string) => void;
}

// ── Toggle row ──────────────────────────────────────────
function LayerToggle({ active, label, icon, color, onClick }: {
  active: boolean; label: string; icon: React.ReactNode; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
        active
          ? 'text-white'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
      }`}
      style={active ? { backgroundColor: color } : undefined}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          active ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'
        }`}
        style={!active ? { color } : undefined}
      >
        {icon}
      </div>
      <span className="flex-1 text-left">{label}</span>
      <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
        active ? 'bg-white/30' : 'bg-slate-200 dark:bg-slate-700'
      }`}>
        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
          active ? 'translate-x-4' : 'translate-x-0'
        }`} />
      </div>
    </button>
  );
}

// ── Metric chips (shown when choropleth is active) ──────
const METRICS = [
  { value: 'composite', label: 'Общий' },
  { value: 'infrastructure', label: 'Объекты инф-ры' },
  { value: 'issues', label: 'Обращения' },
  { value: 'budget', label: 'Бюджет' },
  { value: 'crops', label: 'Агро' },
];

// ── Main component ──────────────────────────────────────
export const LayerPicker: React.FC<LayerPickerProps> = ({
  layers,
  onToggleHeatmap,
  onToggleChoropleth,
  onToggleOrgs,
  onToggleInfrastructure,
  onToggleStandaloneIssues,
  onChoroplethMetricChange,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeCount = [
    layers.showHeatmap,
    layers.showChoropleth,
    layers.showOrgs,
    layers.showInfrastructure,
    layers.showStandaloneIssues,
  ].filter(Boolean).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition duration-300 ${
          open || activeCount > 0
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
        }`}
      >
        <Layers className="w-4 h-4" />
        <span>Слои</span>
        {activeCount > 0 && (
          <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-black bg-white/25 text-white">
            {activeCount}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[500]">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Слои карты</p>
            <button
              onClick={() => setOpen(false)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              <X size={14} className="text-slate-400" />
            </button>
          </div>

          <div className="p-2 space-y-0.5">
            <LayerToggle
              active={layers.showHeatmap}
              label="Тепловая карта"
              icon={<Flame size={16} />}
              color="#ea580c"
              onClick={onToggleHeatmap}
            />
            <LayerToggle
              active={layers.showChoropleth}
              label="Районы (скоринг)"
              icon={<MapIcon size={16} />}
              color="#0d9488"
              onClick={onToggleChoropleth}
            />

            {layers.showChoropleth && (
              <div className="pl-14 pr-3 pb-1.5">
                <div className="flex flex-wrap gap-1">
                  {METRICS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => onChoroplethMetricChange(m.value)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                        layers.choroplethMetric === m.value
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <LayerToggle
              active={layers.showOrgs}
              label="Учреждения"
              icon={<Building2 size={16} />}
              color="#4f46e5"
              onClick={onToggleOrgs}
            />
            <LayerToggle
              active={layers.showInfrastructure}
              label="Инфраструктура"
              icon={<Layers size={16} />}
              color="#2563eb"
              onClick={onToggleInfrastructure}
            />
            <LayerToggle
              active={layers.showStandaloneIssues}
              label="Обращения"
              icon={<Plus size={16} />}
              color="#9333ea"
              onClick={onToggleStandaloneIssues}
            />
          </div>
        </div>
      )}
    </div>
  );
};