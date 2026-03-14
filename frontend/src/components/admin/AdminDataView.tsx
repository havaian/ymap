// frontend/src/components/admin/AdminDataView.tsx

import React, { useState, useEffect, useRef } from "react";
import {
  RefreshCw,
  Database,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  BarChart3,
  Cloud,
  Layers
} from "lucide-react";
import { adminAPI } from "../../services/api";
import { ProgramsSection } from "./ProgramsSection";

interface AdminDataViewProps {
  onDataImported?: () => void;
}

interface JobState {
  jobId: string;
  status: "running" | "done" | "error";
  phase: string;
  progress: number;
  total: number;
  result: any;
  error: string | null;
}

// ── Sync progress block ───────────────────────────────────────────────────────

const PHASE_LABELS: Record<string, string> = {
  fetching_ssv: "Загрузка: ФАП и СВП",
  processing_ssv: "Обработка: ФАП и СВП",
  fetching_bogcha: "Загрузка: Детские сады",
  processing_bogcha: "Обработка: Детские сады",
  fetching_maktab44: "Загрузка: Школы",
  processing_maktab44: "Обработка: Школы",
  done: "Завершено",
};

function SyncProgress({ job, onDone }: { job: JobState; onDone: () => void }) {
  const phasePct =
    job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0;
  const isDone = job.status === "done";
  const isError = job.status === "error";

  return (
    <div
      className={`p-5 rounded-2xl border space-y-4 ${
        isError
          ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30"
          : isDone
          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30"
          : "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex-shrink-0 ${
            isError
              ? "text-red-600 dark:text-red-400"
              : isDone
              ? "text-green-600 dark:text-green-400"
              : "text-blue-600 dark:text-blue-400"
          }`}
        >
          {isError ? (
            <AlertCircle className="w-5 h-5" />
          ) : isDone ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <Loader2 className="w-5 h-5 animate-spin" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-black ${
              isError
                ? "text-red-800 dark:text-red-300"
                : isDone
                ? "text-green-800 dark:text-green-300"
                : "text-blue-800 dark:text-blue-300"
            }`}
          >
            {isError
              ? "Ошибка синхронизации"
              : isDone
              ? "Синхронизация завершена!"
              : "Синхронизация..."}
          </p>
          {!isDone && !isError && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              {PHASE_LABELS[job.phase] || job.phase}
              {job.total > 0 && ` — ${job.progress} / ${job.total}`}
            </p>
          )}
        </div>
      </div>

      {!isDone && !isError && job.total > 0 && (
        <div className="space-y-1">
          <div className="h-2 bg-blue-200 dark:bg-blue-900/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-200"
              style={{ width: `${phasePct}%` }}
            />
          </div>
          <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold text-right">
            {phasePct}%
          </p>
        </div>
      )}

      {isError && (
        <p className="text-xs text-red-600 dark:text-red-400 font-medium">
          {job.error}
        </p>
      )}

      {isDone && job.result && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-white dark:bg-slate-900/50 p-2 rounded-xl text-center">
            <div className="text-lg font-black text-green-700 dark:text-green-400">
              {job.result.inserted ?? 0}
            </div>
            <div className="text-slate-500 dark:text-slate-400 mt-0.5">
              Добавлено
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900/50 p-2 rounded-xl text-center">
            <div className="text-lg font-black text-blue-700 dark:text-blue-400">
              {job.result.updated ?? 0}
            </div>
            <div className="text-slate-500 dark:text-slate-400 mt-0.5">
              Обновлено
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900/50 p-2 rounded-xl text-center">
            <div className="text-lg font-black text-slate-500 dark:text-slate-400">
              {job.result.skipped ?? 0}
            </div>
            <div className="text-slate-500 dark:text-slate-400 mt-0.5">
              Пропущено
            </div>
          </div>
        </div>
      )}

      {(isDone || isError) && (
        <button
          onClick={onDone}
          className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-colors"
        >
          Закрыть
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export const AdminDataView: React.FC<AdminDataViewProps> = ({
  onDataImported,
}) => {
  const [syncJob, setSyncJob] = useState<JobState | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [issuesCount, setIssuesCount] = useState(1000);
  const [includeComments, setIncludeComments] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<any>(null);

  const [isClearing, setIsClearing] = useState(false);
  const [clearResult, setClearResult] = useState<any>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll sync job status every 2 s while running
  useEffect(() => {
    if (!syncJob || syncJob.status !== "running") {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const response = await adminAPI.getJobStatus(syncJob.jobId);
        if (response.data.success) {
          const job = response.data.data;
          setSyncJob((prev) => (prev ? { ...prev, ...job } : null));
          if (job.status === "done" && onDataImported) onDataImported();
        }
      } catch {
        // Network blip — keep polling
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [syncJob?.jobId, syncJob?.status]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await adminAPI.syncObjects();
      if (response.data.success) {
        const { jobId } = response.data.data;
        setSyncJob({
          jobId,
          status: "running",
          phase: "fetching_ssv",
          progress: 0,
          total: 0,
          result: null,
          error: null,
        });
      } else {
        setSyncJob({
          jobId: "",
          status: "error",
          phase: "",
          progress: 0,
          total: 0,
          result: null,
          error: response.data.message || "Ошибка запуска",
        });
      }
    } catch (error: any) {
      setSyncJob({
        jobId: "",
        status: "error",
        phase: "",
        progress: 0,
        total: 0,
        result: null,
        error: error.response?.data?.message || error.message || "Ошибка",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    setSeedResult(null);
    try {
      const response = await adminAPI.seedData({
        issuesCount,
        includeComments,
      });
      setSeedResult(
        response.data.success
          ? response.data.data
          : { error: response.data.message }
      );
      if (response.data.success && onDataImported) onDataImported();
    } catch (error: any) {
      setSeedResult({
        error:
          error.response?.data?.message || error.message || "Seeding failed",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearSeeded = async () => {
    if (
      !confirm("Вы уверены? Это удалит все автосгенерированные данные из базы.")
    )
      return;
    setIsClearing(true);
    setClearResult(null);
    try {
      const response = await adminAPI.clearSeeded();
      setClearResult(
        response.data.success
          ? response.data.data
          : { error: response.data.message }
      );
      if (response.data.success && onDataImported) onDataImported();
    } catch (error: any) {
      setClearResult({
        error:
          error.response?.data?.message || error.message || "Clearing failed",
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col animate-in fade-in duration-100 overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0 p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                Управление данными
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Синхронизация объектов и тестовые данные
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* ── Sync from duasr.uz ── */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <div className="flex items-center gap-3">
                <Cloud className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white">
                    Синхронизация объектов
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Загрузка актуальных данных из duasr.uz (ФАП, детские сады,
                    школы)
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {!syncJob ? (
                <>
                  <div className="flex items-start gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                    <RefreshCw className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Синхронизация загружает все объекты из трёх источников
                      (/api4/ssv, /api4/bogcha, /api4/maktab44) и обновляет базу
                      данных без удаления существующих данных. Координаты
                      расставляются случайно в пределах района.
                    </p>
                  </div>
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Запуск...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-5 h-5" /> Синхронизировать
                        объекты
                      </>
                    )}
                  </button>
                </>
              ) : (
                <SyncProgress job={syncJob} onDone={() => setSyncJob(null)} />
              )}
            </div>
          </div>

          {/* ── Seed test issues ── */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white">
                    Генерация тестовых обращений
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Создать случайные обращения для демонстрации
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Кол-во обращений
                  </label>
                  <input
                    type="number"
                    value={issuesCount}
                    onChange={(e) =>
                      setIssuesCount(parseInt(e.target.value) || 100)
                    }
                    min={10}
                    max={5000}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none dark:text-white"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-3 cursor-pointer pb-3">
                    <div
                      onClick={() => setIncludeComments(!includeComments)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        includeComments
                          ? "bg-purple-600"
                          : "bg-slate-300 dark:bg-slate-600"
                      } relative cursor-pointer`}
                    >
                      <div
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                          includeComments ? "left-7" : "left-1"
                        }`}
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      Комментарии
                    </span>
                  </label>
                </div>
              </div>

              <button
                onClick={handleSeedData}
                disabled={isSeeding}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSeeding ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Генерация...
                  </>
                ) : (
                  <>
                    <Database className="w-5 h-5" /> Сгенерировать данные
                  </>
                )}
              </button>

              {seedResult && (
                <div
                  className={`p-4 rounded-2xl border ${
                    seedResult.error
                      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30"
                      : "bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/30"
                  }`}
                >
                  {seedResult.error ? (
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                      {seedResult.error}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-white dark:bg-slate-900/50 p-2 rounded-xl text-center">
                        <div className="text-lg font-black text-purple-600 dark:text-purple-400">
                          {seedResult.generated || 0}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          Обращений
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900/50 p-2 rounded-xl text-center">
                        <div className="text-lg font-black text-purple-600 dark:text-purple-400">
                          {seedResult.users || 0}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          Пользователей
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900/50 p-2 rounded-xl text-center">
                        <div className="text-lg font-black text-purple-600 dark:text-purple-400">
                          {seedResult.comments || 0}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          Комментариев
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Clear seeded data ── */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-red-200 dark:border-red-900/30 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-red-100 dark:border-red-900/30 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20">
              <div className="flex items-center gap-3">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white">
                    Очистка тестовых данных
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Удалить все автосгенерированные обращения
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-400">
                    Удалит все автоматически созданные обращения, комментарии и
                    тестовых пользователей. Данные объектов затронуты не будут.
                  </p>
                </div>
              </div>

              <button
                onClick={handleClearSeeded}
                disabled={isClearing}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isClearing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Очистка...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" /> Очистить тестовые данные
                  </>
                )}
              </button>

              {clearResult && (
                <div
                  className={`p-4 rounded-2xl border ${
                    clearResult.error
                      ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30"
                      : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30"
                  }`}
                >
                  {clearResult.error ? (
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                      {clearResult.error}
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-white dark:bg-slate-900/50 p-2 rounded-xl text-center">
                        <div className="text-lg font-black text-green-700 dark:text-green-400">
                          {clearResult.issues || 0}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          Обращений
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900/50 p-2 rounded-xl text-center">
                        <div className="text-lg font-black text-green-700 dark:text-green-400">
                          {clearResult.comments || 0}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          Комментариев
                        </div>
                      </div>
                      <div className="bg-white dark:bg-slate-900/50 p-2 rounded-xl text-center">
                        <div className="text-lg font-black text-green-700 dark:text-green-400">
                          {clearResult.users || 0}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                          Пользователей
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Programs ── */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20">
              <div className="flex items-center gap-3">
                <Layers className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white">
                    Региональные программы
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Создание программ с массовым назначением задач на объекты
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <ProgramsSection />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
