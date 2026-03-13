// frontend/src/components/promises/AllocationSection.tsx

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, ChevronDown, ChevronRight, Wallet, Loader2 } from 'lucide-react';
import { CivicPromise, BudgetAllocation, PromiseStatus, User, UserRole } from '../../../types';
import { promisesAPI, allocationsAPI } from '../../services/api';
import { PromiseCard } from './PromiseCard';
import { AdminPromiseModal } from '../admin/AdminPromiseModal';
import { AdminAllocationModal } from '../admin/AdminAllocationModal';

interface AllocationSectionProps {
  targetType: 'organization' | 'infrastructure';
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

  const [allocations, setAllocations]   = useState<BudgetAllocation[]>([]);
  const [promises, setPromises]         = useState<CivicPromise[]>([]);
  const [loading, setLoading]           = useState(true);
  const [expanded, setExpanded]         = useState<Record<string, boolean>>({});

  // Modal state
  const [allocationModal, setAllocationModal] = useState<{ open: boolean; editing: BudgetAllocation | null }>({ open: false, editing: null });
  const [promiseModal, setPromiseModal]       = useState<{ open: boolean; editing: CivicPromise | null; allocationId: string | null }>({ open: false, editing: null, allocationId: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allocRes, promRes] = await Promise.all([
        allocationsAPI.getByTarget(targetType, targetId),
        promisesAPI.getByTarget(targetType, targetId)
      ]);
      setAllocations(allocRes.data?.data || []);
      setPromises(promRes.data?.data || []);
    } catch (err) {
      console.error('AllocationSection load error:', err);
    } finally {
      setLoading(false);
    }
  }, [targetType, targetId]);

  useEffect(() => { load(); }, [load]);

  const handleVote = async (id: string, verdict: 'confirmed' | 'rejected') => {
    const res = await promisesAPI.vote(id, verdict);
    if (res.data?.success) {
      setPromises(prev => prev.map(p => p.id === id ? res.data.data : p));
    }
  };

  const handleStatusChange = async (id: string, status: PromiseStatus) => {
    const res = await promisesAPI.updateStatus(id, status);
    if (res.data?.success) {
      setPromises(prev => prev.map(p => p.id === id ? res.data.data : p));
    }
  };

  const handleDeletePromise = async (id: string) => {
    if (!confirm('Удалить обещание?')) return;
    await promisesAPI.delete(id);
    setPromises(prev => prev.filter(p => p.id !== id));
  };

  const handleDeleteAllocation = async (id: string) => {
    if (!confirm('Удалить выделение бюджета? Связанные обещания останутся, но будут откреплены.')) return;
    await allocationsAPI.delete(id);
    setAllocations(prev => prev.filter(a => a.id !== id));
    // Detach orphaned promises client-side
    setPromises(prev => prev.map(p => p.allocationId === id ? { ...p, allocationId: null } : p));
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

  const handleSavePromise = async (data: Partial<CivicPromise>) => {
    if (promiseModal.editing) {
      const res = await promisesAPI.update(promiseModal.editing.id, data);
      if (res.data?.success) setPromises(prev => prev.map(p => p.id === promiseModal.editing!.id ? res.data.data : p));
    } else {
      const res = await promisesAPI.create({
        ...data,
        targetType,
        targetId,
        allocationId: promiseModal.allocationId || null
      });
      if (res.data?.success) setPromises(prev => [res.data.data, ...prev]);
    }
    setPromiseModal({ open: false, editing: null, allocationId: null });
  };

  // Standalone promises — not tied to any allocation
  const standalonePromises = promises.filter(p => !p.allocationId);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs py-2">
        <Loader2 size={12} className="animate-spin" />
        Загрузка обещаний...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Allocations ── */}
      {allocations.map(alloc => {
        const allocPromises = promises.filter(p => p.allocationId === alloc.id);
        const isOpen = expanded[alloc.id] ?? true;

        return (
          <div key={alloc.id} className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
            {/* Allocation header */}
            <button
              onClick={() => setExpanded(prev => ({ ...prev, [alloc.id]: !isOpen }))}
              className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50 text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              {isOpen ? <ChevronDown size={13} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={13} className="text-slate-400 flex-shrink-0" />}
              <Wallet size={13} className="text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate block">
                  {alloc.note || 'Бюджетное выделение'}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {[formatAmount(alloc.amount, alloc.currency), alloc.period].filter(Boolean).join(' · ')}
                  {allocPromises.length > 0 && ` · ${allocPromises.length} обещ.`}
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

            {/* Promises under this allocation */}
            {isOpen && (
              <div className="p-3 space-y-2 bg-white/40 dark:bg-slate-900/30">
                {allocPromises.map(p => (
                  <PromiseCard
                    key={p.id}
                    promise={p}
                    currentUser={currentUser}
                    onVote={handleVote}
                    onStatusChange={handleStatusChange}
                    onDelete={isAdmin ? handleDeletePromise : undefined}
                    onEdit={isAdmin ? (p) => setPromiseModal({ open: true, editing: p, allocationId: alloc.id }) : undefined}
                  />
                ))}
                {allocPromises.length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">Нет обещаний</p>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setPromiseModal({ open: true, editing: null, allocationId: alloc.id })}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400 dark:text-slate-500 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                  >
                    <Plus size={12} />
                    Добавить обещание
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Add allocation button ── */}
      {isAdmin && (
        <button
          onClick={() => setAllocationModal({ open: true, editing: null })}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400 dark:text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
        >
          <Wallet size={12} />
          Добавить выделение бюджета
        </button>
      )}

      {/* ── Standalone promises (not tied to any allocation) ── */}
      {standalonePromises.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">
            Прочие обещания
          </p>
          {standalonePromises.map(p => (
            <PromiseCard
              key={p.id}
              promise={p}
              currentUser={currentUser}
              onVote={handleVote}
              onStatusChange={handleStatusChange}
              onDelete={isAdmin ? handleDeletePromise : undefined}
              onEdit={isAdmin ? (p) => setPromiseModal({ open: true, editing: p, allocationId: null }) : undefined}
            />
          ))}
        </div>
      )}

      {/* Add standalone promise */}
      {isAdmin && (
        <button
          onClick={() => setPromiseModal({ open: true, editing: null, allocationId: null })}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-400 dark:text-slate-500 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
        >
          <Plus size={12} />
          Добавить обещание без бюджета
        </button>
      )}

      {/* Empty state for non-admins */}
      {!isAdmin && allocations.length === 0 && standalonePromises.length === 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-3">Нет обещаний по данному объекту</p>
      )}

      {/* Modals */}
      <AdminAllocationModal
        isOpen={allocationModal.open}
        editing={allocationModal.editing}
        onClose={() => setAllocationModal({ open: false, editing: null })}
        onSave={handleSaveAllocation}
      />
      <AdminPromiseModal
        isOpen={promiseModal.open}
        editing={promiseModal.editing}
        allocationId={promiseModal.allocationId}
        onClose={() => setPromiseModal({ open: false, editing: null, allocationId: null })}
        onSave={handleSavePromise}
      />
    </div>
  );
};