
import React, { useMemo } from 'react';
import { Issue, IssueCategory, Severity } from '../types';
import { CATEGORY_COLORS, MOCK_ORGANIZATIONS } from '../constants';
import { 
  BarChart3, TrendingUp, Users, CheckCircle2, AlertCircle, 
  PieChart, Building2, Map as MapIcon, Calendar, ArrowUpRight 
} from 'lucide-react';

interface StatisticsViewProps {
  issues: Issue[];
}

export const StatisticsView: React.FC<StatisticsViewProps> = ({ issues }) => {
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

      // District parsing from mock ID (auto-DistrictName-index)
      if (i.id.startsWith('auto-')) {
        const parts = i.id.split('-');
        const district = parts[1];
        byDistrict[district] = (byDistrict[district] || 0) + 1;
      } else {
        byDistrict['Центр'] = (byDistrict['Центр'] || 0) + 1;
      }

      // Org type stats
      if (i.organizationId) {
        const org = MOCK_ORGANIZATIONS.find(o => o.id === i.organizationId);
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
      efficiency: Math.round((resolved / total) * 100)
    };
  }, [issues]);

  const maxCategoryCount = Math.max(...stats.byCategory.map(c => c[1]));
  const maxDistrictCount = Math.max(...stats.byDistrict.map(d => d[1]));

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col animate-in fade-in duration-500 overflow-y-auto custom-scrollbar pb-20">
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
          <div className="bg-white dark:bg-slate-900 px-6 py-4 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-6">
             <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase">Активность</p>
                <div className="flex items-center gap-1 text-green-600">
                  <ArrowUpRight size={14} />
                  <span className="text-sm font-bold">+12%</span>
                </div>
             </div>
             <div className="w-px h-8 bg-slate-100 dark:bg-slate-800"></div>
             <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase">Поддержка</p>
                <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{stats.totalVotes.toLocaleString()}</p>
             </div>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="К исполнению" value={stats.open} icon={<AlertCircle className="text-red-500" />} color="red" percentage={(stats.open / stats.total) * 100} />
          <StatCard title="В процессе" value={stats.inProgress} icon={<TrendingUp className="text-blue-500" />} color="blue" percentage={(stats.inProgress / stats.total) * 100} />
          <StatCard title="Выполнено" value={stats.resolved} icon={<CheckCircle2 className="text-green-500" />} color="green" percentage={(stats.resolved / stats.total) * 100} />
          <StatCard title="KPI Решений" value={`${stats.efficiency}%`} icon={<TrendingUp className="text-indigo-500" />} color="indigo" />
        </div>

        {/* Main Analytics Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Categories & Org Types (Left/Center) */}
          <div className="lg:col-span-2 space-y-8">
            {/* Category Breakdown */}
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
                           className="h-full transition-all duration-1000 ease-out rounded-full"
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

            {/* Organizations & Org Types */}
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
               
               <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
                  <div className="relative z-10">
                    <Calendar className="w-8 h-8 mb-4 opacity-70" />
                    <h4 className="text-xl font-black mb-2">Прогноз решения</h4>
                    <p className="text-sm text-blue-100 mb-6 leading-relaxed">На основе текущей динамики, 85% новых заявок обрабатываются в течение первых 48 часов.</p>
                    <div className="flex items-center gap-3 bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/10">
                       <span className="text-xs font-bold uppercase tracking-wider">Среднее время:</span>
                       <span className="text-lg font-black">1.4 дня</span>
                    </div>
                  </div>
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
               </div>
            </div>
          </div>

          {/* Right Column: Districts & Severity */}
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

             {/* Severity Indicators */}
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
             </div>
          </div>

        </div>

        {/* Civic Engagement Section */}
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
           <button className="px-8 py-4 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition active:scale-95 shrink-0">
              Скачать отчет (PDF)
           </button>
        </div>

        {/* Footer info */}
        <div className="text-center py-4">
           <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-[0.4em]">
              RealHolat Open Data Project • 2025 • By YTech Team
           </p>
        </div>

      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color, percentage }: any) => (
  <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:shadow-md group">
    <div className="flex justify-between items-start mb-4">
      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
      {percentage !== undefined && (
        <span className="text-[10px] font-black text-slate-400 uppercase">{Math.round(percentage)}%</span>
      )}
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
    <p className="text-3xl font-black text-slate-800 dark:text-white tracking-tighter">{value}</p>
    {percentage !== undefined && (
      <div className="mt-4 h-1.5 w-full bg-slate-50 dark:bg-slate-800 rounded-full">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ${color === 'red' ? 'bg-red-500' : color === 'blue' ? 'bg-blue-500' : 'bg-green-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    )}
  </div>
);
