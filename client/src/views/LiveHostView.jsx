import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Play, 
  Pause, 
  SkipForward, 
  Award, 
  Users, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Copy, 
  Check, 
  Sparkles, 
  Trophy, 
  Radio, 
  ArrowLeft,
  Flame,
  BarChart3,
  Crown,
  Eye,
  EyeOff
} from 'lucide-react';

export default function LiveHostView({ sessionId, onBack }) {
  const { accessToken, user } = useAuth();
  const [session, setSession] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING'); // CONNECTING | CONNECTED | DISCONNECTED
  const [participants, setParticipants] = useState([]);
  const [status, setStatus] = useState('LOBBY'); // LOBBY | STARTING | QUESTION_ACTIVE | QUESTION_ENDED | LEADERBOARD | PAUSED | COMPLETED
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [questionEndedData, setQuestionEndedData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [podiumData, setPodiumData] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [countdownNum, setCountdownNum] = useState(3);
  const [isLeaderboardVisible, setIsLeaderboardVisible] = useState(true);

  const wsRef = useRef(null);
  const timerRef = useRef(null);

  // Fetch initial session metadata immediately via REST on mount
  useEffect(() => {
    if (!sessionId || !accessToken) return;

    fetch(`/api/v1/live-sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setSession(prev => ({ ...(prev || {}), ...data.data }));
          if (data.data.status) setStatus(data.data.status);
          if (data.data.totalQuestions) setTotalQuestions(data.data.totalQuestions);
        }
      })
      .catch(err => {
        console.error('[LiveHost] Failed to fetch session metadata:', err);
      });
  }, [sessionId, accessToken]);

  // Initialize WebSocket Connection
  useEffect(() => {
    if (!sessionId || !accessToken) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '3000' ? `${window.location.hostname}:5000` : window.location.host;
    const wsUrl = `${protocol}//${host}/ws/live?token=${encodeURIComponent(accessToken)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('CONNECTED');
      ws.send(JSON.stringify({
        event: 'host_join',
        sessionId,
        payload: { sessionId, token: accessToken }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { event: evt, payload } = msg;

        switch (evt) {
          case 'host_state_snapshot':
            setSession(prev => ({ ...(prev || {}), ...payload }));
            setStatus(payload.status);
            setQuestionIndex(payload.currentQuestionIndex);
            setTotalQuestions(payload.totalQuestions);
            setParticipants(payload.participants || []);
            setAnsweredCount(payload.answeredCount || 0);
            setRemainingSeconds(payload.remainingSeconds || 0);
            if (payload.currentQuestion) setCurrentQuestion(payload.currentQuestion);
            if (payload.leaderboard) setLeaderboard(payload.leaderboard);
            break;

          case 'player_roster_update':
            setParticipants(payload.participants || []);
            break;

          case 'session_starting':
            setStatus('STARTING');
            setCountdownNum(payload.countdownSeconds || 3);
            break;

          case 'host_question_active':
            setStatus('QUESTION_ACTIVE');
            setQuestionIndex(payload.questionIndex);
            setTotalQuestions(payload.totalQuestions);
            setCurrentQuestion(payload.question);
            setAnsweredCount(0);
            setRemainingSeconds(payload.timeLimitSec);
            setQuestionEndedData(null);
            break;

          case 'live_answer_count_update':
            setAnsweredCount(payload.answeredCount);
            break;

          case 'session_paused':
            setStatus('PAUSED');
            setRemainingSeconds(payload.remainingSeconds);
            break;

          case 'session_resumed':
            setStatus('QUESTION_ACTIVE');
            setRemainingSeconds(payload.remainingSeconds);
            break;

          case 'host_question_ended':
            setStatus('QUESTION_ENDED');
            setQuestionEndedData(payload);
            break;

          case 'host_leaderboard_update':
            setStatus('LEADERBOARD');
            setLeaderboard(payload.leaderboard || []);
            break;

          case 'podium_celebration':
            setStatus('COMPLETED');
            setPodiumData(payload);
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('[LiveHost] WS message error:', err);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('DISCONNECTED');
    };

    ws.onerror = () => {
      setConnectionStatus('DISCONNECTED');
    };

    return () => {
      if (ws.readyState === 1) ws.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sessionId, accessToken]);

  // Local authoritative timer display countdown
  useEffect(() => {
    if (status === 'QUESTION_ACTIVE' && remainingSeconds > 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRemainingSeconds(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status, remainingSeconds]);

  // Handle Starting 3s Countdown visual
  useEffect(() => {
    if (status === 'STARTING') {
      const interval = setInterval(() => {
        setCountdownNum(prev => (prev > 1 ? prev - 1 : 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status]);

  // Host Action Handlers
  const handleStartSession = () => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ event: 'start_session', sessionId }));
    }
  };

  const handlePauseSession = () => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ event: 'pause_session', sessionId }));
    }
  };

  const handleResumeSession = () => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ event: 'resume_session', sessionId }));
    }
  };

  const handleShowLeaderboard = () => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ event: 'show_leaderboard', sessionId }));
    }
  };

  const handleNextQuestion = () => {
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ event: 'next_question', sessionId }));
    }
  };

  const handleEndSession = () => {
    if (!window.confirm('Are you sure you want to conclude this live session?')) return;
    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({ event: 'end_session', sessionId }));
    }
  };

  const handleCopyCode = () => {
    if (session?.joinCode) {
      navigator.clipboard.writeText(session.joinCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleLeaveView = async () => {
    if (status === 'LOBBY') {
      const confirmLeave = window.confirm('Quit lobby? Since this live battle was not started, it will not be saved in history.');
      if (!confirmLeave) return;
      try {
        await fetch(`/api/v1/live-sessions/${sessionId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` }
        });
      } catch (err) {
        console.error('Failed to clean up unstarted lobby:', err);
      }
    }
    onBack();
  };

  // Dedicated Permanent Leaderboard Renderer
  const renderLeaderboardTable = () => {
    if (!isLeaderboardVisible) {
      return (
        <div className="p-3.5 rounded-2xl bg-[#0E1626] border border-[#1B2A44] flex items-center justify-between text-xs text-[#94A3B8]">
          <span className="flex items-center gap-2">
            <EyeOff size={15} className="text-[#64748B]" />
            Leaderboard is currently hidden from host console.
          </span>
          <button
            onClick={() => setIsLeaderboardVisible(true)}
            className="text-[#34D399] hover:underline font-bold"
          >
            Show Leaderboard
          </button>
        </div>
      );
    }

    return (
      <div className="dashboard-card p-5 space-y-4 border border-[#1F304E] animate-fadeIn">
        <div className="flex items-center justify-between border-b border-[#1B2A44] pb-3">
          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Trophy size={14} className="text-[#F59E0B]" />
            Live Round Standings ({leaderboard.length} Participants)
          </h4>
          <button
            onClick={() => setIsLeaderboardVisible(false)}
            className="text-xs text-[#94A3B8] hover:text-white flex items-center gap-1 font-semibold"
          >
            <EyeOff size={13} />
            Hide Leaderboard
          </button>
        </div>

        {leaderboard.length === 0 ? (
          <p className="text-xs text-[#64748B] italic py-2">No scores recorded yet for this question round.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {leaderboard.map((item, idx) => (
              <div
                key={item.id || idx}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-all ${
                  item.rank === 1
                    ? 'bg-gradient-to-r from-[#F59E0B]/15 to-[#121D32] border-[#F59E0B]/40 text-white font-bold'
                    : item.rank === 2
                    ? 'bg-[#121D32] border-[#94A3B8]/30 text-white'
                    : item.rank === 3
                    ? 'bg-[#121D32] border-[#D97706]/30 text-white'
                    : 'bg-[#0E1626] border-[#1B2A44] text-[#CBD5E1]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-[11px] shrink-0 ${
                    item.rank === 1 ? 'bg-[#F59E0B] text-black' : item.rank === 2 ? 'bg-[#94A3B8] text-black' : item.rank === 3 ? 'bg-[#D97706] text-white' : 'bg-[#1F304E] text-[#94A3B8]'
                  }`}>
                    #{item.rank}
                  </span>
                  <span className="truncate font-semibold">{item.displayName}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] text-[#94A3B8]">{item.correctCount || 0} ✓</span>
                  <span className="font-mono font-black text-[#34D399]">{item.score} pts</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      
      {/* Top Host Command Bar */}
      <div className="dashboard-card p-4 flex flex-wrap items-center justify-between gap-4 border-b border-[#1B2A44] sticky top-4 z-40 bg-[#0B111D]/95 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeaveView}
            className="w-9 h-9 rounded-xl bg-[#132238] border border-[#1F304E] flex items-center justify-center text-[#94A3B8] hover:text-white transition-colors"
            title="Leave Host View"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
              <h2 className="text-base font-extrabold text-white tracking-wide">
                Live Host Console &bull; {session?.quizTitle || 'Quiz Session'}
              </h2>
            </div>
            <p className="text-[11px] text-[#94A3B8] font-medium">
              Subject: <span className="text-[#38BDF8]">{session?.quizCategory || 'General'}</span> &bull; Status: <span className="font-bold text-white">{status}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Connection status */}
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border flex items-center gap-1.5 ${
            connectionStatus === 'CONNECTED'
              ? 'bg-[#10B981]/15 text-[#34D399] border-[#10B981]/30'
              : 'bg-[#F43F5E]/15 text-[#FB7185] border-[#F43F5E]/30'
          }`}>
            <Radio size={12} className={connectionStatus === 'CONNECTED' ? 'animate-pulse' : ''} />
            {connectionStatus === 'CONNECTED' ? 'Live' : 'Connecting...'}
          </span>

          {/* Permanent Leaderboard Toggle Button */}
          {['QUESTION_ACTIVE', 'PAUSED', 'QUESTION_ENDED', 'LEADERBOARD'].includes(status) && (
            <button
              onClick={() => setIsLeaderboardVisible(prev => !prev)}
              className="px-3 py-1.5 rounded-xl bg-[#132238] hover:bg-[#1E293B] border border-[#2D436B] text-xs font-bold text-[#94A3B8] hover:text-white flex items-center gap-1.5 transition-all shadow-sm"
              title={isLeaderboardVisible ? 'Hide Leaderboard from screen' : 'Show Leaderboard'}
            >
              {isLeaderboardVisible ? <EyeOff size={13} className="text-[#FB7185]" /> : <Eye size={13} className="text-[#34D399]" />}
              <span>{isLeaderboardVisible ? 'Hide Leaderboard' : 'Show Leaderboard'}</span>
            </button>
          )}

          {/* Permanent Next Question (Force Progression) Button */}
          {['QUESTION_ACTIVE', 'PAUSED', 'QUESTION_ENDED', 'LEADERBOARD'].includes(status) && (
            <button
              onClick={handleNextQuestion}
              className="btn-emerald-primary text-xs py-1.5 px-3.5 font-bold flex items-center gap-1.5 shadow-md shadow-[#10B981]/25 hover:scale-105 transition-all"
              title="Force to advance to next question or end session"
            >
              <SkipForward size={13} />
              <span>{(questionIndex + 1) >= totalQuestions ? 'Finish Quiz 🏆' : 'Next Question →'}</span>
            </button>
          )}

          {status !== 'COMPLETED' && (
            <button
              onClick={handleEndSession}
              className="px-3 py-1.5 rounded-xl bg-[#F43F5E]/15 hover:bg-[#F43F5E]/25 text-[#FB7185] text-xs font-bold border border-[#F43F5E]/30 transition-all"
            >
              End Session
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. LOBBY PHASE */}
      {/* ------------------------------------------------------------- */}
      {status === 'LOBBY' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Big Join PIN Hero Card */}
          <div className="dashboard-card p-8 text-center space-y-4 border-2 border-[#10B981]/40 bg-gradient-to-b from-[#10B981]/10 via-[#0E1626] to-[#080D14]">
            <span className="text-xs font-bold uppercase tracking-widest text-[#34D399]">
              Live Multiplayer Game Lobby
            </span>
            <p className="text-sm text-[#94A3B8]">
              Ask students to go to the Student Dashboard and enter this Session Join Code:
            </p>

            <div className="flex items-center justify-center gap-3 py-2">
              <span className="text-5xl sm:text-7xl font-black font-mono tracking-widest text-white drop-shadow-lg bg-[#0B111D] px-6 py-2 rounded-2xl border border-[#2D436B]">
                {session?.joinCode || '------'}
              </span>
              <button
                onClick={handleCopyCode}
                className="w-12 h-12 rounded-2xl bg-[#132238] border border-[#2D436B] hover:border-[#34D399] flex items-center justify-center text-white transition-all"
                title="Copy PIN"
              >
                {copiedCode ? <Check size={20} className="text-[#34D399]" /> : <Copy size={20} />}
              </button>
            </div>

            <div className="flex items-center justify-center gap-6 text-xs text-[#94A3B8]">
              <span className="flex items-center gap-1.5 font-bold text-white">
                <Users size={16} className="text-[#38BDF8]" />
                {participants.length} Student{participants.length === 1 ? '' : 's'} Waiting
              </span>
              <span>&bull;</span>
              <span>{session?.totalQuestions || totalQuestions} Total Questions</span>
            </div>

            <div className="pt-4">
              <button
                onClick={handleStartSession}
                disabled={participants.length === 0}
                className={`btn-emerald-primary text-base font-extrabold py-3.5 px-8 rounded-2xl gap-2 shadow-xl shadow-[#10B981]/25 transition-all ${
                  participants.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'
                }`}
              >
                <Play size={18} />
                Start Quiz Session
              </button>
              {participants.length === 0 && (
                <p className="text-[11px] text-[#64748B] mt-2">
                  At least one participant must join before starting the quiz.
                </p>
              )}
            </div>
          </div>

          {/* Participant Roster Grid */}
          <div className="dashboard-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1B2A44]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users size={16} className="text-[#38BDF8]" />
                Connected Participants ({participants.length})
              </h3>
            </div>

            {participants.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#64748B] font-mono">
                Waiting for students to enter PIN {session?.joinCode}...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {participants.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    className="p-3 rounded-xl bg-[#121D32] border border-[#1F304E] flex items-center gap-2.5 animate-fadeIn"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center font-bold text-xs uppercase">
                      {p.displayName.slice(0, 2)}
                    </div>
                    <span className="text-xs font-semibold text-white truncate">
                      {p.displayName}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. STARTING PHASE (3s Countdown Overlay) */}
      {/* ------------------------------------------------------------- */}
      {status === 'STARTING' && (
        <div className="dashboard-card p-16 text-center space-y-6 border border-[#34D399]/40 bg-[#0A121F] animate-fadeIn">
          <span className="text-xs font-bold text-[#34D399] uppercase tracking-widest">
            Session Starting
          </span>
          <div className="text-8xl font-black text-white font-mono animate-bounce text-[#34D399]">
            {countdownNum}
          </div>
          <p className="text-sm text-[#94A3B8]">Get ready! The first question is about to begin.</p>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. QUESTION ACTIVE OR PAUSED PHASE */}
      {/* ------------------------------------------------------------- */}
      {(status === 'QUESTION_ACTIVE' || status === 'PAUSED') && currentQuestion && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Question Status Banner */}
          <div className="dashboard-card p-6 space-y-5 border border-[#1F304E]">
            
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1B2A44]">
              <div className="flex items-center gap-2.5">
                <span className="px-3 py-1 rounded-xl bg-[#10B981]/20 border border-[#10B981]/40 text-xs font-bold text-[#34D399]">
                  Question {questionIndex + 1} of {totalQuestions}
                </span>
                <span className="text-xs font-mono text-[#94A3B8]">
                  Type: {currentQuestion.question_type?.replace('_', ' ')}
                </span>
              </div>

              {/* Countdown & Action Buttons */}
              <div className="flex items-center gap-3">
                <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-sm font-bold border ${
                  remainingSeconds <= 5
                    ? 'bg-[#F43F5E]/20 text-[#FB7185] border-[#F43F5E]/40 animate-pulse'
                    : 'bg-[#132238] text-[#38BDF8] border-[#1F304E]'
                }`}>
                  <Clock size={16} />
                  <span>{remainingSeconds}s</span>
                </div>

                {status === 'QUESTION_ACTIVE' ? (
                  <button
                    onClick={handlePauseSession}
                    className="p-2 rounded-xl bg-[#132238] border border-[#1F304E] hover:border-[#38BDF8] text-[#94A3B8] hover:text-white"
                    title="Pause Timer"
                  >
                    <Pause size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleResumeSession}
                    className="p-2 rounded-xl bg-[#10B981]/20 border border-[#10B981]/40 text-[#34D399]"
                    title="Resume Timer"
                  >
                    <Play size={16} />
                  </button>
                )}

                <button
                  onClick={handleShowLeaderboard}
                  className="btn-secondary text-xs py-2 px-3 gap-1.5 font-bold"
                  title="Skip to results immediately"
                >
                  <SkipForward size={14} />
                  Skip Question
                </button>
              </div>
            </div>

            {/* Question Text */}
            <h3 className="text-lg md:text-xl font-bold text-white leading-relaxed">
              {currentQuestion.question_text}
            </h3>

            {/* Answer Options Preview (with correct highlighted for Host) */}
            {currentQuestion.options && currentQuestion.options.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {currentQuestion.options.map((opt, i) => (
                  <div
                    key={opt.id || i}
                    className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-medium ${
                      opt.is_correct === 1
                        ? 'bg-[#10B981]/15 border-[#10B981]/50 text-white shadow-sm shadow-[#10B981]/10'
                        : 'bg-[#0E1626] border-[#1B2A44] text-[#94A3B8]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-[#1B2A44] flex items-center justify-center font-bold text-[10px] text-white">
                        {opt.option_key || String.fromCharCode(65 + i)}
                      </span>
                      <span>{opt.option_text}</span>
                    </div>
                    {opt.is_correct === 1 && (
                      <span className="text-[10px] font-bold text-[#34D399] flex items-center gap-1">
                        <Check size={12} /> Correct Choice
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Live Answering Progress Bar */}
            <div className="pt-4 border-t border-[#1B2A44] space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#94A3B8]">
                <span>Responses Submitted</span>
                <span className="text-white font-mono">
                  {answeredCount} / {participants.length}
                </span>
              </div>
              <div className="w-full bg-[#121D32] h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#10B981] to-[#38BDF8] transition-all duration-300"
                  style={{
                    width: `${participants.length > 0 ? (answeredCount / participants.length) * 100 : 0}%`
                  }}
                />
              </div>
            </div>

          </div>

          {/* Real-time Permanent Leaderboard */}
          {renderLeaderboardTable()}

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. QUESTION ENDED (Distribution Reveal) */}
      {/* ------------------------------------------------------------- */}
      {status === 'QUESTION_ENDED' && questionEndedData && (
        <div className="dashboard-card p-6 md:p-8 space-y-6 animate-fadeIn">
          
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1B2A44]">
            <div>
              <span className="text-[11px] font-bold text-[#34D399] uppercase tracking-wider">
                Question {questionEndedData.questionIndex + 1} Concluded
              </span>
              <h3 className="text-lg font-bold text-white mt-1">Answer Distribution & Solution</h3>
            </div>

            <button
              onClick={handleShowLeaderboard}
              className="btn-emerald-primary text-xs py-2.5 px-4 font-bold gap-2"
            >
              <Award size={14} />
              Reveal Live Leaderboard
            </button>
          </div>

          {/* Correct Answer Display */}
          <div className="p-4 rounded-2xl bg-[#0A1E1E] border border-[#10B981]/40 space-y-1">
            <span className="text-xs font-bold text-[#34D399] flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Correct Answer:
            </span>
            <p className="text-sm font-mono font-bold text-white">
              {questionEndedData.correctAnswer}
            </p>
            {questionEndedData.explanation && (
              <p className="text-xs text-[#CBD5E1] pt-1">
                <strong>Explanation:</strong> {questionEndedData.explanation}
              </p>
            )}
          </div>

          {/* Choice Distribution */}
          {questionEndedData.distribution && Object.keys(questionEndedData.distribution).length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-[#94A3B8] uppercase">Class Response Breakdown</h4>
              <div className="space-y-2">
                {Object.entries(questionEndedData.distribution).map(([choice, count]) => {
                  const pct = questionEndedData.totalAnswered > 0
                    ? Math.round((count / questionEndedData.totalAnswered) * 100)
                    : 0;

                  return (
                    <div key={choice} className="p-3 rounded-xl bg-[#121D32] border border-[#1F304E] space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-white truncate max-w-md">{choice}</span>
                        <span className="text-[#38BDF8] font-mono">{count} votes ({pct}%)</span>
                      </div>
                      <div className="w-full bg-[#0B111D] h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#38BDF8]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Real-time Permanent Leaderboard */}
          {renderLeaderboardTable()}

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. LEADERBOARD PHASE */}
      {/* ------------------------------------------------------------- */}
      {status === 'LEADERBOARD' && (
        <div className="dashboard-card p-6 md:p-8 space-y-6 animate-fadeIn">
          
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1B2A44]">
            <div>
              <span className="text-[11px] font-bold text-[#F59E0B] uppercase tracking-wider flex items-center gap-1">
                <Trophy size={14} /> Leaderboard Standings
              </span>
              <h3 className="text-lg font-bold text-white mt-1">
                Rankings after Round {questionIndex + 1} of {totalQuestions}
              </h3>
            </div>

            <button
              onClick={handleNextQuestion}
              className="btn-emerald-primary text-xs py-2.5 px-5 font-bold gap-2 shadow-lg shadow-[#10B981]/20"
            >
              {(questionIndex + 1) >= totalQuestions ? (
                <>
                  <Award size={15} /> Final Results & Podium
                </>
              ) : (
                <>
                  <SkipForward size={15} /> Next Question
                </>
              )}
            </button>
          </div>

          {/* Leaderboard Table */}
          <div className="space-y-2.5">
            {leaderboard.map((item, idx) => (
              <div
                key={item.id || idx}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                  item.rank === 1
                    ? 'bg-gradient-to-r from-[#F59E0B]/20 to-[#121D32] border-[#F59E0B]/40 shadow-md'
                    : item.rank === 2
                    ? 'bg-[#121D32] border-[#94A3B8]/30'
                    : item.rank === 3
                    ? 'bg-[#121D32] border-[#D97706]/30'
                    : 'bg-[#0E1626] border-[#1B2A44]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold font-mono text-xs ${
                    item.rank === 1
                      ? 'bg-[#F59E0B] text-black shadow-lg shadow-[#F59E0B]/30'
                      : item.rank === 2
                      ? 'bg-[#94A3B8] text-black'
                      : item.rank === 3
                      ? 'bg-[#B45309] text-white'
                      : 'bg-[#1F304E] text-[#94A3B8]'
                  }`}>
                    #{item.rank}
                  </div>
                  <span className="text-sm font-bold text-white">
                    {item.displayName}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-xs text-[#94A3B8]">
                    {item.correctCount || 0} Correct
                  </span>
                  <span className="text-sm font-black text-[#34D399] font-mono">
                    {item.score} pts
                  </span>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. FINAL PODIUM CELEBRATION PHASE */}
      {/* ------------------------------------------------------------- */}
      {status === 'COMPLETED' && podiumData && (
        <div className="dashboard-card p-8 md:p-12 text-center space-y-8 border-2 border-[#10B981]/40 bg-gradient-to-b from-[#10B981]/15 to-[#080D14] animate-fadeIn">
          
          <div>
            <Sparkles size={36} className="text-[#34D399] mx-auto animate-bounce mb-2" />
            <h2 className="text-3xl font-black text-white">Session Concluded!</h2>
            <p className="text-xs text-[#94A3B8] mt-1">Here are the top performers for this live assessment:</p>
          </div>

          {/* 3D Olympic Podium */}
          <div className="flex items-end justify-center gap-3 sm:gap-6 pt-6 pb-4">
            
            {/* 2nd Place */}
            {podiumData.second && (
              <div className="flex flex-col items-center space-y-2 w-28 sm:w-36 animate-fadeIn">
                <span className="text-xs font-bold text-[#94A3B8] truncate max-w-full">
                  {podiumData.second.displayName}
                </span>
                <span className="text-[11px] font-mono text-[#38BDF8] font-bold">
                  {podiumData.second.score} pts
                </span>
                <div className="w-full h-28 bg-[#1E293B] rounded-t-2xl border-t-4 border-[#94A3B8] flex items-center justify-center text-2xl font-black text-[#94A3B8] font-mono shadow-lg">
                  2
                </div>
              </div>
            )}

            {/* 1st Place (Winner) */}
            {podiumData.first && (
              <div className="flex flex-col items-center space-y-2 w-32 sm:w-44 animate-fadeIn">
                <Crown size={28} className="text-[#F59E0B] animate-pulse" />
                <span className="text-sm font-black text-white truncate max-w-full">
                  {podiumData.first.displayName}
                </span>
                <span className="text-xs font-mono text-[#F59E0B] font-extrabold">
                  {podiumData.first.score} pts
                </span>
                <div className="w-full h-40 bg-gradient-to-t from-[#F59E0B]/30 to-[#F59E0B]/60 rounded-t-2xl border-t-4 border-[#F59E0B] flex items-center justify-center text-4xl font-black text-white font-mono shadow-2xl shadow-[#F59E0B]/30">
                  1
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {podiumData.third && (
              <div className="flex flex-col items-center space-y-2 w-28 sm:w-36 animate-fadeIn">
                <span className="text-xs font-bold text-[#D97706] truncate max-w-full">
                  {podiumData.third.displayName}
                </span>
                <span className="text-[11px] font-mono text-[#38BDF8] font-bold">
                  {podiumData.third.score} pts
                </span>
                <div className="w-full h-20 bg-[#1A141A] rounded-t-2xl border-t-4 border-[#D97706] flex items-center justify-center text-xl font-black text-[#D97706] font-mono shadow-lg">
                  3
                </div>
              </div>
            )}

          </div>

          <div className="pt-4">
            <button
              onClick={onBack}
              className="btn-emerald-primary text-xs py-3 px-6 font-bold"
            >
              Return to Teacher Dashboard
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
