// frontend/src/components/InfraSidebar.tsx

import React from 'react';
import { Infrastructure, User, UserRole } from '../../../types';
import {
  Construction, Waves, Building2, MapPin, Calendar,
  Wallet, TrendingUp, Globe, Tag, Hash
} from 'lucide-react';
import {
  formatUZS, formatUSD, budgetPercent,
  translateSourceType, translateStatus, statusColor
} from '../../utils/detailFormatters';

interface InfraSidebarProps {
  infra: Infrastructure | null;
  currentUser: User | null;
  onClose: () => void;
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

function getInfraIcon(type: string) {
  if (type === 'Roads') return Construction;
  if (type === 'Water & Sewage') return Waves;
  return Building2;
}

// ─── Main component ───────────────────────────────────────────────────────────
export const InfraSidebar: React.FC<InfraSidebarProps> = ({ infra, currentUser, onClose }) => {
  if (!infra) return null;

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isOrgAdmin = currentUser?.role === UserRole.ORG_ADMIN;
  const canSeeBudget = isAdmin || isOrgAdmin;

  const hasBudget = !!(
    infra.budget?.committedUZS || infra.budget?.spentUZS ||
    infra.budget?.committedUSD || infra.budget?.spentUSD
  );

  const accent = getInfraAccentColor(infra.type);
  const TypeIcon = getInfraIcon(infra.type);

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

        {/* No-issues note — infra objects don't have citizen issues attached */}
        <div className="px-6 pt-4 pb-6">
          <div className="text-center py-8 bg-white/60 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200/50 dark:border-slate-700/50">
            <TypeIcon size={32} className="text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 dark:text-slate-500 font-bold text-sm">Обращения не привязаны</p>
            <p className="text-slate-400 dark:text-slate-600 text-[10px] px-8 mt-1 uppercase tracking-wide">
              Объект инфраструктурного реестра
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};