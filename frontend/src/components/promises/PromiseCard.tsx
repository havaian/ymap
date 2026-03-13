// frontend/src/components/promises/PromiseCard.tsx

import React from 'react';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle,
  Calendar, ThumbsUp, ThumbsDown, Loader2
} from 'lucide-react';
import { CivicPromise, PromiseStatus, User, UserRole } from '../../../types';

interface PromiseCardProps {
  promise: CivicPromise;
  currentUser: User | null;
  onVote?: (id: string, verdict: 'confirmed' | 'rejected') => Promise<void>;
  onStatusChange?: (id: string, status: PromiseStatus) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onEdit?: (promise: CivicPromise) => void;
}

const STATUS_CONFIG: Record<PromiseStatus, { label: string; color: string; icon: React.ReactNode }> = {
  'Planned': {
    label: 'Запланировано',
    color: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400',
    icon: <Clock size={11} />
  },
  'In Progress': {
    label: 'Выполняется',
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <Loader2 size={11} className="animate-spin" />
  },
  'Pending Verification': {
    label: 'На проверке',
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400',
    icon: <AlertTriangle size={11} />
  },
  'Completed': {
    label: 'Выполнено',
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: <CheckCircle2 size={11} />
  },
  'Failed': {
    label: 'Не выполнено',
    color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400',
    icon: <XCircle size={11} />
  }
};

const NEXT_STATUSES: Record<PromiseStatus, PromiseStatus[]> = {
  'Planned':              ['In Progress', 'Failed'],
  'In Progress':          ['Pending Verification', 'Failed'],
  'Pending Verification': ['Completed', 'Failed', 'In Progress'],
  'Completed':            [],
  'Failed':               ['Planned']
};

export const PromiseCard: React.FC<PromiseCardProps> = ({
  promise, currentUser, onVote, onStatusChange, onDelete, onEdit
}) => {
  const [voting, setVoting] = React.useState(false);
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const userId = currentUser?.id;

  const cfg = STATUS_CONFIG[promise.status];
  const confirmedCount = promise.votes.confirmed.length;
  const rejectedCount  = promise.votes.rejected.length;
  const hasVotedConfirm = userId ? promise.votes.confirmed.includes(userId) : false;
  const hasVotedReject  = userId ? promise.votes.rejected.includes(userId)  : false;

  const isOverdue = promise.deadline
    && promise.status !== 'Completed'
    && promise.status !== 'Failed'
    && new Date(promise.deadline) < new Date();

  const handleVote = async (verdict: 'confirmed' | 'rejected') => {
    if (!onVote || voting) return;
    setVoting(true);
    try {
      await onVote(promise.id, verdict);
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">{promise.title}</p>
          {promise.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{promise.description}</p>
          )}
        </div>
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex-shrink-0 ${cfg.color}`}>
          {cfg.icon}
          {cfg.label}
        </span>
      </div>

      {/* Deadline */}
      {promise.deadline && (
        <div className={`flex items-center gap-1.5 text-[11px] font-bold ${isOverdue ? 'text-rose-500' : 'text-slate-400 dark:text-slate-500'}`}>
          <Calendar size={11} />
          {isOverdue ? 'Просрочено · ' : 'Срок: '}
          {new Date(promise.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      )}

      {/* Citizen voting — only visible in Pending Verification */}
      {promise.status === 'Pending Verification' && currentUser && (
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => handleVote('confirmed')}
            disabled={voting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border
              ${hasVotedConfirm
                ? 'bg-emerald-500 text-white border-emerald-500'
                : 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'}
            `}
          >
            <ThumbsUp size={12} />
            {confirmedCount > 0 && <span>{confirmedCount}</span>}
            Сделано
          </button>
          <button
            onClick={() => handleVote('rejected')}
            disabled={voting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border
              ${hasVotedReject
                ? 'bg-rose-500 text-white border-rose-500'
                : 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-900/20'}
            `}
          >
            <ThumbsDown size={12} />
            {rejectedCount > 0 && <span>{rejectedCount}</span>}
            Проблема
          </button>
        </div>
      )}

      {/* Vote tally — visible outside voting stage too */}
      {(promise.status === 'Completed' || promise.status === 'Failed') &&
        (confirmedCount > 0 || rejectedCount > 0) && (
        <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500 pt-0.5">
          <span className="flex items-center gap-1">
            <ThumbsUp size={10} className="text-emerald-500" />
            {confirmedCount} подтвердили
          </span>
          <span className="flex items-center gap-1">
            <ThumbsDown size={10} className="text-rose-500" />
            {rejectedCount} отклонили
          </span>
        </div>
      )}

      {/* Admin controls */}
      {isAdmin && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800">
          {NEXT_STATUSES[promise.status].map(next => (
            <button
              key={next}
              onClick={() => onStatusChange?.(promise.id, next)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              → {STATUS_CONFIG[next].label}
            </button>
          ))}
          <div className="flex-1" />
          {onEdit && (
            <button
              onClick={() => onEdit(promise)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
            >
              Изменить
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(promise.id)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
            >
              Удалить
            </button>
          )}
        </div>
      )}
    </div>
  );
};