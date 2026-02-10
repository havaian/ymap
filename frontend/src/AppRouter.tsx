import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import App from './App';
import { LoginView } from './components/LoginView';
import { User } from '../types';

// Main app wrapper with routing
export const AppRouter: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });

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
        {/* Public routes */}
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
              <App currentUser={currentUser} onLogout={handleLogout} />
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
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};