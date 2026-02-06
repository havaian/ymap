import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapComponent } from './components/MapComponent';
import { DetailSidebar } from './components/DetailSidebar';
import { OrgSidebar } from './components/OrgSidebar';
import { IssueModal } from './components/IssueModal';
import { AboutModal } from './components/AboutModal';
import { NotificationContainer, Toast } from './components/Notification';
import { ListView } from './components/ListView';
import { StatisticsView } from './components/StatisticsView';
import { BurgerMenu } from './components/BurgerMenu';
import { LoginView } from './components/LoginView';
import { AdminUserView } from './components/AdminUserView';
import { AdminOrgModal } from './components/AdminOrgModal';
import { MapPlusIcon } from './components/MapPlusIcon';
import { Issue, Coordinates, Comment, IssueCategory, Organization, User, UserRole } from '../types';
import { TASHKENT_CENTER, CATEGORY_COLORS } from './constants';
import { useIssues, useOrganizations, useUsers } from './hooks/useBackendData';
import { authAPI } from './services/api';
import { 
  Plus, Menu, Navigation, Locate, Building2, Flame, 
  ChevronDown, Car, Droplets, Zap, GraduationCap, 
  Stethoscope, Trash2, HelpCircle, Layers, ShieldCheck
} from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  
  // Use backend hooks instead of mock data
  const { 
    issues, 
    loading: issuesLoading, 
    addIssue, 
    updateIssueStatus, 
    deleteIssue, 
    upvoteIssue, 
    addComment: addCommentToIssue 
  } = useIssues();
  
  const { 
    organizations, 
    loading: orgsLoading 
  } = useOrganizations();
  
  const { 
    users, 
    loading: usersLoading, 
    toggleBlockUser 
  } = useUsers();
  
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [viewingOrg, setViewingOrg] = useState<Organization | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminOrgModalOpen, setIsAdminOrgModalOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [isAdminOrgAddingMode, setIsAdminOrgAddingMode] = useState(false);
  const [showOrgs, setShowOrgs] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(false);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<'MAP' | 'LIST' | 'STATISTICS' | 'USERS'>('MAP');
  
  const [activeFilter, setActiveFilter] = useState<IssueCategory | 'ALL'>('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [triggerLocate, setTriggerLocate] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Settings state
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system';
  });
  
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>(() => {
    const saved = localStorage.getItem('fontSize');
    return (saved === 'small' || saved === 'medium' || saved === 'large') ? saved : 'medium';
  });
  
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = theme === 'dark' || (theme === 'system' && systemPrefersDark);
      
      setIsDarkMode(shouldBeDark);
      if (shouldBeDark) {
        root.classList.add('dark');
        root.classList.remove('light');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        root.style.colorScheme = 'light';
      }
      localStorage.setItem('theme', theme);
    };
    applyTheme();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => { if (theme === 'system') applyTheme(); };
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('fontSize', fontSize);
    const root = window.document.documentElement;
    const sizes = { small: '14px', medium: '16px', large: '18px' };
    root.style.fontSize = sizes[fontSize];
  }, [fontSize]);

  const handleLogin = async (user: User) => {
    // This is handled by LoginView component with backend
    setCurrentUser(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
    addToast(`Добро пожаловать, ${user.name}!`);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('token');
    setIsMenuOpen(false);
    addToast("Вы вышли из системы");
  };

  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const mapIssues = useMemo(() => {
    let filtered = issues.filter(issue => issue.status !== 'Resolved');
    if (selectedIssue && selectedIssue.status === 'Resolved') {
      if (!filtered.find(f => f.id === selectedIssue.id)) {
        filtered = [...filtered, selectedIssue];
      }
    }
    if (activeFilter !== 'ALL') {
      filtered = filtered.filter(issue => issue.category === activeFilter);
    }
    return filtered;
  }, [issues, activeFilter, selectedIssue]);

  const handleMapClick = (coords: Coordinates) => {
    if (isAddingMode) {
      setSelectedLocation(coords);
      setSelectedOrg(null);
      setIsModalOpen(true);
      setIsAddingMode(false);
    } else if (isAdminOrgAddingMode) {
      setSelectedLocation(coords);
      setIsAdminOrgModalOpen(true);
      setIsAdminOrgAddingMode(false);
    } else {
      setSelectedIssue(null);
      setViewingOrg(null);
    }
  };

  const handleOrgClick = (org: Organization) => {
    setViewingOrg(org);
    setSelectedIssue(null);
  };

  const handleSelectIssue = (issue: Issue) => {
    setSelectedIssue(issue);
    setViewingOrg(null);
    if (activeView !== 'MAP') setActiveView('MAP');
  };

  const handleUpdateStatus = async (issueId: string, status: 'Open' | 'In Progress' | 'Resolved') => {
    const result = await updateIssueStatus(issueId, status);
    if (result.success) {
      if (selectedIssue?.id === issueId) {
        setSelectedIssue(prev => prev ? { ...prev, status } : null);
      }
      addToast(`Статус изменен на: ${status}`);
    } else {
      addToast(result.error || 'Ошибка изменения статуса', 'error');
    }
  };

  const handleDeleteIssue = async (issueId: string) => {
    const result = await deleteIssue(issueId);
    if (result.success) {
      setSelectedIssue(null);
      addToast("Обращение удалено модератором");
    } else {
      addToast(result.error || 'Ошибка удаления', 'error');
    }
  };

  const handleToggleBlock = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    
    const result = await toggleBlockUser(userId, user.blocked || false);
    if (result.success) {
      addToast(
        !user.blocked ? "Пользователь заблокирован" : "Доступ восстановлен", 
        !user.blocked ? "error" : "success"
      );
    } else {
      addToast(result.error || 'Ошибка блокировки', 'error');
    }
  };

  const handleAddOrg = (orgData: Omit<Organization, 'id'>) => {
    // TODO: Add API call when backend supports it
    addToast("Функция добавления организаций скоро будет доступна!");
  };

  const handleReportAtOrg = (org: Organization) => {
    setSelectedOrg(org);
    setSelectedLocation({ lat: org.lat, lng: org.lng });
    setIsModalOpen(true);
    setViewingOrg(null);
  };

  const handleLocateMe = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(coords);
          setTriggerLocate(prev => prev + 1);
          addToast("Ваше местоположение определено!", "success");
        },
        () => addToast("Не удалось получить доступ к геопозиции.", "error")
      );
    }
  };

  const handleSelectFromList = (issue: Issue) => {
    setActiveView('MAP');
    setSelectedIssue(issue);
    setViewingOrg(null);
    const loc = issue.organizationId 
      ? organizations.find(o => o.id === issue.organizationId) || { lat: issue.lat, lng: issue.lng }
      : { lat: issue.lat, lng: issue.lng };
    setUserLocation({ lat: loc.lat, lng: loc.lng });
    setTriggerLocate(prev => prev + 1);
  };

  const handleAddIssue = async (data: any) => {
    const issueData = {
      lat: selectedLocation?.lat || TASHKENT_CENTER[0],
      lng: selectedLocation?.lng || TASHKENT_CENTER[1],
      title: data.title,
      description: data.description,
      category: data.category,
      subCategory: data.subCategory,
      severity: data.severity,
      aiSummary: data.summary,
      organizationId: data.organizationId,
      organizationName: data.organizationName
    };

    const result = await addIssue(issueData);
    
    if (result.success) {
      setIsModalOpen(false);
      setSelectedLocation(null);
      setSelectedOrg(null);
      setSelectedIssue(result.issue);
      addToast("Отчет успешно отправлен!");
    } else {
      addToast(result.error || 'Ошибка создания обращения', 'error');
    }
  };

  const handleAddComment = async (issueId: string, text: string) => {
    const result = await addCommentToIssue(issueId, text);
    if (result.success) {
      if (selectedIssue?.id === issueId && result.comment) {
        setSelectedIssue(prev => prev ? { ...prev, comments: [result.comment, ...prev.comments] } : null);
      }
      addToast("Комментарий добавлен.");
    } else {
      addToast(result.error || 'Ошибка добавления комментария', 'error');
    }
  };

  const handleUpvote = async (issueId: string) => {
    const result = await upvoteIssue(issueId);
    if (result.success) {
      if (selectedIssue?.id === issueId) {
        const updatedIssue = issues.find(i => i.id === issueId);
        if (updatedIssue) {
          setSelectedIssue(updatedIssue);
        }
      }
      addToast("Вы поддержали это обращение!");
    } else {
      addToast(result.error || 'Ошибка голосования', 'error');
    }
  };

  const getCategoryIcon = (category: IssueCategory | 'ALL') => {
    switch (category) {
      case 'ALL': return <Layers size={18} />;
      case IssueCategory.ROADS: return <Car size={18} />;
      case IssueCategory.WATER: return <Droplets size={18} />;
      case IssueCategory.ELECTRICITY: return <Zap size={18} />;
      case IssueCategory.EDUCATION: return <GraduationCap size={18} />;
      case IssueCategory.HEALTH: return <Stethoscope size={18} />;
      case IssueCategory.WASTE: return <Trash2 size={18} />;
      default: return <HelpCircle size={18} />;
    }
  };

  // Show loading state
  if (issuesLoading || orgsLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-bold">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className={isDarkMode ? 'dark' : ''}>
        <LoginView onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden bg-white dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <NotificationContainer toasts={toasts} removeToast={removeToast} />

      <BurgerMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        activeView={activeView as any}
        onSelectView={(view) => {
          setActiveView(view as any);
          setIsMenuOpen(false);
        }}
        theme={theme}
        setTheme={setTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        onOpenAbout={() => { setIsAboutOpen(true); setIsMenuOpen(false); }}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <header className="flex-shrink-0 h-16 bg-white dark:bg-slate-900 shadow-sm z-[400] px-6 flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsMenuOpen(true)} className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition">
            <Menu className="w-5 h-5" />
          </button>
          <MapPlusIcon onClick={() => setActiveView('MAP')} />
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
               <h1 className="font-bold text-xl text-slate-800 dark:text-slate-100 tracking-tight leading-none">Real<span className="text-blue-600">Holat</span></h1>
               {currentUser.role === UserRole.ADMIN && (
                 <span className="bg-red-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md flex items-center gap-1">
                   <ShieldCheck size={8} /> Admin
                 </span>
               )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold tracking-widest uppercase mt-0.5">Социальная инфраструктура</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
             {currentUser.role === UserRole.ADMIN && (
               <button 
                onClick={() => { setIsAdminOrgAddingMode(true); setActiveView('MAP'); }} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition duration-300 ${isAdminOrgAddingMode ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-slate-100 dark:bg-slate-800 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}
               >
                 <Building2 className="w-3.5 h-3.5" />
                 <span className="hidden md:inline">+ Объект</span>
               </button>
             )}
             <button onClick={() => setShowHeatmap(!showHeatmap)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition duration-300 ${showHeatmap ? 'bg-orange-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                <Flame className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Тепловая карта</span>
             </button>
             <button onClick={() => setShowOrgs(!showOrgs)} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition duration-300 ${showOrgs ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                <Building2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Учреждения</span>
             </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 relative z-0">
        {activeView === 'MAP' ? (
          <>
            <div className="absolute top-6 left-6 z-[399] flex flex-col" ref={filterRef}>
              <button onClick={() => setIsFilterOpen(!isFilterOpen)} className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl font-black text-sm shadow-2xl transition-all border-2 outline-none ${isFilterOpen ? 'bg-white dark:bg-slate-800 border-blue-500 text-blue-600 scale-105' : 'bg-gradient-to-r from-blue-600 to-indigo-600 border-transparent text-white hover:shadow-blue-500/20'}`}>
                <div className={`${isFilterOpen ? 'text-blue-600' : 'text-white'}`}>{getCategoryIcon(activeFilter)}</div>
                <span className="whitespace-nowrap uppercase tracking-wider">{activeFilter === 'ALL' ? 'Все проблемы' : activeFilter}</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isFilterOpen ? 'rotate-180 text-blue-600' : 'text-white/80'}`} />
              </button>
              {isFilterOpen && (
                <div className="mt-3 w-72 bg-white dark:bg-slate-800 rounded-3xl shadow-[0_20px_60px_-15px_rgba(37,99,235,0.3)] border border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300 origin-top-left">
                  <div className="p-3 max-h-[75vh] overflow-y-auto custom-scrollbar">
                    <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Категории</div>
                    <button onClick={() => { setActiveFilter('ALL'); setIsFilterOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all text-sm font-bold mb-1 ${activeFilter === 'ALL' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeFilter === 'ALL' ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700 text-slate-500'}`}><Layers size={18} /></div>
                      <span className="flex-1 text-left">Все проблемы</span>
                    </button>
                    <div className="w-full h-px bg-slate-100 dark:bg-slate-700 my-2"></div>
                    {Object.values(IssueCategory).map((cat) => (
                      <button key={cat} onClick={() => { setActiveFilter(cat); setIsFilterOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all text-sm font-bold mb-1 ${activeFilter === cat ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activeFilter === cat ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`} style={activeFilter !== cat ? { color: CATEGORY_COLORS[cat] } : {}}>{getCategoryIcon(cat)}</div>
                        <span className="flex-1 text-left">{cat}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <MapComponent 
                issues={mapIssues}
                organizations={organizations}
                center={TASHKENT_CENTER} 
                onIssueClick={handleSelectIssue}
                onMapClick={handleMapClick}
                onOrgClick={handleOrgClick}
                isAdding={isAddingMode || isAdminOrgAddingMode}
                showOrgs={showOrgs}
                showHeatmap={showHeatmap}
                userLocation={userLocation}
                triggerLocate={triggerLocate}
                isDark={isDarkMode}
            />
            <div className="absolute bottom-8 right-6 z-[400] flex flex-col items-end gap-4">
                <button onClick={handleLocateMe} className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-xl text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition duration-300 border border-slate-100 dark:border-slate-700"><Locate className="w-6 h-6" /></button>
                {!isAddingMode && !isAdminOrgAddingMode && !selectedIssue && !viewingOrg && (
                    <button onClick={() => setIsAddingMode(true)} className="group flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white pl-5 pr-6 py-4 rounded-full shadow-2xl transition-all border border-blue-400/20">
                        <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                        <span className="font-bold text-lg uppercase tracking-tight">Сообщить</span>
                    </button>
                )}
            </div>
            {(isAddingMode || isAdminOrgAddingMode) && (
                 <div className={`absolute top-6 left-1/2 transform -translate-x-1/2 z-[400] px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 border animate-in slide-in-from-top-2 backdrop-blur
                   ${isAdminOrgAddingMode ? 'bg-indigo-600/95 border-indigo-400 text-white' : 'bg-blue-600/95 border-blue-400 text-white'}`}>
                     <div className="flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-white animate-pulse" />
                        <span className="font-bold text-sm tracking-tight uppercase">
                          {isAdminOrgAddingMode ? 'Нажмите на карту для установки объекта' : 'Нажмите на карту или здание'}
                        </span>
                     </div>
                     <div className="w-[1px] h-4 bg-white/30"></div>
                     <button onClick={() => { setIsAddingMode(false); setIsAdminOrgAddingMode(false); }} className="text-white hover:text-blue-200 font-black text-xs uppercase tracking-widest">Отмена</button>
                 </div>
            )}
          </>
        ) : activeView === 'LIST' ? (
          <ListView issues={issues} onSelectIssue={handleSelectFromList} />
        ) : activeView === 'USERS' ? (
          <AdminUserView users={users} onToggleBlock={handleToggleBlock} />
        ) : (
          <StatisticsView issues={issues} organizations={organizations} />
        )}
      </main>

      <DetailSidebar 
        issue={selectedIssue} 
        currentUser={currentUser}
        onClose={() => setSelectedIssue(null)} 
        onAddComment={handleAddComment} 
        onUpvote={handleUpvote} 
        onUpdateStatus={handleUpdateStatus}
        onDeleteIssue={handleDeleteIssue}
      />
      <OrgSidebar org={viewingOrg} issues={issues} onClose={() => setViewingOrg(null)} onIssueClick={handleSelectIssue} onReportIssue={handleReportAtOrg} />
      <IssueModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setIsAddingMode(false); setSelectedOrg(null); }} onSubmit={handleAddIssue} selectedLocation={selectedLocation} preSelectedOrg={selectedOrg} />
      <AdminOrgModal isOpen={isAdminOrgModalOpen} onClose={() => { setIsAdminOrgModalOpen(false); setIsAdminOrgAddingMode(false); }} onSubmit={handleAddOrg} selectedLocation={selectedLocation} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
};

export default App;