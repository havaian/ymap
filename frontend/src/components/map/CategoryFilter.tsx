// frontend/src/components/map/CategoryFilter.tsx

import React, { useState, useRef, useEffect } from 'react';
import { IssueCategory } from '../../../types';
import { CATEGORY_COLORS } from '../../constants';
import {
  Layers, ChevronDown, Car, Droplets, Zap,
  GraduationCap, Stethoscope, Trash2, HelpCircle
} from 'lucide-react';

interface CategoryFilterProps {
  activeFilter: IssueCategory | 'ALL';
  onFilterChange: (filter: IssueCategory | 'ALL') => void;
}

function getCategoryIcon(category: IssueCategory | 'ALL') {
  switch (category) {
    case 'ALL': return <Layers size={18} />;
    case IssueCategory.ROADS: return <Car size={18} />;
    case IssueCategory.WATER: return <Droplets size={18} />;
    case IssueCategory.ELECTRICITY: return <Zap size={18} />;
    case IssueCategory.EDUCATION: return <GraduationCap size={18} />;
    case IssueCategory.HEALTH: return <Stethoscope size={18} />;
    case IssueCategory.WASTE: return <Trash2 size={18} />;
    default: return <HelpCircle size={18} />;
  }
}

function getCategoryLabel(category: IssueCategory | 'ALL') {
  if (category === 'ALL') return 'Все проблемы';
  return category;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  activeFilter,
  onFilterChange,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const handleSelect = (filter: IssueCategory | 'ALL') => {
    onFilterChange(filter);
    setOpen(false);
  };

  return (
    <div className="absolute top-6 left-6 z-[399] flex flex-col" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(p => !p)}
        className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl font-black text-sm shadow-2xl transition-all border-2 outline-none ${
          open
            ? 'bg-white dark:bg-slate-800 border-blue-500 text-blue-600'
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 border-transparent text-white hover:shadow-blue-500/20'
        }`}
      >
        <div className={open ? 'text-blue-600' : 'text-white'}>
          {getCategoryIcon(activeFilter)}
        </div>
        <span className="whitespace-nowrap uppercase tracking-wider">
          {getCategoryLabel(activeFilter)}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${
          open ? 'rotate-180 text-blue-600' : 'text-white/80'
        }`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="mt-3 w-72 bg-white dark:bg-slate-800 rounded-3xl shadow-[0_20px_60px_-15px_rgba(37,99,235,0.3)] border border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 origin-top-left">
          <div className="p-3 max-h-[75vh] overflow-y-auto custom-scrollbar">
            <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Категории
            </div>

            {/* "All" option */}
            <button
              onClick={() => handleSelect('ALL')}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all text-sm font-bold mb-1 ${
                activeFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                activeFilter === 'ALL'
                  ? 'bg-white/20'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
              }`}>
                <Layers size={18} />
              </div>
              <span className="flex-1 text-left">Все проблемы</span>
            </button>

            <div className="w-full h-px bg-slate-100 dark:bg-slate-700 my-2" />

            {/* Category options */}
            {Object.values(IssueCategory).map((cat) => (
              <button
                key={cat}
                onClick={() => handleSelect(cat)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all text-sm font-bold mb-1 ${
                  activeFilter === cat
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    activeFilter === cat
                      ? 'bg-white/20'
                      : 'bg-slate-100 dark:bg-slate-700'
                  }`}
                  style={activeFilter !== cat ? { color: CATEGORY_COLORS[cat] } : {}}
                >
                  {getCategoryIcon(cat)}
                </div>
                <span className="flex-1 text-left">{cat}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};