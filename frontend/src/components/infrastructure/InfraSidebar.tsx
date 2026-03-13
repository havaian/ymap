// frontend/src/components/infrastructure/InfraSidebar.tsx

import React, { useMemo } from 'react';
import { Infrastructure, Issue, Severity, User, UserRole } from '../../../types';
import { AllocationSection } from '../promises/AllocationSection';
import { PromisesSection } from '../promises/PromisesSection';
import {
  Construction, Waves, Building2, MapPin, Calendar,
  Wallet, TrendingUp, Globe, Tag, Hash, ClipboardList,
  Star, ChevronRight, Plus
} from 'lucide-react';
import {
  formatUZS, formatUSD, budgetPercent,
  translateSourceType, translateStatus, statusColor
} from '../../utils/detailFormatters';

interface InfraSidebarProps {
  infra: Infrastructure | null;
  currentUser: User | null;
  onClose: () => void;
  issues: Issue[];
  onIssueClick: (issue: Issue) => void;
  onReportIssue: (infra: Infrastructure) => void;
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
function InfoField({ icon: Icon, label, value }: {
  icon: React.ElementType;
  label: string;
  value?: string | number | null;
}) {
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

function getInfraAccentColor(type: string) {
  if (type === 'Roads') return { bg: 'bg-amber-600', ring: 'ring-amber-500/20' };
  if (type === 'Water & Sewage') return { bg: 'bg-cyan-600', ring: 'ring-cyan-500/20' };
  return { bg: 'bg-blue-600', ring: 'ring-blue-500/20' };
}

function getInfraIconComponent(type: string) {
  if (type === 'Roads') return Construction;
  if (type === 'Water & Sewage') return Waves;
  return Building2;
}

// ─── Main component ───────────────────────────────────────────────────────────
export const InfraSidebar: React.FC<InfraSidebarProps> = ({
  infra, currentUser, onClose, issues, onIssueClick, onReportIssue
}) => {
  if (!infra) return null;

  const isAdmin    = currentUser?.role === UserRole.ADMIN;
  const isOrgAdmin = currentUser?.role === UserRole.ORG_ADMIN;
  const canSeeBudget = isAdmin || isOrgAdmin;

  const hasBudget = !!(
    infra.budget?.committedUZS || infra.budget?.spentUZS ||
    infra.budget?.committedUSD || infra.budget?.spentUSD
  );

  const accent   = getInfraAccentColor(infra.type);
  const TypeIcon = getInfraIconComponent(infra.type);

  const infraIssues = useMemo(() => {
    return issues
      .filter(i => i.infrastructureId === infra.id)
      .sort((a, b) => {
        const w = { [Severity.CRITICAL]: 4, [Severity.HIGH]: 3, [Severity.MEDIUM]: 2, [Severity.LOW]: 1 };
        if (w[a.severity] !== w[b.severity]) return w[b.severity] - w[a.severity];
        return b.votes - a.votes;
      });
  }, [issues, infra.id]);

  const stats = useMemo(() => {
    const total = infraIssues.length;
    const resolved = infraIssues.filter(i => i.status === 'Resolved').length;
    return { total, resolved, active: total - resolved };
  }, [infraIssues]);

  return (
    <div className="h-full flex flex-col">

      {/* ── Header ── */}
      <div className="relative p-6 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm rounded-t-2xl">
        <div className="flex items-start gap-4">
          <div className={`w-14 h-14 ${accent.bg} rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0`}>
            <TypeIcon size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-xl text-slate-800 dark:text-slate-100 leading-tight">{infra.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {infra.status && (
                <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${statusColor(infra.status)}`}>
                  {translateStatus(infra.status)}
                </span>
              )}
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{infra.type}</span>
            </div>
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
            {infra.address && (
              <InfoField icon={MapPin}     label="Адрес"    value={infra.address} />
            )}
            <InfoField icon={Globe}      label="Регион"   value={infra.region?.name} />
            <InfoField icon={Calendar}   label="Год"      value={infra.year} />
            <InfoField icon={Tag}        label="Сектор"   value={infra.sector} />
            <InfoField icon={TrendingUp} label="Источник финансирования" value={translateSourceType(infra.sourceType)} />
            <InfoField icon={Building2}  label="Организация / донор"     value={infra.sourceName} />
            {infra.objectType && (
              <InfoField icon={Hash} label="Тип объекта" value={infra.objectType} />
            )}
          </div>
        </div>

        {/* Budget — admin / org_admin only */}
        {canSeeBudget && hasBudget && (
          <div className="px-6 pt-4 pb-1">
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Wallet size={11} />
              Финансирование
            </div>
            <div className="bg-white/60 dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 p-4 space-y-4">
              <BudgetRow
                label="UZS"
                committed={infra.budget?.committedUZS}
                spent={infra.budget?.spentUZS}
                formatFn={formatUZS}
              />
              <BudgetRow
                label="USD"
                committed={infra.budget?.committedUSD}
                spent={infra.budget?.spentUSD}
                formatFn={formatUSD}
              />
            </div>
          </div>
        )}

        {/* ── Government promises + citizen verification ── */}
        <PromisesSection
          targetType="infrastructure"
          targetId={infra.id}
          currentUser={currentUser}
        />

        {/* Promises & Budget Allocations */}
        <div className="px-6 pt-4 pb-1">
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <ClipboardList size={11} />
            Обещания и выделения
          </div>
          <AllocationSection
            targetType="infrastructure"
            targetId={infra.id}
            currentUser={currentUser}
          />
        </div>

        {/* Issues linked to this infrastructure */}
        <div className="px-6 pt-4 pb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Проблемы объекта
            </h3>
            {stats.total > 0 && (
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-600">
                {stats.resolved}/{stats.total} решено
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {infraIssues.length > 0 ? (
              infraIssues.map(issue => (
                <button
                  key={issue.id}
                  onClick={() => onIssueClick(issue)}
                  className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 hover:border-blue-400 dark:hover:border-blue-500 transition-all flex items-center gap-3 text-left group shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-[9px] font-black uppercase ${
                        issue.status === 'Resolved'
                          ? 'text-green-500'
                          : issue.status === 'In Progress'
                          ? 'text-blue-500'
                          : 'text-red-500'
                      }`}>
                        {issue.status}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">{issue.severity}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{issue.title}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 flex-shrink-0" />
                </button>
              ))
            ) : (
              <div className="py-8 text-center bg-white/60 dark:bg-slate-800/50 rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
                <Star className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-400 dark:text-slate-600">Проблем не зарегистрировано</p>
              </div>
            )}
          </div>

          <button
            onClick={() => onReportIssue(infra)}
            className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black uppercase tracking-wider shadow-lg transition-colors"
          >
            <Plus size={16} />
            Сообщить о проблеме
          </button>
        </div>

      </div>
    </div>
  );
};