// frontend/src/components/profile/ProfileView.tsx

import React, { useEffect, useState } from "react";
import { User, UserRole } from "../../../types";
import { usersAPI } from "../../services/api";
import {
  TrendingUp,
  FileText,
  CheckCircle2,
  ThumbsUp,
  Calendar,
  Star,
  Shield,
  Zap,
  Award,
  Target,
  Loader2,
} from "lucide-react";

// ── Геймификация ──────────────────────────────────────────────────────────────

const LEVELS = [
  {
    min: 0,
    label: "Новичок",
    color: "text-slate-500",
    bg: "bg-slate-100 dark:bg-slate-800",
    icon: "🌱",
  },
  {
    min: 10,
    label: "Активист",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    icon: "⚡",
  },
  {
    min: 30,
    label: "Герой района",
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-900/20",
    icon: "🏅",
  },
  {
    min: 75,
    label: "Страж города",
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-900/20",
    icon: "🛡️",
  },
  {
    min: 150,
    label: "Народный инспектор",
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    icon: "🏆",
  },
];

function getLevel(points: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].min) return LEVELS[i];
  }
  return LEVELS[0];
}

function getNextLevel(points: number) {
  for (let i = 0; i < LEVELS.length; i++) {
    if (points < LEVELS[i].min) return LEVELS[i];
  }
  return null; // max level
}

const BADGES = [
  {
    id: "first_issue",
    label: "Первое обращение",
    icon: <FileText size={16} />,
    check: (a: any) => a.issues.total >= 1,
  },
  {
    id: "five_issues",
    label: "5 обращений",
    icon: <FileText size={16} />,
    check: (a: any) => a.issues.total >= 5,
  },
  {
    id: "ten_issues",
    label: "10 обращений",
    icon: <Target size={16} />,
    check: (a: any) => a.issues.total >= 10,
  },
  {
    id: "first_verif",
    label: "Первая проверка",
    icon: <CheckCircle2 size={16} />,
    check: (a: any) => a.verifications.done + a.verifications.problem >= 1,
  },
  {
    id: "ten_verifs",
    label: "10 проверок",
    icon: <Shield size={16} />,
    check: (a: any) => a.verifications.done + a.verifications.problem >= 10,
  },
  {
    id: "first_vote",
    label: "Первый голос",
    icon: <ThumbsUp size={16} />,
    check: (a: any) => a.votesGiven >= 1,
  },
  {
    id: "ten_votes",
    label: "10 голосов",
    icon: <Zap size={16} />,
    check: (a: any) => a.votesGiven >= 10,
  },
  {
    id: "first_resolve",
    label: "Проблема решена",
    icon: <Award size={16} />,
    check: (a: any) => a.issues.resolved >= 1,
  },
];

const CATEGORY_SHORT: Record<string, string> = {
  Roads: "Дороги",
  "Water & Sewage": "Вода",
  Electricity: "Электр.",
  "Schools & Kindergartens": "Образов.",
  "Hospitals & Clinics": "Здравоохр.",
  "Waste Management": "Мусор",
  Other: "Прочее",
};

// ── Component ─────────────────────────────────────────────────────────────────

interface ProfileViewProps {
  currentUser: User;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ currentUser }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersAPI
      .getMyActivity()
      .then((res) => {
        if (res.data?.success) setData(res.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-400">Не удалось загрузить профиль</p>
      </div>
    );
  }

  const { user, activity } = data;
  const points = user.points || 0;
  const level = getLevel(points);
  const nextLevel = getNextLevel(points);
  const progress = nextLevel
    ? Math.round(
        ((points - getLevel(points).min) /
          (nextLevel.min - getLevel(points).min)) *
          100
      )
    : 100;
  const earnedBadges = BADGES.filter((b) => b.check(activity));
  const lockedBadges = BADGES.filter((b) => !b.check(activity));

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Hero card */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-blue-600 to-indigo-600" />
          <div className="px-6 pb-6">
            <div className="-mt-10 mb-4 flex items-end justify-between">
              <div className="w-20 h-20 rounded-[1.5rem] bg-white dark:bg-slate-800 border-4 border-white dark:border-slate-900 shadow-lg flex items-center justify-center text-3xl">
                {level.icon}
              </div>
              <span
                className={`text-xs font-black px-3 py-1.5 rounded-full ${level.bg} ${level.color}`}
              >
                {level.label}
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white">
              {user.name}
            </h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar size={13} />
                {new Date(user.createdAt).toLocaleDateString("ru-RU", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="flex items-center gap-1 font-bold text-amber-500">
                <Star size={13} />
                {points} очков
              </span>
            </div>

            {/* Progress to next level */}
            {nextLevel && (
              <div className="mt-4">
                <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                  <span>{level.label}</span>
                  <span>
                    {nextLevel.label} через {nextLevel.min - points} оч.
                  </span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
            {!nextLevel && (
              <p className="mt-3 text-xs font-bold text-emerald-500">
                🏆 Максимальный уровень достигнут!
              </p>
            )}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              label: "Обращений подано",
              value: activity.issues.total,
              icon: <FileText size={16} className="text-blue-500" />,
              sub: `${activity.issues.resolved} решено`,
            },
            {
              label: "Голосов отдано",
              value: activity.votesGiven,
              icon: <ThumbsUp size={16} className="text-violet-500" />,
              sub: "за чужие обращения",
            },
            {
              label: "Проверок выполнено",
              value:
                activity.verifications.done + activity.verifications.problem,
              icon: <CheckCircle2 size={16} className="text-teal-500" />,
              sub: `${activity.verifications.done} ✓  ${activity.verifications.problem} ✗`,
            },
            {
              label: "Голосов получено",
              value: activity.issues.totalVotes || 0,
              icon: <TrendingUp size={16} className="text-amber-500" />,
              sub: "на своих обращениях",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                {s.icon}
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {s.label}
                </span>
              </div>
              <p className="text-3xl font-black text-slate-800 dark:text-white">
                {s.value}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Badges */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
            Достижения ({earnedBadges.length}/{BADGES.length})
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {earnedBadges.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
              >
                <span className="text-emerald-500">{b.icon}</span>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {b.label}
                </span>
              </div>
            ))}
            {lockedBadges.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 opacity-50"
              >
                <span className="text-slate-400">{b.icon}</span>
                <span className="text-xs font-bold text-slate-500">
                  {b.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent issues */}
        {activity.recentIssues?.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
              Последние обращения
            </h3>
            <div className="space-y-2">
              {activity.recentIssues.map((issue: any) => (
                <div
                  key={issue.id}
                  className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
                      {issue.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-slate-400">
                        {CATEGORY_SHORT[issue.category] || issue.category}
                      </span>
                      <span
                        className={`text-[10px] font-bold ${
                          issue.status === "Resolved"
                            ? "text-emerald-500"
                            : issue.status === "In Progress"
                            ? "text-blue-500"
                            : "text-red-500"
                        }`}
                      >
                        {issue.status === "Resolved"
                          ? "Решено"
                          : issue.status === "In Progress"
                          ? "В работе"
                          : "Открыто"}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">
                    {new Date(issue.createdAt).toLocaleDateString("ru-RU")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
