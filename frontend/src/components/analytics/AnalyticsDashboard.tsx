// frontend/src/components/analytics/AnalyticsDashboard.tsx

import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  Building2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Activity,
  BarChart3,
  Layers,
  MapPin,
  Wheat,
  Award,
  ChevronDown,
} from "lucide-react";
import {
  useAnalytics,
  DistrictScore,
  RegionSummary,
} from "../../hooks/useAnalytics";
import { DistrictDrilldown } from "./DistrictDrilldown";
import { CustomSelect } from "../common/CustomSelect";

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  primary: "#3b82f6",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  teal: "#14b8a6",
  indigo: "#6366f1",
};

const CHART_COLORS = [
  C.primary,
  C.success,
  C.warning,
  C.danger,
  C.purple,
  C.teal,
  C.indigo,
  "#f43f5e",
];

const SEVERITY_COLORS: Record<string, string> = {
  Critical: C.danger,
  High: "#f97316",
  Medium: C.warning,
  Low: C.success,
};

const STATUS_COLORS: Record<string, string> = {
  Open: C.danger,
  "In Progress": C.primary,
  Resolved: C.success,
};

const OBJECT_TYPE_LABELS: Record<string, string> = {
  school: "Школы",
  kindergarten: "Детсады",
  health_post: "ФАП/СВП",
};

const TASK_STATUS_LABELS: Record<string, string> = {
  Planned: "Запланировано",
  "In Progress": "В работе",
  "Pending Verification": "На проверке",
  Completed: "Выполнено",
  Failed: "Не выполнено",
};

// ── Shared sub-components ─────────────────────────────────────────────────────

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}> = ({ icon, label, value, sub, color = C.primary }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800">
    <div className="flex items-start justify-between">
      <div
        className="p-2 rounded-xl"
        style={{ backgroundColor: color + "18", color }}
      >
        {icon}
      </div>
    </div>
    <div className="mt-4">
      <p className="text-2xl font-black text-slate-900 dark:text-slate-100">
        {value}
      </p>
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">
        {label}
      </p>
      {sub && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>
      )}
    </div>
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest mb-4">
    {children}
  </h3>
);

