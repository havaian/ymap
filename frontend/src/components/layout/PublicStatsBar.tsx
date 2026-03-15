// frontend/src/components/layout/PublicStatsBar.tsx
//
// Slim transparent strip overlaid at the top of the map.
// Shows live task verification counts — the "45 граждан проверили, 38 довольны" metric.

import React from "react";
import { CheckCircle2, AlertCircle, Users, Building2 } from "lucide-react";

interface PublicStatsBarProps {
  stats: {
    total: number;
    byStatus: Record<string, number>;
    verifications: { done: number; problem: number };
  };
  objectCount: number;
}

export const PublicStatsBar: React.FC<PublicStatsBarProps> = ({
  stats,
  objectCount,
}) => {
  const totalVerifs =
    (stats.verifications?.done ?? 0) + (stats.verifications?.problem ?? 0);
  const doneVerifs = stats.verifications?.done ?? 0;
  const problemVerifs = stats.verifications?.problem ?? 0;
  const completedTasks = stats.byStatus?.["Completed"] ?? 0;
  const totalTasks = stats.total ?? 0;
  const completionPct =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Only render if there's something meaningful to show
  if (totalVerifs === 0 && totalTasks === 0) return null;

  return (
    <div className="absolute top-[4.25rem] left-1/2 -translate-x-1/2 z-[400] pointer-events-none max-w-[calc(100vw-1rem)]">
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 px-3 py-1.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200/60 dark:border-slate-700/60 shadow-lg text-[11px] font-bold text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-1.5 pr-2.5 border-r border-slate-200 dark:border-slate-700">
          <Building2 size={12} className="text-indigo-500" />
          <span>{objectCount.toLocaleString()} объектов</span>
        </div>

        {totalTasks > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 border-r border-slate-200 dark:border-slate-700">
            <span className="text-slate-400">задач:</span>
            <span className="text-emerald-600 dark:text-emerald-400">
              {completedTasks}/{totalTasks}
            </span>
            <span className="text-slate-400">({completionPct}%)</span>
          </div>
        )}

        {totalVerifs > 0 && (
          <div className="flex items-center gap-2 pl-2.5">
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={11} />
              <span>{doneVerifs}</span>
            </div>
            <div className="flex items-center gap-1 text-red-500 dark:text-red-400">
              <AlertCircle size={11} />
              <span>{problemVerifs}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <Users size={11} />
              <span>{totalVerifs} проверок</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
