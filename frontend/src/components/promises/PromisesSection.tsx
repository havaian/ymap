// frontend/src/components/promises/PromisesSection.tsx
// Generic citizen-facing promises section.
// Works for both organizations (targetType='organization') and
// infrastructure objects (targetType='infrastructure').

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, ClipboardCheck, Camera, X, ThumbsUp, ThumbsDown,
  Loader2, ChevronDown, ChevronUp, ImageIcon, CheckCircle2
} from 'lucide-react';
import { User, UserRole } from '../../../types';
import { promisesAPI } from '../../services/api';

interface PromisesSectionProps {
  targetType: 'organization' | 'infrastructure';
  targetId: string;
  currentUser: User | null;
}

// ─── Inline verification form ─────────────────────────────────────────────────
function VerifyForm({ promiseId, onDone }: { promiseId: string; onDone: () => void }) {
  const [status, setStatus] = useState<'done' | 'problem' | null>(null);
  const [comment, setComment] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    if (file) {
      setPhotoPreview(URL.createObjectURL(file));
    } else {
      setPhotoPreview(null);
    }
  };

  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); };
  }, [photoPreview]);

  const handleSubmit = async () => {
    if (!status) return;
    setSubmitting(true);
    setError(null);
    try {
      let photoUrl: string | undefined;
      if (photo) {
        const uploadRes = await promisesAPI.uploadPhoto(photo);
        photoUrl = uploadRes.data?.data?.photoUrl;
      }
      await promisesAPI.verify(promiseId, { status, comment: comment.trim() || undefined, photoUrl });
      onDone();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка отправки. Попробуйте снова.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setStatus('done')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-colors ${
            status === 'done'
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-400'
          }`}
        >
          <ThumbsUp size={15} />
          Выполнено
        </button>
        <button
          onClick={() => setStatus('problem')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-colors ${
            status === 'problem'
              ? 'bg-red-500 text-white shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-red-400'
          }`}
        >
          <ThumbsDown size={15} />
          Проблема
        </button>
      </div>

      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Комментарий (необязательно)..."
        rows={2}
        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handlePhotoSelect}
          className="hidden"
        />
        {photoPreview ? (
          <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            <img src={photoPreview} alt="preview" className="w-full h-full object-cover" />
            <button
              onClick={() => { setPhoto(null); setPhotoPreview(null); }}
              className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:border-blue-400 hover:text-blue-500 text-xs font-bold transition-colors"
          >
            <Camera size={14} />
            Прикрепить фото
          </button>
        )}
      </div>

      {error && <p className="text-xs font-bold text-red-500">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!status || submitting}
        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
        {submitting ? 'Отправка...' : 'Отправить проверку'}
      </button>
    </div>
  );
}

// ─── Single promise card ──────────────────────────────────────────────────────
function PromiseItem({
  promise,
  currentUser,
  onVerified
}: {
  promise: any;
  currentUser: User | null;
  onVerified: () => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const total   = promise.totalCount   ?? 0;
  const done    = promise.doneCount    ?? 0;
  const problem = promise.problemCount ?? 0;

  const dotColor =
    total === 0              ? 'bg-slate-300 dark:bg-slate-600' :
    done / total >= 0.7      ? 'bg-emerald-500' :
    problem / total >= 0.5   ? 'bg-red-500' :
    'bg-amber-400';

  const handleVerifyDone = () => {
    setVerifying(false);
    onVerified();
  };

  return (
    <div className="bg-white/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
      <div className="flex items-start gap-3 p-3.5">
        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-slate-800 dark:text-slate-100 leading-snug">{promise.title}</p>
          {promise.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{promise.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <ThumbsUp size={11} /> {done} выполнено
            </span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-red-500 dark:text-red-400">
              <ThumbsDown size={11} /> {problem} проблем
            </span>
            {total > 0 && (
              <span className="text-[11px] font-bold text-slate-400">{total} проверок</span>
            )}
          </div>
        </div>
        {total > 0 && (
          <button
            onClick={() => setExpanded(p => !p)}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        )}
      </div>

      {expanded && promise.verifications?.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-3.5 py-2 space-y-2">
          {promise.verifications.slice(-5).reverse().map((v: any) => (
            <div key={v._id} className="flex items-start gap-2 text-xs">
              <span className={`mt-0.5 flex-shrink-0 font-black ${v.status === 'done' ? 'text-emerald-500' : 'text-red-500'}`}>
                {v.status === 'done' ? '✓' : '✗'}
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-slate-700 dark:text-slate-300">{v.userName}</span>
                {v.comment && <p className="text-slate-500 dark:text-slate-400 mt-0.5">{v.comment}</p>}
                {v.photoUrl && (
                  <a
                    href={`/api/uploads/${v.photoUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-500 hover:underline mt-0.5"
                  >
                    <ImageIcon size={10} /> Фото
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {currentUser && (
        <div className="border-t border-slate-100 dark:border-slate-800 px-3.5 pb-3.5">
          {verifying ? (
            <VerifyForm promiseId={promise.id} onDone={handleVerifyDone} />
          ) : (
            <button
              onClick={() => setVerifying(true)}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-sm font-black transition-colors border border-blue-200 dark:border-blue-800"
            >
              <ClipboardCheck size={15} />
              Проверить выполнение
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section root ─────────────────────────────────────────────────────────────
export function PromisesSection({ targetType, targetId, currentUser }: PromisesSectionProps) {
  const [promises, setPromises] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc,  setNewDesc]  = useState('');
  const [adding,   setAdding]   = useState(false);

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const fetchPromises = async () => {
    try {
      setLoading(true);
      const res = await promisesAPI.getByTarget(targetType, targetId);
      setPromises(res.data?.data ?? []);
    } catch {
      // Non-critical — section stays empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPromises(); }, [targetType, targetId]);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setAdding(true);
    try {
      await promisesAPI.create({ targetType, targetId, title: newTitle.trim(), description: newDesc.trim() || undefined });
      setNewTitle('');
      setNewDesc('');
      setShowAddForm(false);
      await fetchPromises();
    } catch {
      // TODO: surface error
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="px-6 pt-4 pb-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <ClipboardCheck size={11} className="text-slate-400 dark:text-slate-500" />
          <h3 className="font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            Обещания властей
          </h3>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddForm(p => !p)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-black transition-colors"
          >
            <Plus size={11} />
            Добавить
          </button>
        )}
      </div>

      {isAdmin && showAddForm && (
        <div className="mb-3 bg-white/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-3.5 space-y-2">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Что было обещано..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Подробности (необязательно)..."
            rows={2}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim() || adding}
              className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
            >
              {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Сохранить
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-black transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : promises.length === 0 ? (
        <div className="py-5 text-center text-slate-400 dark:text-slate-600 text-xs font-bold">
          {isAdmin ? 'Нет обещаний. Нажмите «Добавить».' : 'Обещаний пока нет.'}
        </div>
      ) : (
        <div className="space-y-2.5">
          {promises.map(p => (
            <PromiseItem
              promise={p}
              currentUser={currentUser}
              onVerified={fetchPromises}
            />
          ))}
        </div>
      )}
    </div>
  );
}