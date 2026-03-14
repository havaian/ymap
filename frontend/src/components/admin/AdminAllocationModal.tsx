// frontend/src/components/admin/AdminAllocationModal.tsx

import React, { useState, useEffect } from "react";
import { X, Wallet, CheckCircle2, Loader2 } from "lucide-react";
import { BudgetAllocation } from "../../../types";

interface AdminAllocationModalProps {
  isOpen: boolean;
  editing: BudgetAllocation | null;
  onClose: () => void;
  onSave: (data: Partial<BudgetAllocation>) => Promise<void>;
}

export const AdminAllocationModal: React.FC<AdminAllocationModalProps> = ({
  isOpen,
  editing,
  onClose,
  onSave,
}) => {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"UZS" | "USD">("UZS");
  const [period, setPeriod] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setAmount(editing.amount ? String(editing.amount) : "");
      setCurrency(editing.currency || "UZS");
      setPeriod(editing.period || "");
      setNote(editing.note || "");
    } else {
      setAmount("");
      setCurrency("UZS");
      setPeriod("");
      setNote("");
    }
  }, [editing, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        amount: amount ? Number(amount) : undefined,
        currency,
        period: period || undefined,
        note: note || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden relative z-10 border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 bg-gradient-to-br from-indigo-600 to-blue-700 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-full transition"
          >
            <X size={16} />
          </button>
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
            <Wallet size={20} />
          </div>
          <h2 className="text-lg font-black tracking-tight">
            {editing ? "Изменить выделение" : "Новое выделение бюджета"}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Описание / цель <span className="text-slate-300">(необяз.)</span>
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Напр. Ремонт санузлов, кровли..."
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Сумма
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                min={0}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Валюта
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as "UZS" | "USD")}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              >
                <option value="UZS">UZS</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Период <span className="text-slate-300">(необяз.)</span>
            </label>
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="Напр. Q1 2025, 2024..."
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-3 rounded-xl font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-2 disabled:opacity-50 transition hover:opacity-90"
          >
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            {editing ? "Сохранить" : "Создать"}
          </button>
        </form>
      </div>
    </div>
  );
};
