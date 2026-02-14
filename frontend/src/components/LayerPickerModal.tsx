// frontend/src/components/LayerPickerModal.tsx

import React, { useState } from 'react';
import { Building2, Layers, MessageSquare, ArrowRight } from 'lucide-react';

const STORAGE_KEY = 'ymap_layer_picker_seen';

interface LayerPickerModalProps {
  isOpen: boolean;
  onConfirm: (selection: { orgs: boolean; infrastructure: boolean; issues: boolean }) => void;
}

const LAYERS = [
  {
    key: 'orgs' as const,
    icon: Building2,
    label: 'Учреждения',
    sublabel: 'Школы, больницы, объекты инфраструктуры',
    color: '#4f46e5',
    bg: 'bg-indigo-50 dark:bg-indigo-950/40',
    border: 'border-indigo-200 dark:border-indigo-800',
    activeBorder: 'border-indigo-500 dark:border-indigo-400',
    activeBg: 'bg-indigo-100 dark:bg-indigo-900/60',
    ring: 'ring-indigo-500/30',
    iconBg: 'bg-indigo-600',
    count: '~15 000 объектов',
  },
  {
    key: 'infrastructure' as const,
    icon: Layers,
    label: 'Объекты инфраструктуры',
    sublabel: 'Дороги, водоснабжение, коммуникации',
    color: '#2563eb',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800',
    activeBorder: 'border-blue-500 dark:border-blue-400',
    activeBg: 'bg-blue-100 dark:bg-blue-900/60',
    ring: 'ring-blue-500/30',
    iconBg: 'bg-blue-600',
    count: '~15 000 объектов',
  },
  {
    key: 'issues' as const,
    icon: MessageSquare,
    label: 'Обращения',
    sublabel: 'Жалобы и проблемы от жителей',
    color: '#9333ea',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    border: 'border-purple-200 dark:border-purple-800',
    activeBorder: 'border-purple-500 dark:border-purple-400',
    activeBg: 'bg-purple-100 dark:bg-purple-900/60',
    ring: 'ring-purple-500/30',
    iconBg: 'bg-purple-600',
    count: 'Гражданские обращения',
  },
];

export const LayerPickerModal: React.FC<LayerPickerModalProps> = ({ isOpen, onConfirm }) => {
  const [selected, setSelected] = useState<Record<string, boolean>>({
    orgs: false,
    infrastructure: false,
    issues: false,
  });

  if (!isOpen) return null;

  const toggle = (key: string) => {
    setSelected(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const anySelected = Object.values(selected).some(Boolean);

  const confirm = (selection: { orgs: boolean; infrastructure: boolean; issues: boolean }) => {
    localStorage.setItem(STORAGE_KEY, '1');
    onConfirm(selection);
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
        <div className="px-8 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Layers size={18} className="text-white" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Y.Map</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-50 leading-tight">
            Что показать на карте?
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            Выберите слои для отображения. Карта загружает данные только для активных слоёв.
          </p>
        </div>

        <div className="px-6 py-5 space-y-3">
          {LAYERS.map((layer) => {
            const Icon = layer.icon;
            const isActive = selected[layer.key];
            return (
              <button
                key={layer.key}
                onClick={() => toggle(layer.key)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-150 outline-none ${
                  isActive
                    ? `${layer.activeBg} ${layer.activeBorder} ring-4 ${layer.ring}`
                    : `${layer.bg} ${layer.border} hover:brightness-95 dark:hover:brightness-110`
                }`}
              >
                <div className={`w-11 h-11 ${layer.iconBg} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <Icon size={20} color="white" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-slate-800 dark:text-slate-100 text-sm leading-tight">{layer.label}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{layer.sublabel}</div>
                  <div className="text-[10px] font-black uppercase tracking-wider mt-1" style={{ color: layer.color }}>{layer.count}</div>
                </div>
                <div
                  className={`w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    isActive ? 'border-transparent' : 'border-slate-300 dark:border-slate-600'
                  }`}
                  style={isActive ? { backgroundColor: layer.color } : {}}
                >
                  {isActive && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="px-6 pb-6 flex items-center gap-3">
          <button
            onClick={() => confirm({ orgs: false, infrastructure: false, issues: false })}
            className="flex-shrink-0 px-5 py-3.5 rounded-2xl text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Пропустить
          </button>
          <button
            onClick={() => confirm({ orgs: selected.orgs, infrastructure: selected.infrastructure, issues: selected.issues })}
            disabled={!anySelected}
            className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-2xl text-sm font-black uppercase tracking-wider transition-all ${
              anySelected
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
            }`}
          >
            Показать на карте
            <ArrowRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Use in App.tsx: only show picker when this returns false
export const hasSeenLayerPicker = (): boolean => !!localStorage.getItem(STORAGE_KEY);