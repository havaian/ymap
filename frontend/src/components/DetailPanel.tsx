// frontend/src/components/DetailPanel.tsx

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ArrowLeft } from 'lucide-react';

interface DetailPanelProps {
  children: React.ReactNode;
  type: 'issue' | 'organization';
  isOpen: boolean;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({ children, type, isOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determine the base path from the current URL.
  // /map/issues/123     → /map
  // /list/issues/123   → /list
  // Closing the panel always returns to the current view's root, not browser history.
  // This prevents the "click map → lands on /list" bug when the panel was opened from the list.
  const basePath = location.pathname.startsWith('/list') ? '/list' : '/map';

  // Whether the panel was opened by navigating from the list view.
  // handleSelectFromList passes { state: { from: 'list' } } when navigating to /map.
  const cameFromList = (location.state as any)?.from === 'list';

  const handleClose = () => navigate(basePath);

  const handleBackToList = () => navigate('/list');

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop — clicking it closes the panel and stays on current view */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className={`
        top-16 fixed inset-y-0 right-0 w-full md:w-[500px] lg:w-[600px]
        shadow-2xl z-50 overflow-y-auto
        animate-in slide-in-from-right duration-300
        bg-gradient-to-b
        ${type === 'issue'
          ? 'from-purple-50 via-pink-50 to-slate-50 dark:from-purple-950/20 dark:via-pink-950/20 dark:to-slate-950'
          : 'from-teal-50 via-emerald-50 to-slate-50 dark:from-teal-950/20 dark:via-emerald-950/20 dark:to-slate-950'
        }
      `}>
        {/* Top bar: back-to-list button (left) + close button (right) */}
        <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between">
          {cameFromList ? (
            <button
              onClick={handleBackToList}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-900/10 dark:bg-white/10 hover:bg-slate-900/20 dark:hover:bg-white/20 backdrop-blur-sm text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-wider transition-colors"
              aria-label="Back to list"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              К списку
            </button>
          ) : (
            // Empty placeholder to keep the close button on the right
            <div />
          )}

          <button
            onClick={handleClose}
            className="w-10 h-10 rounded-full bg-slate-900/10 dark:bg-white/10 hover:bg-slate-900/20 dark:hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-colors"
            aria-label="Close panel"
          >
            <X className="w-5 h-5 text-slate-700 dark:text-slate-200" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 pt-16">
          {children}
        </div>
      </div>
    </>
  );
};