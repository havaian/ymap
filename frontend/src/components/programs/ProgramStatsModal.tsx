// frontend/src/components/programs/ProgramStatsModal.tsx

import React, { useEffect, useState } from "react";
import { Program } from "../../../types";
import { programsAPI } from "../../services/api";
import {
  X,
  Loader2,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
} from "lucide-react";

interface ProgramStatsModalProps {
  program: Program;
  onClose: () => void;
}

const TASK_STATUS_LABEL: Record<string, string> = {
  Planned:              "Запланировано",
  "In Progress":        "В работе",
  "Pending Verification": "На проверке",
  Completed:            "Выполнено",
  Failed:               "Не выполнено",
};

const TASK_STATUS_COLOR: Record<string, string> = {
  Planned:              "#94a3b8",
  "In Progress":        "#3b82f6",
  "Pending Verification": "#f59e0b",
  Completed:            "#10b981",
  Failed:               "#ef4444",
};

const TYPE_LABEL: Record<string, string> = {
  school:       "Школы",
  kindergarten: "Детские сады",
  health_post:  "ФАП / СВП",
};

// ── SVG Donut chart ───────────────────────────────────────────────────────────

function DonutChart({
  segments,
  size = 120,
  thickness = 22,
}: {
  segments: Array<{ value: number; color: string; label: string }>;
  size?: number;
  thickness?: number;
}) {
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  if (total === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={thickness} />
      </svg>
    );
  }

  let offset = 0;
  const slices = segments.map((seg) => {
    const pct = seg.value / total;
    const dash = pct * circumference;
    const gap  = circumference - dash;
    const rotation = offset * 360 - 90;
    offset += pct;
    return { ...seg, dash, gap, rotation };
  });

  return (
    <svg width={size} height={size}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={thickness} />
      {slices.map((s, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={thickness}
          strokeDasharray={`${s.dash} ${s.gap}`}
          strokeLinecap="butt"
          transform={`rotate(${s.rotation} ${cx} ${cy})`}
        />
      ))}
    </svg>
  );
}

// ── Simple horizontal bar ─────────────────────────────────────────────────────

