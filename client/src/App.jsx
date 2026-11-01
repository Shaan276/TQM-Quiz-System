import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import NotificationBell from './components/NotificationBell';
import ErrorBoundary from './components/ErrorBoundary';
import LandingView from './views/LandingView';
import RegisterView from './views/RegisterView';
import LoginView from './views/LoginView';
import ForgotPasswordView from './views/ForgotPasswordView';
import ResetPasswordView from './views/ResetPasswordView';
import VerifyEmailView from './views/VerifyEmailView';
import ProfileView from './views/ProfileView';
import CreatorDashboardView from './views/CreatorDashboardView';
import LearnerDashboardView from './views/LearnerDashboardView';
import QuizStudioView from './views/QuizStudioView';
import QuestionBankView from './views/QuestionBankView';
import QuizPreviewModal from './views/QuizPreviewModal';
import QuizAttemptView from './views/QuizAttemptView';
import QuizResultView from './views/QuizResultView';
import MistakeNotebookView from './views/MistakeNotebookView';
import AttemptHistoryView from './views/AttemptHistoryView';
import SuperAdminView from './views/SuperAdminView';
import LiveHostView from './views/LiveHostView';
import LiveSessionView from './views/LiveSessionView';

export default function App() {
  const { user, loading } = useAuth();
  const [activeStudioQuizId, setActiveStudioQuizId] = useState(() => sessionStorage.getItem('quiz_active_studio_id') || null);
  const [previewQuizId, setPreviewQuizId] = useState(null);
  
  // Phase P3 Taking & Result State
  const [activeAttemptId, setActiveAttemptId] = useState(() => sessionStorage.getItem('quiz_active_attempt_id') || null);
  const [activeAttemptQuizId, setActiveAttemptQuizId] = useState(() => sessionStorage.getItem('quiz_active_attempt_quiz_id') || null);
  const [resultAttemptId, setResultAttemptId] = useState(() => sessionStorage.getItem('quiz_result_attempt_id') || null);

  // Phase P4 Live Session State
  const [activeLiveSessionId, setActiveLiveSessionId] = useState(() => sessionStorage.getItem('quiz_active_live_session_id') || null);
  const [activeLivePin, setActiveLivePin] = useState(() => sessionStorage.getItem('quiz_active_live_pin') || '');
  
  // URL check for initial query parameters or persisted route
  const [activeRoute, setActiveRouteState] = useState(() => {
    const path = window.location.pathname;
    if (path.includes('verify-email') || window.location.search.includes('verify-email')) return 'verify-email';
    if (path.includes('reset-password') || window.location.search.includes('reset-password')) return 'reset-password';
    
    // Check URL hash first (e.g. #creator-dashboard)
    const hash = (window.location.hash || '').replace('#', '').trim();
    const VALID_ROUTES = [
      'landing', 'register', 'login', 'forgot-password', 'reset-password',
      'verify-email', 'profile', 'creator-dashboard', 'quiz-studio',
      'question-bank', 'teacher-insights', 'learner-dashboard', 'quiz-attempt', 'quiz-result',
      'mistake-notebook', 'attempt-history', 'admin-dashboard',
      'live-host', 'live-session'
    ];
    if (hash && VALID_ROUTES.includes(hash)) return hash;

    // Check sessionStorage
    const saved = sessionStorage.getItem('quiz_active_route');
    if (saved && VALID_ROUTES.includes(saved)) return saved;

    return 'landing';
  });

  const setActiveRoute = useCallback((route) => {
    setActiveRouteState(route);
    try {
      sessionStorage.setItem('quiz_active_route', route);
      if (window.location.hash.replace('#', '') !== route) {
        window.location.hash = route;
      }
    } catch (e) {}
  }, []);

  // Listen for browser Back / Forward hash navigation
  useEffect(() => {
    const handleHashChange = () => {
      const hash = (window.location.hash || '').replace('#', '').trim();
      if (hash && hash !== activeRoute) {
        setActiveRouteState(hash);
        sessionStorage.setItem('quiz_active_route', hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeRoute]);

  // Requirement: If on any protected/authenticated page and user logs out, immediately return to landing page
  useEffect(() => {
    if (!user && !['landing', 'login', 'register', 'forgot-password', 'reset-password', 'verify-email'].includes(activeRoute)) {
      setActiveRoute('landing');
    }
  }, [user, activeRoute, setActiveRoute]);

  // Strict Role-Based View Guard
  useEffect(() => {
    if (!user) return;
    const role = (user.role || '').toUpperCase();
    const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
    const isOrgAdmin = role === 'ORG_ADMIN';
    const isTeacher = role === 'TEACHER' || role === 'CREATOR';
    const isStudent = role === 'STUDENT' || role === 'LEARNER';

    // Student blocked from Teacher Studio and Admin Console
    if (isStudent && ['creator-dashboard', 'quiz-studio', 'question-bank', 'teacher-insights', 'admin-dashboard'].includes(activeRoute)) {
      setActiveRoute('learner-dashboard');
    }

    // Teacher blocked from Admin Console and Student platform
    if (isTeacher && !isSuperAdmin && !isOrgAdmin && ['admin-dashboard', 'learner-dashboard'].includes(activeRoute)) {
      setActiveRoute('creator-dashboard');
    }

    // Org Admin blocked from Student platform
    if (isOrgAdmin && !isSuperAdmin && ['learner-dashboard'].includes(activeRoute)) {
      setActiveRoute('admin-dashboard');
    }
  }, [user, activeRoute, setActiveRoute]);

  const handleOpenStudio = (quizId) => {
    setActiveStudioQuizId(quizId);
    sessionStorage.setItem('quiz_active_studio_id', quizId);
    setActiveRoute('quiz-studio');
  };

  const handleOpenPreview = (quizId) => {
    setPreviewQuizId(quizId);
  };

  // Taking flows
  const handleStartAttempt = (quizId) => {
    setActiveAttemptQuizId(quizId);
    sessionStorage.setItem('quiz_active_attempt_quiz_id', quizId);
    setActiveAttemptId(null);
    sessionStorage.removeItem('quiz_active_attempt_id');
    setActiveRoute('quiz-attempt');
  };

  const handleResumeAttempt = (attemptId) => {
    setActiveAttemptId(attemptId);
    sessionStorage.setItem('quiz_active_attempt_id', attemptId);
    setActiveAttemptQuizId(null);
    sessionStorage.removeItem('quiz_active_attempt_quiz_id');
    setActiveRoute('quiz-attempt');
  };

  const handleCompleteAttempt = (attemptId) => {
    setResultAttemptId(attemptId);
    sessionStorage.setItem('quiz_result_attempt_id', attemptId);
    setActiveRoute('quiz-result');
  };

  const handleViewResult = (attemptId) => {
    setResultAttemptId(attemptId);
    sessionStorage.setItem('quiz_result_attempt_id', attemptId);
    setActiveRoute('quiz-result');
  };

  const handleRetake = (quizId) => {
    setActiveAttemptQuizId(quizId);
    sessionStorage.setItem('quiz_active_attempt_quiz_id', quizId);
    setActiveAttemptId(null);
    sessionStorage.removeItem('quiz_active_attempt_id');
    setActiveRoute('quiz-attempt');
  };

  // Phase P4 Live Multiplayer Handlers
  const handleHostLive = (sessionId) => {
    setActiveLiveSessionId(sessionId);
    sessionStorage.setItem('quiz_active_live_session_id', sessionId);
    setActiveRoute('live-host');
  };

  const handleJoinLive = (pinCode) => {
    setActiveLivePin(pinCode || '');
    sessionStorage.setItem('quiz_active_live_pin', pinCode || '');
    setActiveRoute('live-session');
  };

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

  const showSidebar = activeRoute !== 'landing';

  return (
    <div className="min-h-screen flex bg-[#080D14] text-white selection:bg-[#10B981] selection:text-[#042F2E]">
      
      {/* Sidebar Navigation (Hidden on Landing Page) */}
      {showSidebar && (
        <Sidebar
          activeRoute={activeRoute}
          setActiveRoute={setActiveRoute}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top-Right Notification & Status Bar (Logged-in Pages) */}
        {user && activeRoute !== 'landing' && (
          <header className="h-16 border-b border-[#1E2D4A] bg-[#0A101D]/90 backdrop-blur-md px-6 lg:px-10 flex items-center justify-between sticky top-0 z-30">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#64748B]">
              <span className="text-[#38BDF8] font-bold uppercase tracking-wider">{user.role}</span>
              <span>/</span>
              <span className="text-white capitalize">{activeRoute.replace(/-/g, ' ')}</span>
            </div>
            <div className="flex items-center gap-4">
              {/* Notification Bell positioned in top right */}
              <NotificationBell setActiveRoute={setActiveRoute} />
              
              {/* Quick Profile Link */}
              <div 
                onClick={() => setActiveRoute('profile')}
                className="flex items-center gap-2.5 py-1.5 px-3 rounded-xl bg-[#121D32] border border-[#1F304E] hover:border-[#38BDF8]/40 cursor-pointer transition-all"
                title="View Profile & Security"
              >
                <div className="w-7 h-7 rounded-lg bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center font-bold text-xs">
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <span className="text-xs font-bold text-white max-w-[140px] truncate hidden sm:inline">{user.name}</span>
              </div>
            </div>
          </header>
        )}

        {/* Viewport protected by Isolated ErrorBoundary per Route */}
        <main className={`flex-1 min-w-0 ${activeRoute === 'landing' ? 'p-0' : 'p-6 lg:p-10 xl:p-12'}`}>
          <ErrorBoundary key={activeRoute} route={activeRoute} onReset={() => window.location.reload()}>
          {activeRoute === 'landing' && <LandingView setActiveRoute={setActiveRoute} />}
          {activeRoute === 'register' && <RegisterView setActiveRoute={setActiveRoute} />}
          {activeRoute === 'login' && <LoginView setActiveRoute={setActiveRoute} />}
          {activeRoute === 'forgot-password' && <ForgotPasswordView setActiveRoute={setActiveRoute} />}
          {activeRoute === 'reset-password' && <ResetPasswordView setActiveRoute={setActiveRoute} />}
          {activeRoute === 'verify-email' && <VerifyEmailView setActiveRoute={setActiveRoute} />}
          {activeRoute === 'profile' && <ProfileView />}
          
          {/* Creator Studio */}
          {activeRoute === 'creator-dashboard' && (
            <CreatorDashboardView
              setActiveRoute={setActiveRoute}
              onOpenStudio={handleOpenStudio}
              onOpenPreview={handleOpenPreview}
              onHostLive={handleHostLive}
            />
          )}

          {activeRoute === 'teacher-insights' && (
            <CreatorDashboardView
              setActiveRoute={setActiveRoute}
              onOpenStudio={handleOpenStudio}
              onOpenPreview={handleOpenPreview}
              onHostLive={handleHostLive}
              initialTab="insights"
            />
          )}

          {activeRoute === 'quiz-studio' && (
            activeStudioQuizId ? (
              <QuizStudioView
                quizId={activeStudioQuizId}
                onBack={() => setActiveRoute('creator-dashboard')}
                onOpenPreview={handleOpenPreview}
              />
            ) : (
              <CreatorDashboardView
                setActiveRoute={setActiveRoute}
                onOpenStudio={handleOpenStudio}
                onOpenPreview={handleOpenPreview}
                onHostLive={handleHostLive}
              />
            )
          )}

          {activeRoute === 'question-bank' && (
            <QuestionBankView
              setActiveRoute={setActiveRoute}
            />
          )}

          {/* Learner Arena & Discovery */}
          {activeRoute === 'learner-dashboard' && (
            <LearnerDashboardView
              onStartAttempt={handleStartAttempt}
              onJoinLive={handleJoinLive}
              setActiveRoute={setActiveRoute}
            />
          )}

          {/* Phase P4 Live Multiplayer Views */}
          {activeRoute === 'live-host' && (
            <LiveHostView
              sessionId={activeLiveSessionId}
              onBack={() => setActiveRoute('creator-dashboard')}
            />
          )}

          {activeRoute === 'live-session' && (
            <LiveSessionView
              initialPin={activeLivePin}
              onBack={() => setActiveRoute('learner-dashboard')}
            />
          )}

          {/* Interactive Taking Runner (P3) */}
          {activeRoute === 'quiz-attempt' && (
            <QuizAttemptView
              attemptId={activeAttemptId}
              quizId={activeAttemptQuizId}
              onComplete={handleCompleteAttempt}
              onExit={() => setActiveRoute('learner-dashboard')}
            />
          )}

          {/* Result & Evaluation Review (P3) */}
          {activeRoute === 'quiz-result' && (
            resultAttemptId ? (
              <QuizResultView
                attemptId={resultAttemptId}
                onRetake={handleRetake}
                onReviewMistakes={() => setActiveRoute('mistake-notebook')}
                onBackToQuizzes={() => setActiveRoute('learner-dashboard')}
              />
            ) : (
              <LearnerDashboardView
                onStartAttempt={handleStartAttempt}
                setActiveRoute={setActiveRoute}
              />
            )
          )}

          {/* Mistake Notebook (P3) */}
          {activeRoute === 'mistake-notebook' && (
            <MistakeNotebookView
              setActiveRoute={setActiveRoute}
            />
          )}

          {/* Attempt History (P3) */}
          {activeRoute === 'attempt-history' && (
            <AttemptHistoryView
              onViewResult={handleViewResult}
              onResumeAttempt={handleResumeAttempt}
              setActiveRoute={setActiveRoute}
            />
          )}

          {/* Superadmin Console (P3) */}
          {activeRoute === 'admin-dashboard' && (
            <SuperAdminView
              setActiveRoute={setActiveRoute}
            />
          )}
        </ErrorBoundary>
      </main>
      </div>

      {/* Global Interactive Quiz Preview Modal */}
      {previewQuizId && (
        <QuizPreviewModal
          quizId={previewQuizId}
          onClose={() => setPreviewQuizId(null)}
        />
      )}

    </div>
  );
}