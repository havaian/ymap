import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    Legend
} from 'recharts';
import {
    Building2, Construction, AlertTriangle, MapPin, TrendingUp,
    CheckCircle2, AlertCircle, DollarSign, Wheat, ChevronDown,
    BarChart3, Activity, Award, Layers
} from 'lucide-react';
import { useAnalytics, DistrictScore, RegionSummary } from '../../hooks/useAnalytics';
import { DistrictDrilldown } from './DistrictDrilldown';

// ─────────────────────────────────────────────
// Color palette
// ─────────────────────────────────────────────

const COLORS = {
    primary: '#3b82f6',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#06b6d4',
    purple: '#8b5cf6',
    rose: '#f43f5e',
    emerald: '#10b981',
    amber: '#f59e0b',
    indigo: '#6366f1',
};

const SEVERITY_COLORS: Record<string, string> = {
    Critical: '#ef4444',
    High: '#f97316',
    Medium: '#f59e0b',
    Low: '#22c55e',
};

const STATUS_COLORS: Record<string, string> = {
    Open: '#ef4444',
    'In Progress': '#3b82f6',
    Resolved: '#22c55e',
};

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e', '#10b981'];

const formatBudget = (val: number): string => {
    if (val >= 1e12) return (val / 1e12).toFixed(1) + ' трлн';
    if (val >= 1e9) return (val / 1e9).toFixed(1) + ' млрд';
    if (val >= 1e6) return (val / 1e6).toFixed(1) + ' млн';
    if (val >= 1e3) return (val / 1e3).toFixed(0) + ' тыс';
    return val.toFixed(0);
};

// ─────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────

const StatCard: React.FC<{
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    color: string;
}> = ({ title, value, subtitle, icon, color }) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="flex items-start justify-between mb-3">
            <div className={`p-2.5 rounded-xl`} style={{ backgroundColor: color + '18', color }}>
                {icon}
            </div>
        </div>
        <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {value}
        </div>
        <div className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 mt-1">
            {title}
        </div>
        {subtitle && (
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</div>
        )}
    </div>
);

// ─────────────────────────────────────────────
// Section wrapper
// ─────────────────────────────────────────────

