
import React, { useState } from 'react';
import { Issue, Comment, IssueSubCategory, UserRole, User as UserType } from '../../types';
import { CATEGORY_COLORS } from '../constants';
import { X, Send, MessageSquare, Clock, ShieldAlert, ChevronUp, User, Building2, Droplets, Zap, MoreHorizontal, Trash2, CheckCircle, RotateCcw, Play } from 'lucide-react';

interface DetailSidebarProps {
  issue: Issue | null;
  currentUser: UserType | null;
  onClose: () => void;
  onAddComment: (issueId: string, text: string) => void;
  onUpvote: (issueId: string) => void;
  onUpdateStatus?: (issueId: string, status: 'Open' | 'In Progress' | 'Resolved') => void;
  onDeleteIssue?: (issueId: string) => void;
}

const getSubCategoryIcon = (sub?: IssueSubCategory) => {
    switch (sub) {
        case IssueSubCategory.WATER: return <Droplets className="w-3 h-3" />;
        case IssueSubCategory.ELECTRICITY: return <Zap className="w-3 h-3" />;
        default: return <MoreHorizontal className="w-3 h-3" />;
    }
};

export const DetailSidebar: React.FC<DetailSidebarProps> = ({ 
  issue, currentUser, onClose, onAddComment, onUpvote, onUpdateStatus, onDeleteIssue 
}) => {
  const [newComment, setNewComment] = useState('');
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  if (!issue) return null;

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      onAddComment(issue.id, newComment);
      setNewComment('');
    }
  };

  return (
    <div className="absolute top-0 right-0 h-full w-full md:w-[420px] bg-white dark:bg-slate-900 shadow-2xl z-[500] flex flex-col transform transition-all duration-300 ease-in-out border-l border-slate-100 dark:border-slate-800">
      
      <div className="relative h-32 bg-slate-100 dark:bg-slate-800 flex-shrink-0">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `linear-gradient(135deg, ${CATEGORY_COLORS[issue.category]} 0%, #ffffff 100%)` }} />
        <div className="absolute top-4 right-4">
            <button onClick={onClose} className="p-2 bg-white/50 dark:bg-slate-700/50 hover:bg-white dark:hover:bg-slate-700 rounded-full transition backdrop-blur-sm text-slate-600 dark:text-slate-300">
                <X className="w-5 h-5" />
            </button>
        </div>
        <div className="absolute -bottom-6 left-6 flex items-end">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg text-white font-bold" style={{ backgroundColor: CATEGORY_COLORS[issue.category] }}>
                {issue.category.substring(0, 2).toUpperCase()}
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-8 px-6 pb-6 custom-scrollbar">
        {isAdmin && (
          <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-700">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              <ShieldAlert size={12} /> Панель модератора
            </h4>
            <div className="flex flex-wrap gap-2 mb-3">
              <button 
                onClick={() => onUpdateStatus?.(issue.id, 'Open')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${issue.status === 'Open' ? 'bg-red-500 text-white border-red-500 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-red-400'}`}
              >
                <RotateCcw size={12} /> Открыть
              </button>
              <button 
                onClick={() => onUpdateStatus?.(issue.id, 'In Progress')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${issue.status === 'In Progress' ? 'bg-blue-500 text-white border-blue-500 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-blue-400'}`}
              >
                <Play size={12} /> В работу
              </button>
              <button 
                onClick={() => onUpdateStatus?.(issue.id, 'Resolved')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${issue.status === 'Resolved' ? 'bg-green-500 text-white border-green-500 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-green-400'}`}
              >
                <CheckCircle size={12} /> Решить
              </button>
            </div>
            <button 
              onClick={() => { if(confirm('Удалить обращение навсегда?')) onDeleteIssue?.(issue.id) }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white dark:bg-slate-900 text-red-500 border border-red-100 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
            >
              <Trash2 size={12} /> Удалить обращение
            </button>
          </div>
        )}

        <div className="mb-6">
            <div className="flex justify-between items-start">
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1 block">
                    {issue.category}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(issue.createdAt).toLocaleDateString()}
                </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 leading-tight mb-3">{issue.title}</h2>
            
            {issue.organizationName && (
                <div className="flex flex-col gap-2 mb-4">
                    <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-2 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                        <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-sm font-bold text-indigo-800 dark:text-indigo-200">{issue.organizationName}</span>
                    </div>
                    {issue.subCategory && (
                        <div className="flex items-center gap-2 self-start bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                            <span className="text-slate-500 dark:text-slate-400">{getSubCategoryIcon(issue.subCategory)}</span>
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-tighter">Тип: {issue.subCategory}</span>
                        </div>
                    )}
                </div>
            )}

            <div className="flex gap-2 mb-4">
                 <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide
                    ${issue.status === 'Open' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30' : 
                      issue.status === 'In Progress' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30' : 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-100 dark:border-green-900/30'}
                `}>
                    {issue.status}
                </span>
                <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide
                    ${issue.severity === 'Critical' ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/30' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700'}
                `}>
                    {issue.severity} Priority
                </span>
            </div>

            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-4">{issue.description}</p>

            {issue.aiSummary && (
                <div className="bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 border border-violet-100 dark:border-violet-900/30 rounded-xl p-4 flex gap-3">
                    <ShieldAlert className="w-5 h-5 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-xs font-bold text-violet-800 dark:text-violet-300 uppercase tracking-wide mb-1">Government Insight</h3>
                        <p className="text-sm text-violet-900 dark:text-violet-100 leading-snug">{issue.aiSummary}</p>
                    </div>
                </div>
            )}
        </div>

        <div className="flex gap-4 mb-8">
            <button onClick={() => onUpvote(issue.id)} className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition rounded-xl p-3 flex flex-col items-center group cursor-pointer shadow-sm">
                <ChevronUp className="w-6 h-6 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 mb-1" />
                <span className="text-2xl font-black text-slate-700 dark:text-slate-100 group-hover:text-blue-700 dark:group-hover:text-blue-400">{issue.votes}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Citizens Affected</span>
            </button>
            <div className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center">
                <MessageSquare className="w-5 h-5 text-slate-400 dark:text-slate-500 mb-2" />
                <span className="font-bold text-slate-700 dark:text-slate-100">{issue.comments.length}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">Updates</span>
            </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 text-sm uppercase tracking-wide">Activity Feed</h3>
            <div className="space-y-4 mb-20">
                {issue.comments.length === 0 ? (
                    <div className="text-center py-8">
                        <MessageSquare className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-sm text-slate-400 dark:text-slate-500">No updates yet.</p>
                    </div>
                ) : (
                    issue.comments.map(comment => (
                        <div key={comment.id} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-slate-500 dark:text-slate-400" /></div>
                            <div className="flex-1">
                                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-2xl rounded-tl-none">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">{comment.author}</span>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(comment.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                    <p className="text-slate-600 dark:text-slate-300 text-sm">{comment.text}</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 p-4">
        <form onSubmit={handleCommentSubmit} className="relative flex items-center gap-2">
            <input 
                type="text" placeholder="Write an update..." 
                className="flex-1 pl-4 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none transition dark:text-white"
                value={newComment} onChange={(e) => setNewComment(e.target.value)}
            />
            <button type="submit" disabled={!newComment.trim()} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 transition">
                <Send className="w-4 h-4" />
            </button>
        </form>
      </div>
    </div>
  );
};
