// frontend/src/components/analytics/DistrictDrilldown.tsx

import React, { useState, useEffect } from 'react';
import { analyticsAPI } from '../../services/analyticsApi';
import {
    X, MapPin, AlertCircle, Building2, CheckCircle2, TrendingDown
} from 'lucide-react';

// ── Scores now reflect the new district scoring model ─────────────────────────
// composite:    overall livability score (0-100, higher = better)
// deficit:      facility deficit (0-100, higher = more underfunded)
// issuePressure: open issues ratio (0-100, higher = more problems)
interface DistrictScores {
    composite: number;
    deficit: number;
    issuePressure: number;
}

interface DistrictDrilldownProps {
    districtId: string | null;
    districtName?: { en?: string; ru?: string; uz?: string } | string;
    scores?: DistrictScores;
    onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatNum(n: number | null | undefined): string {
    if (n == null) return '—';
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' млрд';
    if (n >= 1_000_000)     return (n / 1_000_000).toFixed(1)     + ' млн';
    if (n >= 1_000)         return (n / 1_000).toFixed(1)         + ' тыс';
    return n.toLocaleString();
}

// ── ScoreBar ──────────────────────────────────────────────────────────────────

function ScoreBar({ score, label, inverted = false }: {
    score: number;
    label: string;
    // inverted=true means higher = worse (deficit, issue pressure)
    inverted?: boolean;
}) {
    const effective = inverted ? 100 - score : score;
    const color = effective >= 70 ? 'bg-emerald-500' : effective >= 40 ? 'bg-amber-400' : 'bg-red-500';
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className="text-slate-400">{label}</span>
                <span className="text-slate-600 dark:text-slate-300">{score}/100</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-300 ${color}`}
                    style={{ width: `${score}%` }}
                />
            </div>
        </div>
    );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, color = 'text-slate-800 dark:text-slate-100' }: {
    label: string;
    value: string | number;
    color?: string;
}) {
    return (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 text-center">
            <p className={`text-lg font-black ${color}`}>{value}</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{label}</p>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export const DistrictDrilldown: React.FC<DistrictDrilldownProps> = ({
    districtId,
    districtName,
    scores: initialScores,
    onClose
}) => {
    const [detail,  setDetail]  = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!districtId) { setDetail(null); return; }
        setLoading(true);
        analyticsAPI.getDistrictDetail(districtId)
            .then(res => setDetail(res.data.data))
            .catch(err => console.error('District detail error:', err))
            .finally(() => setLoading(false));
    }, [districtId]);

    if (!districtId) return null;

    const name = typeof districtName === 'string'
        ? districtName
        : districtName?.ru || districtName?.en || districtName?.uz || 'Район';

    // Object type Russian labels
    const OBJ_LABELS: Record<string, string> = {
        school:       'Школы',
        kindergarten: 'Детские сады',
        health_post:  'ФАП / СВП'
    };

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="relative w-full max-w-lg h-full bg-white dark:bg-slate-950 shadow-2xl overflow-y-auto custom-scrollbar animate-in slide-in-from-right duration-100">

                {/* Sticky header */}
                <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-blue-600 text-[10px] font-black uppercase tracking-widest mb-1">
                                <MapPin size={12} />
                                Детали района
                            </div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{name}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Score summary */}
                    {initialScores && (
                        <div className="mt-3 flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-black text-xl text-white flex-shrink-0 ${
                                initialScores.composite >= 60 ? 'bg-emerald-500' :
                                initialScores.composite >= 30 ? 'bg-amber-500' : 'bg-red-500'
                            }`}>
                                {initialScores.composite}
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <ScoreBar
                                    score={initialScores.composite}
                                    label="Общий скоринг"
                                />
                                <ScoreBar
                                    score={initialScores.deficit}
                                    label="Дефицит объектов"
                                    inverted
                                />
                                <ScoreBar
                                    score={initialScores.issuePressure}
                                    label="Давление обращений"
                                    inverted
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : detail ? (
                        <>
                            {/* Facility objects section */}
                            <section>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                                    <Building2 size={16} className="text-indigo-500" />
                                    Объекты
                                    <span className="ml-auto text-[10px] font-black text-slate-400">
                                        {detail.objects?.total ?? 0} объектов
                                    </span>
                                </h3>

                                {detail.objects?.byType && Object.keys(detail.objects.byType).length > 0 ? (
                                    <div className="grid grid-cols-3 gap-2 mb-3">
                                        {Object.entries(detail.objects.byType as Record<string, number>).map(([type, count]) => (
                                            <StatCard
                                                label={OBJ_LABELS[type] || type}
                                                value={count}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 dark:text-slate-600 py-2">
                                        Объекты не найдены
                                    </p>
                                )}

                                {/* List of objects (first 10) */}
                                {detail.objects?.list?.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {detail.objects.list.slice(0, 10).map((obj: any) => (
                                            <div
                                                key={obj._id || obj.id}
                                                className="flex items-center justify-between text-xs py-1"
                                            >
                                                <span className="text-slate-600 dark:text-slate-400 truncate mr-2">
                                                    {obj.name}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 flex-shrink-0">
                                                    {OBJ_LABELS[obj.objectType] || obj.objectType}
                                                </span>
                                            </div>
                                        ))}
                                        {detail.objects.total > 10 && (
                                            <p className="text-[10px] text-slate-400 pt-1">
                                                + ещё {detail.objects.total - 10} объектов
                                            </p>
                                        )}
                                    </div>
                                )}
                            </section>

                            {/* Issues section */}
                            <section>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                                    <AlertCircle size={16} className="text-red-500" />
                                    Обращения граждан
                                    <span className="ml-auto text-[10px] font-black text-slate-400">
                                        {detail.issues?.total ?? 0} всего
                                    </span>
                                </h3>

                                {detail.issues?.total > 0 ? (
                                    <>
                                        {/* Status counts derived from list */}
                                        {(() => {
                                            const list: any[] = detail.issues.list || [];
                                            const open     = list.filter(i => i.status === 'Open').length;
                                            const progress = list.filter(i => i.status === 'In Progress').length;
                                            const resolved = list.filter(i => i.status === 'Resolved').length;
                                            return (
                                                <div className="grid grid-cols-3 gap-2 mb-3">
                                                    <StatCard label="Открыто"    value={open}     color="text-red-500" />
                                                    <StatCard label="В работе"   value={progress} color="text-blue-500" />
                                                    <StatCard label="Решено"     value={resolved} color="text-emerald-600" />
                                                </div>
                                            );
                                        })()}

                                        {/* Top voted issues */}
                                        {detail.issues.list?.length > 0 && (
                                            <div className="space-y-1.5">
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                                    Последние обращения
                                                </p>
                                                {detail.issues.list.slice(0, 8).map((issue: any, i: number) => (
                                                    <div key={issue._id || i} className="flex items-center gap-2 text-xs">
                                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                            issue.status === 'Resolved' ? 'bg-emerald-500' :
                                                            issue.status === 'In Progress' ? 'bg-blue-500' : 'bg-red-400'
                                                        }`} />
                                                        <span className="flex-1 truncate text-slate-700 dark:text-slate-300">
                                                            {issue.title}
                                                        </span>
                                                        <span className="font-bold text-slate-400 flex-shrink-0">
                                                            ▲ {issue.votes ?? 0}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 py-2">
                                        <CheckCircle2 size={14} />
                                        Обращений не зарегистрировано
                                    </div>
                                )}
                            </section>

                            {/* District meta */}
                            {detail.district && (
                                <section>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                                        <TrendingDown size={16} className="text-slate-400" />
                                        Общая информация
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {detail.district.areaKm2 && (
                                            <StatCard
                                                label="Площадь"
                                                value={`${formatNum(detail.district.areaKm2)} км²`}
                                            />
                                        )}
                                        {detail.district.regionCode && (
                                            <StatCard
                                                label="Код региона"
                                                value={detail.district.regionCode}
                                            />
                                        )}
                                    </div>
                                </section>
                            )}
                        </>
                    ) : (
                        <p className="text-slate-400 text-sm text-center py-8">Данные не найдены</p>
                    )}
                </div>
            </div>
        </div>
    );
};