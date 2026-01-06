
import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Search, User as UserIcon, ShieldCheck, Ban, RotateCcw, MoreVertical, Mail, MapPin } from 'lucide-react';

interface AdminUserViewProps {
  users: User[];
  onToggleBlock: (userId: string) => void;
}

export const AdminUserView: React.FC<AdminUserViewProps> = ({ users, onToggleBlock }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col animate-in fade-in duration-300 overflow-hidden">
      <div className="flex-shrink-0 p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Управление доступом</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Модерация аккаунтов и мониторинг активности граждан</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Поиск пользователей..."
              className="w-full pl-11 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map(user => (
              <div key={user.id} className={`bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-200 dark:border-slate-800 transition-all ${user.blocked ? 'opacity-60 grayscale' : 'shadow-sm'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${user.role === UserRole.ADMIN ? 'bg-indigo-600' : 'bg-blue-500'}`}>
                    {user.role === UserRole.ADMIN ? <ShieldCheck size={24} /> : <UserIcon size={24} />}
                  </div>
                  {user.role !== UserRole.ADMIN && (
                    <button 
                      onClick={() => onToggleBlock(user.id)}
                      className={`p-2 rounded-xl transition-colors ${user.blocked ? 'bg-green-100 text-green-600 hover:bg-green-200' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                      title={user.blocked ? "Разблокировать" : "Заблокировать"}
                    >
                      {user.blocked ? <RotateCcw size={18} /> : <Ban size={18} />}
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h3 className="font-bold text-slate-800 dark:text-white truncate">{user.name}</h3>
                      {user.role === UserRole.ADMIN && (
                        <span className="bg-red-500 text-white text-[7px] font-black px-1 py-0.5 rounded uppercase">Admin</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      <Mail size={10} /> {user.email}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      <MapPin size={10} /> {user.district || 'Общий'}
                    </div>
                    {user.blocked && (
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">Заблокирован</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
