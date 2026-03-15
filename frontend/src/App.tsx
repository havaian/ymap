// frontend/src/App.tsx

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MapComponent } from "./components/map/MapComponent";
import { CategoryFilter } from "./components/map/CategoryFilter";
import { DetailSidebar } from "./components/issues/DetailSidebar";
import { ObjectSidebar } from "./components/objects/ObjectSidebar";
import { DetailPanel } from "./components/layout/DetailPanel";
import { IssueModal } from "./components/issues/IssueModal";
import { AboutModal } from "./components/common/AboutModal";
import { NotificationContainer, Toast } from "./components/layout/Notification";
import { ListView } from "./components/issues/ListView";
import { AnalyticsDashboard } from "./components/analytics/AnalyticsDashboard";
import { BurgerMenu } from "./components/layout/BurgerMenu";
import { AdminUserView } from "./components/admin/AdminUserView";
import { AdminDataView } from "./components/admin/AdminDataView";
import { AppHeader } from "./components/layout/AppHeader";
import { DistrictDrilldown } from "./components/analytics/DistrictDrilldown";
import { PublicStatsBar } from "./components/layout/PublicStatsBar";
import { ProgramsView } from "./components/programs/ProgramsView";
import { ProfileView } from "./components/profile/ProfileView";
import { LeaderboardView } from "./components/leaderboard/LeaderboardView";
import { LayerState } from "./components/map/LayerPicker";
import {
  Issue,
  Coordinates,
  IssueCategory,
  FacilityObject,
  User,
  UserRole,
} from "../types";
import { TASHKENT_CENTER } from "./constants";
import { useIssues, useObjects, useUsers } from "./hooks/useBackendData";
import { tasksAPI } from "./services/api";
import { Plus, Navigation, Locate } from "lucide-react";

interface AppProps {
  currentUser: User;
  onLogout: () => void;
  view: "MAP" | "LIST" | "STATISTICS" | "USERS" | "DATA" | "PROGRAMS" | "PROFILE" | "LEADERBOARD";
}

