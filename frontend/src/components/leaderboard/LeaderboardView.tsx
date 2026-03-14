// frontend/src/components/leaderboard/LeaderboardView.tsx

import React, { useEffect, useState } from "react";
import { User } from "../../../types";
import { usersAPI } from "../../services/api";
import {
  Trophy,
  Medal,
  Star,
  FileText,
  CheckCircle2,
  Loader2,
} from "lucide-react";

const LEVEL_ICONS: [number, string][] = [
  [150, "🏆"],
  [75, "🛡️"],
  [30, "🏅"],
  [10, "⚡"],
  [0, "🌱"],
];
function getLevelIcon(points: number) {
  for (const [min, icon] of LEVEL_ICONS) {
    if (points >= min) return icon;
  }
  return "🌱";
}

interface LeaderboardViewProps {
  currentUser: User;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  currentUser,
}) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersAPI
      .getLeaderboard()
      .then((res) => {
        if (res.data?.success) setData(res.data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const myEntry = data.find((u) => u.id === currentUser.id);

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col animate-in fade-in duration-100 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              Лидерборд
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Самые активные граждане
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
        <div className="max-w-2xl mx-auto space-y-3">
          {/* My position — sticky reminder if not in view */}
          {myEntry && myEntry.rank > 10 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-center gap-4">
              <span className="text-2xl font-black text-blue-600 w-8 text-center">
                #{myEntry.rank}
              </span>
              <div className="flex-1">
                <p className="font-black text-slate-800 dark:text-white text-sm">
                  Ваша позиция
                </p>
                <p className="text-xs text-slate-500">
                  {myEntry.points} очков · {myEntry.issueCount} обращений
                </p>
              </div>
              <span className="text-xl">{getLevelIcon(myEntry.points)}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : data.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-16">
              Нет данных
            </p>
          ) : (
            data.map((entry) => {
              const isMe = entry.id === currentUser.id;
              const isTop3 = entry.rank <= 3;
              const medal =
                entry.rank === 1
                  ? "🥇"
                  : entry.rank === 2
                  ? "🥈"
                  : entry.rank === 3
                  ? "🥉"
                  : null;

              return (
                <div
                  key={entry.id}
                  className={`rounded-2xl border p-4 flex items-center gap-4 transition-colors ${
                    isMe
                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700"
                      : isTop3
                      ? "bg-white dark:bg-slate-900 border-amber-200 dark:border-amber-800/50 shadow-sm"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  {/* Rank */}
                  <div className="w-10 text-center flex-shrink-0">
                    {medal ? (
                      <span className="text-2xl">{medal}</span>
                    ) : (
                      <span
                        className={`text-lg font-black ${
                          isMe ? "text-blue-600" : "text-slate-400"
                        }`}
                      >
                        #{entry.rank}
                      </span>
                    )}
                  </div>

                  {/* Level icon */}
                  <span className="text-xl flex-shrink-0">
                    {getLevelIcon(entry.points)}
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`font-black text-sm truncate ${
                          isMe
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-slate-800 dark:text-white"
                        }`}
                      >
                        {entry.name}
                        {isMe && (
                          <span className="ml-1 text-[10px] font-black text-blue-500 uppercase tracking-wider">
                            (вы)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <FileText size={10} />
                        {entry.issueCount} обращений
                      </span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        {entry.verificationCount} проверок
                      </span>
                    </div>
                  </div>

                  {/* Points */}
                  <div className="text-right flex-shrink-0">
                    <p
                      className={`text-lg font-black ${
                        isTop3
                          ? "text-amber-500"
                          : "text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {entry.points}
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold">
                      очков
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
