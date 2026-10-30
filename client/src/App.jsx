import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import LandingView from './views/LandingView';
import RegisterView from './views/RegisterView';
import LoginView from './views/LoginView';
import ForgotPasswordView from './views/ForgotPasswordView';
import ResetPasswordView from './views/ResetPasswordView';
import VerifyEmailView from './views/VerifyEmailView';
import ProfileView from './views/ProfileView';
import CreatorDashboardView from './views/CreatorDashboardView';
import LearnerDashboardView from './views/LearnerDashboardView';

export default function App() {
  const { user, loading } = useAuth();
  
  // URL check for initial query parameters (e.g. ?token=... on verify or reset password links)
  const [activeRoute, setActiveRoute] = useState(() => {
    const path = window.location.pathname;
    if (path.includes('verify-email') || window.location.search.includes('verify-email')) return 'verify-email';
    if (path.includes('reset-password') || window.location.search.includes('reset-password')) return 'reset-password';
    return 'landing';
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080D14] flex items-center justify-center text-white text-xs font-mono">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
          Initializing Quiz System Foundation...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#080D14] text-white selection:bg-[#10B981] selection:text-[#042F2E]">
      
      {/* Sidebar Navigation */}
      <Sidebar
        activeRoute={activeRoute}
        setActiveRoute={setActiveRoute}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        {activeRoute === 'landing' && <LandingView setActiveRoute={setActiveRoute} />}
        {activeRoute === 'register' && <RegisterView setActiveRoute={setActiveRoute} />}
        {activeRoute === 'login' && <LoginView setActiveRoute={setActiveRoute} />}
        {activeRoute === 'forgot-password' && <ForgotPasswordView setActiveRoute={setActiveRoute} />}
        {activeRoute === 'reset-password' && <ResetPasswordView setActiveRoute={setActiveRoute} />}
        {activeRoute === 'verify-email' && <VerifyEmailView setActiveRoute={setActiveRoute} />}
        {activeRoute === 'profile' && <ProfileView />}
        {activeRoute === 'creator-dashboard' && <CreatorDashboardView />}
        {activeRoute === 'learner-dashboard' && <LearnerDashboardView />}
      </main>

    </div>
  );
}