const App: React.FC<AppProps> = ({ currentUser, onLogout, view }) => {
  const params = useParams<{ issueId?: string; objectId?: string }>();
  const navigate = useNavigate();
  const activeView = view;

  const [selectedRegionCode, setSelectedRegionCode] = useState<number | null>(
    () => {
      const saved = localStorage.getItem("map_region");
      return saved ? parseInt(saved) : null;
    }
  );

  // Persist region selection
  useEffect(() => {
    if (selectedRegionCode != null)
      localStorage.setItem("map_region", String(selectedRegionCode));
    else localStorage.removeItem("map_region");
  }, [selectedRegionCode]);

  // ── Data hooks ────────────────────────────────────────
  const {
    issues,
    loading: issuesLoading,
    addIssue,
    updateIssueStatus,
    deleteIssue,
    upvoteIssue,
    addComment: addCommentToIssue,
    fetchDetail: fetchIssueDetail,
  } = useIssues(selectedRegionCode);

  const {
    objects,
    loading: objectsLoading,
    fetchDetail: fetchObjectDetail,
  } = useObjects(selectedRegionCode);
  const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role.toLowerCase() === "admin";
  const { users, toggleBlockUser } = useUsers(isAdmin);

  // Verification summary for map marker colors — Map<objectId, { doneCount, problemCount, totalCount }>
  const [verificationSummary, setVerificationSummary] = useState<
    Map<string, any>
  >(new Map());
  const [taskStats, setTaskStats] = useState<any>(null);

  const {
    issues: allIssues,
  } = useIssues(activeView === "LIST" ? null : selectedRegionCode);

  useEffect(() => {
    tasksAPI
      .getVerificationSummary()
      .then((res) => {
        if (res.data?.success) {
          const map = new Map<string, any>();
          res.data.data.forEach((s: any) => map.set(s.targetId, s));
          setVerificationSummary(map);
        }
      })
      .catch(() => {});

    tasksAPI
      .getStats()
      .then((res) => {
        if (res.data?.success) setTaskStats(res.data.data);
      })
      .catch(() => {});
  }, []);

  const [selectedIssueOverride, setSelectedIssueOverride] = useState<Issue | null>(null);

  // ── Derived from URL params ───────────────────────────
  const selectedIssue = params.issueId
  ? issues.find((i) => i.id === params.issueId) || selectedIssueOverride
  : null;
  const [viewingObject, setViewingObject] = useState<FacilityObject | null>(
    null
  );

  useEffect(() => {
  if (!params.issueId) {
    setSelectedIssueOverride(null);
    return;
  }
  const found = issues.find((i) => i.id === params.issueId);
  if (!found) {
    fetchIssueDetail(params.issueId).then((detail) => {
      if (detail) setSelectedIssueOverride(detail);
    });
  } else {
    setSelectedIssueOverride(null);
  }
}, [params.issueId]);

  useEffect(() => {
    if (!params.objectId) {
      setViewingObject(null);
      return;
    }
    fetchObjectDetail(params.objectId).then((detail) => {
      setViewingObject(detail);
    });
  }, [params.objectId, fetchObjectDetail]);

  // ── UI state ──────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Coordinates | null>(
    null
  );
  const [selectedObjectForReport, setSelectedObjectForReport] =
    useState<FacilityObject | null>(null);
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<IssueCategory | "ALL">(
    "ALL"
  );
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [triggerLocate, setTriggerLocate] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Layer toggles — all three are fully independent, no mutual exclusions
  const [showObjects, setShowObjects] = useState(() => {
    const v = localStorage.getItem("layer_objects");
    return v !== null ? v === "true" : true; // default on
  });
  const [showStandaloneIssues, setShowStandaloneIssues] = useState(
    () => localStorage.getItem("layer_standalone") === "true"
  );
  const [showHeatmap, setShowHeatmap] = useState(
    () => localStorage.getItem("layer_heatmap") === "true"
  );
  const [showChoropleth, setShowChoropleth] = useState(
    () => localStorage.getItem("layer_choropleth") === "true"
  );
  const [choroplethMetric, setChoroplethMetric] = useState(
    () => localStorage.getItem("layer_choropleth_metric") || "composite"
  );

  // Persist layer state changes
  useEffect(() => {
    localStorage.setItem("layer_objects", String(showObjects));
  }, [showObjects]);
  useEffect(() => {
    localStorage.setItem("layer_standalone", String(showStandaloneIssues));
  }, [showStandaloneIssues]);
  useEffect(() => {
    localStorage.setItem("layer_heatmap", String(showHeatmap));
  }, [showHeatmap]);
  useEffect(() => {
    localStorage.setItem("layer_choropleth", String(showChoropleth));
  }, [showChoropleth]);
  useEffect(() => {
    localStorage.setItem("layer_choropleth_metric", choroplethMetric);
  }, [choroplethMetric]);

  // District drilldown
  const [drilldownDistrictId, setDrilldownDistrictId] = useState<string | null>(
    null
  );
  const [drilldownDistrictName, setDrilldownDistrictName] = useState<any>(null);
  const [drilldownDistrictScores, setDrilldownDistrictScores] =
    useState<any>(null);

  // Settings
  const [theme, setTheme] = useState<"light" | "dark" | "system">(() => {
    const saved = localStorage.getItem("theme");
    return saved === "light" || saved === "dark" || saved === "system"
      ? saved
      : "system";
  });
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">(() => {
    const saved = localStorage.getItem("fontSize");
    return saved === "small" || saved === "medium" || saved === "large"
      ? saved
      : "medium";
  });
  const [isDarkMode, setIsDarkMode] = useState(false);

  // ── Theme effect ──────────────────────────────────────
  useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;
      const sysOk = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = theme === "dark" || (theme === "system" && sysOk);
      setIsDarkMode(dark);
      root.classList.toggle("dark", dark);
      root.classList.toggle("light", !dark);
      root.style.colorScheme = dark ? "dark" : "light";
      localStorage.setItem("theme", theme);
    };
    applyTheme();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") applyTheme();
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("fontSize", fontSize);
    const sizes = { small: "14px", medium: "16px", large: "18px" };
    window.document.documentElement.style.fontSize = sizes[fontSize];
  }, [fontSize]);

  // ── Toast helpers ─────────────────────────────────────
  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id: string) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  const layers: LayerState = { showHeatmap, showObjects, showStandaloneIssues };

  // ── Filtered map issues ───────────────────────────────
  const mapIssues = useMemo(() => {
    if (!issues || !Array.isArray(issues)) return [];
    let filtered = issues.filter((i) => i.status !== "Resolved");
    if (activeFilter !== "ALL")
      filtered = filtered.filter((i) => i.category === activeFilter);
    if (!showStandaloneIssues) filtered = filtered.filter((i) => i.objectId);
    return filtered;
  }, [issues, activeFilter, showStandaloneIssues]);

  // ── Unresolved counts per object (map marker badge) ───
  const objectUnresolvedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    issues.forEach((issue) => {
      if (issue.objectId && issue.status !== "Resolved") {
        counts[issue.objectId] = (counts[issue.objectId] || 0) + 1;
      }
    });
    return counts;
  }, [issues]);

  // ── Handlers ──────────────────────────────────────────

  const handleMapClick = useCallback(
    (coords: Coordinates) => {
      if (isAddingMode) {
        setSelectedLocation(coords);
        setSelectedObjectForReport(null);
        setIsModalOpen(true);
        setIsAddingMode(false);
      } else {
        if (params.issueId || params.objectId) {
          navigate(activeView === "LIST" ? "/list" : "/map");
        }
      }
    },
    [isAddingMode, params.issueId, params.objectId, navigate, activeView]
  );

  const handleObjectClick = useCallback(
    (obj: FacilityObject) => {
      navigate(`${activeView === "LIST" ? "/list" : "/map"}/objects/${obj.id}`);
    },
    [activeView, navigate]
  );

  const handleSelectIssue = useCallback(
    (issue: Issue) => {
      navigate(
        `${activeView === "LIST" ? "/list" : "/map"}/issues/${issue.id}`
      );
    },
    [activeView, navigate]
  );

  const handleDistrictClick = useCallback(
    (districtId: string, name: any, scores: any) => {
      setDrilldownDistrictId(districtId);
      setDrilldownDistrictName(name);
      setDrilldownDistrictScores(scores);
    },
    []
  );

  const handleUpdateStatus = async (
    issueId: string,
    status: "Open" | "In Progress" | "Resolved"
  ) => {
    const result = await updateIssueStatus(issueId, status);
    if (result.success) addToast(`Статус изменен на: ${status}`);
    else addToast(result.error || "Ошибка изменения статуса", "error");
  };

  const handleDeleteIssue = async (issueId: string) => {
    const result = await deleteIssue(issueId);
    if (result.success) {
      navigate(activeView === "LIST" ? "/list" : "/map");
      addToast("Обращение удалено модератором");
    } else addToast(result.error || "Ошибка удаления", "error");
  };

  const handleToggleBlock = async (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const result = await toggleBlockUser(userId, user.blocked || false);
    if (result.success)
      addToast(
        !user.blocked ? "Пользователь заблокирован" : "Доступ восстановлен",
        !user.blocked ? "error" : "success"
      );
    else addToast(result.error || "Ошибка блокировки", "error");
  };

  const handleReportAtObject = (obj: FacilityObject) => {
    setSelectedObjectForReport(obj);
    setSelectedLocation({ lat: obj.lat, lng: obj.lng });
    setIsModalOpen(true);
    navigate(activeView === "LIST" ? "/list" : "/map");
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
      objectId: data.objectId || null,
      objectName: data.objectName || null,
    };
    const result = await addIssue(issueData);
    if (result.success) {
      setIsModalOpen(false);
      setSelectedLocation(null);
      setSelectedObjectForReport(null);
      if (result.issue?.id) navigate(`/map/issues/${result.issue.id}`);
      addToast("Отчет успешно отправлен!");
    } else {
      addToast(result.error || "Ошибка создания обращения", "error");
    }
  };

  const handleAddComment = async (issueId: string, text: string) => {
    const result = await addCommentToIssue(issueId, text);
    if (result.success) addToast("Комментарий добавлен.");
    else addToast(result.error || "Ошибка добавления комментария", "error");
  };

  const handleUpvote = async (issueId: string) => {
    const result = await upvoteIssue(issueId);
    if (result.success) addToast("Вы поддержали это обращение!");
    else addToast(result.error || "Ошибка голосования", "error");
  };

  const handleSelectFromList = (issue: Issue) => {
    navigate(`/map/issues/${issue.id}`, { state: { from: "list" } });
    const loc = issue.objectId
      ? objects.find((o) => o.id === issue.objectId) || {
          lat: issue.lat,
          lng: issue.lng,
        }
      : { lat: issue.lat, lng: issue.lng };
    setUserLocation({ lat: loc.lat, lng: loc.lng });
    setTriggerLocate((prev) => prev + 1);
  };

  const handleLocateMe = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({ lat: coords.latitude, lng: coords.longitude });
        setTriggerLocate((prev) => prev + 1);
        addToast("Ваше местоположение определено!", "success");
      },
      () => addToast("Не удалось получить доступ к геопозиции.", "error")
    );
  };

  // Refresh verification summary after a task is verified from ObjectSidebar
  const handleVerificationDone = useCallback(() => {
    tasksAPI
      .getVerificationSummary()
      .then((res) => {
        if (res.data?.success) {
          const map = new Map<string, any>();
          res.data.data.forEach((s: any) => map.set(s.targetId, s));
          setVerificationSummary(map);
        }
      })
      .catch(() => {});
    tasksAPI
      .getStats()
      .then((res) => {
        if (res.data?.success) setTaskStats(res.data.data);
      })
      .catch(() => {});
  }, []);

  // ── Loading screen ────────────────────────────────────
  if (issuesLoading || objectsLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 font-bold">
            Загрузка данных...
          </p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────
  return (
    <div className="h-screen w-screen flex flex-col relative overflow-hidden bg-white dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-100">
      <NotificationContainer toasts={toasts} removeToast={removeToast} />

      <BurgerMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        activeView={activeView}
        onSelectView={(v) => {
          const routes: Record<string, string> = {
            MAP: "/map",
            LIST: "/list",
            STATISTICS: "/dashboard",
            USERS: "/users",
            DATA: "/data",
            PROGRAMS: "/programs",
            PROFILE: "/profile",
            LEADERBOARD: "/leaderboard",
          };
          navigate(routes[v]);
          setIsMenuOpen(false);
        }}
        theme={theme}
        setTheme={setTheme}
        fontSize={fontSize}
        setFontSize={setFontSize}
        onOpenAbout={() => {
          setIsAboutOpen(true);
          setIsMenuOpen(false);
        }}
        currentUser={currentUser}
        onLogout={onLogout}
      />

      <AppHeader
        currentUser={currentUser}
        onMenuOpen={() => setIsMenuOpen(true)}
        activeView={activeView}
        layers={layers}
        onToggleHeatmap={() => setShowHeatmap((p) => !p)}
        onToggleObjects={() => setShowObjects((p) => !p)}
        onToggleStandaloneIssues={() => setShowStandaloneIssues((p) => !p)}
        showChoropleth={showChoropleth}
        choroplethMetric={choroplethMetric}
        onToggleChoropleth={() => setShowChoropleth((p) => !p)}
        onChoroplethMetricChange={setChoroplethMetric}
        selectedRegionCode={selectedRegionCode}
        onRegionChange={setSelectedRegionCode}
      />

      <main className="flex-1 min-h-0 relative z-0">
        {activeView === "MAP" ? (
          <>
            {/* Public stats strip — shown on map view when there's task data */}
            {taskStats && (
              <PublicStatsBar stats={taskStats} objectCount={objects.length} />
            )}

            <CategoryFilter
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />
            <MapComponent
              issues={mapIssues}
              objects={objects}
              center={TASHKENT_CENTER}
              onIssueClick={handleSelectIssue}
              onMapClick={handleMapClick}
              onObjectClick={handleObjectClick}
              isAdding={isAddingMode}
              showObjects={showObjects}
              showHeatmap={showHeatmap}
              showChoropleth={showChoropleth}
              choroplethMetric={choroplethMetric}
              selectedRegionCode={selectedRegionCode}
              onDistrictClick={handleDistrictClick}
              userLocation={userLocation}
              triggerLocate={triggerLocate}
              isDark={isDarkMode}
              objectUnresolvedCounts={objectUnresolvedCounts}
              verificationSummary={verificationSummary}
            />
            <div className="absolute bottom-8 right-6 z-[400] flex flex-col items-end gap-4">
              <button
                onClick={handleLocateMe}
                className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-xl text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition duration-100 border border-slate-100 dark:border-slate-700"
              >
                <Locate className="w-6 h-6" />
              </button>
              {!isAddingMode &&
                !selectedIssue &&
                !viewingObject &&
                currentUser.role !== UserRole.ADMIN && (
                  <button
                    onClick={() => setIsAddingMode(true)}
                    className="group flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white pl-5 pr-6 py-4 rounded-full shadow-2xl transition-all border border-blue-400/20"
                  >
                    <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-100" />
                    <span className="font-bold text-lg uppercase tracking-tight">
                      Сообщить
                    </span>
                  </button>
                )}
            </div>
            {isAddingMode && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[400] px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 border animate-in slide-in-from-top-2 backdrop-blur bg-blue-600/95 border-blue-400 text-white">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 animate-pulse" />
                  <span className="font-bold text-sm tracking-tight uppercase">
                    Нажмите на карту или здание
                  </span>
                </div>
                <div className="w-[1px] h-4 bg-white/30" />
                <button
                  onClick={() => setIsAddingMode(false)}
                  className="text-white hover:text-blue-200 font-black text-xs uppercase tracking-widest"
                >
                  Отмена
                </button>
              </div>
            )}
          </>
        ) : activeView === "LIST" ? (
          <ListView issues={allIssues} onSelectIssue={handleSelectFromList} />
        ) : activeView === "USERS" ? (
          <AdminUserView users={users} onToggleBlock={handleToggleBlock} />
        ) : activeView === "DATA" ? (
          <AdminDataView onDataImported={() => window.location.reload()} />
        ) : activeView === "PROFILE" ? (
          <ProfileView currentUser={currentUser} />
        ) : activeView === "LEADERBOARD" ? (
          <LeaderboardView currentUser={currentUser} />
        ) : activeView === "PROGRAMS" ? (
          <ProgramsView currentUser={currentUser} />
        ) : (
          <AnalyticsDashboard initialRegionCode={selectedRegionCode} />
        )}
      </main>

      <DetailPanel type="issue" isOpen={!!selectedIssue}>
        <DetailSidebar
          issue={selectedIssue}
          currentUser={currentUser}
          onClose={() => navigate("/map")}
          onAddComment={handleAddComment}
          onUpvote={handleUpvote}
          onUpdateStatus={handleUpdateStatus}
          onDeleteIssue={handleDeleteIssue}
        />
      </DetailPanel>

      <DetailPanel type="organization" isOpen={!!viewingObject}>
        <ObjectSidebar
          object={viewingObject}
          issues={issues}
          currentUser={currentUser}
          onClose={() => navigate("/map")}
          onIssueClick={handleSelectIssue}
          onReportIssue={handleReportAtObject}
          onVerificationDone={handleVerificationDone}
        />
      </DetailPanel>

      <DistrictDrilldown
        districtId={drilldownDistrictId}
        districtName={drilldownDistrictName}
        scores={drilldownDistrictScores}
        onClose={() => setDrilldownDistrictId(null)}
      />

      <IssueModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIsAddingMode(false);
          setSelectedObjectForReport(null);
        }}
        onSubmit={handleAddIssue}
        selectedLocation={selectedLocation}
        preSelectedObject={selectedObjectForReport}
      />

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
};

export default App;
