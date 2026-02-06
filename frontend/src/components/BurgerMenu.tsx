
import React from 'react';
import { Map, List, BarChart3, Info, X, LogOut, Settings, Sun, Moon, Monitor, Type, ShieldCheck, User as UserIcon, Users } from 'lucide-react';
import { User, UserRole } from '../../types';

interface BurgerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeView: 'MAP' | 'LIST' | 'STATISTICS' | 'USERS';
  onSelectView: (view: 'MAP' | 'LIST' | 'STATISTICS' | 'USERS') => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  fontSize: 'small' | 'medium' | 'large';
  setFontSize: (size: 'small' | 'medium' | 'large') => void;
  onOpenAbout: () => void;
  currentUser: User | null;
  onLogout: () => void;
}

export const BurgerMenu: React.FC<BurgerMenuProps> = ({ 
  isOpen, onClose, activeView, onSelectView,
  theme, setTheme, fontSize, setFontSize, onOpenAbout,
  currentUser, onLogout
}) => {
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[1001] transition-opacity duration-300 
          ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className={`fixed top-0 left-0 h-full w-80 bg-white dark:bg-slate-900 z-[1002] shadow-2xl transform transition-transform duration-300 ease-out flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 transition-colors duration-300">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg text-white shadow-md shadow-blue-500/20">
                <Map className="w-5 h-5" />
              </div>
              <span className="font-black text-xl tracking-tight text-slate-800 dark:text-white">Y.Map</span>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition text-slate-500 dark:text-slate-400">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-lg
              ${currentUser?.role === UserRole.ADMIN ? 'bg-indigo-600' : 'bg-blue-500'}`}
            >
              {currentUser?.role === UserRole.ADMIN ? <ShieldCheck size={24} /> : <UserIcon size={24} />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <p className="text-sm font-black text-slate-800 dark:text-white leading-tight truncate">{currentUser?.name || 'Гость'}</p>
                {currentUser?.role === UserRole.ADMIN && (
                   <span className="bg-red-500 text-white text-[7px] font-black px-1 rounded uppercase tracking-tighter">Admin</span>
                )}
              </div>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">{currentUser?.district || 'Ташкент, Узбекистан'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          <p className="px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 mt-4">Навигация</p>
          <button 
            onClick={() => onSelectView('MAP')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition font-bold text-sm
              ${activeView === 'MAP' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}
            `}
          >
            <Map className="w-5 h-5" />
            Интерактивная карта
          </button>
          <button 
            onClick={() => onSelectView('LIST')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition font-bold text-sm
              ${activeView === 'LIST' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}
            `}
          >
            <List className="w-5 h-5" />
            Список обращений
          </button>
          <button 
            onClick={() => onSelectView('STATISTICS')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition font-bold text-sm
              ${activeView === 'STATISTICS' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}
            `}
          >
            <BarChart3 className="w-5 h-5" />
            Статистика ГЧП
          </button>

          {isAdmin && (
            <>
              <div className="my-4 border-t border-slate-100 dark:border-slate-800 mx-4"></div>
              <p className="px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Админ-панель</p>
              <button 
                onClick={() => onSelectView('USERS')}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition font-bold text-sm
                  ${activeView === 'USERS' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-800'}
                `}
              >
                <Users className="w-5 h-5" />
                Пользователи
              </button>
            </>
          )}
          
          <div className="my-6 border-t border-slate-100 dark:border-slate-800 mx-4"></div>
          
          <p className="px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Настройки приложения</p>
          
          {/* Theme Settings */}
          <div className="px-4 mb-4">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-2">
              <Settings className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-wider">Тема оформления</span>
            </div>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button 
                onClick={() => setTheme('light')}
                className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${theme === 'light' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Sun size={14} className="mb-1" />
                <span className="text-[9px] font-bold">Светлая</span>
              </button>
              <button 
                onClick={() => setTheme('dark')}
                className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${theme === 'dark' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-400'}`}
              >
                <Moon size={14} className="mb-1" />
                <span className="text-[9px] font-bold">Темная</span>
              </button>
              <button 
                onClick={() => setTheme('system')}
                className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${theme === 'system' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Monitor size={14} className="mb-1" />
                <span className="text-[9px] font-bold">Система</span>
              </button>
            </div>
          </div>

          {/* Font Size Settings */}
          <div className="px-4">
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-2">
              <Type className="w-3.5 h-3.5" />
              <span className="text-[10px] font-black uppercase tracking-wider">Размер шрифта</span>
            </div>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button 
                onClick={() => setFontSize('small')}
                className={`py-2 rounded-lg transition-all font-bold ${fontSize === 'small' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 text-xs'}`}
              >
                A
              </button>
              <button 
                onClick={() => setFontSize('medium')}
                className={`py-2 rounded-lg transition-all font-bold ${fontSize === 'medium' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 text-sm'}`}
              >
                A
              </button>
              <button 
                onClick={() => setFontSize('large')}
                className={`py-2 rounded-lg transition-all font-bold ${fontSize === 'large' ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-500 text-base'}`}
              >
                A
              </button>
            </div>
          </div>

          <div className="mt-8">
            <p className="px-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Прочее</p>
            <button onClick={onOpenAbout} className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition font-bold text-sm">
              <Info className="w-5 h-5" />
              О платформе
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition font-bold text-sm"
          >
            <LogOut className="w-5 h-5" />
            Выйти
          </button>
        </div>
      </div>
    </>
  );
};
