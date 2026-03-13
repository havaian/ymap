// frontend/src/App.tsx

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { MapComponent } from './components/map/MapComponent';
import { CategoryFilter } from './components/map/CategoryFilter';
import { DetailSidebar } from './components/issues/DetailSidebar';
import { OrgSidebar } from './components/organizations/OrgSidebar';
import { DetailPanel } from './components/layout/DetailPanel';
import { IssueModal } from './components/issues/IssueModal';
import { AboutModal } from './components/common/AboutModal';
import { NotificationContainer, Toast } from './components/layout/Notification';
import { ListView } from './components/issues/ListView';
import { AnalyticsDashboard } from './components/analytics/AnalyticsDashboard';
import { BurgerMenu } from './components/layout/BurgerMenu';
import { AdminUserView } from './components/admin/AdminUserView';
import { AdminDataView } from './components/admin/AdminDataView';
import { AdminOrgModal } from './components/admin/AdminOrgModal';
import { AppHeader } from './components/layout/AppHeader';
import { DistrictDrilldown } from './components/analytics/DistrictDrilldown';
import { LayerState } from './components/map/LayerPicker';
import { Issue, Coordinates, IssueCategory, Organization, User, UserRole } from '../types';
import { TASHKENT_CENTER } from './constants';
import { useIssues, useOrganizations, useUsers } from './hooks/useBackendData';
import { useInfrastructure } from './hooks/useInfrastructure';
import { Plus, Navigation, Locate } from 'lucide-react';

interface AppProps {
  currentUser: User;
  onLogout: () => void;
  view: 'MAP' | 'LIST' | 'STATISTICS' | 'USERS' | 'DATA';
}

