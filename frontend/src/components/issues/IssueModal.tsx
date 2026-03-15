// frontend/src/components/issues/IssueModal.tsx

import React, { useState, useEffect } from "react";
import {
  IssueCategory,
  Severity,
  Coordinates,
  IssueSubCategory,
  FacilityObject,
} from "../../../types";
import {
  analyzeReportWithGemini,
  AnalysisResult,
  AnalysisContext,
  TaskSignal,
  FieldSignal,
} from "../../services/geminiService";
import { tasksAPI } from "../../services/api";
import { useObjects } from "../../hooks/useBackendData";
import {
  Loader2,
  Sparkles,
  MapPin,
  X,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Search,
  Droplets,
  Zap,
  MoreHorizontal,
  ClipboardList,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

interface IssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  selectedLocation: Coordinates | null;
  preSelectedObject?: FacilityObject | null;
}

const OBJECT_TYPE_CATEGORY: Record<string, IssueCategory> = {
  school: IssueCategory.EDUCATION,
  kindergarten: IssueCategory.EDUCATION,
  health_post: IssueCategory.HEALTH,
};

// ── Метаданные верифицируемых полей (для контекста Gemini) ─────────────────────

const VERIFIABLE_FIELD_LABELS: Record<string, string> = {
  materialSten:      "Стены",
  elektrKunDavomida: "Электричество",
  ichimlikSuviManbaa:"Водоснабжение",
  internet:          "Интернет",
  binoIchidaSuv:     "Вода в здании",
  kapitalTamir:      "Капремонт",
  smena:             "Смены",
  sportZalHolati:    "Спортзал",
  aktivZalHolati:    "Актовый зал",
  oshhonaHolati:     "Столовая",
};

const FIELD_VALUE_TRANSLATIONS_FOR_CONTEXT: Record<string, Record<string, string>> = {
  materialSten:       { gisht: "Кирпич", beton: "Бетон", paxsa: "Глинобит", tosh: "Камень" },
  aktivZalHolati:     { aktiv_zal_umuman_yuq: "Актового зала нет", aktiv_zal_qoniqarli: "Удовлетворительное состояние", aktiv_zal_bor_mebel_yuq: "Отсутствует мебель", aktiv_zal_qisman_tamir: "Частичный ремонт" },
  oshhonaHolati:      { oshhona_bor_ishlamaydi: "Столовая не работает", oshhona_holati_qoniqarli: "Удовлетворительное состояние", oshhona_holati_qisman_tamir: "Частичный ремонт", oshhona_umuman_yuq: "Столовой нет" },
  elektrKunDavomida:  { elektr_qisman: "Частично", elektr_bor: "Электричество есть", elektr_yuq: "Электричества нет" },
  ichimlikSuviManbaa: { ichimlik_suvi_manbaa_lokal: "Локальный источник", ichimlik_suvi_manbaa_markaz: "Центральный источник", ichimlik_suvi_manbaa_olib_kelinadi: "Привозная вода", ichimlik_suvi_yuq: "Питьевой воды нет", yuq: "Воды нет", vodoprovod_suvi: "Водопровод", yer_osti_suvi: "Скважина", avtosisterna: "Автоцистерна", qadoqlangan_suv: "Бутилированная вода" },
  internet:           { internet_optika: "Оптоволокно", internet_mobil: "Мобильный интернет", umuman_yuq: "Интернета нет", shisha_tola: "Оптоволоконный", shaxsiy: "Личный", yuq: "Отсутствует" },
  kapitalTamir:       { yuq_remont: "Ремонта не было", ha_joriy: "Текущий ремонт", ha_kapital: "Капитальный", ha_rekon: "Реконструкция" },
  smena:              { "1": "Первая", "2": "Вторая" },
  sportZalHolati:     { sport_zal_umuman_yuq: "Спортзала нет", sport_zal_qisman_tamir: "Частичный ремонт", sport_zal_qoniqarli: "Удовлетворительное состояние" },
  binoIchidaSuv:      { quvur_yuq_suv_yuq: "Трубы нет, воды нет", kran_orqali: "Вода есть, посредством крана", quvur_bor_suv_yuq: "Труба есть, воды нет" },
};

