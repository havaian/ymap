// frontend/src/components/map/LayerPicker.tsx

import React, { useState, useRef, useEffect } from 'react';
import { Layers, Flame, Building2, Plus, ChevronDown, X } from 'lucide-react';

// choropleth is intentionally excluded — it lives in ScorePicker (AppHeader)
export interface LayerState {
  showHeatmap: boolean;
  showObjects: boolean;
  showStandaloneIssues: boolean;
}

interface LayerPickerProps {
  layers: LayerState;
  onToggleHeatmap: () => void;
  onToggleObjects: () => void;
  onToggleStandaloneIssues: () => void;
}

function LayerToggle({ active, label, icon, color, onClick }: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
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

export const LayerPicker: React.FC<LayerPickerProps> = ({
  layers,
  onToggleHeatmap,
  onToggleObjects,
  onToggleStandaloneIssues,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeCount = [
    layers.showHeatmap,
    layers.showObjects,
    layers.showStandaloneIssues,
  ].filter(Boolean).length;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition duration-100 ${
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

      {open && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[500]">
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
              active={layers.showObjects}
              label="Объекты"
              icon={<Building2 size={16} />}
              color="#4f46e5"
              onClick={onToggleObjects}
            />
            <LayerToggle
              active={layers.showStandaloneIssues}
              label="Все обращения"
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