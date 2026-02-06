
import React from 'react';
import { X, Globe, Shield, Sparkles, Map, Heart, Code2, Zap, Layout } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md transition-opacity" onClick={onClose} />

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] relative z-10 animate-in fade-in zoom-in-95 duration-300 border border-slate-200 dark:border-slate-800">
        
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 dark:bg-blue-400/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>

        <div className="p-8 pb-4 flex justify-between items-center border-b border-slate-50 dark:border-slate-800 relative">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/20">
               <Map size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Y.<span className="text-blue-600">Map</span></h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Civic Infrastructure Ecosystem</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition text-slate-400">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="space-y-12">
            
            <section>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Globe size={16} className="text-blue-500" />
                Наша Миссия
              </h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                <strong className="text-slate-800 dark:text-white">Y.Map</strong> — это цифровая платформа следующего поколения для улучшения социальной инфраструктуры Узбекистана. Мы верим, что современные технологии могут сделать взаимодействие гражданина и государства мгновенным, прозрачным и эффективным. 
                Наша цель — создать среду, где каждый отчет превращается в конкретное действие.
              </p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <FeatureItem 
                icon={<Sparkles className="text-purple-500" />} 
                title="Интеллект Gemini" 
                description="Мы используем Gemini 3 для мгновенной классификации проблем. ИИ понимает контекст и помогает госслужбам расставить приоритеты." 
               />
               <FeatureItem 
                icon={<Shield className="text-green-500" />} 
                title="Абсолютная прозрачность" 
                description="Все обращения находятся в открытом доступе. Жители могут голосовать за проблемы соседей, повышая их статус в очереди на ремонт." 
               />
               <FeatureItem 
                icon={<Layout className="text-blue-500" />} 
                title="Интуитивный UI" 
                description="Адаптивный интерфейс, работающий одинаково быстро на мобильных устройствах и десктопах." 
               />
               <FeatureItem 
                icon={<Zap className="text-amber-500" />} 
                title="Real-time аналитика" 
                description="Автоматическое построение тепловых карт и статистических дашбордов для управления развитием районов." 
               />
            </div>

            <section className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 relative">
               <div className="flex items-center gap-3 mb-6">
                 <Code2 className="text-slate-400" size={18} />
                 <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Технологический стек</h4>
               </div>
               <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-4">
                  <TechBadge label="React 19" sub="Framework" />
                  <TechBadge label="Gemini API" sub="AI Engine" />
                  <TechBadge label="Leaflet JS" sub="Geodata" />
                  <TechBadge label="Tailwind CSS" sub="Styling" />
                  <TechBadge label="Lucide" sub="Iconography" />
                  <TechBadge label="CARTO Maps" sub="Tile Services" />
               </div>
            </section>

            <section className="text-center pt-6 pb-4">
               <div className="inline-flex flex-col items-center">
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-black text-xl mb-1">
                    <span>By YTech team</span>
                    <Heart size={20} className="text-red-500 fill-red-500 animate-pulse" />
                    <span>2025</span>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">
                    Engineering the future of Uzbekistan
                  </p>
                  <div className="mt-8 px-6 py-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                      Hackathon social infrastructure project
                    </p>
                  </div>
               </div>
            </section>

          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-50 dark:border-slate-800 flex justify-center">
           <button 
            onClick={onClose}
            className="w-full max-w-sm bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl shadow-blue-500/20 transition-all active:scale-95"
           >
             Вернуться к платформе
           </button>
        </div>
      </div>
    </div>
  );
};

const FeatureItem = ({ icon, title, description }: any) => (
  <div className="flex gap-5">
    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-100 dark:border-slate-700 shadow-sm">
      {icon}
    </div>
    <div>
      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-1.5">{title}</h4>
      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
    </div>
  </div>
);

const TechBadge = ({ label, sub }: { label: string, sub: string }) => (
  <div className="flex flex-col">
    <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">{label}</span>
    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{sub}</span>
  </div>
);