export const IssueModal: React.FC<IssueModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  selectedLocation,
  preSelectedObject,
}) => {
  const [description, setDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string>(
    preSelectedObject?.id || ""
  );
  const [selectedSubCategory, setSelectedSubCategory] = useState<
    IssueSubCategory | undefined
  >(undefined);
  const [objectSearchTerm, setObjectSearchTerm] = useState("");

  const { objects } = useObjects();

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  // Reset / pre-fill when modal opens or preSelectedObject changes
  useEffect(() => {
    if (preSelectedObject) {
      setSelectedObjectId(preSelectedObject.id);
      const category = OBJECT_TYPE_CATEGORY[preSelectedObject.objectType];
      if (category)
        setAnalysis((prev) => (prev ? { ...prev, category } : null));
    } else {
      setSelectedObjectId("");
    }
    if (!isOpen) {
      setDescription("");
      setAnalysis(null);
      setSelectedSubCategory(undefined);
      setObjectSearchTerm("");
    }
  }, [preSelectedObject, isOpen]);

  useEffect(() => {
    if (analysis?.subCategory) setSelectedSubCategory(analysis.subCategory);
  }, [analysis]);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!description.trim()) return;
    setIsAnalyzing(true);

    let context: AnalysisContext | undefined;

    if (selectedObjectId) {
      try {
        // Fetch active tasks for the object
        const tasksRes = await tasksAPI.getByObject(selectedObjectId);
        const tasks = (tasksRes.data?.data || [])
          .filter((t: any) => t.status !== "Completed" && t.status !== "Failed")
          .map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description || undefined,
            status: t.status,
          }));

        // Build verifiable fields list from selected object's details
        const obj = objects.find((o) => o.id === selectedObjectId);
        const fields: AnalysisContext["fields"] = [];
        if (obj?.details) {
          for (const [key, val] of Object.entries(obj.details)) {
            if (val !== undefined && val !== null && VERIFIABLE_FIELD_LABELS[key]) {
              const map = FIELD_VALUE_TRANSLATIONS_FOR_CONTEXT[key];
              const translated = map ? (map[String(val)] ?? String(val)) : String(val);
              fields.push({ key, label: VERIFIABLE_FIELD_LABELS[key], value: translated });
            }
          }
        }

        if (tasks.length > 0 || fields.length > 0) {
          context = { tasks, fields };
        }
      } catch {
        // context остаётся undefined — анализ продолжается без него
      }
    }

    const result = await analyzeReportWithGemini(description, context);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const isEducationOrHealth =
    analysis?.category === IssueCategory.EDUCATION ||
    analysis?.category === IssueCategory.HEALTH;

  const canSubmit = analysis && (!isEducationOrHealth || selectedObjectId);

  const handleSubmit = () => {
    if (!analysis) return;
    const obj = objects.find((o) => o.id === selectedObjectId);
    onSubmit({
      ...analysis,
      subCategory: selectedSubCategory,
      description,
      objectId: selectedObjectId || undefined,
      objectName: obj?.name,
    });
  };

  // Only show education/health objects in the picker
  const filteredObjects = objects.filter((obj) => {
    const cat = OBJECT_TYPE_CATEGORY[obj.objectType];
    const matchesCategory = analysis?.category
      ? cat === analysis.category
      : true;
    const matchesSearch = obj.name
      .toLowerCase()
      .includes(objectSearchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const subCategories = [
    {
      value: IssueSubCategory.WATER,
      label: "Вода",
      icon: Droplets,
      color: "text-blue-500",
    },
    {
      value: IssueSubCategory.ELECTRICITY,
      label: "Электр",
      icon: Zap,
      color: "text-yellow-500",
    },
    {
      value: IssueSubCategory.GENERAL,
      label: "Другое",
      icon: MoreHorizontal,
      color: "text-slate-500",
    },
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] relative z-10 animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1 opacity-90">
              <MapPin className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Новый отчет
              </span>
            </div>
            <h2 className="font-bold text-xl">Что произошло?</h2>
            {preSelectedObject && (
              <p className="text-blue-100 text-xs font-bold mt-1 opacity-90">
                Объект: {preSelectedObject.name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="hover:bg-white/20 p-2 rounded-full transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {!selectedLocation && !preSelectedObject && (
            <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-lg p-3 text-amber-800 dark:text-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p className="text-sm">
                Пожалуйста, выберите место или объект на карте.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {/* Description textarea */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Опишите проблему
              </label>
              <textarea
                className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 text-sm focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none min-h-[120px] resize-none transition dark:text-white"
                placeholder="Например: В школе №110 пропало электричество..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Analyze button */}
            <div className="flex justify-end">
              <button
                onClick={handleAnalyze}
                disabled={!description || isAnalyzing}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                  !description || isAnalyzing
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/25"
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Анализ...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Анализировать
                  </>
                )}
              </button>
            </div>

            {/* Analysis result */}
            {analysis && (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                      {analysis.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {analysis.category}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-1 rounded-md flex-shrink-0 ${
                      analysis.severity === "Critical"
                        ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        : analysis.severity === "High"
                        ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                        : analysis.severity === "Medium"
                        ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300"
                        : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    }`}
                  >
                    {analysis.severity}
                  </span>
                </div>

                {analysis.summary && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {analysis.summary}
                  </p>
                )}

                {/* Task signals */}
                {analysis.taskSignals && analysis.taskSignals.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-1.5 mb-2">
                      <ClipboardList size={11} className="text-slate-400" />
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Связь с задачами
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {analysis.taskSignals.map((s: TaskSignal) => (
                        <div
                          key={s.taskId}
                          className={`flex items-start gap-2 px-2.5 py-2 rounded-xl text-xs ${
                            s.signal === "confirms"
                              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200"
                              : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200"
                          }`}
                        >
                          {s.signal === "confirms" ? (
                            <ShieldCheck size={12} className="flex-shrink-0 mt-0.5 text-emerald-500" />
                          ) : (
                            <ShieldAlert size={12} className="flex-shrink-0 mt-0.5 text-red-500" />
                          )}
                          <div className="min-w-0">
                            <span className="font-black">{s.taskTitle}</span>
                            <span className="opacity-70"> — {s.reason}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Field signals */}
                {analysis.fieldSignals && analysis.fieldSignals.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-1.5 mb-2">
                      <ShieldCheck size={11} className="text-slate-400" />
                      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Верификация полей
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {analysis.fieldSignals.map((s: FieldSignal) => (
                        <div
                          key={s.field}
                          className={`flex items-start gap-2 px-2.5 py-2 rounded-xl text-xs ${
                            s.signal === "confirms"
                              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200"
                              : "bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200"
                          }`}
                        >
                          {s.signal === "confirms" ? (
                            <ShieldCheck size={12} className="flex-shrink-0 mt-0.5 text-emerald-500" />
                          ) : (
                            <ShieldAlert size={12} className="flex-shrink-0 mt-0.5 text-amber-500" />
                          )}
                          <div className="min-w-0">
                            <span className="font-black">{s.fieldLabel}</span>
                            <span className="opacity-70"> — {s.reason}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-category picker */}
                {(isEducationOrHealth ||
                  analysis.category === IssueCategory.OTHER) && (
                  <div>
                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                      Подкатегория
                    </div>
                    <div className="flex gap-2">
                      {subCategories.map((sub) => (
                        <button
                          key={sub.value}
                          onClick={() => setSelectedSubCategory(sub.value)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition-all ${
                            selectedSubCategory === sub.value
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-300"
                          }`}
                        >
                          <sub.icon
                            size={13}
                            className={
                              selectedSubCategory === sub.value
                                ? "text-white"
                                : sub.color
                            }
                          />
                          <span className="text-[10px] font-bold uppercase">
                            {sub.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Object picker — for education/health categories */}
                {isEducationOrHealth && !preSelectedObject && (
                  <div
                    className={`rounded-2xl p-4 transition-colors border ${
                      !selectedObjectId
                        ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-sm font-bold text-indigo-800 dark:text-indigo-200">
                          Привязать к объекту{" "}
                          <span className="text-red-500">*</span>
                        </span>
                      </div>
                      {selectedObjectId && (
                        <button
                          onClick={() => setSelectedObjectId("")}
                          className="text-[10px] text-slate-400 dark:text-slate-600 hover:text-red-500 font-bold uppercase"
                        >
                          Очистить
                        </button>
                      )}
                    </div>

                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Поиск объекта..."
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300 dark:text-white"
                        value={objectSearchTerm}
                        onChange={(e) => setObjectSearchTerm(e.target.value)}
                      />
                    </div>

                    <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                      {filteredObjects.slice(0, 50).map((obj) => (
                        <button
                          key={obj.id}
                          onClick={() => setSelectedObjectId(obj.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                            selectedObjectId === obj.id
                              ? "bg-indigo-600 text-white font-bold"
                              : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-100 dark:hover:bg-slate-700"
                          }`}
                        >
                          <span className="font-bold">{obj.name}</span>
                          {obj.tuman && (
                            <span
                              className={`ml-1 ${
                                selectedObjectId === obj.id
                                  ? "text-indigo-200"
                                  : "text-slate-400"
                              }`}
                            >
                              · {obj.tuman}
                            </span>
                          )}
                        </button>
                      ))}
                      {filteredObjects.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-2">
                          Объекты не найдены
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl font-medium text-sm transition"
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 ${
              !canSubmit
                ? "bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 hover:shadow-lg"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Отправить отчет
          </button>
        </div>
      </div>
    </div>
  );
};
