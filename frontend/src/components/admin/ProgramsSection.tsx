// frontend/src/components/admin/ProgramsSection.tsx

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  Plus,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Layers,
  RefreshCw,
  Trash2,
  MapPin,
  X,
} from "lucide-react";
import { regionsAPI, programsAPI, districtsAPI, tasksAPI } from "../../services/api";
import { CustomSelect } from "../common/CustomSelect";
import { Program } from "../../../types";

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active: {
    label: "Активна",
    color: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
  },
  completed: {
    label: "Завершена",
    color: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
  },
  cancelled: {
    label: "Отменена",
    color: "text-slate-400 bg-slate-100 dark:bg-slate-800",
  },
};

const TYPE_LABELS: Record<string, string> = {
  school: "Школы",
  kindergarten: "Дет. сады",
  health_post: "ФАП/СВП",
};

interface RegionOption {
  value: number;
  label: string;
}
interface DistrictOption {
  value: string;
  label: string;
}

// ── Create program form ───────────────────────────────────────────────────────

function CreateProgramForm({ onCreated }: { onCreated: (p: Program) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [objectTypes, setObjectTypes] = useState<string[]>([]);
  const [regionCode, setRegionCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [districtId, setDistrictId] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [currency, setCurrency] = useState<"UZS" | "USD">("UZS");

  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);

  // Загружаем регионы при открытии формы:
  useEffect(() => {
    if (!open) return;
    regionsAPI
      .getAll()
      .then((res) => {
        if (res.data?.success) {
          setRegions(
            (res.data.data || []).map((r: any) => ({
              value: r.code,
              label: r.name?.ru || r.name?.en || `Регион ${r.code}`,
            }))
          );
        }
      })
      .catch(() => {});
  }, [open]);

  // Загружаем районы при выборе региона:
  useEffect(() => {
    if (!regionCode) {
      setDistricts([]);
      setDistrictId("");
      return;
    }
    setLoadingDistricts(true);
    districtsAPI
      .getAll({ regionCode: parseInt(regionCode) })
      .then((res) => {
        if (res.data?.success) {
          setDistricts(
            (res.data.data || []).map((d: any) => ({
              value: d.id,
              label: d.name?.ru || d.name?.en || d.name?.uz || d.id,
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoadingDistricts(false));
  }, [regionCode]);

  const toggleType = (t: string) =>
    setObjectTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Название обязательно");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await programsAPI.create({
        name: name.trim(),
        number: number.trim() || undefined,
        description: description.trim() || undefined,
        deadline: deadline || undefined,
        totalBudget: totalBudget ? parseFloat(totalBudget) : undefined,
        currency,
        scope: {
          objectTypes,
          regionCode: regionCode ? parseInt(regionCode) : null,
          districtId: districtId || null,
        },
      });
      if (res.data?.success) {
        onCreated(res.data.data);
        setOpen(false);
        setName("");
        setNumber("");
        setDescription("");
        setDeadline("");
        setObjectTypes([]);
        setRegionCode("");
        setDistrictId("");
        setTotalBudget("");
        setCurrency("UZS");
      }
    } catch (e: any) {
      setError(e.response?.data?.message || "Ошибка создания");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-sm font-black text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
      >
        <Plus size={16} /> Создать программу
      </button>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-black text-slate-700 dark:text-slate-200">
          Новая программа
        </span>
        <button
          onClick={() => setOpen(false)}
          className="text-slate-400 hover:text-slate-600"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Название *
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Напр. Ремонт школ 2025"
            className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            № постановления
          </label>
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="ПП-1234"
            className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Дедлайн
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
          />
        </div>
        <div className="col-span-2">
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Описание
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
          />
        </div>
      </div>

      {/* Scope */}
      <div>
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
          Типы объектов (пусто = все)
        </label>
        <div className="flex gap-2">
          {(["school", "kindergarten", "health_post"] as const).map((t) => (
            <button
              key={t}
              onClick={() => toggleType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-colors ${
                objectTypes.includes(t)
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700"
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <CustomSelect
        options={regions}
        value={regionCode ? Number(regionCode) : null}
        onChange={(v) => setRegionCode(v != null ? String(v) : "")}
        placeholder="Все регионы"
        heading="Выбор региона"
        icon={<MapPin size={13} />}
      />

      {/* Район — только если выбран регион */}
      {regionCode && (
        <div>
          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
            Район{" "}
            {loadingDistricts && (
              <span className="text-indigo-400">загрузка...</span>
            )}
          </label>
          <CustomSelect
            options={districts}
            value={districtId || null}
            onChange={(v) => setDistrictId(v ?? "")}
            placeholder={loadingDistricts ? "Загрузка..." : "Весь регион"}
            heading="Выбор района"
            clearLabel="Весь регион"
          />
        </div>
      )}

      {/* Бюджет */}
      <div className="col-span-2">
        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
          Бюджет программы
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            value={totalBudget}
            onChange={(e) => setTotalBudget(e.target.value)}
            placeholder="Сумма (необязательно)"
            className="flex-1 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "UZS" | "USD")}
            className="px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
          >
            <option value="UZS">UZS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>

      {error && <p className="text-xs font-bold text-red-500">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={saving}
        className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
      >
        {saving ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Plus size={15} />
        )}
        {saving ? "Создание..." : "Создать"}
      </button>
    </div>
  );
}

// ── Program objects list ──────────────────────────────────────────────────────

const TASK_STATUS_COLOR: Record<string, string> = {
  Planned:              'text-slate-400',
  'In Progress':        'text-blue-500',
  'Pending Verification': 'text-amber-500',
  Completed:            'text-emerald-500',
  Failed:               'text-red-500',
};

const TASK_STATUS_LABEL: Record<string, string> = {
  Planned:              'Запланировано',
  'In Progress':        'В работе',
  'Pending Verification': 'На проверке',
  Completed:            'Выполнено',
  Failed:               'Не выполнено',
};

const TYPE_SHORT: Record<string, string> = {
  school: 'Школа', kindergarten: 'Дет.сад', health_post: 'ФАП',
};

function ProgramObjectsList({ programId }: { programId: string }) {
  const [objects, setObjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (programsAPI as any).getProgramObjects(programId)
      .then((res: any) => { if (mounted && res.data?.success) setObjects(res.data.data); })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [programId]);

  if (loading) return (
    <div className="flex items-center gap-2 text-slate-400 text-xs py-3 justify-center">
      <Loader2 size={12} className="animate-spin" /> Загрузка объектов...
    </div>
  );

  if (!objects.length) return (
    <p className="text-xs text-slate-400 text-center py-3">Нет объектов</p>
  );

  return (
    <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar pr-1">
      {objects.map(obj => (
        <div key={obj.id} className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Object header */}
          <div className="flex items-center gap-2 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-800 dark:text-white truncate">{obj.name}</p>
              <p className="text-[10px] text-slate-400">{TYPE_SHORT[obj.objectType] || obj.objectType} · {obj.tuman || obj.viloyat || '—'}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Map button */}
              <button
                onClick={() => navigate(`/map/objects/${obj.id}`)}
                className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black hover:bg-blue-100 transition-colors flex items-center gap-1"
                title="Открыть на карте"
              >
                <MapPin size={10} /> Карта
              </button>
              {/* Toggle tasks */}
              {obj.tasks.length > 0 && (
                <button
                  onClick={() => setExpandedId(expandedId === obj.id ? null : obj.id)}
                  className="px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-black hover:bg-indigo-100 transition-colors flex items-center gap-1"
                >
                  <Layers size={10} /> {obj.tasks.length} задач
                  {expandedId === obj.id ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </button>
              )}
            </div>
          </div>

          {/* Tasks list */}
          {expandedId === obj.id && (
            <div className="border-t border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/50">
              {obj.tasks.map((task: any) => (
                <div key={task.id} className="px-3 py-2 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">{task.title}</p>
                    {task.deadline && (
                      <p className="text-[10px] text-slate-400">
                        до {new Date(task.deadline).toLocaleDateString('ru-RU')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {task.totalCount > 0 && (
                      <span className="text-[10px] font-bold text-slate-400">
                        <span className="text-emerald-500">{task.doneCount}✓</span>
                        {task.problemCount > 0 && <span className="text-red-500 ml-1">{task.problemCount}✗</span>}
                        /{task.totalCount}
                      </span>
                    )}
                    <span className={`text-[10px] font-black uppercase ${TASK_STATUS_COLOR[task.status] || 'text-slate-400'}`}>
                      {TASK_STATUS_LABEL[task.status] || task.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Program row ───────────────────────────────────────────────────────────────

function ProgramRow({
  program,
  onDeleted,
  isAdmin = false,
}: {
  program: Program;
  onDeleted: (id: string) => void;
  isAdmin?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignResult, setAssignResult] = useState<{
    assigned: number;
    total: number;
  } | null>(null);

  // Bulk tasks state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [bulking, setBulking] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    created: number;
    skipped: number;
  } | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const cfg = STATUS_LABEL[program.status] || STATUS_LABEL.active;

  const handleAssign = async () => {
    setAssigning(true);
    setAssignResult(null);
    try {
      const res = await programsAPI.assignObjects(program.id);
      if (res.data?.success) setAssignResult(res.data.data);
    } finally {
      setAssigning(false);
    }
  };

  const handleBulkTasks = async () => {
    if (!taskTitle.trim()) return;
    setBulking(true);
    setBulkResult(null);
    setBulkError(null);
    try {
      const res = await (programsAPI as any).bulkCreateTasks(program.id, {
        title: taskTitle.trim(),
        description: taskDesc.trim() || undefined,
        deadline: taskDeadline || undefined,
      });
      if (res.data?.success) setBulkResult(res.data.data);
    } catch (e: any) {
      setBulkError(e.response?.data?.message || "Ошибка");
    } finally {
      setBulking(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Удалить программу "${program.name}"?`)) return;
    try {
      await programsAPI.delete(program.id);
      onDeleted(program.id);
    } catch {}
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${cfg.color}`}
            >
              {cfg.label}
            </span>
            {program.number && (
              <span className="text-[10px] font-bold text-slate-400">
                {program.number}
              </span>
            )}
          </div>
          <p className="text-sm font-black text-slate-800 dark:text-white leading-snug">
            {program.name}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {program.objectIds.length} объектов
            {program.scope.objectTypes.length > 0 && (
              <>
                {" "}
                ·{" "}
                {program.scope.objectTypes
                  .map((t) => TYPE_LABELS[t])
                  .join(", ")}
              </>
            )}
            {program.scope.regionCode && (
              <> · регион {program.scope.regionCode}</>
            )}
            {program.totalBudget && (
              <> · {(program.totalBudget / 1_000_000).toFixed(1)} млн {program.currency}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-lg"
            >
              <Trash2 size={13} />
            </button>
          )}
          {expanded ? (
            <ChevronUp size={15} className="text-slate-400" />
          ) : (
            <ChevronDown size={15} className="text-slate-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-100 dark:border-slate-800 pt-4">
          {program.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {program.description}
            </p>
          )}

          {/* Auto-assign objects */}
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Назначение объектов по фильтру
            </div>
            <button
              onClick={handleAssign}
              disabled={assigning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 text-xs font-black hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              {assigning ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RefreshCw size={13} />
              )}
              Автоназначить объекты
            </button>
            {assignResult && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-2">
                ✓ Назначено {assignResult.assigned}, всего {assignResult.total}{" "}
                объектов
              </p>
            )}
          </div>

          {/* Bulk tasks */}
          <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Массовое создание задач
            </div>
            <div className="space-y-2">
              <input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Название задачи для всех объектов *"
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              />
              <input
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Описание (необязательно)"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              />
              <input
                type="date"
                value={taskDeadline}
                onChange={(e) => setTaskDeadline(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              />
              <button
                onClick={handleBulkTasks}
                disabled={
                  bulking || !taskTitle.trim() || program.objectIds.length === 0
                }
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                {bulking ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Layers size={13} />
                )}
                {bulking
                  ? "Создание..."
                  : `Создать задачи для ${program.objectIds.length} объектов`}
              </button>
              {bulkResult && (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={13} />
                  Создано {bulkResult.created}, пропущено {bulkResult.skipped}
                </div>
              )}
              {bulkError && (
                <div className="flex items-center gap-2 text-xs font-bold text-red-500">
                  <AlertCircle size={13} /> {bulkError}
                </div>
              )}
              {program.objectIds.length === 0 && (
                <p className="text-[11px] text-amber-500 font-bold">
                  ⚠ Сначала назначьте объекты
                </p>
              )}
            </div>
          </div>

          {/* Objects list */}
          {program.objectIds.length > 0 && (
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Объекты программы ({program.objectIds.length})
              </div>
              <ProgramObjectsList programId={program.id} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export const ProgramsSection: React.FC<{ isAdmin?: boolean }> = ({
  isAdmin = false,
}) => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await programsAPI.getAll();
      if (res.data?.success) setPrograms(res.data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-xs py-4 justify-center">
          <Loader2 size={14} className="animate-spin" /> Загрузка программ...
        </div>
      ) : (
        <>
          {programs.map((p) => (
            <ProgramRow
              program={p}
              isAdmin={isAdmin}
              onDeleted={(id) =>
                setPrograms((prev) => prev.filter((x) => x.id !== id))
              }
            />
          ))}
          {programs.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">
              Программ нет
            </p>
          )}
        </>
      )}
      {isAdmin && (
        <CreateProgramForm
          onCreated={(p) => setPrograms((prev) => [p, ...prev])}
        />
      )}
    </div>
  );
};
