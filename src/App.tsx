import React, { useState, useEffect } from 'react';
import PhoneContainer from './components/PhoneContainer';
import SplashScreen from './components/SplashScreen';
import LoginScreen from './components/LoginScreen';
import AdminDashboard from './components/AdminDashboard';
import DriverDashboard from './components/DriverDashboard';
import { UserProfile } from './types';
import { fetchApi } from './lib/api';

type ScreenState = 'splash' | 'login' | 'admin' | 'driver';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('splash');
  const [user, setUser] = useState<UserProfile | null>(null);

  // Load session from localStorage on startup and refresh/verify from Firestore
  useEffect(() => {
    const savedUser = localStorage.getItem('dn_gps_session_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as UserProfile;
        setUser(parsed);
        
        // Sync profile directly from Firestore to ensure no stale data
        fetchApi(`/api/profile/${parsed.id}`)
          .then(async (res) => {
            if (res.ok) {
              const freshUser = await res.json();
              setUser(freshUser);
              localStorage.setItem('dn_gps_session_user', JSON.stringify(freshUser));
            } else if (res.status === 404) {
              // User has been deleted by an admin
              setUser(null);
              localStorage.clear();
              sessionStorage.clear();
              setScreen('login');
            }
          })
          .catch((err) => {
            console.error('Failed to sync user session on startup:', err);
          });
      } catch (err) {
        console.error('Failed to parse cached session:', err);
      }
    }
  }, []);

  const handleSplashComplete = () => {
    // If we have a logged-in user session, skip login screen and route directly to their dashboard
    if (user) {
      setScreen(user.role === 'admin' ? 'admin' : 'driver');
    } else {
      setScreen('login');
    }
  };

  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    localStorage.clear();
    sessionStorage.clear();
    setUser(loggedInUser);
    localStorage.setItem('dn_gps_session_user', JSON.stringify(loggedInUser));
    setScreen(loggedInUser.role === 'admin' ? 'admin' : 'driver');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.clear();
    sessionStorage.clear();
    setScreen('login');
  };

  const handleResetApp = () => {
    setScreen('splash');
  };

  return (
    <PhoneContainer onResetApp={handleResetApp} screen={screen}>
      {screen === 'splash' && (
        <SplashScreen onComplete={handleSplashComplete} />
      )}
      {screen === 'login' && (
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      )}
      {screen === 'admin' && user && (
        <AdminDashboard user={user} onLogout={handleLogout} />
      )}
      {screen === 'driver' && user && (
        <DriverDashboard 
          user={user} 
          onLogout={handleLogout} 
          onProfileUpdate={(updatedUser) => {
            setUser(updatedUser);
            localStorage.setItem('dn_gps_session_user', JSON.stringify(updatedUser));
          }}
        />
      )}
    </PhoneContainer>
  );
}
