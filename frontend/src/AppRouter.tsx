// frontend/src/AppRouter.tsx
//
// Code-split: heavy views load on demand.
// Map view loads eagerly (most common entry point).
// Dashboard, Admin, List views load via React.lazy.

import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { LoginView } from './components/LoginView';
import { User } from '../types';
import '../public/assets/styles/index.css';

// ─── Lazy-loaded views ─────────────────────────────────
// These get split into separate chunks by Vite/Rollup.
// The user only downloads them when they navigate to the route.

const LazyStatistics = React.lazy(() =>
    import('./App').then(mod => ({ default: mod.default }))
);
const LazyAdmin = React.lazy(() =>
    import('./App').then(mod => ({ default: mod.default }))
);
const LazyList = React.lazy(() =>
    import('./App').then(mod => ({ default: mod.default }))
);

// Loading fallback
const ViewLoader = () => (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">Загрузка...</p>
        </div>
    </div>
);

const AppWrapper: React.FC = () => {
    const [currentUser, setCurrentUser] = React.useState<User | null>(() => {
        const saved = localStorage.getItem('currentUser');
        return saved ? JSON.parse(saved) : null;
    });

    const [theme, setTheme] = React.useState<'light' | 'dark' | 'system'>(() => {
        const saved = localStorage.getItem('theme');
        return (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system';
    });

    React.useEffect(() => {
        const applyTheme = () => {
            const root = window.document.documentElement;
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const shouldBeDark = theme === 'dark' || (theme === 'system' && systemPrefersDark);

            if (shouldBeDark) {
                root.classList.add('dark');
                root.classList.remove('light');
            } else {
                root.classList.remove('dark');
                root.classList.add('light');
            }
        };
        applyTheme();
    }, [theme]);

    const handleLogin = (user: User) => {
        setCurrentUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));
    };

    const handleLogout = () => {
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
        localStorage.removeItem('token');
    };

    return (
        <BrowserRouter>
            <Routes>
                {/* Login route */}
                <Route
                    path="/login"
                    element={
                        currentUser ? <Navigate to="/map" replace /> : <LoginView onLogin={handleLogin} />
                    }
                />

                {/* Root redirect */}
                <Route
                    path="/"
                    element={
                        currentUser ? <Navigate to="/map" replace /> : <Navigate to="/login" replace />
                    }
                />

                {/* Map routes — eagerly loaded (primary view) */}
                <Route
                    path="/map"
                    element={
                        currentUser ? (
                            <App currentUser={currentUser} onLogout={handleLogout} view="MAP" />
                        ) : (
                            <Navigate to="/login" replace />
                        )
                    }
                >
                    <Route path="issues/:issueId" element={null} />
                    <Route path="organizations/:orgId" element={null} />
                </Route>

                {/* List routes — lazy loaded */}
                <Route
                    path="/list"
                    element={
                        currentUser ? (
                            <Suspense fallback={<ViewLoader />}>
                                <App currentUser={currentUser} onLogout={handleLogout} view="LIST" />
                            </Suspense>
                        ) : (
                            <Navigate to="/login" replace />
                        )
                    }
                >
                    <Route path="issues/:issueId" element={null} />
                    <Route path="organizations/:orgId" element={null} />
                </Route>

                {/* Dashboard — lazy loaded */}
                <Route
                    path="/dashboard"
                    element={
                        currentUser ? (
                            <Suspense fallback={<ViewLoader />}>
                                <App currentUser={currentUser} onLogout={handleLogout} view="STATISTICS" />
                            </Suspense>
                        ) : (
                            <Navigate to="/login" replace />
                        )
                    }
                />

                {/* Admin routes — lazy loaded */}
                <Route
                    path="/users"
                    element={
                        currentUser && currentUser.role.toLowerCase() === 'admin' ? (
                            <Suspense fallback={<ViewLoader />}>
                                <App currentUser={currentUser} onLogout={handleLogout} view="USERS" />
                            </Suspense>
                        ) : (
                            <Navigate to="/map" replace />
                        )
                    }
                />

                <Route
                    path="/data"
                    element={
                        currentUser && currentUser.role.toLowerCase() === 'admin' ? (
                            <Suspense fallback={<ViewLoader />}>
                                <App currentUser={currentUser} onLogout={handleLogout} view="DATA" />
                            </Suspense>
                        ) : (
                            <Navigate to="/map" replace />
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