// frontend/src/components/issues/DetailSidebar.tsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Issue,
  IssueSubCategory,
  UserRole,
  User as UserType,
} from "../../../types";
import { CATEGORY_COLORS } from "../../constants";
import {
  Send,
  MessageSquare,
  Clock,
  ShieldAlert,
  ChevronUp,
  User,
  Building2,
  Droplets,
  Zap,
  MoreHorizontal,
  Trash2,
  CheckCircle,
  RotateCcw,
  Play,
  ExternalLink,
} from "lucide-react";

interface DetailSidebarProps {
  issue: Issue | null;
  currentUser: UserType | null;
  onClose: () => void;
  onAddComment: (issueId: string, text: string) => void;
  onUpvote: (issueId: string) => void;
  onUpdateStatus?: (
    issueId: string,
    status: "Open" | "In Progress" | "Resolved"
  ) => void;
  onDeleteIssue?: (issueId: string) => void;
}

const getSubCategoryIcon = (sub?: string) => {
  switch (sub) {
    case IssueSubCategory.WATER:
      return <Droplets className="w-3 h-3" />;
    case IssueSubCategory.ELECTRICITY:
      return <Zap className="w-3 h-3" />;
    default:
      return <MoreHorizontal className="w-3 h-3" />;
  }
};

export const DetailSidebar: React.FC<DetailSidebarProps> = ({
  issue,
  currentUser,
  onClose,
  onAddComment,
  onUpvote,
  onUpdateStatus,
  onDeleteIssue,
}) => {
  const [newComment, setNewComment] = useState("");
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const navigate = useNavigate();

  if (!issue) return null;

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      onAddComment(issue.id, newComment);
      setNewComment("");
    }
  };

  return (
    <div className="h-full flex flex-col pb-24">
      <div className="flex-1 overflow-y-auto pt-8 px-6 pb-6 custom-scrollbar">
        {/* Admin moderation panel */}
        {isAdmin && (
          <div className="mb-6 p-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-200/50 dark:border-slate-700/50">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ShieldAlert size={12} /> Панель модератора
            </h4>
            <div className="flex flex-wrap gap-2 mb-3">
              <button
                onClick={() => onUpdateStatus?.(issue.id, "Open")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  issue.status === "Open"
                    ? "bg-red-500 text-white border-red-500 shadow-md"
                    : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm text-slate-500 border-slate-200/50 dark:border-slate-700/50 hover:border-red-400"
                }`}
              >
                <RotateCcw size={12} /> Открыть
              </button>
              <button
                onClick={() => onUpdateStatus?.(issue.id, "In Progress")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  issue.status === "In Progress"
                    ? "bg-blue-500 text-white border-blue-500 shadow-md"
                    : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm text-slate-500 border-slate-200/50 dark:border-slate-700/50 hover:border-blue-400"
                }`}
              >
                <Play size={12} /> В работу
              </button>
              <button
                onClick={() => onUpdateStatus?.(issue.id, "Resolved")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                  issue.status === "Resolved"
                    ? "bg-green-500 text-white border-green-500 shadow-md"
                    : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm text-slate-500 border-slate-200/50 dark:border-slate-700/50 hover:border-green-400"
                }`}
              >
                <CheckCircle size={12} /> Решить
              </button>
            </div>
            <button
              onClick={() => {
                if (confirm("Удалить обращение навсегда?"))
                  onDeleteIssue?.(issue.id);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm text-red-500 border border-red-200/50 dark:border-red-900/40 hover:bg-red-50/80 dark:hover:bg-red-900/30 transition-all"
            >
              <Trash2 size={12} /> Удалить обращение
            </button>
          </div>
        )}

        {/* Title + metadata */}
        <div className="mb-6">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 block">
              {issue.category}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(issue.createdAt).toLocaleDateString("ru-RU")}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-tight mb-3">
            {issue.title}
          </h2>

          {/* Linked object badge — replaces old organizationName / infrastructureName */}
          {issue.objectName && (
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center gap-2 bg-indigo-50/80 dark:bg-indigo-900/30 backdrop-blur-sm px-3 py-2 rounded-lg border border-indigo-200/50 dark:border-indigo-900/40">
                <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-bold text-indigo-800 dark:text-indigo-200">
                  {issue.objectName}
                </span>
              </div>
              {issue.subCategory && (
                <div className="flex items-center gap-2 self-start bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm px-2 py-1 rounded-md border border-slate-200/50 dark:border-slate-700/50">
                  <span className="text-slate-500 dark:text-slate-400">
                    {getSubCategoryIcon(issue.subCategory)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter">
                    Тип: {issue.subCategory}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${
                issue.status === "Open"
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  : issue.status === "In Progress"
                  ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                  : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              }`}
            >
              {issue.status === "Open"
                ? "Открыто"
                : issue.status === "In Progress"
                ? "В работе"
                : "Решено"}
            </span>
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${
                issue.severity === "Critical"
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                  : issue.severity === "High"
                  ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                  : issue.severity === "Medium"
                  ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                  : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
              }`}
            >
              {issue.severity}
            </span>
          </div>

          {/* Object backlink */}
          {issue.objectId && (
            <button
              onClick={() => navigate(`/map/objects/${issue.objectId}`)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 mb-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-left group"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                <Building2 size={13} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest">
                  Объект
                </div>
                <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300 truncate leading-snug">
                  {issue.objectName || "Перейти к объекту"}
                </div>
              </div>
              <ExternalLink size={13} className="text-indigo-400 flex-shrink-0 group-hover:text-indigo-600 transition-colors" />
            </button>
          )}

          {issue.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
              {issue.description}
            </p>
          )}

          {issue.aiSummary && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 rounded-xl p-3 mb-4">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-1">
                AI-анализ
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {issue.aiSummary}
              </p>
            </div>
          )}

          {/* Upvote */}
          <button
            onClick={() => onUpvote(issue.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 transition-all text-sm font-bold"
          >
            <ChevronUp className="w-4 h-4" />
            {issue.votes} голосов
          </button>
        </div>

        {/* Comments */}
        <div>
          <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <MessageSquare size={12} />
            Комментарии ({issue.comments?.length || 0})
          </h3>

          <div className="space-y-3 mb-4">
            {issue.comments?.length === 0 && (
              <p className="text-sm text-slate-400 dark:text-slate-600 text-center py-4">
                Пока нет комментариев
              </p>
            )}
            {issue.comments?.map((comment, i) => (
              <div
                key={comment.id || i}
                className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                    <User className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {comment.author}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-600 ml-auto">
                    {new Date(comment.timestamp).toLocaleDateString("ru-RU")}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 ml-8">
                  {comment.text}
                </p>
              </div>
            ))}
          </div>

          {/* Add comment form — citizens and admins can both comment */}
          <form onSubmit={handleCommentSubmit} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Написать комментарий..."
              className="flex-1 px-3 py-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-400 dark:text-white"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