const Section: React.FC<{
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}> = ({ title, icon, children, className = '' }) => (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm ${className}`}>
        <div className="flex items-center gap-2.5 mb-5">
            <div className="text-slate-400 dark:text-slate-500">{icon}</div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm uppercase tracking-wide">{title}</h3>
        </div>
        {children}
    </div>
);

// ─────────────────────────────────────────────
// Region selector
// ─────────────────────────────────────────────

const RegionSelector: React.FC<{
    regions: RegionSummary[];
    selected: number | null;
    onSelect: (code: number | null) => void;
}> = ({ regions, selected, onSelect }) => (
    <div className="relative">
        <select
            value={selected ?? ''}
            onChange={(e) => onSelect(e.target.value ? parseInt(e.target.value) : null)}
            className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 pr-10 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
            <option value="">Все регионы</option>
            {regions.map(r => (
                <option key={r.regionCode} value={r.regionCode}>
                    {r.regionName?.en || r.regionName?.uz || `Region ${r.regionCode}`}
                </option>
            ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
);

// ─────────────────────────────────────────────
// Custom tooltip
// ─────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs">
            {label && <div className="font-bold text-slate-600 dark:text-slate-300 mb-1">{label}</div>}
            {payload.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }} />
                    <span className="text-slate-500">{p.name}:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{p.value}</span>
                </div>
            ))}
        </div>
    );
};

// ─────────────────────────────────────────────
// District scoring table
// ─────────────────────────────────────────────

const ScoreBar: React.FC<{ value: number; color: string }> = ({ value, color }) => (
    <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
        </div>
        <span className="text-[10px] font-bold text-slate-500 w-7 text-right">{value}</span>
    </div>
);

const DistrictTable: React.FC<{ districts: DistrictScore[]; limit?: number }> = ({ districts, limit = 15 }) => {
    const shown = districts.slice(0, limit);
    return (
        <div className="overflow-x-auto -mx-2">
            <table className="w-full text-xs">
                <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                        <th className="text-left py-2 px-2 font-bold">#</th>
                        <th className="text-left py-2 px-2 font-bold">Район</th>
                        <th className="text-center py-2 px-2 font-bold">Балл</th>
                        <th className="text-center py-2 px-2 font-bold">Инфра</th>
                        <th className="text-center py-2 px-2 font-bold">Обращения</th>
                        <th className="text-center py-2 px-2 font-bold">Бюджет</th>
                        <th className="text-right py-2 px-2 font-bold">Объектов</th>
                        <th className="text-right py-2 px-2 font-bold">Проблем</th>
                    </tr>
                </thead>
                <tbody>
                    {shown.map((d) => (
                        <tr key={d.districtId} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer"
                            onClick={() => {
                                // Dispatch custom event for drilldown
                                window.dispatchEvent(new CustomEvent('district-drilldown', {
                                    detail: { id: d.districtId, name: d.districtName, scores: d.scores }
                                }));
                            }}>
                            <td className="py-2.5 px-2 font-black text-slate-300 dark:text-slate-600">{d.rank}</td>
                            <td className="py-2.5 px-2">
                                <div className="font-bold text-slate-800 dark:text-slate-200">
                                    {d.districtName?.en || d.districtName?.uz}
                                </div>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded-full font-black text-[10px] ${
                                    d.scores.composite >= 60 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                    d.scores.composite >= 30 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                    {d.scores.composite}
                                </span>
                            </td>
                            <td className="py-2.5 px-2"><ScoreBar value={d.scores.infrastructure} color={COLORS.primary} /></td>
                            <td className="py-2.5 px-2"><ScoreBar value={d.scores.issues} color={COLORS.success} /></td>
                            <td className="py-2.5 px-2"><ScoreBar value={d.scores.budget} color={COLORS.warning} /></td>
                            <td className="py-2.5 px-2 text-right font-bold text-slate-600 dark:text-slate-400">{d.orgCount + d.infraCount}</td>
                            <td className="py-2.5 px-2 text-right font-bold text-slate-600 dark:text-slate-400">{d.issueCount}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// ─────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────

export const AnalyticsDashboard: React.FC = () => {
    const {
        overview, districtScoring, regionSummary, issueAnalytics, cropAnalytics,
        budgetAnalytics, loading, error, refetch, fetchDistrictDetail,
        regionCode: selectedRegion, setRegionCode: setSelectedRegion,
        period, setPeriod
    } = useAnalytics();

    // District drilldown
    const [drilldownId, setDrilldownId] = useState<string | null>(null);
    const [drilldownName, setDrilldownName] = useState<any>(null);
    const [drilldownScores, setDrilldownScores] = useState<any>(null);

    const handleRegionChange = (code: number | null) => {
        setSelectedRegion(code);
    };

    // ── Chart data transforms ──

    const categoryData = useMemo(() =>
        (issueAnalytics?.byCategory || []).map(c => ({
            name: c._id || 'Другое',
            count: c.count,
            avgVotes: Math.round(c.avgVotes || 0)
        })),
        [issueAnalytics]
    );

    const severityData = useMemo(() =>
        Object.entries(issueAnalytics?.bySeverity || {}).map(([name, value]) => ({
            name,
            value,
            color: SEVERITY_COLORS[name] || '#94a3b8'
        })),
        [issueAnalytics]
    );

    const statusData = useMemo(() =>
        Object.entries(issueAnalytics?.byStatus || {}).map(([name, value]) => ({
            name,
            value,
            color: STATUS_COLORS[name] || '#94a3b8'
        })),
        [issueAnalytics]
    );

    const trendData = useMemo(() =>
        (issueAnalytics?.trends || []).map(t => ({
            label: `${t.month}/${t.year}`,
            Создано: t.count,
            Решено: t.resolved
        })),
        [issueAnalytics]
    );

    const regionChartData = useMemo(() =>
        regionSummary
            .filter(r => r.issueCount > 0 || r.orgCount > 0)
            .sort((a, b) => b.issueCount - a.issueCount)
            .slice(0, 10)
            .map(r => ({
                name: r.regionName?.en?.replace(' region', '') || `R${r.regionCode}`,
                issues: r.issueCount,
                orgs: r.orgCount,
                infra: r.infraCount
            })),
        [regionSummary]
    );

    const topDistrictsRadar = useMemo(() => {
        const top5 = districtScoring.slice(0, 5);
        if (top5.length === 0) return [];
        return ['infrastructure', 'issues', 'budget', 'crops'].map(key => {
            const entry: Record<string, any> = { metric: key === 'infrastructure' ? 'Инфра' : key === 'issues' ? 'Обращения' : key === 'budget' ? 'Бюджет' : 'Агро' };
            top5.forEach(d => {
                entry[d.districtName?.en || d.districtId] = d.scores[key as keyof typeof d.scores];
            });
            return entry;
        });
    }, [districtScoring]);

    const cropTotalData = useMemo(() =>
        (cropAnalytics?.cropTotals || []).map(c => ({
            name: c.name || `Crop ${c._id}`,
            districts: c.districtCount,
            color: c.color || '#94a3b8'
        })),
        [cropAnalytics]
    );

    // Listen for district-drilldown events from the DistrictTable
    React.useEffect(() => {
        const handler = (e: any) => {
            const { id, name, scores } = e.detail;
            setDrilldownId(id);
            setDrilldownName(name);
            setDrilldownScores(scores);
        };
        window.addEventListener('district-drilldown', handler);
        return () => window.removeEventListener('district-drilldown', handler);
    }, []);

    // ── Loading / Error ──

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">Загрузка аналитики...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <AlertCircle size={40} className="mx-auto mb-3 text-red-400" />
                    <p className="text-red-500 font-bold">{error}</p>
                    <button onClick={() => refetch()} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700">
                        Повторить
                    </button>
                </div>
            </div>
        );
    }

    const o = overview!;
    const totalBudget = o.budget.committedUZS;
    const spentBudget = o.budget.spentUZS;

    return (
        <React.Fragment>
        <div className="h-full overflow-y-auto">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-6">

                {/* ── Header ── */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            Аналитика геопортала
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                            {o.counts.districts} районов · {o.counts.organizations + o.counts.infrastructure} объектов · {o.counts.issues} обращений
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <select
                                value={period ?? ''}
                                onChange={(e) => setPeriod(e.target.value ? parseInt(e.target.value) : null)}
                                className="appearance-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 pr-10 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                                <option value="">Все время</option>
                                <option value="30">30 дней</option>
                                <option value="90">90 дней</option>
                                <option value="180">6 месяцев</option>
                                <option value="365">1 год</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        <RegionSelector regions={regionSummary} selected={selectedRegion} onSelect={handleRegionChange} />
                    </div>
                </div>

                {/* ── Overview Cards ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <StatCard title="Учреждения" value={o.counts.organizations.toLocaleString()} icon={<Building2 size={18} />} color={COLORS.primary} />
                    <StatCard title="Инфраструктура" value={o.counts.infrastructure.toLocaleString()} icon={<Construction size={18} />} color={COLORS.warning} />
                    <StatCard title="Обращения" value={o.counts.issues.toLocaleString()} subtitle={`${o.issues.byStatus?.['Open'] || 0} открыто`} icon={<AlertTriangle size={18} />} color={COLORS.danger} />
                    <StatCard title="Решено" value={`${o.issues.resolutionRate}%`} icon={<CheckCircle2 size={18} />} color={COLORS.success} />
                    <StatCard title="Бюджет" value={formatBudget(totalBudget) + ' сум'} subtitle={`Исп: ${o.budget.executionRate}%`} icon={<DollarSign size={18} />} color={COLORS.indigo} />
                    <StatCard title="Районы" value={o.counts.districts} icon={<MapPin size={18} />} color={COLORS.purple} />
                </div>

                {/* ── Row 1: Issues by Category + Severity + Status ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Section title="По категориям" icon={<BarChart3 size={16} />} className="lg:col-span-2">
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={categoryData} layout="vertical" margin={{ left: 0, right: 10 }}>
                                    <XAxis type="number" tick={{ fontSize: 10 }} />
                                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Bar dataKey="count" fill={COLORS.primary} radius={[0, 4, 4, 0]} name="Обращений" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Section>

                    <div className="space-y-4">
                        <Section title="По степени" icon={<AlertCircle size={16} />}>
                            <div className="h-32 flex justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={severityData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" paddingAngle={3}>
                                            {severityData.map((d, i) => <Cell key={i} fill={d.color} />)}
                                        </Pie>
                                        <Tooltip content={<ChartTooltip />} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-3 mt-2">
                                {severityData.map(d => (
                                    <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                        <span className="text-slate-500">{d.name}</span>
                                        <span className="font-bold text-slate-700 dark:text-slate-300">{d.value}</span>
                                    </div>
                                ))}
                            </div>
                        </Section>

                        <Section title="По статусу" icon={<Activity size={16} />}>
                            <div className="space-y-2">
                                {statusData.map(d => {
                                    const total = statusData.reduce((s, x) => s + x.value, 0);
                                    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
                                    return (
                                        <div key={d.name} className="flex items-center gap-3">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                                            <span className="text-xs text-slate-600 dark:text-slate-400 w-24">{d.name}</span>
                                            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                                            </div>
                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-10 text-right">{d.value}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </Section>
                    </div>
                </div>

                {/* ── Row 2: Trends + Region Comparison ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Section title="Динамика обращений" icon={<TrendingUp size={16} />}>
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--tw-color-slate-100, #f1f5f9)" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Line type="monotone" dataKey="Создано" stroke={COLORS.danger} strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="Решено" stroke={COLORS.success} strokeWidth={2} dot={{ r: 3 }} />
                                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </Section>

                    <Section title="Регионы: объекты и обращения" icon={<Layers size={16} />}>
                        <div className="h-56">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={regionChartData}>
                                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} />
                                    <YAxis tick={{ fontSize: 10 }} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Bar dataKey="orgs" fill={COLORS.primary} name="Учреждения" radius={[2, 2, 0, 0]} stackId="stack" />
                                    <Bar dataKey="infra" fill={COLORS.warning} name="Инфраструктура" radius={[2, 2, 0, 0]} stackId="stack" />
                                    <Bar dataKey="issues" fill={COLORS.danger} name="Обращения" radius={[2, 2, 0, 0]} />
                                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Section>
                </div>

                {/* ── Row 3: District Scoring ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Section title="Рейтинг районов" icon={<Award size={16} />} className="lg:col-span-2">
                        <DistrictTable districts={districtScoring} limit={15} />
                    </Section>

                    {topDistrictsRadar.length > 0 && (
                        <Section title="Топ-5 районов: профиль" icon={<Activity size={16} />}>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart data={topDistrictsRadar} cx="50%" cy="50%" outerRadius="70%">
                                        <PolarGrid stroke="#e2e8f0" />
                                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                                        <PolarRadiusAxis tick={{ fontSize: 8 }} domain={[0, 100]} />
                                        {districtScoring.slice(0, 5).map((d, i) => (
                                            <Radar
                                                key={d.districtId}
                                                name={d.districtName?.en || d.districtId}
                                                dataKey={d.districtName?.en || d.districtId}
                                                stroke={CHART_COLORS[i]}
                                                fill={CHART_COLORS[i]}
                                                fillOpacity={0.1}
                                                strokeWidth={2}
                                            />
                                        ))}
                                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                                        <Tooltip content={<ChartTooltip />} />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </Section>
                    )}
                </div>

                {/* ── Row 4: Budget Analysis ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Section title="Бюджет по регионам" icon={<DollarSign size={16} />}>
                        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                            {regionSummary
                                .filter(r => r.budgetCommittedUZS > 0)
                                .sort((a, b) => b.budgetCommittedUZS - a.budgetCommittedUZS)
                                .map(r => {
                                    const execRate = r.budgetCommittedUZS > 0
                                        ? Math.round((r.budgetSpentUZS / r.budgetCommittedUZS) * 100)
                                        : 0;
                                    return (
                                        <div key={r.regionCode} className="space-y-1">
                                            <div className="flex justify-between text-xs">
                                                <span className="font-bold text-slate-700 dark:text-slate-300">
                                                    {r.regionName?.en?.replace(' region', '') || `R${r.regionCode}`}
                                                </span>
                                                <span className="text-slate-500">
                                                    {formatBudget(r.budgetSpentUZS)} / {formatBudget(r.budgetCommittedUZS)} сум ({execRate}%)
                                                </span>
                                            </div>
                                            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full"
                                                    style={{
                                                        width: `${execRate}%`,
                                                        backgroundColor: execRate >= 80 ? COLORS.success : execRate >= 50 ? COLORS.warning : COLORS.danger
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </Section>

                    <Section title="Выполнение бюджета по районам" icon={<TrendingUp size={16} />}>
                        <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={districtScoring
                                        .filter(d => d.budgetCommittedUZS > 0)
                                        .sort((a, b) => b.budgetExecution - a.budgetExecution)
                                        .slice(0, 12)
                                        .map(d => ({
                                            name: (d.districtName?.en || '').substring(0, 12),
                                            rate: d.budgetExecution
                                        }))}
                                    layout="vertical"
                                    margin={{ left: 0, right: 10 }}
                                >
                                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                                    <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 9 }} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Bar dataKey="rate" fill={COLORS.indigo} radius={[0, 4, 4, 0]} name="Исполнение %" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Section>
                </div>

                {/* ── Row 5: Crops ── */}
                {cropTotalData.length > 0 && (
                    <Section title="Сельскохозяйственные культуры" icon={<Wheat size={16} />}>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={cropTotalData} layout="vertical" margin={{ left: 0, right: 10 }}>
                                        <XAxis type="number" tick={{ fontSize: 10 }} />
                                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Bar dataKey="districts" name="Районов" radius={[0, 4, 4, 0]}>
                                            {cropTotalData.map((d, i) => (
                                                <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">
                                    Топ районы по разнообразию культур
                                </div>
                                <div className="space-y-2 max-h-56 overflow-y-auto">
                                    {(cropAnalytics?.byDistrict || [])
                                        .slice(0, 10)
                                        .map((d: any) => (
                                            <div key={d._id} className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    {d.districtName?.en || d.districtName?.uz}
                                                </span>
                                                <div className="flex items-center gap-1.5">
                                                    {d.crops?.slice(0, 5).map((c: any, i: number) => (
                                                        <div
                                                            key={i}
                                                            className="w-3 h-3 rounded-full border border-white dark:border-slate-800"
                                                            style={{ backgroundColor: c.color || '#94a3b8' }}
                                                            title={c.name}
                                                        />
                                                    ))}
                                                    <span className="text-[10px] font-bold text-slate-400 ml-1">
                                                        {d.cropCount}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </Section>
                )}

                {/* ── Row 6: Top voted issues ── */}
                {issueAnalytics?.topVoted && issueAnalytics.topVoted.length > 0 && (
                    <Section title="Топ обращения по поддержке" icon={<TrendingUp size={16} />}>
                        <div className="space-y-2">
                            {issueAnalytics.topVoted.slice(0, 8).map((issue: any, i: number) => (
                                <div key={issue._id} className="flex items-center gap-3 py-2 border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                                    <span className="text-lg font-black text-slate-200 dark:text-slate-700 w-6 text-right">{i + 1}</span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{issue.title}</div>
                                        <div className="flex gap-2 mt-0.5">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">{issue.category}</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                                                backgroundColor: (SEVERITY_COLORS[issue.severity] || '#94a3b8') + '20',
                                                color: SEVERITY_COLORS[issue.severity] || '#94a3b8'
                                            }}>{issue.severity}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-black text-blue-600">{issue.votes}</div>
                                        <div className="text-[10px] text-slate-400">голосов</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* ── Row 7: Budget Efficiency ── */}
                {budgetAnalytics && (
                    <Section title="Эффективность бюджета" icon={<DollarSign size={16} />} className="lg:col-span-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Выделено</p>
                                <p className="text-sm font-black text-slate-800 dark:text-slate-100">{formatBudget(budgetAnalytics.totals.committedUZS)} сум</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Освоено</p>
                                <p className="text-sm font-black text-emerald-600">{formatBudget(budgetAnalytics.totals.spentUZS)} сум</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Исполнение</p>
                                <p className="text-sm font-black text-blue-600">{budgetAnalytics.totals.executionRate}%</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                                <p className="text-[9px] font-bold text-slate-400 uppercase">Цена решения</p>
                                <p className="text-sm font-black text-amber-600">
                                    {budgetAnalytics.totals.costPerResolved
                                        ? formatBudget(budgetAnalytics.totals.costPerResolved) + ' сум'
                                        : '—'}
                                </p>
                            </div>
                        </div>

                        {budgetAnalytics.byDistrict.length > 0 && (
                            <div className="overflow-x-auto -mx-2">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                            <th className="text-left py-2 px-2 font-bold">Район</th>
                                            <th className="text-right py-2 px-2 font-bold">Выделено</th>
                                            <th className="text-right py-2 px-2 font-bold">Освоено</th>
                                            <th className="text-right py-2 px-2 font-bold">Исп. %</th>
                                            <th className="text-right py-2 px-2 font-bold">Решено</th>
                                            <th className="text-right py-2 px-2 font-bold">Цена/решение</th>
                                            <th className="text-right py-2 px-2 font-bold">Бюджет/км²</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {budgetAnalytics.byDistrict.slice(0, 20).map((d: any) => (
                                            <tr key={d.districtId}
                                                className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer"
                                                onClick={() => {
                                                    setDrilldownId(d.districtId);
                                                    setDrilldownName(d.districtName);
                                                    setDrilldownScores(null);
                                                }}>
                                                <td className="py-2 px-2 font-bold text-slate-700 dark:text-slate-200">
                                                    {d.districtName?.en || d.districtName?.uz || '—'}
                                                </td>
                                                <td className="py-2 px-2 text-right tabular-nums">{formatBudget(d.totalCommittedUZS)}</td>
                                                <td className="py-2 px-2 text-right tabular-nums text-emerald-600">{formatBudget(d.totalSpentUZS)}</td>
                                                <td className="py-2 px-2 text-right tabular-nums">
                                                    <span className={`font-bold ${d.executionRate >= 70 ? 'text-emerald-600' : d.executionRate >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
                                                        {d.executionRate}%
                                                    </span>
                                                </td>
                                                <td className="py-2 px-2 text-right tabular-nums">{d.resolvedCount}</td>
                                                <td className="py-2 px-2 text-right tabular-nums text-amber-600">
                                                    {d.costPerResolved ? formatBudget(d.costPerResolved) : '—'}
                                                </td>
                                                <td className="py-2 px-2 text-right tabular-nums text-slate-500">
                                                    {formatBudget(d.budgetPerKm2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Section>
                )}

            </div>
        </div>

        {/* District drilldown panel */}
        <DistrictDrilldown
            districtId={drilldownId}
            districtName={drilldownName}
            scores={drilldownScores}
            onClose={() => setDrilldownId(null)}
        />
    </React.Fragment>
    );
};