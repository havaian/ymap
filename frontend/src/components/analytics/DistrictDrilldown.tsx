import React, { useState, useEffect } from 'react';
import { analyticsAPI } from '../../services/analyticsApi';
import {
    X, MapPin, AlertCircle, Building2, Construction, DollarSign,
    CheckCircle2, TrendingUp, Sprout, BarChart3
} from 'lucide-react';

interface DistrictDrilldownProps {
    districtId: string | null;
    districtName?: { en?: string; ru?: string; uz?: string };
    scores?: { composite: number; infrastructure: number; issues: number; budget: number; crops: number };
    onClose: () => void;
}

function formatNum(n: number | null | undefined): string {
    if (n == null) return '—';
    if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toLocaleString();
}

function ScoreBar({ score, label, color }: { score: number; label: string; color?: string }) {
    const c = color || (score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-400' : 'bg-red-500');
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                <span className="text-slate-400">{label}</span>
                <span className="text-slate-600 dark:text-slate-300">{score}/100</span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${c}`} style={{ width: `${score}%` }} />
            </div>
        </div>
    );
}

function HBar({ label, value, max, suffix = '' }: { label: string; value: number; max: number; suffix?: string }) {
    const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-bold">
                <span className="text-slate-600 dark:text-slate-400 truncate mr-2">{label}</span>
                <span className="text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatNum(value)}{suffix}</span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${w}%` }} />
            </div>
        </div>
    );
}

export const DistrictDrilldown: React.FC<DistrictDrilldownProps> = ({
    districtId,
    districtName,
    scores: initialScores,
    onClose
}) => {
    const [detail, setDetail] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!districtId) {
            setDetail(null);
            return;
        }

        setLoading(true);
        analyticsAPI.getDistrictDetail(districtId)
            .then(res => setDetail(res.data.data))
            .catch(err => console.error('District detail error:', err))
            .finally(() => setLoading(false));
    }, [districtId]);

    if (!districtId) return null;

    const name = districtName?.en || districtName?.uz || districtName?.ru || 'Район';

    return (
        <div className="fixed inset-0 z-[500] flex items-center justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

            {/* Panel */}
            <div className="relative w-full max-w-lg h-full bg-white dark:bg-slate-950 shadow-2xl overflow-y-auto custom-scrollbar animate-in slide-in-from-right duration-100">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 text-blue-600 text-[10px] font-black uppercase tracking-widest mb-1">
                                <MapPin size={12} />
                                Детали района
                            </div>
                            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100">{name}</h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Composite score */}
                    {initialScores && (
                        <div className="mt-3 flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center font-black text-xl text-white
                                ${initialScores.composite >= 60 ? 'bg-emerald-500' :
                                    initialScores.composite >= 30 ? 'bg-amber-500' : 'bg-red-500'}`}>
                                {initialScores.composite}
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <ScoreBar score={initialScores.infrastructure} label="Инфраструктура" />
                                <ScoreBar score={initialScores.issues} label="Обращения" />
                                <ScoreBar score={initialScores.budget} label="Бюджет" />
                                <ScoreBar score={initialScores.crops} label="Агро" />
                            </div>
                        </div>
                    )}
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : detail ? (
                        <>
                            {/* Issues summary */}
                            <section>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                                    <AlertCircle size={16} className="text-red-500" /> Обращения
                                </h3>
                                <div className="grid grid-cols-3 gap-3 mb-3">
                                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 text-center">
                                        <p className="text-lg font-black text-slate-800 dark:text-slate-100">{detail.issues?.total || 0}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Всего</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 text-center">
                                        <p className="text-lg font-black text-emerald-600">{detail.issues?.byStatus?.Resolved || 0}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Решено</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3 text-center">
                                        <p className="text-lg font-black text-red-500">{detail.issues?.byStatus?.Open || 0}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Открыто</p>
                                    </div>
                                </div>

                                {/* By category */}
                                {detail.issues?.byCategory?.length > 0 && (
                                    <div className="space-y-2">
                                        {detail.issues.byCategory.map((c: any) => (
                                            <HBar key={c._id} label={c._id} value={c.count}
                                                max={detail.issues.byCategory[0].count} />
                                        ))}
                                    </div>
                                )}

                                {/* Top voted */}
                                {detail.issues?.topVoted?.length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                            Топ проблемы
                                        </p>
                                        <div className="space-y-1.5">
                                            {detail.issues.topVoted.map((issue: any, i: number) => (
                                                <div key={issue._id} className="flex items-center gap-2 text-xs">
                                                    <span className="text-slate-300 font-black w-4 text-right">{i + 1}</span>
                                                    <span className="flex-1 truncate text-slate-700 dark:text-slate-300">{issue.title}</span>
                                                    <span className="font-bold text-blue-600">{issue.votes}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>

                            {/* Organizations */}
                            <section>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                                    <Building2 size={16} className="text-blue-500" /> Организации
                                </h3>
                                <div className="space-y-2">
                                    {detail.organizations?.byType?.map((t: any) => (
                                        <div key={t._id} className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600 dark:text-slate-400">{t._id}</span>
                                            <div className="text-right">
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{t.count}</span>
                                                {t.committedUZS > 0 && (
                                                    <span className="text-[10px] text-slate-400 ml-2">
                                                        {formatNum(t.committedUZS)} UZS
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Infrastructure */}
                            <section>
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                                    <Construction size={16} className="text-amber-500" /> Инфраструктура
                                </h3>
                                <div className="space-y-2">
                                    {detail.infrastructure?.byType?.map((t: any) => (
                                        <div key={t._id} className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600 dark:text-slate-400">{t._id}</span>
                                            <div className="text-right">
                                                <span className="font-bold text-slate-800 dark:text-slate-200">{t.count}</span>
                                                {t.committedUZS > 0 && (
                                                    <span className="text-[10px] text-slate-400 ml-2">
                                                        {formatNum(t.spentUZS)}/{formatNum(t.committedUZS)} ({t.executionRate}%)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Budget */}
                            {(detail.organizations?.totalBudget?.committedUZS > 0 || detail.infrastructure?.totalBudget?.committedUZS > 0) && (
                                <section>
                                    <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                                        <DollarSign size={16} className="text-emerald-500" /> Бюджет
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Организацией выделено</p>
                                            <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                                                {formatNum(detail.organizations?.totalBudget?.committedUZS)} UZS
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Организацией освоено</p>
                                            <p className="text-sm font-black text-emerald-600">
                                                {formatNum(detail.organizations?.totalBudget?.spentUZS)} UZS
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Объектом инф-ры выделено</p>
                                            <p className="text-sm font-black text-slate-800 dark:text-slate-100">
                                                {formatNum(detail.infrastructure?.totalBudget?.committedUZS)} UZS
                                            </p>
                                        </div>
                                        <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
                                            <p className="text-[9px] font-bold text-slate-400 uppercase">Объектом инф-ры освоено</p>
                                            <p className="text-sm font-black text-emerald-600">
                                                {formatNum(detail.infrastructure?.totalBudget?.spentUZS)} UZS
                                            </p>
                                        </div>
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