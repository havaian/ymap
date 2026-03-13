// frontend/src/components/OrgSidebar.tsx

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Organization, Issue, Severity, User, UserRole } from '../../../types';
import { CATEGORY_COLORS } from '../../constants';
import { promisesAPI } from '../../services/api';
import {
  Building2, MapPin, CheckCircle2, Star, ChevronRight, Plus,
  Info, Calendar, Wallet, TrendingUp, Globe, Tag, Hash,
  ClipboardCheck, Camera, X, ThumbsUp, ThumbsDown, Loader2,
  ChevronDown, ChevronUp, ImageIcon
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

// ─── Promise verification form (inline, per promise) ─────────────────────────
function VerifyForm({ promiseId, onDone }: { promiseId: string; onDone: () => void }) {
  const [status, setStatus] = useState<'done' | 'problem' | null>(null);
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    } else {
      setPhotoPreview(null);
    }
  };

  // Revoke object URL on unmount / change
  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); };
  }, [photoPreview]);

  const handleSubmit = async () => {
    if (!status) return;
    setSubmitting(true);
    setError(null);
    try {
      let photoUrl: string | undefined;
      if (photo) {
        const uploadRes = await promisesAPI.uploadPhoto(photo);
        photoUrl = uploadRes.data?.data?.photoUrl;
      }
      await promisesAPI.verify(promiseId, { status, comment: comment.trim() || undefined, photoUrl });
      onDone();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка отправки. Попробуйте снова.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">

      {/* Done / Problem toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setStatus('done')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-colors ${
            status === 'done'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-400'
          }`}
        >
          <ThumbsUp size={15} />
          Выполнено
        </button>
        <button
          onClick={() => setStatus('problem')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-colors ${
            status === 'problem'
              ? 'bg-red-500 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-red-400'
          }`}
        >
          <ThumbsDown size={15} />
          Проблема
        </button>
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Комментарий (необязательно)..."
        rows={2}
        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Photo upload */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoSelect}
          className="hidden"
        />
        {photoPreview ? (
          <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
            <button
              onClick={() => { setPhoto(null); setPhotoPreview(null); }}
              className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:border-blue-400 hover:text-blue-500 text-xs font-bold transition-colors"
          >
            <Camera size={14} />
            Прикрепить фото
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs font-bold text-red-500">{error}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!status || submitting}
        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
        {submitting ? 'Отправка...' : 'Отправить проверку'}
      </button>
    </div>
  );
}

// ─── Single promise card ──────────────────────────────────────────────────────
function PromiseCard({
  promise,
  currentUser,
  onVerified
}: {
  promise: any;
  currentUser: User | null;
  onVerified: () => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const total = promise.totalCount ?? 0;
  const done = promise.doneCount ?? 0;
  const problem = promise.problemCount ?? 0;
  // Verification ratio: green ≥70% done, yellow mixed, red ≥50% problem
  const statusColor =
    total === 0 ? 'bg-slate-300 dark:bg-slate-600' :
    done / total >= 0.7 ? 'bg-emerald-500' :
    problem / total >= 0.5 ? 'bg-red-500' :
    'bg-amber-400';

  const handleVerifyDone = () => {
    setVerifying(false);
    onVerified();
  };

  return (
    <div className="bg-white/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
      {/* Card header */}
      <div className="flex items-start gap-3 p-3.5">
        {/* Status dot */}
        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${statusColor}`} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-800 dark:text-slate-100 leading-snug">{promise.title}</p>
          {promise.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{promise.description}</p>
          )}

          {/* Counts */}
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <ThumbsUp size={11} /> {done} выполнено
            </span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-red-500 dark:text-red-400">
              <ThumbsDown size={11} /> {problem} проблем
            </span>
            {total > 0 && (
              <span className="text-[11px] font-bold text-slate-400">{total} проверок</span>
            )}
          </div>
        </div>

        {/* Expand verifications toggle */}
        {total > 0 && (
          <button
            onClick={() => setExpanded(p => !p)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        )}
      </div>

      {/* Recent verifications (collapsed by default) */}
      {expanded && promise.verifications?.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-3.5 py-2 space-y-2">
          {promise.verifications.slice(-5).reverse().map((v: any) => (
            <div key={v._id} className="flex items-start gap-2 text-xs">
              <span className={`mt-0.5 flex-shrink-0 font-black ${v.status === 'done' ? 'text-emerald-500' : 'text-red-500'}`}>
                {v.status === 'done' ? '✓' : '✗'}
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-slate-700 dark:text-slate-300">{v.userName}</span>
                {v.comment && <p className="text-slate-500 dark:text-slate-400 mt-0.5">{v.comment}</p>}
                {v.photoUrl && (
                  <a
                    href={`/api/uploads/${v.photoUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-500 hover:underline mt-0.5"
                  >
                    <ImageIcon size={10} /> Фото
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Verify button / inline form */}
      {currentUser && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-3.5 pb-3.5">
          {verifying ? (
            <VerifyForm promiseId={promise.id} onDone={handleVerifyDone} />
          ) : (
            <button
              onClick={() => setVerifying(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-sm font-black transition-colors border border-blue-200 dark:border-blue-800"
            >
              <ClipboardCheck size={15} />
              Проверить выполнение
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Promises section (fetches own data) ─────────────────────────────────────
function PromisesSection({ org, currentUser }: { org: Organization; currentUser: User | null }) {
  const [promises, setPromises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [adding, setAdding] = useState(false);

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const fetchPromises = async () => {
    try {
      setLoading(true);
      const res = await promisesAPI.getByOrg(org.id);
      setPromises(res.data?.data ?? []);
    } catch {
      // Non-critical — section just stays empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromises();
  }, [org.id]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      await promisesAPI.create({
        organizationId: org.id,
        title: newTitle.trim(),
        description: newDesc.trim() || undefined
      });
      setNewTitle('');
      setNewDesc('');
      setShowAddForm(false);
      await fetchPromises();
    } catch {
      // TODO: surface error
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="px-6 pt-4 pb-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <ClipboardCheck size={11} className="text-slate-400 dark:text-slate-500" />
          <h3 className="font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Обещания властей
          </h3>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddForm(p => !p)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-black transition-colors"
          >
            <Plus size={11} />
            Добавить
          </button>
        )}
      </div>

      {/* Admin: add promise form */}
      {isAdmin && showAddForm && (
        <div className="mb-3 bg-white/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-3.5 space-y-2">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Что было обещано..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Подробности (необязательно)..."
            rows={2}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim() || adding}
              className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
            >
              {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Сохранить
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-black transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : promises.length === 0 ? (
        <div className="py-5 text-center text-slate-400 dark:text-slate-600 text-xs font-bold">
          {isAdmin ? 'Нет обещаний. Нажмите «Добавить».' : 'Обещаний пока нет.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {promises.map(p => (
            <PromiseCard
              key={p.id}
              promise={p}
              currentUser={currentUser}
              onVerified={fetchPromises}
            />
          ))}
        </div>
      )}
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

        {/* ── Government promises + citizen verification ── */}
        <PromisesSection org={org} currentUser={currentUser} />

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
                      <span className={`text-[9px] font-black uppercase ${issue.status === 'Resolved' ? 'text-green-500' : issue.status === 'In Progress' ? 'text-blue-500' : 'text-red-500'}`}>
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
              <div className="py-8 text-center">
                <Star className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-400 dark:text-slate-600">Проблем не зарегистрировано</p>
              </div>
            )}
          </div>

          {/* Report issue button */}
          <button
            onClick={() => onReportIssue(org)}
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