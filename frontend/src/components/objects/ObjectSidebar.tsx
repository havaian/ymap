// frontend/src/components/objects/ObjectSidebar.tsx
// Unified sidebar for all facility objects (schools, kindergartens, health posts).
// Replaces OrgSidebar + InfraSidebar.

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  FacilityObject,
  Issue,
  Severity,
  User,
  UserRole,
  Task,
  BudgetAllocation,
} from "../../../types";
import { AllocationSection } from "../promises/AllocationSection";
import { tasksAPI } from "../../services/api";
import {
  Building2,
  MapPin,
  CheckCircle2,
  Star,
  ChevronRight,
  Plus,
  Info,
  Calendar,
  Wifi,
  Zap,
  Droplets,
  Hammer,
  Users,
  Camera,
  X,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  ClipboardList,
  ClipboardCheck,
} from "lucide-react";

// ── Object type labels / colors ───────────────────────────────────────────────

const OBJECT_TYPE_LABEL: Record<string, string> = {
  school: "Школа",
  kindergarten: "Детский сад",
  health_post: "ФАП / СВП",
};

const OBJECT_TYPE_COLOR: Record<string, string> = {
  school: "#4f46e5",
  kindergarten: "#0891b2",
  health_post: "#059669",
};

const SEVERITY_WEIGHT: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

// ── Condition field label map ─────────────────────────────────────────────────

const CONDITION_LABELS: Record<string, string> = {
  materialSten: "Стены",
  elektrKunDavomida: "Электричество",
  ichimlikSuviManbaa: "Водоснабжение",
  internet: "Интернет",
  binoIchidaSuv: "Вода в здании",
  kapitalTamir: "Капремонт",
  qurilishYili: "Год постройки",
  sigimi: "Вместимость",
  umumiyUquvchi: "Учащихся / пациентов",
  smena: "Смены",
  sportZalHolati: "Спортзал",
  aktivZalHolati: "Актовый зал",
  oshhonaHolati: "Столовая",
};

const CONDITION_ICONS: Record<string, React.ElementType> = {
  materialSten: Building2,
  elektrKunDavomida: Zap,
  ichimlikSuviManbaa: Droplets,
  internet: Wifi,
  binoIchidaSuv: Droplets,
  kapitalTamir: Hammer,
  qurilishYili: Calendar,
  sigimi: Users,
  umumiyUquvchi: Users,
  smena: Info,
  sportZalHolati: Info,
  aktivZalHolati: Info,
  oshhonaHolati: Info,
};

// ── Task status config ────────────────────────────────────────────────────────

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  Planned: {
    label: "Запланировано",
    color: "text-slate-500 bg-slate-100 dark:bg-slate-800",
  },
  "In Progress": {
    label: "Выполняется",
    color: "text-blue-600 bg-blue-50 dark:bg-blue-900/30",
  },
  "Pending Verification": {
    label: "На проверке",
    color: "text-amber-600 bg-amber-50 dark:bg-amber-900/30",
  },
  Completed: {
    label: "Выполнено",
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30",
  },
  Failed: {
    label: "Не выполнено",
    color: "text-rose-600 bg-rose-50 dark:bg-rose-900/30",
  },
};

// ── InfoField ─────────────────────────────────────────────────────────────────

function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | number | null;
}) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100/60 dark:border-slate-800/60 last:border-0">
      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={13} className="text-slate-500 dark:text-slate-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {label}
        </div>
        <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5 leading-snug">
          {value}
        </div>
      </div>
    </div>
  );
}

// ── Citizen verification form ─────────────────────────────────────────────────

