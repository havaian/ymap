// frontend/src/components/promises/TaskCard.tsx
// Replaces PromiseCard. Renamed to TaskCard to match the new Task model.

import React from 'react';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Calendar,
  ThumbsUp, ThumbsDown, Loader2
} from 'lucide-react';
import { Task, TaskStatus, User, UserRole } from '../../../types';

interface TaskCardProps {
  task: Task;
  currentUser: User | null;
  onVote?: (id: string, verdict: 'confirmed' | 'rejected') => Promise<void>;
  onStatusChange?: (id: string, status: TaskStatus) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onEdit?: (task: Task) => void;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; icon: React.ReactNode }> = {
  'Planned':              { label: 'Запланировано', color: 'text-slate-500 bg-slate-100 dark:bg-slate-800 dark:text-slate-400', icon: <Clock size={11} /> },
  'In Progress':          { label: 'Выполняется',   color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400',  icon: <Loader2 size={11} className="animate-spin" /> },
  'Pending Verification': { label: 'На проверке',   color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400', icon: <AlertTriangle size={11} /> },
  'Completed':            { label: 'Выполнено',     color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400', icon: <CheckCircle2 size={11} /> },
  'Failed':               { label: 'Не выполнено',  color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400',  icon: <XCircle size={11} /> },
};

const NEXT_STATUSES: Record<TaskStatus, TaskStatus[]> = {
  'Planned':              ['In Progress', 'Failed'],
  'In Progress':          ['Pending Verification', 'Failed'],
  'Pending Verification': ['Completed', 'Failed', 'In Progress'],
  'Completed':            [],
  'Failed':               ['Planned'],
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task, currentUser, onVote, onStatusChange, onDelete, onEdit
}) => {
  const [voting, setVoting] = React.useState(false);
  const isAdmin  = currentUser?.role === UserRole.ADMIN;
  const userId   = currentUser?.id;

  const cfg            = STATUS_CONFIG[task.status];
  const confirmedCount = task.votes.confirmed.length;
  const rejectedCount  = task.votes.rejected.length;
  const hasVotedConfirm = userId ? task.votes.confirmed.includes(userId) : false;
  const hasVotedReject  = userId ? task.votes.rejected.includes(userId)  : false;

  const handleVote = async (verdict: 'confirmed' | 'rejected') => {
    if (!onVote || voting) return;
    setVoting(true);
    try { await onVote(task.id, verdict); }
    finally { setVoting(false); }
  };

  return (
    <div className="bg-white/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${cfg.color}`}>
            {cfg.icon}{cfg.label}
          </span>
          {task.deadline && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1 flex-shrink-0">
              <Calendar size={10} /> {new Date(task.deadline).toLocaleDateString('ru-RU')}
            </span>
          )}
        </div>
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">{task.title}</p>
        {task.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{task.description}</p>
        )}
      </div>

      {/* Verification counts */}
      {(task.totalCount ?? 0) > 0 && (
        <div className="px-4 pb-2 flex items-center gap-3 text-xs">
          <span className="text-emerald-600 font-black">✓ {task.doneCount ?? 0}</span>
          <span className="text-rose-500 font-black">✗ {task.problemCount ?? 0}</span>
          <span className="text-slate-400">из {task.totalCount ?? 0}</span>
        </div>
      )}

      {/* Voting — only when Pending Verification */}
      {task.status === 'Pending Verification' && onVote && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <button
            onClick={() => handleVote('confirmed')}
            disabled={voting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-colors border ${
              hasVotedConfirm
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-emerald-400 hover:text-emerald-600'
            }`}
          >
            <ThumbsUp size={12} /> {confirmedCount}
          </button>
          <button
            onClick={() => handleVote('rejected')}
            disabled={voting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-colors border ${
              hasVotedReject
                ? 'bg-rose-500 border-rose-500 text-white'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-rose-400 hover:text-rose-500'
            }`}
          >
            <ThumbsDown size={12} /> {rejectedCount}
          </button>
        </div>
      )}

      {/* Admin controls */}
      {isAdmin && (onStatusChange || onDelete || onEdit) && (
        <div className="px-4 pb-3 flex items-center gap-1.5 flex-wrap border-t border-slate-100 dark:border-slate-800 pt-2 mt-1">
          {onStatusChange && NEXT_STATUSES[task.status].map(s => (
            <button
              key={s}
              onClick={() => onStatusChange(task.id, s)}
              className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 transition"
            >
              → {STATUS_CONFIG[s].label}
            </button>
          ))}
          {onEdit && (
            <button
              onClick={() => onEdit(task)}
              className="text-[10px] font-black px-2 py-0.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition ml-auto"
            >
              Изм.
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(task.id)}
              className="text-[10px] font-black px-2 py-0.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
            >
              Удал.
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Backward-compat alias — remove once all imports are updated
export { TaskCard as PromiseCard };