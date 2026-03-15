// frontend/src/components/common/CustomSelect.tsx
//
// Reusable dropdown that matches the LayerPicker / AppHeader pill style.
// Replaces native <select> elements throughout the app.
//
// Usage:
//   <CustomSelect
//     options={[{ value: 'a', label: 'Option A' }, ...]}
//     value={selected}
//     onChange={setSelected}
//     placeholder="All regions"
//     icon={<MapPin size={14} />}
//   />
//
// Generic type T extends string | number | null so value/onChange are type-safe.

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, X, Check } from "lucide-react";

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  /** Optional leading element (icon, color dot, etc.) */
  icon?: React.ReactNode;
}

interface CustomSelectProps<T extends string | number> {
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;

  /** Label shown when value === null */
  placeholder?: string;
  /** Icon shown in the trigger pill */
  icon?: React.ReactNode;
  /** Section heading inside the panel */
  heading?: string;

  /** Whether to include a "clear / all" option at the top */
  clearable?: boolean;
  /** Label for the clear option — defaults to placeholder */
  clearLabel?: string;

  /**
   * When set, the dropdown auto-opens on first render until the user
   * makes any selection. Persisted in localStorage under this key so
   * it only happens once per browser.
   */
  autoOpenKey?: string;

  /** Extra classes on the trigger button */
  className?: string;
  /** Max height of the options list (Tailwind class) — default max-h-80 */
  maxHeightClass?: string;
}

export function CustomSelect<T extends string | number>({
  options,
  value,
  onChange,
  placeholder = "Выбрать...",
  icon,
  heading,
  clearable = true,
  clearLabel,
  autoOpenKey,
  className = "",
  maxHeightClass = "max-h-80",
}: CustomSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [panelSide, setPanelSide] = useState<"left" | "right">("right");
  const ref = useRef<HTMLDivElement>(null);

  // Auto-open on first ever interaction if autoOpenKey is provided
  useEffect(() => {
    if (autoOpenKey && !localStorage.getItem(autoOpenKey)) {
      setOpen(true);
    }
    // Only run once on mount — options.length guards against firing before data arrives
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenKey, options.length > 0]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

// Определяем сторону открытия чтобы не выйти за экран
  useEffect(() => {
    if (!open || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const panelWidth = Math.min(288, window.innerWidth - 8);
    // right-0: левый край панели = rect.right - panelWidth
    if (rect.right - panelWidth < 0) {
      setPanelSide("left");
    } else {
      setPanelSide("right");
    }
  }, [open]);

  const handleSelect = (next: T | null) => {
    onChange(next);
    if (autoOpenKey) localStorage.setItem(autoOpenKey, "1");
    setOpen(false);
  };

  const activeOption =
    value != null ? options.find((o) => o.value === value) : null;
  const triggerLabel = activeOption?.label ?? placeholder;
  const isActive = value != null;

  return (
    <div className={`relative ${className}`} ref={ref}>
      {/* ── Trigger pill ─────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition duration-100 ${
          open || isActive
            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
        }`}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <span className="hidden sm:inline max-w-[150px] truncate">
          {triggerLabel}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* ── Panel ────────────────────────────────────────────────── */}
      {open && (
        <div className={`absolute ${panelSide === "right" ? "right-0" : "left-0"} top-full mt-2 w-72 max-w-[calc(100vw-0.75rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/60 dark:border-slate-700/60 z-[500] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150`}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {heading ?? placeholder}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X size={14} />
            </button>
          </div>

          {/* Options */}
          <div className={`${maxHeightClass} overflow-y-auto py-1`}>
            {/* Clear / "all" option */}
            {clearable && (
              <>
                <OptionRow
                  label={clearLabel ?? placeholder}
                  active={value === null}
                  onClick={() => handleSelect(null)}
                />
                <div className="mx-4 my-1 border-t border-slate-100 dark:border-slate-800" />
              </>
            )}

            {options.map((opt) => (
              <OptionRow
                label={opt.label}
                icon={opt.icon}
                active={value === opt.value}
                onClick={() => handleSelect(opt.value)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Internal row ─────────────────────────────────────────────────────────────
function OptionRow({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        active
          ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
          : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60"
      }`}
    >
      {icon && <span className="flex-shrink-0 text-current">{icon}</span>}
      <span className="flex-1 text-xs font-black uppercase tracking-wider">
        {label}
      </span>
      {active && <Check size={13} className="flex-shrink-0 text-blue-500" />}
    </button>
  );
}
