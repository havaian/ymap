// frontend/src/components/AdminUserView.tsx

import React, { useState, useEffect } from "react";
import { User, UserRole } from "../../../types";
import {
  Search,
  User as UserIcon,
  ShieldCheck,
  Ban,
  RotateCcw,
  MoreVertical,
  Mail,
  MapPin,
  Activity,
  ChevronRight,
  X,
  TrendingUp,
  FileText,
  ThumbsUp,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { adminAPI } from "../../services/api";

// ── User Activity Panel ───────────────────────────────────────────────────────

const CATEGORY_SHORT: Record<string, string> = {
  'Roads': 'Дороги',
  'Water & Sewage': 'Водоснаб.',
  'Electricity': 'Электр.',
  'Schools & Kindergartens': 'Образов.',
  'Hospitals & Clinics': 'Здравоохр.',
  'Waste Management': 'Мусор',
  'Other': 'Прочее',
};

function UserActivityPanel({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    adminAPI.getUserActivity(userId)
      .then(res => { if (mounted && res.data?.success) setData(res.data.data); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [userId]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full md:w-[480px] bg-white dark:bg-slate-900 z-[61] shadow-2xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="text-base font-black text-slate-800 dark:text-white">
            Активность пользователя
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data ? (
          <p className="text-center text-sm text-slate-400 py-16">Ошибка загрузки</p>
        ) : (
          <div className="p-6 space-y-6">
            {/* User info */}
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0 ${
                data.user.role === 'ADMIN' ? 'bg-indigo-600' : 'bg-blue-500'
              }`}>
                <UserIcon size={26} />
              </div>
              <div className="min-w-0">
                <p className="font-black text-slate-800 dark:text-white text-base truncate">{data.user.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{data.user.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
                    {data.user.role}
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                    <TrendingUp size={10} />
                    {data.user.points} очков
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Calendar size={10} />
                    {new Date(data.user.createdAt).toLocaleDateString('ru-RU')}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={14} className="text-blue-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Обращений</span>
                </div>
                <p className="text-3xl font-black text-slate-800 dark:text-white">{data.activity.issues.total}</p>
                <div className="flex gap-3 mt-2 text-[11px] font-bold">
                  <span className="text-red-500">{data.activity.issues.open} откр.</span>
                  <span className="text-blue-500">{data.activity.issues.progress} в раб.</span>
                  <span className="text-emerald-500">{data.activity.issues.resolved} реш.</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ThumbsUp size={14} className="text-emerald-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Голосов дано</span>
                </div>
                <p className="text-3xl font-black text-slate-800 dark:text-white">{data.activity.votesGiven}</p>
                <p className="text-[11px] font-bold text-slate-400 mt-2">за чужие обращения</p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={14} className="text-teal-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Верификаций</span>
                </div>
                <p className="text-3xl font-black text-slate-800 dark:text-white">
                  {(data.activity.verifications.done || 0) + (data.activity.verifications.problem || 0)}
                </p>
                <div className="flex gap-3 mt-2 text-[11px] font-bold">
                  <span className="text-emerald-500">{data.activity.verifications.done || 0} ✓</span>
                  <span className="text-red-500">{data.activity.verifications.problem || 0} ✗</span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={14} className="text-amber-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Голосов набрано</span>
                </div>
                <p className="text-3xl font-black text-slate-800 dark:text-white">{data.activity.issues.totalVotes || 0}</p>
                <p className="text-[11px] font-bold text-slate-400 mt-2">на своих обращениях</p>
              </div>
            </div>

            {/* Recent issues */}
            {data.activity.recentIssues?.length > 0 && (
              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                  Последние обращения
                </h4>
                <div className="space-y-2">
                  {data.activity.recentIssues.map((issue: any) => (
                    <div
                      key={issue.id}
                      className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{issue.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-slate-400">{CATEGORY_SHORT[issue.category] || issue.category}</span>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <span className={`text-[10px] font-bold ${
                            issue.status === 'Resolved' ? 'text-emerald-500' :
                            issue.status === 'In Progress' ? 'text-blue-500' : 'text-red-500'
                          }`}>
                            {issue.status === 'Resolved' ? 'Решено' : issue.status === 'In Progress' ? 'В работе' : 'Открыто'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {new Date(issue.createdAt).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.activity.issues.total === 0 && (
              <p className="text-center text-sm text-slate-400 dark:text-slate-600 py-4">
                Пользователь ещё не подавал обращений
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

interface AdminUserViewProps {
  users: User[];
  onToggleBlock: (userId: string) => void;
}

export const AdminUserView: React.FC<AdminUserViewProps> = ({
  users,
  onToggleBlock,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activityUserId, setActivityUserId] = useState<string | null>(null);

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col animate-in fade-in duration-100 overflow-hidden">
      <div className="flex-shrink-0 p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              Управление доступом
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Модерация аккаунтов и мониторинг активности граждан
            </p>
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
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className={`bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-200 dark:border-slate-800 transition-all ${
                  user.blocked ? "opacity-60 grayscale" : "shadow-sm"
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                      user.role === UserRole.ADMIN
                        ? "bg-indigo-600"
                        : "bg-blue-500"
                    }`}
                  >
                    {user.role === UserRole.ADMIN ? (
                      <ShieldCheck size={24} />
                    ) : (
                      <UserIcon size={24} />
                    )}
                  </div>
                  {user.role !== UserRole.ADMIN && (
                    <div>
                      <button
                        onClick={() => setActivityUserId(user.id)}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:text-blue-400 transition-colors"
                        title="Активность пользователя"
                      >
                        <Activity size={16} />
                      </button>
                      <button
                        onClick={() => onToggleBlock(user.id)}
                        className={`p-2 rounded-xl transition-colors ${
                          user.blocked
                            ? "bg-green-100 text-green-600 hover:bg-green-200"
                            : "bg-red-50 text-red-600 hover:bg-red-100"
                        }`}
                        title={user.blocked ? "Разблокировать" : "Заблокировать"}
                      >
                        {user.blocked ? (
                          <RotateCcw size={18} />
                        ) : (
                          <Ban size={18} />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h3 className="font-bold text-slate-800 dark:text-white truncate">
                        {user.name}
                      </h3>
                      {user.role === UserRole.ADMIN && (
                        <span className="bg-red-500 text-white text-[7px] font-black px-1 py-0.5 rounded uppercase">
                          Admin
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      <Mail size={10} /> {user.email}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      <MapPin size={10} /> {user.district || "Общий"}
                    </div>
                    {user.blocked && (
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded">
                        Заблокирован
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {activityUserId && (
        <UserActivityPanel
          userId={activityUserId}
          onClose={() => setActivityUserId(null)}
        />
      )}
    </div>
  );
};