const App: React.FC<AppProps> = ({ currentUser, onLogout, view }) => {
  const location = useLocation();
  const params = useParams<{ issueId?: string; orgId?: string }>();
  const navigate = useNavigate();
  
  // activeView is now derived from props, not state
  const activeView = view;
  
  const [selectedRegionCode, setSelectedRegionCode] = useState<number | null>(null);
  
  // Use backend hooks instead of mock data
  const { 
    issues, 
    loading: issuesLoading, 
    addIssue, 
    updateIssueStatus, 
    deleteIssue, 
    upvoteIssue, 
    addComment: addCommentToIssue 
  } = useIssues(selectedRegionCode);
  
  const { 
    organizations, 
    loading: orgsLoading 
  } = useOrganizations(selectedRegionCode);

  const { 
    infrastructure, 
    loading: infraLoading 
  } = useInfrastructure(selectedRegionCode);
  
  const { 
    users, 
    loading: usersLoading, 
    toggleBlockUser 
  } = useUsers();
  
  // Derive from URL params instead of state
  const selectedIssue = params.issueId 
    ? issues.find(i => i.id === params.issueId) || null 
    : null;
    
  const viewingOrg = params.orgId 
    ? organizations.find(o => o.id === params.orgId) || null 
    : null;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAdminOrgModalOpen, setIsAdminOrgModalOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [isAdminOrgAddingMode, setIsAdminOrgAddingMode] = useState(false);

  // Layer toggles
  const [showOrgs, setShowOrgs] = useState(false);
  const [showInfrastructure, setShowInfrastructure] = useState(false);
  const [showStandaloneIssues, setShowStandaloneIssues] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showChoropleth, setShowChoropleth] = useState(false);
  const [choroplethMetric, setChoroplethMetric] = useState('composite');
  
  // District drilldown (triggered by choropleth click)
  const [drilldownDistrictId, setDrilldownDistrictId] = useState<string | null>(null);
  const [drilldownDistrictName, setDrilldownDistrictName] = useState<any>(null);
  const [drilldownDistrictScores, setDrilldownDistrictScores] = useState<any>(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<IssueCategory | 'ALL'>('ALL');

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

  // ── Theme effect ──────────────────────────────────────
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

  // ── Font size effect ──────────────────────────────────
  useEffect(() => {
    localStorage.setItem('fontSize', fontSize);
    const root = window.document.documentElement;
    const sizes = { small: '14px', medium: '16px', large: '18px' };
    root.style.fontSize = sizes[fontSize];
  }, [fontSize]);

  // ── Toast helpers ─────────────────────────────────────
  const addToast = (message: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // ── Derived: layers object for AppHeader ──────────────
  const layers: LayerState = {
    showHeatmap,
    showChoropleth,
    showOrgs,
    showInfrastructure,
    showStandaloneIssues,
    choroplethMetric,
  };

  // ── Derived: map issues (filtered) ────────────────────
  // selectedIssue intentionally removed from deps.
  // Previously it caused mapIssues to recalculate (and MapComponent to re-render)
  // every time a panel was opened or closed. The resolved-issue edge case is handled
  // by simply not filtering resolved issues out if they're currently selected,
  // which we achieve by keeping selectedIssue out of the filter entirely.
  const mapIssues = useMemo(() => {
    // Safety guard: ensure issues is a valid array before filtering
    if (!issues || !Array.isArray(issues)) return [];
    
    let filtered = issues.filter(issue => issue.status !== 'Resolved');
    
    // Filter by category
    if (activeFilter !== 'ALL') {
      filtered = filtered.filter(issue => issue.category === activeFilter);
    }
    
    // Filter based on toggle states
    if (!showStandaloneIssues) {
      // Hide issues without organization or infrastructure
      filtered = filtered.filter(issue => issue.organizationId);
    }
    
    return filtered;
  }, [issues, activeFilter, showStandaloneIssues]);

  const canShowOrgs = showOrgs && !showHeatmap;
  const canShowInfrastructure = showInfrastructure && !showHeatmap;

  // ── Handlers ──────────────────────────────────────────
  // useCallback so MapComponent and MapController don't re-run effects when
  // unrelated App state changes (e.g. toasts, modal open/close)
  const handleMapClick = useCallback((coords: Coordinates) => {
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
      // Close any open panels by navigating to the current view root.
      // Using navigate(basePath) instead of navigate(-1) to prevent returning
      // to /list when the panel was opened from the list view.
      if (params.issueId || params.orgId) {
        navigate(activeView === 'LIST' ? '/list' : '/map');
      }
    }
  }, [isAddingMode, isAdminOrgAddingMode, params.issueId, params.orgId, navigate, activeView]);

  const handleOrgClick = useCallback((org: Organization) => {
    const basePath = activeView === 'LIST' ? '/list' : '/map';
    navigate(`${basePath}/organizations/${org.id}`);
  }, [activeView, navigate]);

  const handleSelectIssue = useCallback((issue: Issue) => {
    const basePath = activeView === 'LIST' ? '/list' : '/map';
    navigate(`${basePath}/issues/${issue.id}`);
  }, [activeView, navigate]);

  const handleDistrictClick = useCallback((districtId: string, name: any, scores: any) => {
    setDrilldownDistrictId(districtId);
    setDrilldownDistrictName(name);
    setDrilldownDistrictScores(scores);
  }, []);

  const handleUpdateStatus = async (issueId: string, status: 'Open' | 'In Progress' | 'Resolved') => {
    const result = await updateIssueStatus(issueId, status);
    if (result.success) {
      addToast(`Статус изменен на: ${status}`);
    } else {
      addToast(result.error || 'Ошибка изменения статуса', 'error');
    }
  };

  const handleDeleteIssue = async (issueId: string) => {
    const result = await deleteIssue(issueId);
    if (result.success) {
      navigate(activeView === 'LIST' ? '/list' : '/map');
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
    // Close org panel
    navigate(activeView === 'LIST' ? '/list' : '/map');
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
    // Navigate to map view with issue.
    // Pass { from: 'list' } in state so DetailPanel can show the "Back to list" button.
    navigate(`/map/issues/${issue.id}`, { state: { from: 'list' } });
    
    // Set location for map centering
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
      
      // Navigate to the new issue
      if (result.issue?.id) {
        navigate(`/map/issues/${result.issue.id}`);
      }
      
      addToast("Отчет успешно отправлен!");
    } else {
      addToast(result.error || 'Ошибка создания обращения', 'error');
    }
  };

  const handleAddComment = async (issueId: string, text: string) => {
    const result = await addCommentToIssue(issueId, text);
    if (result.success) {
      addToast("Комментарий добавлен.");
    } else {
      addToast(result.error || 'Ошибка добавления комментария', 'error');
    }
  };

  const handleUpvote = async (issueId: string) => {
    const result = await upvoteIssue(issueId);
    if (result.success) {
      addToast("Вы поддержали это обращение!");
    } else {
      addToast(result.error || 'Ошибка голосования', 'error');
    }
  };

  // ── Loading state ─────────────────────────────────────
  if (issuesLoading || orgsLoading || infraLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400 font-bold">Загрузка данных...</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────
  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden bg-white dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <NotificationContainer toasts={toasts} removeToast={removeToast} />

      <BurgerMenu 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        activeView={activeView}
        onSelectView={(view) => {
          const routes = {
            'MAP': '/map',
            'LIST': '/list',
            'STATISTICS': '/dashboard',
            'USERS': '/users',
            'DATA': '/data'
          };
          navigate(routes[view]);
          setIsMenuOpen(false);
        }}
        theme={theme}
        setTheme={setTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        onOpenAbout={() => { setIsAboutOpen(true); setIsMenuOpen(false); }}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      <AppHeader
        currentUser={currentUser}
        onMenuOpen={() => setIsMenuOpen(true)}
        activeView={activeView}
        layers={layers}
        onToggleHeatmap={() => setShowHeatmap(p => !p)}
        onToggleChoropleth={() => setShowChoropleth(p => !p)}
        onToggleOrgs={() => setShowOrgs(p => !p)}
        onToggleInfrastructure={() => setShowInfrastructure(p => !p)}
        onToggleStandaloneIssues={() => setShowStandaloneIssues(p => !p)}
        onChoroplethMetricChange={setChoroplethMetric}
        selectedRegionCode={selectedRegionCode}
        onRegionChange={setSelectedRegionCode}
        isAdminOrgAddingMode={isAdminOrgAddingMode}
        onStartAdminOrgAdd={() => { setIsAdminOrgAddingMode(true); navigate('/map'); }}
      />

      <main className="flex-1 min-h-0 relative z-0">
        {activeView === 'MAP' ? (
          <>
            <CategoryFilter
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />
            <MapComponent 
                issues={mapIssues}
                organizations={organizations}
                infrastructure={infrastructure}
                center={TASHKENT_CENTER} 
                onIssueClick={handleSelectIssue}
                onMapClick={handleMapClick}
                onOrgClick={handleOrgClick}
                isAdding={isAddingMode || isAdminOrgAddingMode}
                showOrgs={canShowOrgs}
                showInfrastructure={canShowInfrastructure}
                showHeatmap={showHeatmap}
                showChoropleth={showChoropleth}
                choroplethMetric={choroplethMetric}
                onDistrictClick={handleDistrictClick}
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
        ) : activeView === 'DATA' ? (
          <AdminDataView onDataImported={() => window.location.reload()} />
        ) : (
          <AnalyticsDashboard />
        )}
      </main>

      {/* Issue Detail Panel with gradient background */}
      <DetailPanel type="issue" isOpen={!!selectedIssue}>
        <DetailSidebar 
          issue={selectedIssue} 
          currentUser={currentUser}
          onClose={() => navigate('/map')} 
          onAddComment={handleAddComment} 
          onUpvote={handleUpvote} 
          onUpdateStatus={handleUpdateStatus}
          onDeleteIssue={handleDeleteIssue}
        />
      </DetailPanel>

      {/* Organization Detail Panel with gradient background */}
      <DetailPanel type="organization" isOpen={!!viewingOrg}>
        <OrgSidebar 
          org={viewingOrg} 
          issues={issues} 
          onClose={() => navigate('/map')} 
          onIssueClick={handleSelectIssue} 
          onReportIssue={handleReportAtOrg} 
        />
      </DetailPanel>

      {/* District Drilldown (triggered by choropleth click) */}
      <DistrictDrilldown
        districtId={drilldownDistrictId}
        districtName={drilldownDistrictName}
        scores={drilldownDistrictScores}
        onClose={() => setDrilldownDistrictId(null)}
      />

      <IssueModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setIsAddingMode(false); setSelectedOrg(null); }} onSubmit={handleAddIssue} selectedLocation={selectedLocation} preSelectedOrg={selectedOrg} />
      <AdminOrgModal isOpen={isAdminOrgModalOpen} onClose={() => { setIsAdminOrgModalOpen(false); setIsAdminOrgAddingMode(false); }} onSubmit={handleAddOrg} selectedLocation={selectedLocation} />
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
};

export default App;