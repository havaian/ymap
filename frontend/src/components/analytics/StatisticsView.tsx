// frontend/src/components/analytics/StatisticsView.tsx

import React, { useMemo, useState } from 'react';
import { Issue, IssueCategory, Severity, Organization } from '../../../types';
import { CATEGORY_COLORS } from '../../constants';
import { useTrends, useResolution, useEfficiency } from '../../hooks/useAnalytics';
import { 
  BarChart3, TrendingUp, Users, CheckCircle2, AlertCircle, 
  PieChart, Building2, Map as MapIcon, Calendar, ArrowUpRight,
  Clock, AlertTriangle, ArrowDown, ArrowUp, Minus, Target,
  DollarSign, Activity
} from 'lucide-react';

interface StatisticsViewProps {
  issues: Issue[];
  organizations: Organization[];
}

// ── Format helpers ──────────────────────────────────────

function fmtNum(n: number) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} млрд`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} тыс`;
  return n.toLocaleString();
}

function fmtUzs(n: number | null | undefined) {
  if (!n) return '—';
  return fmtNum(n) + ' сум';
}

// ── Trend micro-chart (CSS bars) ────────────────────────

function TrendChart({ data }: { data: Array<{ label: string; total: number; resolved: number }> }) {
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div className="flex items-end gap-1 h-36">
      {data.map((d, i) => {
        const totalH = (d.total / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
            <div className="w-full flex flex-col items-center justify-end h-32">
              <div className="w-full rounded-t relative" style={{ height: `${totalH}%`, minHeight: d.total > 0 ? '4px' : '0' }}>
                <div className="absolute inset-0 bg-blue-200 dark:bg-blue-900/40 rounded-t" />
                <div
                  className="absolute bottom-0 left-0 right-0 bg-blue-500 rounded-t transition-all duration-200"
                  style={{ height: `${d.total > 0 ? (d.resolved / d.total) * 100 : 0}%` }}
                />
              </div>
            </div>
            <span className="text-[8px] text-slate-400 leading-none">{d.label.slice(5)}</span>
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 bg-slate-800 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none">
              {d.label}: {d.total} всего, {d.resolved} решено
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Loading placeholder ─────────────────────────────────

function LoadingPulse({ className = 'h-24' }: { className?: string }) {
  return <div className={`bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse ${className}`} />;
}

// ── Main component ──────────────────────────────────────

export const StatisticsView: React.FC<StatisticsViewProps> = ({ issues, organizations }) => {
  const { data: trends, loading: trendsLoading } = useTrends(12);
  const { data: resolution, loading: resLoading } = useResolution();
  const { data: efficiency, loading: effLoading } = useEfficiency();
  const [activeTab, setActiveTab] = useState<'overview' | 'budget' | 'districts'>('overview');

  const stats = useMemo(() => {
    const total = issues.length;
    const resolved = issues.filter(i => i.status === 'Resolved').length;
    const inProgress = issues.filter(i => i.status === 'In Progress').length;
    const open = total - resolved - inProgress;
    
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byDistrict: Record<string, number> = {};
    const byOrgType: Record<string, number> = {
      'Образование': 0,
      'Здравоохранение': 0,
      'Прочие (уличные)': 0
    };
    
    let totalVotes = 0;

    issues.forEach(i => {
      // Category stats
      byCategory[i.category] = (byCategory[i.category] || 0) + 1;
      
      // Severity stats
      bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
      
      // Votes
      totalVotes += i.votes;

      // District: try to get from org region, fallback to ID parsing
      if (i.organizationId) {
        const org = organizations.find(o => o.id === i.organizationId);
        if (org?.region?.name) {
          byDistrict[org.region.name] = (byDistrict[org.region.name] || 0) + 1;
        } else {
          byDistrict['Без района'] = (byDistrict['Без района'] || 0) + 1;
        }
      } else if (i.id.startsWith('auto-')) {
        const parts = i.id.split('-');
        const district = parts[1];
        byDistrict[district] = (byDistrict[district] || 0) + 1;
      } else {
        byDistrict['Без района'] = (byDistrict['Без района'] || 0) + 1;
      }

      // Org type stats
      if (i.organizationId) {
        const org = organizations.find(o => o.id === i.organizationId);
        if (org?.type === IssueCategory.EDUCATION) byOrgType['Образование']++;
        else if (org?.type === IssueCategory.HEALTH) byOrgType['Здравоохранение']++;
      } else {
        byOrgType['Прочие (уличные)']++;
      }
    });

    const categoriesSorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const districtsSorted = Object.entries(byDistrict).sort((a, b) => b[1] - a[1]);

    return { 
      total, resolved, inProgress, open, 
      byCategory: categoriesSorted, 
      bySeverity, 
      byDistrict: districtsSorted,
      byOrgType,
      totalVotes,
      efficiency: total > 0 ? Math.round((resolved / total) * 100) : 0
    };
  }, [issues, organizations]);

  const maxCategoryCount = Math.max(...stats.byCategory.map(c => c[1]), 1);
  const maxDistrictCount = Math.max(...stats.byDistrict.map(d => d[1]), 1);

  // Month-over-month delta from API trends (replaces hardcoded +12%)
  const monthDelta = useMemo(() => {
    if (!trends || trends.trend.length < 2) return null;
    const last = trends.trend[trends.trend.length - 1];
    const prev = trends.trend[trends.trend.length - 2];
    if (prev.total === 0) return null;
    return Math.round(((last.total - prev.total) / prev.total) * 100);
  }, [trends]);

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col animate-in fade-in duration-200 overflow-y-auto custom-scrollbar pb-20">
      <div className="p-6 md:p-10 max-w-7xl mx-auto w-full space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-widest mb-2">
              <TrendingUp size={14} />
              Аналитический хаб открытых данных
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Мониторинг инфраструктуры</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-2">Анализ состояния городской среды Ташкента на основе {stats.total} обращений граждан</p>
          </div>

          <div className="flex items-center gap-4">
            {/* Tab switcher */}
            <div className="bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex">
              {([
                { key: 'overview', label: 'Обзор' },
                { key: 'budget', label: 'Бюджет' },
                { key: 'districts', label: 'Районы' },
              ] as const).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                    activeTab === tab.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Activity badge — real data */}
            <div className="hidden md:flex bg-white dark:bg-slate-900 px-6 py-4 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 items-center gap-6">
               <div className="text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Активность</p>
                  <div className={`flex items-center gap-1 ${monthDelta !== null && monthDelta < 0 ? 'text-green-600' : monthDelta !== null && monthDelta > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {monthDelta !== null ? (
                      <>
                        {monthDelta > 0 ? <ArrowUp size={14} /> : monthDelta < 0 ? <ArrowDown size={14} /> : <Minus size={14} />}
                        <span className="text-sm font-bold">{monthDelta > 0 ? '+' : ''}{monthDelta}%</span>
                      </>
                    ) : (
                      <>
                        <ArrowUpRight size={14} />
                        <span className="text-sm font-bold">—</span>
                      </>
                    )}
                  </div>
               </div>
               <div className="w-px h-8 bg-slate-100 dark:bg-slate-800"></div>
               <div className="text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase">Поддержка</p>
                  <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.totalVotes.toLocaleString()}</p>
               </div>
            </div>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard title="Всего" value={stats.total} icon={<BarChart3 className="text-blue-500" />} color="blue" />
          <StatCard title="К исполнению" value={stats.open} icon={<AlertCircle className="text-red-500" />} color="red" percentage={(stats.open / stats.total) * 100} />
          <StatCard title="В процессе" value={stats.inProgress} icon={<TrendingUp className="text-blue-500" />} color="blue" percentage={(stats.inProgress / stats.total) * 100} />
          <StatCard title="Выполнено" value={stats.resolved} icon={<CheckCircle2 className="text-green-500" />} color="green" percentage={(stats.resolved / stats.total) * 100} />
          <StatCard title="KPI Решений" value={`${stats.efficiency}%`} icon={<Target className="text-indigo-500" />} color="indigo" />
          <StatCard
            title="Ср. решение"
            value={resolution?.overall.avgDays != null ? `${resolution.overall.avgDays} дн` : '—'}
            icon={<Clock className="text-teal-500" />}
            color="teal"
            sub={resolution?.overall.medianDays != null ? `Медиана: ${resolution.overall.medianDays} дн` : undefined}
          />
        </div>


        {/* ═══════════════════════════════════════════════
            TAB: OVERVIEW (original layout extended)
           ═══════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <>
            {/* Main Analytics Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Categories & Org Types (Left/Center) */}
              <div className="lg:col-span-2 space-y-8">

                {/* Monthly Trend Chart — NEW */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-xl text-blue-600 dark:text-blue-400">
                      <Activity size={20} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Динамика обращений (12 мес)</h3>
                  </div>
                  {trendsLoading || !trends ? <LoadingPulse className="h-36" /> : (
                    <>
                      <TrendChart data={trends.trend} />
                      <div className="flex items-center gap-4 mt-4">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                          <div className="w-3 h-3 bg-blue-200 dark:bg-blue-900/40 rounded-sm" /> Всего
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                          <div className="w-3 h-3 bg-blue-500 rounded-sm" /> Решено
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Category Breakdown — original */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-xl text-blue-600 dark:text-blue-400">
                      <BarChart3 size={20} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Распределение по типам проблем</h3>
                  </div>
                  <div className="space-y-6">
                     {stats.byCategory.map(([cat, count]) => (
                       <div key={cat} className="space-y-2">
                          <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                             <span className="text-slate-600 dark:text-slate-400">{cat}</span>
                             <span className="text-slate-800 dark:text-slate-100">{count} заявок</span>
                          </div>
                          <div className="h-2.5 w-full bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                             <div 
                               className="h-full transition-all duration-400 ease-out rounded-full"
                               style={{ 
                                  width: `${(count / maxCategoryCount) * 100}%`,
                                  backgroundColor: CATEGORY_COLORS[cat as IssueCategory] || '#64748b'
                               }}
                             />
                          </div>
                       </div>
                     ))}
                  </div>
                </div>

                {/* Per-category efficiency — NEW */}
                {!trendsLoading && trends && (
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-xl text-green-600 dark:text-green-400">
                        <Target size={20} />
                      </div>
                      <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Эффективность по категориям</h3>
                    </div>
                    <div className="space-y-3">
                      {trends.categories.map(c => (
                        <div key={c.category} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                          <div className="w-2 h-10 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[c.category as IssueCategory] || '#64748b' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{c.category}</p>
                            <p className="text-[10px] text-slate-400">{c.total} всего · {c.resolved} решено</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`text-sm font-black ${c.resolutionRate >= 50 ? 'text-green-600' : c.resolutionRate >= 25 ? 'text-orange-500' : 'text-red-500'}`}>
                              {c.resolutionRate}%
                            </p>
                            {c.avgResolutionDays != null && (
                              <p className="text-[10px] text-slate-400">{c.avgResolutionDays} дн</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Organizations & Org Types — original */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3 mb-6">
                        <Building2 className="text-indigo-500" size={18} />
                        <h4 className="font-bold text-slate-800 dark:text-slate-100">Типы объектов</h4>
                      </div>
                      <div className="space-y-4">
                        {Object.entries(stats.byOrgType).map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                            <span className="text-xs font-bold text-slate-500">{type}</span>
                            <span className="text-sm font-black text-slate-800 dark:text-white">{count}</span>
                          </div>
                        ))}
                      </div>
                   </div>
                   
                   {/* Gradient card — now with real data instead of hardcoded */}
                   <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
                      <div className="relative z-10">
                        <Calendar className="w-8 h-8 mb-4 opacity-70" />
                        <h4 className="text-xl font-black mb-2">Время решения</h4>
                        <p className="text-sm text-blue-100 mb-6 leading-relaxed">
                          {resolution?.overall.avgDays != null
                            ? `Среднее время решения проблемы — ${resolution.overall.avgDays} дн. Медиана — ${resolution.overall.medianDays ?? '—'} дн.`
                            : 'На основе текущей динамики, заявки обрабатываются в кратчайшие сроки.'}
                        </p>
                        <div className="flex items-center gap-3 bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/10">
                           <span className="text-xs font-bold uppercase tracking-wider">Решено всего:</span>
                           <span className="text-lg font-black">{resolution?.overall.count ?? stats.resolved}</span>
                        </div>
                      </div>
                      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                   </div>
                </div>
              </div>

              {/* Right Column: Districts & Severity — original */}
              <div className="space-y-8">
                 {/* District Breakdown */}
                 <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-8">
                      <MapIcon className="text-orange-500" size={18} />
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">Анализ районов</h3>
                    </div>
                    <div className="space-y-5">
                       {stats.byDistrict.map(([dist, count]) => (
                         <div key={dist} className="flex flex-col gap-1.5">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                               <span>{dist}</span>
                               <span>{count}</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-50 dark:bg-slate-800 rounded-full">
                               <div 
                                className="h-full bg-orange-500 rounded-full" 
                                style={{ width: `${(count / maxDistrictCount) * 100}%` }}
                               />
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>

                 {/* Severity Indicators — original + resolution time addon */}
                 <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-8">
                      <PieChart className="text-red-500" size={18} />
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">Уровень угрозы</h3>
                    </div>
                    <div className="flex flex-wrap gap-4 justify-center">
                       {Object.entries(stats.bySeverity).map(([sev, count]) => (
                          <div key={sev} className="flex flex-col items-center">
                             <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center font-black text-sm mb-2
                               ${sev === Severity.CRITICAL ? 'border-red-500 text-red-600' : 
                                 sev === Severity.HIGH ? 'border-orange-500 text-orange-600' : 
                                 sev === Severity.MEDIUM ? 'border-blue-500 text-blue-600' : 'border-slate-300 text-slate-400'}
                             `}>
                                {count}
                             </div>
                             <span className="text-[9px] font-black uppercase text-slate-400">{sev}</span>
                          </div>
                       ))}
                    </div>
                    {/* Resolution time by severity — NEW addon */}
                    {resolution && resolution.bySeverity.length > 0 && (
                      <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ср. время решения</p>
                        <div className="space-y-2">
                          {resolution.bySeverity.map(s => (
                            <div key={s.severity} className="flex items-center justify-between py-1">
                              <span className="text-xs font-bold text-slate-500">{s.severity}</span>
                              <span className="text-xs font-black text-slate-800 dark:text-white">
                                {s.avgDays != null ? `${s.avgDays} дн` : '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                 </div>
              </div>

            </div>

            {/* Civic Engagement Section — original */}
            <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center gap-10">
               <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-inner">
                  <Users size={40} />
               </div>
               <div className="flex-1 text-center md:text-left">
                  <h3 className="text-xl font-black text-slate-800 dark:text-white mb-2">Голос каждого имеет значение</h3>
                  <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                    За последний месяц зафиксировано <span className="text-indigo-600 font-bold">{stats.totalVotes}</span> взаимодействий с платформой. 
                    Ваша активность напрямую влияет на приоритет исполнения работ государственными службами.
                  </p>
               </div>
               <button className="px-8 py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:shadow-lg transition active:opacity-90 shrink-0">
                  Скачать отчет (PDF)
               </button>
            </div>
          </>
        )}


        {/* ═══════════════════════════════════════════════
            TAB: BUDGET
           ═══════════════════════════════════════════════ */}
        {activeTab === 'budget' && (
          <>
            {effLoading || !efficiency ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <LoadingPulse className="h-32" /><LoadingPulse className="h-32" /><LoadingPulse className="h-32" /><LoadingPulse className="h-32" />
                </div>
                <LoadingPulse className="h-64" />
              </div>
            ) : (
              <>
                {/* Budget KPI row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard title="Общий бюджет" value={fmtUzs(efficiency.summary.totalBudget)} icon={<DollarSign className="text-indigo-500" />} color="indigo" />
                  <StatCard title="Исполнение" value={`${efficiency.summary.avgExecutionRate}%`} icon={<Target className="text-green-500" />} color="green" percentage={efficiency.summary.avgExecutionRate} />
                  <StatCard title="Стоимость решения" value={efficiency.summary.avgCostPerResolved ? fmtUzs(efficiency.summary.avgCostPerResolved) : '—'} icon={<BarChart3 className="text-blue-500" />} color="blue" />
                  <StatCard title="Аномалии" value={efficiency.summary.anomalyCount} icon={<AlertTriangle className="text-red-500" />} color="red" sub="высокий бюджет, мало решений" />
                </div>

                {/* District efficiency table */}
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="bg-teal-100 dark:bg-teal-900/30 p-2 rounded-xl text-teal-600 dark:text-teal-400">
                      <MapIcon size={20} />
                    </div>
                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Эффективность по районам</h3>
                  </div>
                  <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-xs min-w-[640px]">
                      <thead>
                        <tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                          <td className="pb-3 pl-2 pr-4">Район</td>
                          <td className="pb-3 pr-4 text-right">Объектов</td>
                          <td className="pb-3 pr-4 text-right">Бюджет</td>
                          <td className="pb-3 pr-4 text-right">Исполн.</td>
                          <td className="pb-3 pr-4 text-right">Проблем</td>
                          <td className="pb-3 pr-4 text-right">Решено</td>
                          <td className="pb-3 pr-2 text-right">Стоим./реш.</td>
                        </tr>
                      </thead>
                      <tbody>
                        {efficiency.districts
                          .sort((a, b) => b.totalBudget - a.totalBudget)
                          .map(d => (
                            <tr key={d.district} className="border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="py-3 pl-2 pr-4 font-bold text-slate-700 dark:text-slate-300">{d.district}</td>
                              <td className="py-3 pr-4 text-right text-slate-500">{d.orgCount}</td>
                              <td className="py-3 pr-4 text-right font-bold text-slate-700 dark:text-slate-300">{fmtNum(d.totalBudget)}</td>
                              <td className="py-3 pr-4 text-right">
                                <span className={`font-bold ${d.executionRate >= 70 ? 'text-green-600' : d.executionRate >= 40 ? 'text-orange-500' : 'text-red-500'}`}>
                                  {d.executionRate}%
                                </span>
                              </td>
                              <td className="py-3 pr-4 text-right text-slate-500">{d.totalIssues}</td>
                              <td className="py-3 pr-4 text-right">
                                <span className={`font-bold ${d.resolutionRate >= 50 ? 'text-green-600' : d.resolutionRate >= 25 ? 'text-orange-500' : 'text-red-500'}`}>
                                  {d.resolutionRate}%
                                </span>
                              </td>
                              <td className="py-3 pr-2 text-right text-slate-500">{d.costPerResolved ? fmtNum(d.costPerResolved) : '—'}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Anomalies */}
                {efficiency.anomalies.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-xl text-red-600 dark:text-red-400">
                        <AlertTriangle size={20} />
                      </div>
                      <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Аномалии ({efficiency.anomalies.length})</h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 ml-12">
                      Учреждения с высоким исполнением бюджета, но низким % решённых проблем
                    </p>
                    <div className="space-y-2">
                      {efficiency.anomalies.map(a => (
                        <div
                          key={a.id}
                          className={`flex items-center gap-3 p-3 rounded-2xl border ${
                            a.flag === 'critical'
                              ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'
                              : 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40'
                          }`}
                        >
                          <AlertTriangle size={14} className={`shrink-0 ${a.flag === 'critical' ? 'text-red-500' : 'text-orange-500'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{a.name}</p>
                            <p className="text-[10px] text-slate-500">{a.region} · {a.type}</p>
                          </div>
                          <div className="text-right shrink-0 space-y-0.5">
                            <p className="text-[10px] text-slate-500">Бюджет <span className="font-bold text-green-600">{a.budget.executionRate}%</span></p>
                            <p className="text-[10px] text-slate-500">Решено <span className="font-bold text-red-500">{a.issues.resolutionRate}%</span></p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}


        {/* ═══════════════════════════════════════════════
            TAB: DISTRICTS
           ═══════════════════════════════════════════════ */}
        {activeTab === 'districts' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Resolution time by district */}
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-8">
                  <div className="bg-teal-100 dark:bg-teal-900/30 p-2 rounded-xl text-teal-600 dark:text-teal-400">
                    <Clock size={20} />
                  </div>
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Время решения по районам</h3>
                </div>
                {resLoading || !resolution ? <LoadingPulse /> : (
                  <div className="space-y-5">
                    {resolution.byDistrict.map(d => {
                      const maxDays = Math.max(...resolution.byDistrict.map(x => x.avgDays || 0), 1);
                      return (
                        <div key={d.district} className="flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                            <span>{d.district}</span>
                            <span className="normal-case">
                              {d.avgDays != null ? `${d.avgDays} дн` : '—'}
                              <span className="font-normal text-slate-300 dark:text-slate-600 ml-1">({d.count})</span>
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-50 dark:bg-slate-800 rounded-full">
                            <div
                              className="h-full bg-teal-500 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(((d.avgDays || 0) / maxDays) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Issues by district — same style as overview sidebar */}
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-8">
                  <MapIcon className="text-orange-500" size={18} />
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Обращения по районам</h3>
                </div>
                <div className="space-y-5">
                   {stats.byDistrict.map(([dist, count]) => (
                     <div key={dist} className="flex flex-col gap-1.5">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                           <span>{dist}</span>
                           <span>{count}</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-50 dark:bg-slate-800 rounded-full">
                           <div 
                            className="h-full bg-orange-500 rounded-full transition-all duration-300" 
                            style={{ width: `${(count / maxDistrictCount) * 100}%` }}
                           />
                        </div>
                     </div>
                   ))}
                </div>
              </div>
            </div>

            {/* Resolution time by category */}
            {resolution && resolution.byCategory.length > 0 && (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-8">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-xl text-blue-600 dark:text-blue-400">
                    <Clock size={20} />
                  </div>
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Время решения по категориям</h3>
                </div>
                <div className="space-y-6">
                  {resolution.byCategory.map(c => {
                    const maxDays = Math.max(...resolution.byCategory.map(x => x.avgDays || 0), 1);
                    return (
                      <div key={c.category} className="space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-tight">
                          <span className="text-slate-600 dark:text-slate-400">{c.category}</span>
                          <span className="text-slate-800 dark:text-slate-100">
                            {c.avgDays != null ? `${c.avgDays} дн` : '—'}
                            <span className="font-normal text-slate-400 text-[10px] ml-1.5">мин {c.minDays ?? '—'} / макс {c.maxDays ?? '—'}</span>
                          </span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-400 ease-out rounded-full"
                            style={{
                              width: `${Math.min(((c.avgDays || 0) / maxDays) * 100, 100)}%`,
                              backgroundColor: CATEGORY_COLORS[c.category as IssueCategory] || '#64748b'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Budget ranking cards */}
            {efficiency && efficiency.districts.length > 0 && (
              <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-8">
                  <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <DollarSign size={20} />
                  </div>
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">Бюджетный рейтинг районов</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {efficiency.districts
                    .sort((a, b) => b.totalBudget - a.totalBudget)
                    .map((d, i) => (
                      <div key={d.district} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center gap-3">
                        <span className="text-lg font-black text-slate-300 dark:text-slate-600 w-8 shrink-0">#{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{d.district}</p>
                          <p className="text-[10px] text-slate-400">{d.orgCount} объектов · {d.totalIssues} обращений</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-black text-slate-700 dark:text-slate-300">{fmtUzs(d.totalBudget)}</p>
                          <p className={`text-[10px] font-bold ${d.executionRate >= 70 ? 'text-green-600' : d.executionRate >= 40 ? 'text-orange-500' : 'text-red-500'}`}>
                            {d.executionRate}% исполн.
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}


        {/* Footer info */}
        <div className="text-center py-4">
           <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.4em]">
              Y.Map • 2026 • By Y.Tech
           </p>
        </div>

      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color, percentage, sub }: any) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md group">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">{icon}</div>
      {percentage !== undefined && (
        <span className="text-[10px] font-black text-slate-400 uppercase">{Math.round(percentage)}%</span>
      )}
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
    <p className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">{value}</p>
    {sub && <p className="text-[10px] text-slate-400 mt-1">{sub}</p>}
    {percentage !== undefined && (
      <div className="mt-4 h-1.5 w-full bg-slate-50 dark:bg-slate-800 rounded-full">
        <div 
          className={`h-full rounded-full transition-all duration-400 ${
            color === 'red' ? 'bg-red-500' : 
            color === 'orange' ? 'bg-orange-500' :
            color === 'blue' ? 'bg-blue-500' : 
            color === 'green' ? 'bg-green-500' :
            color === 'indigo' ? 'bg-indigo-500' :
            color === 'teal' ? 'bg-teal-500' : 'bg-slate-400'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    )}
  </div>
);