
import React, { useState, useMemo } from 'react';
import { Issue, IssueCategory, Severity } from '../types';
import { CATEGORY_COLORS } from '../constants';
import { Search, ChevronRight, Star, Building2 } from 'lucide-react';

interface ListViewProps {
  issues: Issue[];
  onSelectIssue: (issue: Issue) => void;
}

export const ListView: React.FC<ListViewProps> = ({ issues, onSelectIssue }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Open' | 'In Progress' | 'Resolved'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<IssueCategory | 'ALL'>('ALL');

  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      const matchesSearch = issue.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (issue.organizationName?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
      const matchesStatus = statusFilter === 'ALL' || issue.status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || issue.category === categoryFilter;
      
      return matchesSearch && matchesStatus && matchesCategory;
    }).sort((a, b) => b.votes - a.votes);
  }, [issues, searchTerm, statusFilter, categoryFilter]);

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col animate-in fade-in duration-300 overflow-hidden">
      <div className="flex-shrink-0 p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Поиск по названию или учреждению..."
              className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 outline-none transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {(['ALL', 'Open', 'In Progress', 'Resolved'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition
                    ${statusFilter === status ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}
                  `}
                >
                  {status === 'ALL' ? 'Все' : status === 'Open' ? 'Новые' : status === 'In Progress' ? 'В работе' : 'Решено'}
                </button>
              ))}
            </div>

            <select 
              className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
            >
              <option value="ALL">Все категории</option>
              {Object.values(IssueCategory).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-3 pb-12">
          {filteredIssues.length > 0 ? (
            filteredIssues.map(issue => (
              <button
                key={issue.id}
                onClick={() => onSelectIssue(issue)}
                className="w-full bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all flex items-center gap-4 text-left group"
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-sm"
                  style={{ backgroundColor: CATEGORY_COLORS[issue.category] }}
                >
                  <Building2 size={24} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{issue.category}</span>
                    <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full"></span>
                    <span className={`text-[10px] font-bold uppercase ${
                      issue.status === 'Resolved' ? 'text-green-600' : 
                      issue.status === 'In Progress' ? 'text-blue-600' : 'text-red-500'
                    }`}>
                      {issue.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate leading-tight mb-1">{issue.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1 font-medium">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span>Поддержали: {issue.votes}</span>
                    </div>
                    {issue.organizationName && (
                      <div className="flex items-center gap-1 truncate max-w-[200px]">
                        <Building2 className="w-3 h-3" />
                        <span className="truncate">{issue.organizationName}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-tight
                    ${issue.severity === Severity.CRITICAL ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 
                      issue.severity === Severity.HIGH ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}
                  `}>
                    {issue.severity}
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 transition-colors" />
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
              <Search className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
              <h3 className="text-slate-800 dark:text-slate-100 font-bold">Ничего не найдено</h3>
              <p className="text-slate-400 dark:text-slate-500 text-sm">Попробуйте изменить параметры фильтрации</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
