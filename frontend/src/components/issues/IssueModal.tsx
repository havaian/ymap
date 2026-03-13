// frontend/src/components/issues/IssueModal.tsx

import React, { useState, useEffect } from 'react';
import { IssueCategory, Severity, Coordinates, Organization, Infrastructure, IssueSubCategory } from '../../../types';
import { analyzeReportWithGemini } from '../../services/geminiService';
import { useOrganizations } from '../../hooks/useBackendData';
import { Loader2, Sparkles, MapPin, X, AlertTriangle, CheckCircle2, Building2, Search, Droplets, Zap, MoreHorizontal } from 'lucide-react';

interface IssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  selectedLocation: Coordinates | null;
  preSelectedOrg?: Organization | null;
  preSelectedInfra?: Infrastructure | null;
}

export const IssueModal: React.FC<IssueModalProps> = ({
  isOpen, onClose, onSubmit, selectedLocation, preSelectedOrg, preSelectedInfra
}) => {
  const [description, setDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(preSelectedOrg?.id || '');
  const [selectedSubCategory, setSelectedSubCategory] = useState<IssueSubCategory | undefined>(undefined);
  const [orgSearchTerm, setOrgSearchTerm] = useState('');

  // Get organizations from backend
  const { organizations } = useOrganizations();

  const [analysis, setAnalysis] = useState<{
    title: string;
    category: IssueCategory;
    subCategory?: IssueSubCategory;
    severity: Severity;
    summary: string;
  } | null>(null);

  useEffect(() => {
    if (preSelectedOrg) {
      setSelectedOrgId(preSelectedOrg.id);
      setAnalysis(prev => prev ? { ...prev, category: preSelectedOrg.type } : null);
    } else {
      setSelectedOrgId('');
    }
    if (!isOpen) {
      setDescription('');
      setAnalysis(null);
      setSelectedSubCategory(undefined);
      setOrgSearchTerm('');
    }
  }, [preSelectedOrg, preSelectedInfra, isOpen]);

  useEffect(() => {
    if (analysis?.subCategory) {
      setSelectedSubCategory(analysis.subCategory);
    }
  }, [analysis]);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!description.trim()) return;
    setIsAnalyzing(true);
    const result = await analyzeReportWithGemini(description);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  const isEducationOrHealth = analysis?.category === IssueCategory.EDUCATION || analysis?.category === IssueCategory.HEALTH;
  const isOrgRequired = isEducationOrHealth && !!preSelectedOrg;
  const canSubmit = analysis && (!isOrgRequired || selectedOrgId);

  const handleSubmit = () => {
    if (!analysis) return;
    const org = organizations.find(o => o.id === selectedOrgId);
    onSubmit({
      ...analysis,
      subCategory: selectedSubCategory,
      description,
      organizationId: selectedOrgId || undefined,
      organizationName: org?.name,
      infrastructureId: preSelectedInfra?.id || undefined,
      infrastructureName: preSelectedInfra?.name,
    });
  };

  const filteredOrgs = organizations.filter(org =>
    (analysis?.category ? org.type === analysis.category : true) &&
    org.name.toLowerCase().includes(orgSearchTerm.toLowerCase())
  );

  const subCategories = [
    { value: IssueSubCategory.WATER, label: 'Вода', icon: Droplets, color: 'text-blue-500' },
    { value: IssueSubCategory.ELECTRICITY, label: 'Электр', icon: Zap, color: 'text-yellow-500' },
    { value: IssueSubCategory.GENERAL, label: 'Другое', icon: MoreHorizontal, color: 'text-slate-500' },
  ];

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] relative z-10 animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">

        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1 opacity-90">
              <MapPin className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Новый отчет</span>
            </div>
            <h2 className="font-bold text-xl">Что произошло?</h2>
            {/* Show which entity this issue is being reported against */}
            {preSelectedInfra && (
              <p className="text-blue-100 text-xs font-bold mt-1 opacity-90">
                Объект: {preSelectedInfra.name}
              </p>
            )}
            {preSelectedOrg && (
              <p className="text-blue-100 text-xs font-bold mt-1 opacity-90">
                Учреждение: {preSelectedOrg.name}
              </p>
            )}
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {!selectedLocation && !preSelectedOrg && !preSelectedInfra && (
            <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-lg p-3 text-amber-800 dark:text-amber-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <p className="text-sm">Пожалуйста, выберите место или организацию на карте.</p>
            </div>
          )}

          <div className="space-y-4">
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

            <div className="flex justify-end">
              <button
                onClick={handleAnalyze}
                disabled={!description || isAnalyzing}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all
                  ${!description || isAnalyzing
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/25'
                  }`}
              >
                {isAnalyzing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Анализируем...</>
                  : <><Sparkles className="w-4 h-4" /> Анализировать</>
                }
              </button>
            </div>

            {analysis && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 space-y-3 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Заголовок</div>
                      <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{analysis.title}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-[11px] font-black">
                      {analysis.category}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                      analysis.severity === 'Critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                      analysis.severity === 'High' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                      analysis.severity === 'Medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' :
                      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    }`}>
                      {analysis.severity}
                    </span>
                  </div>
                  {analysis.summary && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{analysis.summary}</p>
                  )}
                </div>

                {/* Sub-category selector */}
                {(isEducationOrHealth || analysis.category === IssueCategory.OTHER) && (
                  <div>
                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Подкатегория</div>
                    <div className="flex gap-2">
                      {subCategories.map(sub => (
                        <button
                          key={sub.value}
                          onClick={() => setSelectedSubCategory(sub.value)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition-all ${
                            selectedSubCategory === sub.value
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-300'
                          }`}
                        >
                          <sub.icon size={13} className={selectedSubCategory === sub.value ? 'text-white' : sub.color} />
                          <span className="text-[10px] font-bold uppercase">{sub.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Org picker — only for education/health and only when not reporting from infra */}
                {isEducationOrHealth && !preSelectedInfra && (
                  <div className={`rounded-2xl p-4 transition-colors border ${
                    isOrgRequired
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/30'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="text-sm font-bold text-indigo-800 dark:text-indigo-200">
                          Привязать к организации {isOrgRequired && <span className="text-red-500">*</span>}
                        </span>
                      </div>
                      {!isOrgRequired && selectedOrgId && (
                        <button
                          onClick={() => setSelectedOrgId('')}
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
                        placeholder="Поиск учреждения..."
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300 dark:text-white"
                        value={orgSearchTerm}
                        onChange={(e) => setOrgSearchTerm(e.target.value)}
                      />
                    </div>

                    <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar">
                      {filteredOrgs.map(org => (
                        <button
                          key={org.id}
                          onClick={() => setSelectedOrgId(org.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                            selectedOrgId === org.id
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {org.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex justify-end gap-3 transition-colors">
          <button onClick={onClose} className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl font-medium text-sm transition">
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow-md transition-all flex items-center gap-2
              ${!canSubmit
                ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 hover:shadow-lg'
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