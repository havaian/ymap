// frontend/src/components/admin/AdminTaskModal.tsx
// Replaces AdminPromiseModal. Renamed to AdminTaskModal.

import React, { useState, useEffect } from "react";
import { X, CheckCircle2, Loader2, ClipboardList } from "lucide-react";
import { Task, TaskStatus } from "../../../types";

interface AdminTaskModalProps {
  isOpen: boolean;
  editing: Task | null;
  allocationId: string | null;
  onClose: () => void;
  onSave: (data: Partial<Task>) => Promise<void>;
}

const STATUSES: TaskStatus[] = [
  "Planned",
  "In Progress",
  "Pending Verification",
  "Completed",
  "Failed",
];
const STATUS_LABELS: Record<TaskStatus, string> = {
  Planned: "Запланировано",
  "In Progress": "Выполняется",
  "Pending Verification": "На проверке",
  Completed: "Выполнено",
  Failed: "Не выполнено",
};

export const AdminTaskModal: React.FC<AdminTaskModalProps> = ({
  isOpen,
  editing,
  allocationId,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [status, setStatus] = useState<TaskStatus>("Planned");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title || "");
      setDescription(editing.description || "");
      setDeadline(
        editing.deadline
          ? new Date(editing.deadline).toISOString().split("T")[0]
          : ""
      );
      setStatus(editing.status || "Planned");
    } else {
      setTitle("");
      setDescription("");
      setDeadline("");
      setStatus("Planned");
    }
  }, [editing, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        deadline: deadline || undefined,
        status,
        allocationId: allocationId || undefined,
      } as Partial<Task>);
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
        <div className="p-5 bg-gradient-to-br from-emerald-600 to-teal-700 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-full transition"
          >
            <X size={16} />
          </button>
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
            <ClipboardList size={20} />
          </div>
          <h2 className="text-lg font-black tracking-tight">
            {editing ? "Изменить задачу" : "Новая задача"}
          </h2>
          {allocationId && !editing && (
            <p className="text-emerald-100 text-[10px] font-bold uppercase tracking-wider mt-0.5">
              Привязано к выделению бюджета
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Название <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Напр. Ремонт туалетов"
              required
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Описание <span className="text-slate-300">(необяз.)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Что именно нужно сделать..."
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Срок
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Статус
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-left transition-all ${
                    status === s
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!title.trim() || saving}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black transition flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Backward-compat alias
export { AdminTaskModal as AdminPromiseModal };
