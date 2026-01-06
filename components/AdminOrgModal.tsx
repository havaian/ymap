
import React, { useState } from 'react';
import { IssueCategory, Coordinates, Organization } from '../types';
import { X, Building2, MapPin, School, Hospital, CheckCircle2, Loader2 } from 'lucide-react';

interface AdminOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (org: Omit<Organization, 'id'>) => void;
  selectedLocation: Coordinates | null;
}

export const AdminOrgModal: React.FC<AdminOrgModalProps> = ({ isOpen, onClose, onSubmit, selectedLocation }) => {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [type, setType] = useState<IssueCategory.EDUCATION | IssueCategory.HEALTH>(IssueCategory.EDUCATION);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address || !selectedLocation) return;
    
    setIsSubmitting(true);
    setTimeout(() => {
      onSubmit({
        name,
        address,
        type,
        lat: selectedLocation.lat,
        lng: selectedLocation.lng
      });
      setIsSubmitting(false);
      setName('');
      setAddress('');
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden flex flex-col relative z-10 animate-in fade-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800">
        
        <div className="p-6 bg-gradient-to-br from-indigo-600 to-blue-700 text-white relative">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition">
            <X size={20} />
          </button>
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4">
            <Building2 size={24} />
          </div>
          <h2 className="text-2xl font-black tracking-tight">Новое учреждение</h2>
          <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest mt-1">Добавление соц. объекта на карту</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Тип объекта</label>
            <div className="grid grid-cols-2 gap-2">
              <button 
                type="button"
                onClick={() => setType(IssueCategory.EDUCATION)}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all ${type === IssueCategory.EDUCATION ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'}`}
              >
                <School size={16} /> <span className="text-xs font-bold">Школа / Сад</span>
              </button>
              <button 
                type="button"
                onClick={() => setType(IssueCategory.HEALTH)}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl border transition-all ${type === IssueCategory.HEALTH ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'}`}
              >
                <Hospital size={16} /> <span className="text-xs font-bold">Медцентр</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Название учреждения</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Школа №123 им. Амира Темура"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Адрес (Улица, дом)</label>
            <input 
              type="text" 
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="ул. Мукими, 12"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white transition"
              required
            />
          </div>

          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center gap-3 border border-dashed border-indigo-200 dark:border-indigo-800">
            <MapPin className="text-indigo-600 dark:text-indigo-400 w-4 h-4 shrink-0" />
            <div className="text-[10px] font-bold text-indigo-800 dark:text-indigo-300">
              {selectedLocation ? `Координаты: ${selectedLocation.lat.toFixed(5)}, ${selectedLocation.lng.toFixed(5)}` : 'Местоположение не выбрано'}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting || !name || !address}
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 size={16} />}
            Создать объект
          </button>
        </form>
      </div>
    </div>
  );
};
