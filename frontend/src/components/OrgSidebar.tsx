// frontend/src/components/OrgSidebar.tsx

import React, { useMemo } from 'react';
import { Organization, Issue, Severity } from '../../types';
import { CATEGORY_COLORS } from '../constants';
import { Building2, MapPin, CheckCircle2, Star, ChevronRight, Plus, Info } from 'lucide-react';

interface OrgSidebarProps {
  org: Organization | null;
  issues: Issue[];
  onClose: () => void;
  onIssueClick: (issue: Issue) => void;
  onReportIssue: (org: Organization) => void;
}

export const OrgSidebar: React.FC<OrgSidebarProps> = ({ org, issues, onClose, onIssueClick, onReportIssue }) => {
  if (!org) return null;

  const orgIssues = useMemo(() => {
    return issues
      .filter(i => i.organizationId === org.id)
      .sort((a, b) => {
        const severityWeight = { [Severity.CRITICAL]: 4, [Severity.HIGH]: 3, [Severity.MEDIUM]: 2, [Severity.LOW]: 1 };
        if (severityWeight[a.severity] !== severityWeight[b.severity]) {
          return severityWeight[b.severity] - severityWeight[a.severity];
        }
        return b.votes - a.votes;
      });
  }, [issues, org.id]);

  const stats = useMemo(() => {
    const total = orgIssues.length;
    const resolved = orgIssues.filter(i => i.status === 'Resolved').length;
    const active = total - resolved;
    return { total, resolved, active };
  }, [orgIssues]);

  return (
    <div className="h-full flex flex-col">
      
      {/* Header */}
      <div className="relative p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm transition-colors rounded-t-2xl">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
            <Building2 size={28} />
          </div>
          <div>
            <h2 className="font-black text-xl text-slate-800 dark:text-slate-100 leading-tight">{org.name}</h2>
            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 mt-1">
              <MapPin size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{org.address}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm p-2 rounded-xl border border-slate-200/50 dark:border-slate-700/50 flex flex-col items-center">
            <span className="text-lg font-black text-slate-700 dark:text-slate-200 leading-none">{stats.total}</span>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-1">Всего</span>
          </div>
          <div className="bg-red-50/80 dark:bg-red-950/30 backdrop-blur-sm p-2 rounded-xl border border-red-200/50 dark:border-red-900/40 flex flex-col items-center">
            <span className="text-lg font-black text-red-600 dark:text-red-400 leading-none">{stats.active}</span>
            <span className="text-[9px] font-bold text-red-400 dark:text-red-500 uppercase mt-1">Активных</span>
          </div>
          <div className="bg-green-50/80 dark:bg-green-950/30 backdrop-blur-sm p-2 rounded-xl border border-green-200/50 dark:border-green-900/40 flex flex-col items-center">
            <span className="text-lg font-black text-green-600 dark:text-green-400 leading-none">{stats.resolved}</span>
            <span className="text-[9px] font-bold text-green-400 dark:text-green-500 uppercase mt-1">Решено</span>
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="flex items-center justify-between mb-4 px-2">
            <h3 className="font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">Проблемы учреждения</h3>
            {orgIssues.length > 0 && (
                <div className="flex items-center gap-1 text-slate-400 dark:text-slate-600">
                    <Info size={12} />
                    <span className="text-[9px] font-bold">Приоритет: Автоматически</span>
                </div>
            )}
        </div>

        <div className="space-y-3">
          {orgIssues.length > 0 ? (
            orgIssues.map(issue => (
              <button
                key={issue.id}
                onClick={() => onIssueClick(issue)}
                className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 hover:border-blue-400 dark:hover:border-blue-500 transition-all flex items-center gap-3 text-left group shadow-sm"
              >
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                  style={{ backgroundColor: CATEGORY_COLORS[issue.category] }}
                >
                  {issue.category.substring(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[9px] font-black uppercase ${
                      issue.status === 'Resolved' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                    }`}>
                      {issue.status}
                    </span>
                    <span className="w-0.5 h-0.5 bg-slate-300 dark:bg-slate-700 rounded-full"></span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate">{issue.severity}</span>
                  </div>
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate leading-tight">{issue.title}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    <Star size={10} className="text-amber-500 fill-amber-500" />
                    <span>{issue.votes} голосов</span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-slate-300 dark:text-slate-700 group-hover:text-blue-500 transition-colors" />
              </button>
            ))
          ) : (
            <div className="text-center py-12 bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200/50 dark:border-slate-800/50">
              <CheckCircle2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 dark:text-slate-500 font-bold text-sm">Проблем не зафиксировано</p>
              <p className="text-slate-400 dark:text-slate-600 text-[10px] px-8 mt-1 uppercase tracking-wide">Учреждение работает в штатном режиме</p>
            </div>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-t border-slate-200/50 dark:border-slate-800/50 transition-colors">
        <button 
          onClick={() => onReportIssue(org)}
          className="w-full bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95"
        >
          <Plus size={20} />
          Сообщить о проблеме
        </button>
      </div>
    </div>
  );
};