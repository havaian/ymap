import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import { LoginView } from './components/LoginView';
import { User } from '../types';
import './index.css';

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
        
        {/* Protected routes */}
        <Route 
          path="/" 
          element={
            currentUser ? <Navigate to="/map" replace /> : <Navigate to="/login" replace />
          } 
        />
        
        <Route 
          path="/map" 
          element={
            currentUser ? (
              <App currentUser={currentUser} onLogout={handleLogout} initialView="MAP" />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        
        <Route 
          path="/list" 
          element={
            currentUser ? (
              <App currentUser={currentUser} onLogout={handleLogout} initialView="LIST" />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        
        <Route 
          path="/dashboard" 
          element={
            currentUser ? (
              <App currentUser={currentUser} onLogout={handleLogout} initialView="STATISTICS" />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        
        <Route 
          path="/users" 
          element={
            currentUser && currentUser.role === 'Admin' ? (
              <App currentUser={currentUser} onLogout={handleLogout} initialView="USERS" />
            ) : (
              <Navigate to="/map" replace />
            )
          } 
        />
        
        <Route 
          path="/data" 
          element={
            currentUser && currentUser.role === 'Admin' ? (
              <App currentUser={currentUser} onLogout={handleLogout} initialView="DATA" />
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