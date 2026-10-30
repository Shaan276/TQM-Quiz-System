import React, { useState, useEffect } from 'react';
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
import QuizStudioView from './views/QuizStudioView';
import QuestionBankView from './views/QuestionBankView';
import QuizPreviewModal from './views/QuizPreviewModal';
import QuizAttemptView from './views/QuizAttemptView';
import QuizResultView from './views/QuizResultView';
import MistakeNotebookView from './views/MistakeNotebookView';
import AttemptHistoryView from './views/AttemptHistoryView';
import SuperAdminView from './views/SuperAdminView';

export default function App() {
  const { user, loading } = useAuth();
  const [activeStudioQuizId, setActiveStudioQuizId] = useState(null);
  const [previewQuizId, setPreviewQuizId] = useState(null);
  
  // Phase P3 Taking & Result State
  const [activeAttemptId, setActiveAttemptId] = useState(null);
  const [activeAttemptQuizId, setActiveAttemptQuizId] = useState(null);
  const [resultAttemptId, setResultAttemptId] = useState(null);
  
  // URL check for initial query parameters (e.g. ?token=... on verify or reset password links)
  const [activeRoute, setActiveRoute] = useState(() => {
    const path = window.location.pathname;
    if (path.includes('verify-email') || window.location.search.includes('verify-email')) return 'verify-email';
    if (path.includes('reset-password') || window.location.search.includes('reset-password')) return 'reset-password';
    return 'landing';
  });

  // Requirement: If on any protected/authenticated page and user logs out, immediately return to landing page
  useEffect(() => {
    if (!user && !['landing', 'login', 'register', 'forgot-password', 'reset-password', 'verify-email'].includes(activeRoute)) {
      setActiveRoute('landing');
    }
  }, [user, activeRoute]);

  const handleOpenStudio = (quizId) => {
    setActiveStudioQuizId(quizId);
    setActiveRoute('quiz-studio');
  };

  const handleOpenPreview = (quizId) => {
    setPreviewQuizId(quizId);
  };

  // Taking flows
  const handleStartAttempt = (quizId) => {
    setActiveAttemptQuizId(quizId);
    setActiveAttemptId(null);
    setActiveRoute('quiz-attempt');
  };

  const handleResumeAttempt = (attemptId) => {
    setActiveAttemptId(attemptId);
    setActiveAttemptQuizId(null);
    setActiveRoute('quiz-attempt');
  };

  const handleCompleteAttempt = (attemptId) => {
    setResultAttemptId(attemptId);
    setActiveRoute('quiz-result');
  };

  const handleViewResult = (attemptId) => {
    setResultAttemptId(attemptId);
    setActiveRoute('quiz-result');
  };

  const handleRetake = (quizId) => {
    setActiveAttemptQuizId(quizId);
    setActiveAttemptId(null);
    setActiveRoute('quiz-attempt');
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
        
        {/* Creator Studio */}
        {activeRoute === 'creator-dashboard' && (
          <CreatorDashboardView
            setActiveRoute={setActiveRoute}
            onOpenStudio={handleOpenStudio}
            onOpenPreview={handleOpenPreview}
          />
        )}

        {activeRoute === 'quiz-studio' && activeStudioQuizId && (
          <QuizStudioView
            quizId={activeStudioQuizId}
            onBack={() => setActiveRoute('creator-dashboard')}
            onOpenPreview={handleOpenPreview}
          />
        )}

        {activeRoute === 'question-bank' && (
          <QuestionBankView
            setActiveRoute={setActiveRoute}
          />
        )}

        {/* Learner Arena & Discovery */}
        {activeRoute === 'learner-dashboard' && (
          <LearnerDashboardView
            onOpenPreview={handleOpenPreview}
            onStartAttempt={handleStartAttempt}
            setActiveRoute={setActiveRoute}
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
        {activeRoute === 'quiz-result' && resultAttemptId && (
          <QuizResultView
            attemptId={resultAttemptId}
            onRetake={handleRetake}
            onReviewMistakes={() => setActiveRoute('mistake-notebook')}
            onBackToQuizzes={() => setActiveRoute('learner-dashboard')}
          />
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

      </main>

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