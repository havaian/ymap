// frontend/src/components/OrgSidebar.tsx

import React, { useMemo } from 'react';
import { Organization, Issue, Severity, User, UserRole } from '../../../types';
import { CATEGORY_COLORS } from '../../constants';
import {
  Building2, MapPin, CheckCircle2, Star, ChevronRight, Plus,
  Info, Calendar, Wallet, TrendingUp, Globe, Tag, Hash
} from 'lucide-react';
import {
  formatUZS, formatUSD, budgetPercent,
  translateSourceType, translateStatus, statusColor
} from '../../utils/detailFormatters';

interface OrgSidebarProps {
  org: Organization | null;
  issues: Issue[];
  currentUser: User | null;
  onClose: () => void;
  onIssueClick: (issue: Issue) => void;
  onReportIssue: (org: Organization) => void;
}

// ─── Budget row ───────────────────────────────────────────────────────────────
function BudgetRow({ label, committed, spent, formatFn }: {
  label: string;
  committed?: number;
  spent?: number;
  formatFn: (v?: number) => string | null;
}) {
  const committedStr = formatFn(committed);
  const spentStr = formatFn(spent);
  if (!committedStr && !spentStr) return null;
  const pct = budgetPercent(spent, committed);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
        {pct > 0 && (
          <span className="font-black text-slate-600 dark:text-slate-300">{pct}% освоено</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Выделено</div>
          <div className="font-black text-slate-800 dark:text-slate-100 text-sm truncate">{committedStr ?? '—'}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Освоено</div>
          <div className="font-black text-slate-800 dark:text-slate-100 text-sm truncate">{spentStr ?? '—'}</div>
        </div>
      </div>
      {pct > 0 && (
        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              backgroundColor: pct >= 90 ? '#10b981' : pct >= 50 ? '#3b82f6' : '#f59e0b',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Info field ───────────────────────────────────────────────────────────────
function InfoField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100/60 dark:border-slate-800/60 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={13} className="text-slate-500 dark:text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</div>
        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5 leading-snug">{value}</div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const OrgSidebar: React.FC<OrgSidebarProps> = ({
  org, issues, currentUser, onClose, onIssueClick, onReportIssue
}) => {
  if (!org) return null;

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isOrgAdmin = currentUser?.role === UserRole.ORG_ADMIN;
  const canSeeBudget = isAdmin || isOrgAdmin;

  const orgIssues = useMemo(() => {
    return issues
      .filter(i => i.organizationId === org.id)
      .sort((a, b) => {
        const w = { [Severity.CRITICAL]: 4, [Severity.HIGH]: 3, [Severity.MEDIUM]: 2, [Severity.LOW]: 1 };
        if (w[a.severity] !== w[b.severity]) return w[b.severity] - w[a.severity];
        return b.votes - a.votes;
      });
  }, [issues, org.id]);

  const stats = useMemo(() => {
    const total = orgIssues.length;
    const resolved = orgIssues.filter(i => i.status === 'Resolved').length;
    return { total, resolved, active: total - resolved };
  }, [orgIssues]);

  const hasBudget = !!(
    org.budget?.committedUZS || org.budget?.spentUZS ||
    org.budget?.committedUSD || org.budget?.spentUSD
  );

  return (
    <div className="h-full flex flex-col">

      {/* ── Header ── */}
      <div className="relative p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm rounded-t-2xl">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0">
            <Building2 size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-xl text-slate-800 dark:text-slate-100 leading-tight">{org.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {org.status && (
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${statusColor(org.status)}`}>
                  {translateStatus(org.status)}
                </span>
              )}
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{org.type}</span>
            </div>
          </div>
        </div>

        {/* Issue stats */}
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

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* Object info */}
        <div className="px-6 pt-5 pb-1">
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
            Информация об объекте
          </div>
          <div className="bg-white/60 dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 px-4 py-1">
            <InfoField icon={MapPin}     label="Адрес"    value={org.address} />
            <InfoField icon={Globe}      label="Регион"   value={org.region?.name} />
            <InfoField icon={Calendar}   label="Год"      value={org.year} />
            <InfoField icon={Tag}        label="Сектор"   value={org.sector} />
            <InfoField icon={TrendingUp} label="Источник финансирования" value={translateSourceType(org.sourceType)} />
            <InfoField icon={Building2}  label="Организация / донор"     value={org.sourceName} />
            {org.objectType && (
              <InfoField icon={Hash} label="Тип объекта" value={org.objectType} />
            )}
          </div>
        </div>

        {/* Budget — visible to admin and org_admin only */}
        {canSeeBudget && hasBudget && (
          <div className="px-6 pt-4 pb-1">
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Wallet size={11} />
              Финансирование
            </div>
            <div className="bg-white/60 dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-4 space-y-4">
              <BudgetRow
                label="UZS"
                committed={org.budget?.committedUZS}
                spent={org.budget?.spentUZS}
                formatFn={formatUZS}
              />
              <BudgetRow
                label="USD"
                committed={org.budget?.committedUSD}
                spent={org.budget?.spentUSD}
                formatFn={formatUSD}
              />
            </div>
          </div>
        )}

        {/* Issues list */}
        <div className="px-6 pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Проблемы учреждения
            </h3>
            {orgIssues.length > 0 && (
              <div className="flex items-center gap-1 text-slate-400 dark:text-slate-600">
                <Info size={12} />
                <span className="text-[9px] font-bold">По приоритету</span>
              </div>
            )}
          </div>

          <div className="space-y-2.5">
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
                    {issue.category.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[9px] font-black uppercase ${issue.status === 'Resolved' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                        {issue.status}
                      </span>
                      <span className="w-0.5 h-0.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
                      <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase truncate">{issue.severity}</span>
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate leading-tight">{issue.title}</h4>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      <Star size={10} className="text-amber-500 fill-amber-500" />
                      <span>{issue.votes} голосов</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 dark:text-slate-700 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                </button>
              ))
            ) : (
              <div className="text-center py-10 bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-dashed border-slate-200/50 dark:border-slate-800/50">
                <CheckCircle2 className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 dark:text-slate-500 font-bold text-sm">Проблем не зафиксировано</p>
                <p className="text-slate-400 dark:text-slate-600 text-[10px] px-8 mt-1 uppercase tracking-wide">Учреждение работает в штатном режиме</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="p-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-t border-slate-200/50 dark:border-slate-800/50">
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