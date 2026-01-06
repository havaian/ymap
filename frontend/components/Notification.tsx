
import React, { useEffect } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface NotificationContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

export const NotificationContainer: React.FC<NotificationContainerProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-20 right-6 z-[2000] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <div className="pointer-events-auto flex items-center gap-3 bg-white dark:bg-slate-800 px-4 py-3 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 animate-in slide-in-from-right-full duration-300 min-w-[300px] transition-colors duration-300">
      {toast.type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 text-green-500" />
      ) : (
        <XCircle className="w-5 h-5 text-red-500" />
      )}
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{toast.message}</p>
    </div>
  );
};
