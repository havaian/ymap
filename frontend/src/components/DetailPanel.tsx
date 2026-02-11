import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';

interface DetailPanelProps {
  children: React.ReactNode;
  type: 'issue' | 'organization';
  isOpen: boolean;
}

export const DetailPanel: React.FC<DetailPanelProps> = ({ children, type, isOpen }) => {
  const navigate = useNavigate();

  const handleClose = () => {
    navigate(-1);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Panel with gradient */}
      <div className={`
        top-16 fixed inset-y-0 right-0 w-full md:w-[500px] lg:w-[600px] 
        shadow-2xl z-50 overflow-y-auto
        animate-in slide-in-from-right duration-300
        ${type === 'issue' 
          ? 'bg-gradient-to-b from-purple-50 via-pink-50 to-slate-50 dark:bg-gradient-to-b dark:from-purple-950/20 dark:via-pink-950/20 dark:to-slate-950' 
          : 'bg-gradient-to-b from-teal-50 via-emerald-50 to-slate-50 dark:bg-gradient-to-b dark:from-teal-950/20 dark:via-emerald-950/20 dark:to-slate-950'
        }
      `}>
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-slate-900/10 dark:bg-white/10 hover:bg-slate-900/20 dark:hover:bg-white/20 backdrop-blur-sm flex items-center justify-center transition-colors"
          aria-label="Close panel"
        >
          <X className="w-5 h-5 text-slate-700 dark:text-slate-200" />
        </button>

        {/* Content */}
        <div className="p-6 pt-16">
          {children}
        </div>
      </div>
    </>
  );
};