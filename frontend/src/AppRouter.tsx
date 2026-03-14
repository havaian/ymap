// frontend/src/AppRouter.tsx
//
// Code-split: heavy views load on demand.
// Map view loads eagerly (most common entry point).

import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import App from "./App";
import { LoginView } from "./components/auth/LoginView";
import { User } from "../types";
import "../public/assets/styles/index.css";

const ViewLoader = () => (
  <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">
        Загрузка...
      </p>
    </div>
  </div>
);

const AppWrapper: React.FC = () => {
  const [currentUser, setCurrentUser] = React.useState<User | null>(() => {
    const saved = localStorage.getItem("currentUser");
    return saved ? JSON.parse(saved) : null;
  });

  const [theme, setTheme] = React.useState<"light" | "dark" | "system">(() => {
    const saved = localStorage.getItem("theme");
    return saved === "light" || saved === "dark" || saved === "system"
      ? saved
      : "system";
  });

  React.useEffect(() => {
    const applyTheme = () => {
      const root = window.document.documentElement;
      const sysOk = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const dark = theme === "dark" || (theme === "system" && sysOk);
      root.classList.toggle("dark", dark);
      root.classList.toggle("light", !dark);
    };
    applyTheme();
  }, [theme]);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem("currentUser", JSON.stringify(user));
  };
  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
    localStorage.removeItem("token");
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* Login */}
        <Route
          path="/login"
          element={
            currentUser ? (
              <Navigate to="/map" replace />
            ) : (
              <LoginView onLogin={handleLogin} />
            )
          }
        />

        {/* Root redirect */}
        <Route
          path="/"
          element={
            currentUser ? (
              <Navigate to="/map" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Map routes — eagerly loaded */}
        <Route
          path="/map"
          element={
            currentUser ? (
              <App
                currentUser={currentUser}
                onLogout={handleLogout}
                view="MAP"
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="issues/:issueId" element={null} />
          <Route path="objects/:objectId" element={null} />
        </Route>

        {/* List routes — lazy loaded */}
        <Route
          path="/list"
          element={
            currentUser ? (
              <Suspense fallback={<ViewLoader />}>
                <App
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  view="LIST"
                />
              </Suspense>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        >
          <Route path="issues/:issueId" element={null} />
          <Route path="objects/:objectId" element={null} />
        </Route>

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            currentUser ? (
              <Suspense fallback={<ViewLoader />}>
                <App
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  view="STATISTICS"
                />
              </Suspense>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Admin — users */}
        <Route
          path="/users"
          element={
            currentUser && currentUser.role.toLowerCase() === "admin" ? (
              <Suspense fallback={<ViewLoader />}>
                <App
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  view="USERS"
                />
              </Suspense>
            ) : (
              <Navigate to="/map" replace />
            )
          }
        />

        {/* Admin — data management */}
        <Route
          path="/data"
          element={
            currentUser && currentUser.role.toLowerCase() === "admin" ? (
              <Suspense fallback={<ViewLoader />}>
                <App
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  view="DATA"
                />
              </Suspense>
            ) : (
              <Navigate to="/map" replace />
            )
          }
        />

        {/* Programs — all authenticated users */}
        <Route
          path="/programs"
          element={
            currentUser ? (
              <Suspense fallback={<ViewLoader />}>
                <App
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  view="PROGRAMS"
                />
              </Suspense>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Profile */}
        <Route
          path="/profile"
          element={
            currentUser ? (
              <Suspense fallback={<ViewLoader />}>
                <App
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  view="PROFILE"
                />
              </Suspense>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Leaderboard */}
        <Route
          path="/leaderboard"
          element={
            currentUser ? (
              <Suspense fallback={<ViewLoader />}>
                <App
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  view="LEADERBOARD"
                />
              </Suspense>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export const AppRouter = AppWrapper;