function HBar({
  label,
  value,
  max,
  color,
  count,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  count: number;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate shrink-0">
        {label}
      </div>
      <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-6 text-[11px] font-black text-slate-600 dark:text-slate-300 text-right shrink-0">
        {count}
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export const ProgramStatsModal: React.FC<ProgramStatsModalProps> = ({
  program,
  onClose,
}) => {
  const [objects, setObjects]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    (programsAPI as any)
      .getProgramObjects(program.id)
      .then((res: any) => {
        if (res.data?.success) setObjects(res.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [program.id]);

  // ── Derive stats ──────────────────────────────────────────────────────────

  const allTasks = objects.flatMap((o: any) => o.tasks || []);

  const statusCounts: Record<string, number> = {};
  for (const t of allTasks) {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  }

  const totalTasks    = allTasks.length;
  const completedCnt  = statusCounts["Completed"] || 0;
  const inProgressCnt = statusCounts["In Progress"] || 0;
  const pendingCnt    = statusCounts["Pending Verification"] || 0;
  const failedCnt     = statusCounts["Failed"] || 0;
  const plannedCnt    = statusCounts["Planned"] || 0;

  const totalVerif = allTasks.reduce((s: number, t: any) => s + (t.totalCount || 0), 0);
  const doneCnt    = allTasks.reduce((s: number, t: any) => s + (t.doneCount   || 0), 0);
  const problemCnt = allTasks.reduce((s: number, t: any) => s + (t.problemCount|| 0), 0);

  const typeCounts: Record<string, number> = {};
  for (const o of objects) {
    typeCounts[o.objectType] = (typeCounts[o.objectType] || 0) + 1;
  }

  const completionPct = totalTasks > 0
    ? Math.round((completedCnt / totalTasks) * 100)
    : 0;

  const donutSegments = Object.entries(TASK_STATUS_COLOR)
    .map(([status, color]) => ({
      value: statusCounts[status] || 0,
      color,
      label: TASK_STATUS_LABEL[status],
    }))
    .filter((s) => s.value > 0);

  const maxStatusCount = Math.max(...Object.values(statusCounts), 1);
  const maxTypeCount   = Math.max(...Object.values(typeCounts), 1);

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 flex-shrink-0">
              <BarChart3 size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Статистика программы
              </p>
              <h2 className="text-base font-black text-slate-800 dark:text-white leading-tight">
                {program.name}
              </h2>
              {program.number && (
                <p className="text-xs text-slate-400">№ {program.number}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition flex-shrink-0"
          >
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Загрузка данных...</span>
            </div>
          ) : (
            <div className="space-y-6">

              {/* KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    icon: <Building2 size={14} />,
                    label: "Объектов",
                    value: objects.length,
                    color: "text-indigo-600 dark:text-indigo-400",
                    bg: "bg-indigo-50 dark:bg-indigo-900/20",
                  },
                  {
                    icon: <BarChart3 size={14} />,
                    label: "Задач всего",
                    value: totalTasks,
                    color: "text-blue-600 dark:text-blue-400",
                    bg: "bg-blue-50 dark:bg-blue-900/20",
                  },
                  {
                    icon: <CheckCircle2 size={14} />,
                    label: "Выполнено",
                    value: completedCnt,
                    color: "text-emerald-600 dark:text-emerald-400",
                    bg: "bg-emerald-50 dark:bg-emerald-900/20",
                  },
                  {
                    icon: <AlertTriangle size={14} />,
                    label: "Проблемы",
                    value: problemCnt,
                    color: "text-red-600 dark:text-red-400",
                    bg: "bg-red-50 dark:bg-red-900/20",
                  },
                ].map((k) => (
                  <div
                    key={k.label}
                    className={`${k.bg} rounded-2xl p-3 flex flex-col gap-1.5`}
                  >
                    <div className={`flex items-center gap-1.5 ${k.color}`}>
                      {k.icon}
                      <span className="text-[10px] font-black uppercase tracking-wider">
                        {k.label}
                      </span>
                    </div>
                    <div className={`text-2xl font-black ${k.color}`}>
                      {k.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress bar overall */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Общий прогресс выполнения
                  </span>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">
                    {completionPct}%
                  </span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${completionPct}%`,
                      backgroundColor:
                        completionPct >= 70
                          ? "#10b981"
                          : completionPct >= 30
                          ? "#f59e0b"
                          : "#ef4444",
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-slate-400">
                    {completedCnt} из {totalTasks}
                  </span>
                  {program.deadline && (
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock size={9} />
                      до{" "}
                      {new Date(program.deadline).toLocaleDateString("ru-RU")}
                    </span>
                  )}
                </div>
              </div>

              {/* Task status donut + legend */}
              {totalTasks > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                    Статусы задач
                  </p>
                  <div className="flex items-center gap-6 flex-wrap">
                    {/* Donut */}
                    <div className="relative flex-shrink-0">
                      <DonutChart segments={donutSegments} size={120} thickness={22} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-black text-slate-800 dark:text-white leading-none">
                          {totalTasks}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">
                          задач
                        </span>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="flex-1 space-y-2 min-w-0">
                      {Object.entries(TASK_STATUS_LABEL).map(([status, label]) => {
                        const cnt = statusCounts[status] || 0;
                        if (cnt === 0) return null;
                        return (
                          <HBar
                            key={status}
                            label={label}
                            value={cnt}
                            max={maxStatusCount}
                            color={TASK_STATUS_COLOR[status]}
                            count={cnt}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Verifications */}
              {totalVerif > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                    Верификации граждан
                  </p>
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="relative flex-shrink-0">
                      <DonutChart
                        segments={[
                          { value: doneCnt,    color: "#10b981", label: "Выполнено" },
                          { value: problemCnt, color: "#ef4444", label: "Проблема"  },
                          {
                            value: totalVerif - doneCnt - problemCnt,
                            color: "#94a3b8",
                            label: "Прочее",
                          },
                        ].filter((s) => s.value > 0)}
                        size={120}
                        thickness={22}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-black text-slate-800 dark:text-white leading-none">
                          {totalVerif}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">
                          всего
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2 min-w-0">
                      <HBar label="Подтверждено" value={doneCnt}    max={totalVerif} color="#10b981" count={doneCnt}    />
                      <HBar label="Проблема"     value={problemCnt} max={totalVerif} color="#ef4444" count={problemCnt} />
                    </div>
                  </div>
                </div>
              )}

              {/* Object types */}
              {Object.keys(typeCounts).length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                    Типы объектов
                  </p>
                  <div className="space-y-2">
                    {Object.entries(typeCounts).map(([type, cnt]) => (
                      <HBar
                        key={type}
                        label={TYPE_LABEL[type] || type}
                        value={cnt}
                        max={maxTypeCount}
                        color="#4f46e5"
                        count={cnt}
                      />
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
};