// frontend/src/components/layout/AppHeader.tsx

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  ShieldCheck,
  MapPin,
  BarChart2,
  ChevronDown,
  X,
} from "lucide-react";
import { MapPlusIcon } from "../map/MapPlusIcon";
import { LayerPicker, LayerState } from "../map/LayerPicker";
import { CustomSelect } from "../common/CustomSelect";
import { regionsAPI } from "../../services/api";
import { User, UserRole } from "../../../types";

// Metrics match the new analytics controller
const SCORE_METRICS = [
  { value: "composite", label: "Общий" },
  { value: "issues", label: "Обращения" },
  { value: "objects", label: "Объекты" },
  { value: "verification", label: "Верификация" },
];

// ── ScorePicker ────────────────────────────────────────────────────────────────
function ScorePicker({
  show,
  metric,
  onToggle,
  onMetricChange,
}: {
  show: boolean;
  metric: string;
  onToggle: () => void;
  onMetricChange: (m: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number; width: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const activeLabel =
    SCORE_METRICS.find((m) => m.value === metric)?.label ?? "Скоринг";

  return (
    <div className="relative" ref={ref}>
      <button
onClick={() => {
          if (!open && ref.current) {
            const rect = ref.current.getBoundingClientRect();
            const w = Math.min(240, window.innerWidth - 8);
            const right = Math.max(4, window.innerWidth - rect.right);
            setPanelPos({ top: rect.bottom + 8, right, width: w });
          }
          setOpen((p) => !p);
        }}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition duration-100 ${
          open || show
            ? "bg-teal-600 text-white shadow-lg shadow-teal-500/20"
            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
        }`}
      >
        <BarChart2 className="w-4 h-4" />
        <span className="hidden sm:inline">
          {show ? activeLabel : "Скоринг"}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && panelPos && (
        <div
          style={{ position: "fixed", top: panelPos.top, right: panelPos.right, width: panelPos.width, zIndex: 500 }}
          className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Районный скоринг
            </p>
            <button
              onClick={() => setOpen(false)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              <X size={14} className="text-slate-400" />
            </button>
          </div>
          <div className="p-3 space-y-3">
            <button
              onClick={onToggle}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                show
                  ? "text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
              style={show ? { backgroundColor: "#0d9488" } : undefined}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  show ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"
                }`}
                style={!show ? { color: "#0d9488" } : undefined}
              >
                <BarChart2 size={16} />
              </div>
              <span className="flex-1 text-left">Показать на карте</span>
              <div
                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                  show ? "bg-white/30" : "bg-slate-200 dark:bg-slate-700"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
                    show ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
            </button>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 px-1">
                Метрика
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SCORE_METRICS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => {
                      onMetricChange(m.value);
                      if (!show) onToggle();
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                      metric === m.value
                        ? "bg-teal-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AppHeader ──────────────────────────────────────────────────────────────────

interface AppHeaderProps {
  currentUser: User;
  onMenuOpen: () => void;
  activeView: string;
  layers: LayerState;
  onToggleHeatmap: () => void;
  onToggleObjects: () => void;
  onToggleStandaloneIssues: () => void;
  showChoropleth: boolean;
  choroplethMetric: string;
  onToggleChoropleth: () => void;
  onChoroplethMetricChange: (metric: string) => void;
  selectedRegionCode: number | null;
  onRegionChange: (code: number | null) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentUser,
  onMenuOpen,
  activeView,
  layers,
  onToggleHeatmap,
  onToggleObjects,
  onToggleStandaloneIssues,
  showChoropleth,
  choroplethMetric,
  onToggleChoropleth,
  onChoroplethMetricChange,
  selectedRegionCode,
  onRegionChange,
}) => {
  const navigate = useNavigate();
  const [regionOptions, setRegionOptions] = useState<
    { value: number; label: string }[]
  >([]);

  useEffect(() => {
    regionsAPI
      .getAll()
      .then((res) => {
        if (res.data?.success) {
          setRegionOptions(
            res.data.data.map((r: any) => ({
              value: r.code,
              label: r.name?.ru || r.name?.en || `Регион ${r.code}`,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  return (
    <header className="flex-shrink-0 h-16 bg-white dark:bg-slate-900 shadow-sm z-[400] px-6 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 transition-colors duration-100">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuOpen}
          className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition"
        >
          <Menu className="w-5 h-5" />
        </button>
        <MapPlusIcon onClick={() => navigate("/map")} className="hidden sm:block" />
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

      {activeView === "MAP" && (
        <div className="flex items-center gap-2">
          <CustomSelect
            options={regionOptions}
            value={selectedRegionCode}
            onChange={onRegionChange}
            placeholder="Весь Узбекистан"
            heading="Выберите регион"
            icon={<MapPin size={14} />}
            autoOpenKey="regionChosen"
          />
          <ScorePicker
            show={showChoropleth}
            metric={choroplethMetric}
            onToggle={onToggleChoropleth}
            onMetricChange={onChoroplethMetricChange}
          />
          <LayerPicker
            layers={layers}
            onToggleHeatmap={onToggleHeatmap}
            onToggleObjects={onToggleObjects}
            onToggleStandaloneIssues={onToggleStandaloneIssues}
          />
        </div>
      )}
    </header>
  );
};
