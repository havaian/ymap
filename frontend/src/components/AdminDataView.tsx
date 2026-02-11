import React, { useState } from 'react';
import { Upload, Database, Trash2, FileSpreadsheet, Users, AlertCircle, CheckCircle2, Loader2, Download, BarChart3 } from 'lucide-react';
import { adminAPI } from '../services/api';

interface AdminDataViewProps {
  onDataImported?: () => void;
}

export const AdminDataView: React.FC<AdminDataViewProps> = ({ onDataImported }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  
  const [issuesCount, setIssuesCount] = useState(1000);
  const [includeComments, setIncludeComments] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<any>(null);
  
  const [isClearing, setIsClearing] = useState(false);
  const [clearResult, setClearResult] = useState<any>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleUploadOrganizations = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const response = await adminAPI.uploadOrganizations(selectedFile);

      if (response.data.success) {
        setUploadResult(response.data.data);
        setSelectedFile(null);
        if (onDataImported) onDataImported();
      } else {
        setUploadResult({ error: response.data.message });
      }
    } catch (error: any) {
      setUploadResult({ error: error.response?.data?.message || error.message || 'Upload failed' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSeedData = async () => {
    setIsSeeding(true);
    setSeedResult(null);

    try {
      const response = await adminAPI.seedData({ issuesCount, includeComments });

      if (response.data.success) {
        setSeedResult(response.data.data);
        if (onDataImported) onDataImported();
      } else {
        setSeedResult({ error: response.data.message });
      }
    } catch (error: any) {
      setSeedResult({ error: error.response?.data?.message || error.message || 'Seeding failed' });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearSeeded = async () => {
    if (!confirm('Вы уверены? Это удалит все автосгенерированные данные из базы.')) {
      return;
    }

    setIsClearing(true);
    setClearResult(null);

    try {
      const response = await adminAPI.clearSeeded();

      if (response.data.success) {
        setClearResult(response.data.data);
        if (onDataImported) onDataImported();
      } else {
        setClearResult({ error: response.data.message });
      }
    } catch (error: any) {
      setClearResult({ error: error.response?.data?.message || error.message || 'Clearing failed' });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col animate-in fade-in duration-300 overflow-y-auto">
      <div className="flex-shrink-0 p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Управление данными</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Импорт организаций и генерация тестовых данных</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Upload Organizations Section */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white">Импорт организаций</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Загрузите Excel файл с данными школ и медучреждений</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center"
                >
                  <Upload className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-3" />
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">
                    {selectedFile ? selectedFile.name : 'Нажмите для выбора файла'}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Поддерживаются форматы: .xlsx, .xls
                  </p>
                </label>
              </div>

              {selectedFile && (
                <button
                  onClick={handleUploadOrganizations}
                  disabled={isUploading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Загрузить данные
                    </>
                  )}
                </button>
              )}

              {uploadResult && (
                <div className={`p-4 rounded-2xl border ${uploadResult.error ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30' : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30'}`}>
                  <div className="flex items-start gap-3">
                    {uploadResult.error ? (
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm font-bold mb-2 ${uploadResult.error ? 'text-red-800 dark:text-red-300' : 'text-green-800 dark:text-green-300'}`}>
                        {uploadResult.error ? 'Ошибка загрузки' : 'Данные успешно импортированы!'}
                      </p>
                      {uploadResult.error ? (
                        <p className="text-xs text-red-600 dark:text-red-400">{uploadResult.error}</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-white dark:bg-slate-900/50 p-2 rounded-lg">
                            <span className="text-slate-500 dark:text-slate-400">Организаций:</span>
                            <span className="font-black text-green-700 dark:text-green-400 ml-2">{uploadResult.organizations || 0}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-900/50 p-2 rounded-lg">
                            <span className="text-slate-500 dark:text-slate-400">Пользователей:</span>
                            <span className="font-black text-green-700 dark:text-green-400 ml-2">{uploadResult.usersCreated || 0}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-900/50 p-2 rounded-lg">
                            <span className="text-slate-500 dark:text-slate-400">Инфраструктура:</span>
                            <span className="font-black text-green-700 dark:text-green-400 ml-2">{uploadResult.infrastructure || 0}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-900/50 p-2 rounded-lg">
                            <span className="text-slate-500 dark:text-slate-400">Пропущено:</span>
                            <span className="font-black text-slate-500 dark:text-slate-400 ml-2">{uploadResult.skipped || 0}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Seed Data Section */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white">Генерация тестовых данных</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Создайте реалистичные обращения для демонстрации</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                  Количество обращений
                </label>
                <input
                  type="number"
                  value={issuesCount}
                  onChange={(e) => setIssuesCount(parseInt(e.target.value))}
                  min="10"
                  max="10000"
                  step="100"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none dark:text-white"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Рекомендуется: 500-2000 для оптимальной производительности</p>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <input
                  type="checkbox"
                  id="include-comments"
                  checked={includeComments}
                  onChange={(e) => setIncludeComments(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="include-comments" className="text-sm font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                  Добавить комментарии к обращениям
                </label>
              </div>

              <button
                onClick={handleSeedData}
                disabled={isSeeding}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSeeding ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Генерация данных...
                  </>
                ) : (
                  <>
                    <Database className="w-5 h-5" />
                    Сгенерировать данные
                  </>
                )}
              </button>

              {seedResult && (
                <div className={`p-4 rounded-2xl border ${seedResult.error ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30' : 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/30'}`}>
                  <div className="flex items-start gap-3">
                    {seedResult.error ? (
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm font-bold mb-2 ${seedResult.error ? 'text-red-800 dark:text-red-300' : 'text-purple-800 dark:text-purple-300'}`}>
                        {seedResult.error ? 'Ошибка генерации' : 'Данные успешно созданы!'}
                      </p>
                      {seedResult.error ? (
                        <p className="text-xs text-red-600 dark:text-red-400">{seedResult.error}</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-white dark:bg-slate-900/50 p-2 rounded-lg text-center">
                            <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{seedResult.generated || 0}</div>
                            <div className="text-slate-500 dark:text-slate-400 mt-1">Обращений</div>
                          </div>
                          <div className="bg-white dark:bg-slate-900/50 p-2 rounded-lg text-center">
                            <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{seedResult.users || 0}</div>
                            <div className="text-slate-500 dark:text-slate-400 mt-1">Пользователей</div>
                          </div>
                          <div className="bg-white dark:bg-slate-900/50 p-2 rounded-lg text-center">
                            <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{seedResult.comments || 0}</div>
                            <div className="text-slate-500 dark:text-slate-400 mt-1">Комментариев</div>
                          </div>
                          <div className="bg-white dark:bg-slate-900/50 p-2 rounded-lg text-center">
                            <div className="text-2xl font-black text-purple-600 dark:text-purple-400">{seedResult.organizations || 0}</div>
                            <div className="text-slate-500 dark:text-slate-400 mt-1">Организаций</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Clear Seeded Data Section */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-red-200 dark:border-red-900/30 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-red-100 dark:border-red-900/30 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20">
              <div className="flex items-center gap-3">
                <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                <div>
                  <h3 className="text-lg font-black text-slate-800 dark:text-white">Очистка тестовых данных</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Удалить все автосгенерированные обращения</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-2xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-red-800 dark:text-red-300 mb-1">Внимание!</p>
                    <p className="text-xs text-red-700 dark:text-red-400">
                      Эта операция удалит все автоматически созданные обращения, комментарии и пользователей. 
                      Данные организаций не будут затронуты.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleClearSeeded}
                disabled={isClearing}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isClearing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Удаление...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    Удалить тестовые данные
                  </>
                )}
              </button>

              {clearResult && (
                <div className={`p-4 rounded-2xl border ${clearResult.error ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30' : 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30'}`}>
                  <div className="flex items-start gap-3">
                    {clearResult.error ? (
                      <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm font-bold mb-2 ${clearResult.error ? 'text-red-800 dark:text-red-300' : 'text-green-800 dark:text-green-300'}`}>
                        {clearResult.error ? 'Ошибка удаления' : 'Данные успешно удалены!'}
                      </p>
                      {clearResult.error ? (
                        <p className="text-xs text-red-600 dark:text-red-400">{clearResult.error}</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div className="bg-white dark:bg-slate-900/50 p-2 rounded-lg">
                            <span className="text-slate-500 dark:text-slate-400">Обращений:</span>
                            <span className="font-black text-green-700 dark:text-green-400 ml-2">{clearResult.issues || 0}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-900/50 p-2 rounded-lg">
                            <span className="text-slate-500 dark:text-slate-400">Комментариев:</span>
                            <span className="font-black text-green-700 dark:text-green-400 ml-2">{clearResult.comments || 0}</span>
                          </div>
                          <div className="bg-white dark:bg-slate-900/50 p-2 rounded-lg">
                            <span className="text-slate-500 dark:text-slate-400">Пользователей:</span>
                            <span className="font-black text-green-700 dark:text-green-400 ml-2">{clearResult.users || 0}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};