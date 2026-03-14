// frontend/src/components/promises/AllocationSection.tsx
// Budget allocation section for an object or program.
// Displays allocations with their linked tasks; admin can add/edit/delete both.

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, ChevronDown, ChevronRight, Wallet, Loader2 } from 'lucide-react';
import { Task, BudgetAllocation, TaskStatus, User, UserRole } from '../../../types';
import { tasksAPI, allocationsAPI } from '../../services/api';
import { TaskCard } from './TaskCard';
import { AdminTaskModal } from '../admin/AdminTaskModal';
import { AdminAllocationModal } from '../admin/AdminAllocationModal';

interface AllocationSectionProps {
  targetType: 'object' | 'program';
  targetId: string;
  currentUser: User | null;
}

function formatAmount(amount?: number, currency?: string) {
  if (!amount) return null;
  if (currency === 'UZS') return `${(amount / 1_000_000).toFixed(1)} млн UZS`;
  return `$${amount.toLocaleString()} USD`;
}

export const AllocationSection: React.FC<AllocationSectionProps> = ({
  targetType, targetId, currentUser
}) => {
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const [allocations, setAllocations] = useState<BudgetAllocation[]>([]);
  const [tasks,        setTasks]       = useState<Task[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [expanded,     setExpanded]    = useState<Record<string, boolean>>({});

  const [allocationModal, setAllocationModal] = useState<{ open: boolean; editing: BudgetAllocation | null }>({ open: false, editing: null });
  const [taskModal, setTaskModal] = useState<{ open: boolean; editing: Task | null; allocationId: string | null }>({ open: false, editing: null, allocationId: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allocRes, taskRes] = await Promise.all([
        allocationsAPI.getByTarget(targetType, targetId),
        tasksAPI.getByTarget(targetId)
      ]);
      setAllocations(allocRes.data?.data || []);
      setTasks(taskRes.data?.data || []);
    } catch (err) {
      console.error('AllocationSection load error:', err);
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => { load(); }, [load]);

  const handleVote = async (id: string, verdict: 'confirmed' | 'rejected') => {
    const res = await tasksAPI.vote(id, verdict);
    if (res.data?.success) setTasks(prev => prev.map(t => t.id === id ? res.data.data : t));
  };

  const handleStatusChange = async (id: string, status: TaskStatus) => {
    const res = await tasksAPI.updateStatus(id, status);
    if (res.data?.success) setTasks(prev => prev.map(t => t.id === id ? res.data.data : t));
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Удалить задачу?')) return;
    await tasksAPI.delete(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const handleDeleteAllocation = async (id: string) => {
    if (!confirm('Удалить выделение? Связанные задачи останутся, но будут откреплены.')) return;
    await allocationsAPI.delete(id);
    setAllocations(prev => prev.filter(a => a.id !== id));
    setTasks(prev => prev.map(t => t.allocationId === id ? { ...t, allocationId: null } : t));
  };

  const handleSaveAllocation = async (data: Partial<BudgetAllocation>) => {
    if (allocationModal.editing) {
      const res = await allocationsAPI.update(allocationModal.editing.id, data);
      if (res.data?.success) setAllocations(prev => prev.map(a => a.id === allocationModal.editing!.id ? res.data.data : a));
    } else {
      const res = await allocationsAPI.create({ ...data, targetType, targetId });
      if (res.data?.success) setAllocations(prev => [res.data.data, ...prev]);
    }
    setAllocationModal({ open: false, editing: null });
  };

  const handleSaveTask = async (data: Partial<Task>) => {
    if (taskModal.editing) {
      const res = await tasksAPI.update(taskModal.editing.id, data);
      if (res.data?.success) setTasks(prev => prev.map(t => t.id === taskModal.editing!.id ? res.data.data : t));
    } else {
      const res = await tasksAPI.create({
        ...data,
        targetId,
        allocationId: taskModal.allocationId || null
      });
      if (res.data?.success) setTasks(prev => [res.data.data, ...prev]);
    }
    setTaskModal({ open: false, editing: null, allocationId: null });
  };

  const standaloneTasks = tasks.filter(t => !t.allocationId);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs py-2">
        <Loader2 size={12} className="animate-spin" /> Загрузка...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Allocations with their tasks */}
      {allocations.map(alloc => {
        const allocTasks = tasks.filter(t => t.allocationId === alloc.id);
        const isOpen = expanded[alloc.id] ?? true;
        return (
          <div key={alloc.id} className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
            <button
              onClick={() => setExpanded(prev => ({ ...prev, [alloc.id]: !isOpen }))}
              className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {isOpen
                ? <ChevronDown size={13} className="text-slate-400 flex-shrink-0" />
                : <ChevronRight size={13} className="text-slate-400 flex-shrink-0" />
              }
              <Wallet size={13} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate block">
                  {alloc.note || 'Бюджетное выделение'}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {[formatAmount(alloc.amount, alloc.currency), alloc.period].filter(Boolean).join(' · ')}
                  {allocTasks.length > 0 && ` · ${allocTasks.length} задач`}
                </span>
              </div>
              {isAdmin && (
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => setAllocationModal({ open: true, editing: alloc })}
                    className="text-[10px] font-black px-2 py-0.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                  >
                    Изм.
                  </button>
                  <button
                    onClick={() => handleDeleteAllocation(alloc.id)}
                    className="text-[10px] font-black px-2 py-0.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
                  >
                    Удал.
                  </button>
                </div>
              )}
            </button>

            {isOpen && (
              <div className="p-3 space-y-2 bg-white/40 dark:bg-slate-900/30">
                {allocTasks.map(t => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    currentUser={currentUser}
                    onVote={handleVote}
                    onStatusChange={handleStatusChange}
                    onDelete={isAdmin ? handleDeleteTask : undefined}
                    onEdit={isAdmin ? (t) => setTaskModal({ open: true, editing: t, allocationId: alloc.id }) : undefined}
                  />
                ))}
                {allocTasks.length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">Нет задач</p>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setTaskModal({ open: true, editing: null, allocationId: alloc.id })}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400 dark:text-slate-500 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                  >
                    <Plus size={12} /> Добавить задачу
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add allocation */}
      {isAdmin && (
        <button
          onClick={() => setAllocationModal({ open: true, editing: null })}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400 dark:text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
        >
          <Wallet size={12} /> Добавить выделение бюджета
        </button>
      )}

      {/* Standalone tasks (not tied to any allocation) */}
      {standaloneTasks.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
            Прочие задачи
          </p>
          {standaloneTasks.map(t => (
            <TaskCard
              key={t.id}
              task={t}
              currentUser={currentUser}
              onVote={handleVote}
              onStatusChange={handleStatusChange}
              onDelete={isAdmin ? handleDeleteTask : undefined}
              onEdit={isAdmin ? (t) => setTaskModal({ open: true, editing: t, allocationId: null }) : undefined}
            />
          ))}
        </div>
      )}

      {/* Add standalone task */}
      {isAdmin && (
        <button
          onClick={() => setTaskModal({ open: true, editing: null, allocationId: null })}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400 dark:text-slate-500 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
        >
          <Plus size={12} /> Добавить задачу без бюджета
        </button>
      )}

      {!isAdmin && allocations.length === 0 && standaloneTasks.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-3">Нет выделений по данному объекту</p>
      )}

      <AdminAllocationModal
        isOpen={allocationModal.open}
        editing={allocationModal.editing}
        onClose={() => setAllocationModal({ open: false, editing: null })}
        onSave={handleSaveAllocation}
      />
      <AdminTaskModal
        isOpen={taskModal.open}
        editing={taskModal.editing}
        allocationId={taskModal.allocationId}
        onClose={() => setTaskModal({ open: false, editing: null, allocationId: null })}
        onSave={handleSaveTask}
      />
    </div>
  );
};