function VerifyForm({
  taskId,
  onDone,
}: {
  taskId: string;
  onDone: () => void;
}) {
  const [status, setStatus] = useState<"done" | "problem" | null>(null);
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async () => {
    if (!status) return;
    setSubmitting(true);
    setError(null);
    try {
      let photoUrl: string | undefined;
      if (photo) {
        const uploadRes = await tasksAPI.uploadPhoto(photo);
        photoUrl = uploadRes.data?.data?.photoUrl;
      }
      await tasksAPI.verify(taskId, {
        status,
        comment: comment.trim() || undefined,
        photoUrl,
      });
      onDone();
    } catch (err: any) {
      setError(
        err.response?.data?.error || "Ошибка отправки. Попробуйте снова."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setStatus("done")}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-colors ${
            status === "done"
              ? "bg-emerald-600 text-white"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
          }`}
        >
          <CheckCircle2 size={15} /> Выполнено
        </button>
        <button
          onClick={() => setStatus("problem")}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-colors ${
            status === "problem"
              ? "bg-red-500 text-white"
              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
          }`}
        >
          <X size={15} /> Проблема
        </button>
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Комментарий (необязательно)"
        rows={2}
        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none outline-none focus:ring-2 focus:ring-blue-400 dark:text-white"
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelect}
      />
      {photoPreview ? (
        <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <img
            src={photoPreview}
            alt="preview"
            className="w-full h-full object-cover"
          />
          <button
            onClick={() => {
              setPhoto(null);
              setPhotoPreview(null);
            }}
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
          <Camera size={14} /> Прикрепить фото
        </button>
      )}

      {error && <p className="text-xs font-bold text-red-500">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={!status || submitting}
        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
      >
        {submitting ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <CheckCircle2 size={15} />
        )}
        {submitting ? "Отправка..." : "Отправить проверку"}
      </button>
    </div>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  currentUser,
  onRefresh,
}: {
  task: Task;
  currentUser: User | null;
  onRefresh: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const cfg = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG["Planned"];
  const total = task.totalCount ?? 0;
  const done = task.doneCount ?? 0;
  const problem = task.problemCount ?? 0;

  const barColor =
    total === 0
      ? "bg-slate-300 dark:bg-slate-600"
      : done / total >= 0.7
      ? "bg-emerald-500"
      : problem / total >= 0.5
      ? "bg-red-500"
      : "bg-amber-500";

  return (
    <div className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden bg-white/60 dark:bg-slate-900/40">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${cfg.color}`}
            >
              {cfg.label}
            </span>
            {task.deadline && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                до {new Date(task.deadline).toLocaleDateString("ru-RU")}
              </span>
            )}
          </div>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
            {task.title}
          </p>
          {task.description && !expanded && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
              {task.description}
            </p>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-slate-400 flex-shrink-0 mt-1" />
        ) : (
          <ChevronDown
            size={14}
            className="text-slate-400 flex-shrink-0 mt-1"
          />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-800">
          {task.description && (
            <p className="text-xs text-slate-600 dark:text-slate-400 pt-3">
              {task.description}
            </p>
          )}

          {/* Verification bar */}
          {total > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>{total} проверок</span>
                <span className="text-emerald-600">{done} ✓</span>
                {problem > 0 && (
                  <span className="text-red-500">{problem} ✗</span>
                )}
              </div>
              <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${Math.round((done / total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Recent verifications */}
          {task.verifications?.slice(0, 3).map((v) => (
            <div key={v._id} className="flex items-start gap-2 text-xs">
              <span
                className={`font-black flex-shrink-0 ${
                  v.status === "done" ? "text-emerald-500" : "text-red-500"
                }`}
              >
                {v.status === "done" ? "✓" : "✗"}
              </span>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {v.userName}
                </span>
                {v.comment && (
                  <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                    {v.comment}
                  </p>
                )}
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

          {/* Verify button */}
          {currentUser && (
            <div className="pt-1">
              {verifying ? (
                <VerifyForm
                  taskId={task.id}
                  onDone={() => {
                    setVerifying(false);
                    onRefresh();
                  }}
                />
              ) : (
                <button
                  onClick={() => setVerifying(true)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-sm font-black transition-colors border border-blue-200 dark:border-blue-800"
                >
                  <ClipboardCheck size={15} />
                  Проверить выполнение
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tasks section ─────────────────────────────────────────────────────────────

function TasksSection({
  objectId,
  currentUser,
  onVerificationDone,
}: {
  objectId: string;
  currentUser: User | null;
  onVerificationDone?: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await tasksAPI.getByObject(objectId);
      setTasks(res.data?.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [objectId]);

  const handleRefresh = () => {
    load();
    onVerificationDone?.();
  };

  if (loading)
    return (
      <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
        <Loader2 size={12} className="animate-spin" /> Загрузка задач...
      </div>
    );

  if (tasks.length === 0)
    return (
      <p className="text-xs text-slate-400 dark:text-slate-600 text-center py-4">
        Нет задач
      </p>
    );

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <TaskCard
          task={t}
          currentUser={currentUser}
          onRefresh={handleRefresh}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface ObjectSidebarProps {
  object: FacilityObject | null;
  issues: Issue[];
  currentUser: User | null;
  onClose: () => void;
  onIssueClick: (issue: Issue) => void;
  onReportIssue: (obj: FacilityObject) => void;
  // Called after a citizen submits a verification — lets App refresh the stats bar + marker colors
  onVerificationDone?: () => void;
}

export const ObjectSidebar: React.FC<ObjectSidebarProps> = ({
  object,
  issues,
  currentUser,
  onClose,
  onIssueClick,
  onReportIssue,
  onVerificationDone,
}) => {
  if (!object) return null;

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  // Issues linked to this object, sorted by severity then votes
  const objectIssues = useMemo(() => {
    return issues
      .filter((i) => i.objectId === object.id)
      .sort((a, b) => {
        if (SEVERITY_WEIGHT[a.severity] !== SEVERITY_WEIGHT[b.severity])
          return SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
        return b.votes - a.votes;
      });
  }, [issues, object.id]);

  const stats = useMemo(() => {
    const total = objectIssues.length;
    const resolved = objectIssues.filter((i) => i.status === "Resolved").length;
    return { total, resolved, active: total - resolved };
  }, [objectIssues]);

  const typeColor = OBJECT_TYPE_COLOR[object.objectType] || "#4f46e5";
  const typeLabel = OBJECT_TYPE_LABEL[object.objectType] || object.objectType;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="px-6 pt-8 pb-6"
        style={{
          background: `linear-gradient(135deg, ${typeColor}15, ${typeColor}05)`,
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{ backgroundColor: typeColor }}
          >
            <Building2 size={24} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white mb-2"
              style={{ backgroundColor: typeColor }}
            >
              {typeLabel}
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
              {object.name}
            </h2>
            {object.nameRu && object.nameRu !== object.name && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {object.nameRu}
              </p>
            )}
            {(object.viloyat || object.tuman) && (
              <div className="flex items-center gap-1 mt-1.5 text-slate-500 dark:text-slate-400">
                <MapPin size={12} />
                <span className="text-xs font-bold">
                  {[object.tuman, object.viloyat].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        {stats.total > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              {
                label: "Всего",
                value: stats.total,
                color: "text-slate-600 dark:text-slate-300",
              },
              { label: "Активных", value: stats.active, color: "text-red-500" },
              {
                label: "Решено",
                value: stats.resolved,
                color: "text-emerald-500",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white/60 dark:bg-slate-800/40 rounded-xl p-2 text-center"
              >
                <div className={`text-lg font-black ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Condition details */}
        {object.details && Object.keys(object.details).length > 0 && (
          <div className="px-6 pt-4 pb-1">
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
              Состояние объекта
            </div>
            <div className="bg-white/60 dark:bg-slate-800/30 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 px-4 py-1">
              {Object.entries(object.details).map(([key, val]) => {
                if (!val && val !== 0) return null;
                const Icon = CONDITION_ICONS[key] || Info;
                return (
                  <InfoField
                    icon={Icon}
                    label={CONDITION_LABELS[key] || key}
                    value={String(val)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Government tasks + citizen verification */}
        <div className="px-6 pt-4 pb-1">
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <ClipboardCheck size={11} />
            Задачи и проверки
          </div>
          <TasksSection
            objectId={object.id}
            currentUser={currentUser}
            onVerificationDone={onVerificationDone}
          />
        </div>

        {/* Budget allocations (admin only) */}
        {isAdmin && (
          <div className="px-6 pt-4 pb-1">
            <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <ClipboardList size={11} />
              Бюджетные выделения
            </div>
            <AllocationSection
              targetType="object"
              targetId={object.id}
              currentUser={currentUser}
            />
          </div>
        )}

        {/* Linked issues */}
        <div className="px-6 pt-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Обращения граждан
            </h3>
            {objectIssues.length > 0 && (
              <div className="flex items-center gap-1 text-slate-400 dark:text-slate-600">
                <Info size={12} />
                <span className="text-[9px] font-bold">По приоритету</span>
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {objectIssues.length > 0 ? (
              objectIssues.map((issue) => (
                <button
                  key={issue.id}
                  onClick={() => onIssueClick(issue)}
                  className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 hover:border-blue-400 dark:hover:border-blue-500 transition-all flex items-center gap-3 text-left group shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`text-[9px] font-black uppercase ${
                          issue.status === "Resolved"
                            ? "text-green-500"
                            : issue.status === "In Progress"
                            ? "text-blue-500"
                            : "text-red-500"
                        }`}
                      >
                        {issue.status}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">
                        {issue.severity}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                      {issue.title}
                    </p>
                    {issue.votes > 0 && (
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        ▲ {issue.votes} голосов
                      </p>
                    )}
                  </div>
                  <ChevronRight
                    size={16}
                    className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 flex-shrink-0"
                  />
                </button>
              ))
            ) : (
              <div className="py-8 text-center">
                <Star className="w-8 h-8 text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-400 dark:text-slate-600">
                  Обращений не зарегистрировано
                </p>
              </div>
            )}
          </div>

          {/* Report issue — citizens only */}
          {currentUser?.role !== UserRole.ADMIN && (
            <button
              onClick={() => onReportIssue(object)}
              className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black uppercase tracking-wider shadow-lg transition-colors"
            >
              <Plus size={16} />
              Сообщить о проблеме
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