const ChartCard: React.FC<{
  title: string;
  children: React.ReactNode;
  className?: string;
}> = ({ title, children, className = "" }) => (
  <div
    className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 ${className}`}
  >
    <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
      {title}
    </p>
    {children}
  </div>
);

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-7 text-right">
        {value}
      </span>
    </div>
  );
}

// ── TABS ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: "overview", label: "Обзор", icon: <BarChart3 size={14} /> },
  { id: "issues", label: "Обращения", icon: <AlertTriangle size={14} /> },
  { id: "objects", label: "Объекты", icon: <Building2 size={14} /> },
  { id: "tasks", label: "Задачи", icon: <CheckCircle2 size={14} /> },
  { id: "districts", label: "Районы", icon: <MapPin size={14} /> },
  { id: "crops", label: "Агро", icon: <Wheat size={14} /> },
  { id: "problematic", label: "Проблемные", icon: <AlertTriangle size={14} /> },
];

// ─────────────────────────────────────────────
// Tab: Overview
// ─────────────────────────────────────────────

const OverviewTab: React.FC<{
  data: any;
  tasks: any;
  regions: RegionSummary[];
}> = ({ data, tasks, regions }) => {
  const byTypeData = useMemo(
    () =>
      (data?.byType || []).map((t: any) => ({
        name: OBJECT_TYPE_LABELS[t._id] || t._id,
        count: t.count,
      })),
    [data]
  );

  const topRegions = useMemo(
    () =>
      [...(regions || [])]
        .sort((a, b) => b.objectCount - a.objectCount)
        .slice(0, 8),
    [regions]
  );

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Building2 size={18} />}
          label="Объектов"
          value={(data?.total || 0).toLocaleString()}
          color={C.indigo}
        />
        <StatCard
          icon={<AlertTriangle size={18} />}
          label="Обращений"
          value={0}
          sub="нет данных"
          color={C.danger}
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Задач выполнено"
          value={tasks?.byStatus?.Completed ?? 0}
          sub={`из ${tasks?.total ?? 0}`}
          color={C.success}
        />
        <StatCard
          icon={<Activity size={18} />}
          label="Верификаций"
          value={
            (tasks?.verifications?.done ?? 0) +
            (tasks?.verifications?.problem ?? 0)
          }
          sub={`✓ ${tasks?.verifications?.done ?? 0}  ✗ ${
            tasks?.verifications?.problem ?? 0
          }`}
          color={C.teal}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Объекты по типу">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byTypeData} margin={{ left: -10 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
              />
              <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: any) => [v.toLocaleString(), "Объектов"]}
              />
              <Bar dataKey="count" fill={C.indigo} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Топ регионов по количеству объектов">
          <div className="space-y-2">
            {topRegions.map((r, i) => {
              const max = topRegions[0]?.objectCount || 1;
              return (
                <div key={r.code} className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 w-4">
                    {i + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-32 truncate">
                    {r.name?.ru || r.name?.en || `Регион ${r.code}`}
                  </span>
                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500"
                      style={{ width: `${(r.objectCount / max) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-10 text-right">
                    {r.objectCount.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Tab: Issues
// ─────────────────────────────────────────────

const IssuesTab: React.FC<{ data: any }> = ({ data }) => {
  const categoryData = useMemo(
    () =>
      (data?.byCategory || []).map((c: any) => ({
        name: c._id || "Другое",
        count: c.count,
        votes: c.votes || 0,
      })),
    [data]
  );

  const severityData = useMemo(
    () =>
      Object.entries(data?.bySeverity || {}).map(([name, value]) => ({
        name,
        value: value as number,
        color: SEVERITY_COLORS[name] || "#888",
      })),
    [data]
  );

  const statusData = useMemo(
    () =>
      Object.entries(data?.byStatus || {}).map(([name, value]) => ({
        name,
        value: value as number,
        color: STATUS_COLORS[name] || "#888",
      })),
    [data]
  );

  const trendData = useMemo(
    () =>
      (data?.trends || []).map((t: any) => ({
        label: `${t.year}-${String(t.month).padStart(2, "0")}`,
        Всего: t.count,
        Решено: t.resolved,
      })),
    [data]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity size={18} />}
          label="Всего"
          value={(data?.total || 0).toLocaleString()}
          color={C.primary}
        />
        <StatCard
          icon={<AlertCircle size={18} />}
          label="Открытых"
          value={data?.byStatus?.Open || 0}
          color={C.danger}
        />
        <StatCard
          icon={<Activity size={18} />}
          label="В работе"
          value={data?.byStatus?.["In Progress"] || 0}
          color={C.primary}
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Решено"
          value={data?.byStatus?.Resolved || 0}
          color={C.success}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard title="По категории" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={categoryData}
              layout="vertical"
              margin={{ left: 60, right: 20 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#e2e8f0"
              />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 10, fontWeight: 700 }}
                width={60}
              />
              <Tooltip formatter={(v: any) => [v.toLocaleString(), ""]} />
              <Bar
                dataKey="count"
                name="Обращений"
                fill={C.danger}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="space-y-4">
          <ChartCard title="По тяжести">
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie
                  data={severityData}
                  dataKey="value"
                  innerRadius={25}
                  outerRadius={42}
                  paddingAngle={2}
                >
                  {severityData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => [v, ""]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-1">
              {severityData.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-slate-600 dark:text-slate-400">
                      {s.name}
                    </span>
                  </div>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {(s.value as number).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      </div>

      {trendData.length > 0 && (
        <ChartCard title="Тренд за 12 месяцев">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="Всего"
                stroke={C.primary}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Решено"
                stroke={C.success}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// Tab: Objects
// ─────────────────────────────────────────────

const ObjectsTab: React.FC<{ data: any; regions: RegionSummary[] }> = ({
  data,
  regions,
}) => {
  const byTypeData = useMemo(
    () =>
      (data?.byType || []).map((t: any) => ({
        name: OBJECT_TYPE_LABELS[t._id] || t._id,
        count: t.count,
      })),
    [data]
  );

  const byRegionData = useMemo(
    () =>
      (data?.byRegion || []).slice(0, 12).map((r: any) => ({
        name: r._id || "—",
        count: r.count,
      })),
    [data]
  );

  const regionRows = useMemo(
    () => [...(regions || [])].sort((a, b) => b.objectCount - a.objectCount),
    [regions]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="По типу объекта">
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={byTypeData}
                dataKey="count"
                cx="50%"
                cy="50%"
                outerRadius={60}
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {byTypeData.map((_: any, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: any) => [v.toLocaleString(), "Объектов"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="По вилояту (топ-12)">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={byRegionData} margin={{ left: -20, right: 5 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 8, fontWeight: 700 }}
                interval={0}
                angle={-35}
                textAnchor="end"
                height={45}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: any) => [v.toLocaleString(), "Объектов"]}
              />
              <Bar dataKey="count" fill={C.indigo} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Сводка по регионам">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <th className="text-left py-2 font-black text-slate-400 uppercase tracking-wider">
                  Регион
                </th>
                <th className="text-right py-2 font-black text-slate-400 uppercase tracking-wider">
                  Объектов
                </th>
                <th className="text-right py-2 font-black text-slate-400 uppercase tracking-wider">
                  Обращений
                </th>
                <th className="text-right py-2 font-black text-slate-400 uppercase tracking-wider">
                  Решено %
                </th>
              </tr>
            </thead>
            <tbody>
              {regionRows.map((r) => (
                <tr
                  key={r.code}
                  className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                >
                  <td className="py-2 font-bold text-slate-700 dark:text-slate-300">
                    {r.name?.ru || r.name?.en || `Регион ${r.code}`}
                  </td>
                  <td className="py-2 text-right font-bold text-indigo-600 dark:text-indigo-400">
                    {r.objectCount.toLocaleString()}
                  </td>
                  <td className="py-2 text-right font-bold text-slate-600 dark:text-slate-400">
                    {r.issueCount.toLocaleString()}
                  </td>
                  <td className="py-2 text-right font-bold">
                    {r.resolutionRate != null ? (
                      <span
                        style={{
                          color:
                            r.resolutionRate >= 60
                              ? C.success
                              : r.resolutionRate >= 30
                              ? C.warning
                              : C.danger,
                        }}
                      >
                        {r.resolutionRate}%
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
};

// ─────────────────────────────────────────────
// Tab: Tasks
// ─────────────────────────────────────────────

const TasksTab: React.FC<{ data: any }> = ({ data }) => {
  const statusData = useMemo(
    () =>
      Object.entries(data?.byStatus || {}).map(([name, value]) => ({
        name: TASK_STATUS_LABELS[name] || name,
        value: value as number,
      })),
    [data]
  );

  const verifData = useMemo(
    () => [
      {
        name: "Выполнено ✓",
        value: data?.verifications?.done || 0,
        color: C.success,
      },
      {
        name: "Проблема ✗",
        value: data?.verifications?.problem || 0,
        color: C.danger,
      },
    ],
    [data]
  );

  const total = data?.total || 0;
  const completed = data?.byStatus?.Completed || 0;
  const pending = data?.byStatus?.["Pending Verification"] || 0;
  const verifTotal =
    (data?.verifications?.done || 0) + (data?.verifications?.problem || 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Layers size={18} />}
          label="Всего задач"
          value={total}
          color={C.indigo}
        />
        <StatCard
          icon={<CheckCircle2 size={18} />}
          label="Выполнено"
          value={completed}
          sub={total > 0 ? `${Math.round((completed / total) * 100)}%` : ""}
          color={C.success}
        />
        <StatCard
          icon={<Activity size={18} />}
          label="На проверке"
          value={pending}
          color={C.warning}
        />
        <StatCard
          icon={<Award size={18} />}
          label="Верификаций"
          value={verifTotal}
          sub={`✓ ${data?.verifications?.done || 0}  ✗ ${
            data?.verifications?.problem || 0
          }`}
          color={C.teal}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Статусы задач">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusData} margin={{ left: -10 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
              />
              <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" name="Задач" radius={[4, 4, 0, 0]}>
                {statusData.map((_: any, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Верификации граждан">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={verifData}
                dataKey="value"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
              >
                {verifData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => [v.toLocaleString(), ""]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            {verifData.map((v) => (
              <div key={v.name} className="flex items-center gap-2 text-xs">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: v.color }}
                />
                <span className="font-bold text-slate-600 dark:text-slate-400">
                  {v.name}
                </span>
                <span className="font-black text-slate-800 dark:text-slate-200">
                  {v.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Tab: Districts
// ─────────────────────────────────────────────

const DistrictsTab: React.FC<{
  data: DistrictScore[];
  onDrilldown: (id: string, name: any, scores: any) => void;
}> = ({ data, regions, onDrilldown }) => {
  const [sortBy, setSortBy] = useState<
    "issueCount" | "composite" | "issues" | "objects" | "verification"
  >("issueCount");

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
        if (sortBy === "issueCount") return b.issueCount - a.issueCount;
        return b.scores[sortBy] - a.scores[sortBy];
    });
    }, [data, sortBy]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
          Сортировка:
        </span>
        {(
          [
            "issueCount",
            "composite",
            "issues",
            "objects",
            "verification",
          ] as const
        ).map((s) => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
              sortBy === s
                ? "bg-teal-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {
              {
                issueCount: "Активность",
                composite: "Общий",
                issues: "Обращения",
                objects: "Объекты",
                verification: "Верификация",
              }[s]
            }
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
              <th className="text-left py-3 px-4 font-black text-slate-400 uppercase tracking-wider w-6">
                #
              </th>
              <th className="text-left py-3 px-2 font-black text-slate-400 uppercase tracking-wider">
                Район
              </th>
              <th className="py-3 px-2 font-black text-slate-400 uppercase tracking-wider text-center">
                Общий
              </th>
              <th className="py-3 px-2 font-black text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                Обращения
              </th>
              <th className="py-3 px-2 font-black text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                Объекты
              </th>
              <th className="py-3 px-2 font-black text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                Верификация
              </th>
              <th className="text-right py-3 px-4 font-black text-slate-400 uppercase tracking-wider">
                Обр.
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d, i) => (
              <tr
                key={d.districtId}
                onClick={() =>
                  onDrilldown(d.districtId, d.districtName, d.scores)
                }
                className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 cursor-pointer"
              >
                <td className="py-2.5 px-4 text-slate-400 font-bold">
                  {i + 1}
                </td>
                <td className="py-2.5 px-2 font-bold text-slate-700 dark:text-slate-300">
                  {d.districtName?.ru ||
                    d.districtName?.en ||
                    d.districtName?.uz ||
                    "—"}
                </td>
                <td className="py-2.5 px-2 text-center">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-lg text-[11px] font-black ${
                      d.scores.composite >= 60
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : d.scores.composite >= 30
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}
                  >
                    {d.scores.composite}
                  </span>
                </td>
                <td className="py-2.5 px-2 hidden lg:table-cell w-28">
                  <ScoreBar value={d.scores.issues} color={C.danger} />
                </td>
                <td className="py-2.5 px-2 hidden lg:table-cell w-28">
                  <ScoreBar value={d.scores.objects} color={C.indigo} />
                </td>
                <td className="py-2.5 px-2 hidden lg:table-cell w-28">
                  <ScoreBar value={d.scores.verification} color={C.teal} />
                </td>
                <td className="py-2.5 px-4 text-right font-bold text-slate-500 dark:text-slate-400">
                  {d.issueCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Tab: Crops
// ─────────────────────────────────────────────

const CropsTab: React.FC<{ data: any }> = ({ data }) => {
  const cropData = useMemo(
    () =>
      (data?.cropTotals || []).slice(0, 10).map((c: any) => ({
        name: c.name,
        count: c.districtCount,
        color: c.color || "#94a3b8",
      })),
    [data]
  );

  if (!data || cropData.length === 0) {
    return (
      <p className="text-sm text-slate-400 dark:text-slate-600 text-center py-16">
        Данные о культурах недоступны
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <ChartCard title="Топ культур по охвату районов">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={cropData} margin={{ left: -10, right: 10 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e2e8f0"
            />
            <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 700 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              label={{
                value: "районов",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 9 },
              }}
            />
            <Tooltip formatter={(v: any) => [v, "районов"]} />
            <Bar dataKey="count" name="Районов" radius={[4, 4, 0, 0]}>
              {cropData.map((entry: any, i: number) => (
                <Cell
                  key={i}
                  fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};

// ── Tab: Problematic facilities ──────────────────────────────────────────────

const ProblematicTab: React.FC<{ data: any[] }> = ({ data }) => {
  const TYPE_LABELS: Record<string, string> = {
    school: "Школа",
    kindergarten: "Дет. сад",
    health_post: "ФАП/СВП",
  };

  if (data.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400 dark:text-slate-600">
        <CheckCircle2 size={32} className="mx-auto mb-3 opacity-40" />
        <p className="font-bold text-sm">Проблемных учреждений не обнаружено</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-2xl border border-red-200 dark:border-red-900/30">
        <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
        <p className="text-xs font-bold text-red-700 dark:text-red-400">
          {data.length} учреждений имеют верифицированные проблемы или
          оспоренные показатели
        </p>
      </div>

      <div className="space-y-2">
        {data.map((f) => (
          <div
            key={f.id}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200/60 dark:border-red-900/30 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {TYPE_LABELS[f.objectType] || f.objectType}
                  </span>
                  {f.isOvercrowded && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600">
                      Переполнено
                    </span>
                  )}
                </div>
                <p className="text-sm font-black text-slate-800 dark:text-slate-100 leading-snug">
                  {f.name}
                </p>
                {(f.tuman || f.viloyat) && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {[f.tuman, f.viloyat].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1 flex-shrink-0 text-right">
                {f.taskProblems && (
                  <span className="text-[10px] font-black text-red-500">
                    ✗ {f.taskProblems.problemVerif}/{f.taskProblems.totalVerif}{" "}
                    задач
                  </span>
                )}
                {f.indicatorProblems && (
                  <span className="text-[10px] font-black text-amber-500">
                    ⚠ {f.indicatorProblems.disputed}/{f.indicatorProblems.total}{" "}
                    показат.
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────

interface AnalyticsDashboardProps {
  initialRegionCode?: number | null;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ initialRegionCode }) => {
  const {
    overview,
    issueAnalytics,
    objectAnalytics,
    districtScoring,
    regionSummary,
    taskStats,
    cropAnalytics,
    problematicFacilities,
    loading,
    error,
    refetch,
    regionCode,
    setRegionCode,
  } = useAnalytics();

  const [activeTab, setActiveTab] = useState("overview");

  // District drilldown
  const [drilldownId, setDrilldownId] = useState<string | null>(null);
  const [drilldownName, setDrilldownName] = useState<any>(null);
  const [drilldownScores, setDrilldownScores] = useState<any>(null);

  const regionOptions = useMemo(
    () =>
      (regionSummary || []).map((r) => ({
        value: r.code,
        label: r.name?.ru || r.name?.en || `Регион ${r.code}`,
      })),
    [regionSummary]
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400 font-bold">
            Загрузка аналитики...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle size={32} className="text-red-400 mx-auto" />
          <p className="text-sm text-slate-500 dark:text-slate-400">{error}</p>
          <button
            onClick={refetch}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold"
          >
            Повторить
          </button>
        </div>
      </div>
    );
  }

  // Derive stats for OverviewTab from objectAnalytics
  const objectOverviewData = {
    total: (objectAnalytics?.byType || []).reduce(
      (s: number, t: any) => s + t.count,
      0
    ),
    byType: objectAnalytics?.byType || [],
    byRegion: objectAnalytics?.byRegion || [],
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              Аналитика
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-bold uppercase tracking-widest">
              Real Holat — Мониторинг социальной инфраструктуры
            </p>
          </div>
          <div className="flex items-center gap-3">
            <CustomSelect
              options={regionOptions}
              value={regionCode}
              onChange={setRegionCode}
              placeholder="Весь Узбекистан"
              heading="Фильтр по региону"
              icon={<MapPin size={13} />}
              autoOpenKey="dashRegion"
            />
            <button
              onClick={refetch}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold transition-colors"
            >
              Обновить
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-6 bg-white dark:bg-slate-900 rounded-2xl p-1.5 border border-slate-100 dark:border-slate-800 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview" && (
          <OverviewTab
            data={objectOverviewData}
            tasks={taskStats}
            regions={regionSummary}
          />
        )}
        {activeTab === "issues" && <IssuesTab data={issueAnalytics} />}
        {activeTab === "objects" && (
          <ObjectsTab data={objectAnalytics} regions={regionSummary} />
        )}
        {activeTab === "tasks" && <TasksTab data={taskStats} />}
        {activeTab === "districts" && (
          <DistrictsTab
            data={districtScoring}
            regions={regionSummary}
            onDrilldown={(id, name, scores) => {
              setDrilldownId(id);
              setDrilldownName(name);
              setDrilldownScores(scores);
            }}
          />
        )}
        {activeTab === "crops" && <CropsTab data={cropAnalytics} />}
        {activeTab === "problematic" && (
          <ProblematicTab data={problematicFacilities} />
        )}
      </div>

      {/* District drilldown panel */}
      <DistrictDrilldown
        districtId={drilldownId}
        districtName={drilldownName}
        scores={drilldownScores}
        onClose={() => setDrilldownId(null)}
      />
    </div>
  );
};
