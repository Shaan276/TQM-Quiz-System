import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Clock, 
  Send, 
  Check, 
  X, 
  Award, 
  Sparkles, 
  Trophy, 
  Crown, 
  ArrowLeft, 
  AlertCircle,
  HelpCircle,
  CheckCircle2,
  Hourglass,
  Radio
} from 'lucide-react';

export default function LiveSessionView({ initialPin = '', onBack }) {
  const { accessToken, user } = useAuth();
  const [pin, setPin] = useState(initialPin || '');
  const [joined, setJoined] = useState(false);
  const [sessionMeta, setSessionMeta] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('DISCONNECTED'); // CONNECTING | CONNECTED | DISCONNECTED
  const [status, setStatus] = useState('JOIN'); // JOIN | LOBBY | STARTING | QUESTION_ACTIVE | QUESTION_ENDED | LEADERBOARD | COMPLETED
  const [countdownNum, setCountdownNum] = useState(3);
  
  // Question state
  const [question, setQuestion] = useState(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [multiSelected, setMultiSelected] = useState([]);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [answerResult, setAnswerResult] = useState(null);
  const [currentScore, setCurrentScore] = useState(0);
  const [myRank, setMyRank] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [podiumData, setPodiumData] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const wsRef = useRef(null);
  const timerRef = useRef(null);

  // Initialize or handle joining
  const handleConnectAndJoin = (pinToUse) => {
    const code = (pinToUse || pin).trim();
    if (!code || code.length < 4) {
      setErrorMessage('Please enter a valid session PIN');
      return;
    }
    setErrorMessage('');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '3000' ? `${window.location.hostname}:5000` : window.location.host;
    const wsUrl = `${protocol}//${host}/ws/live?token=${encodeURIComponent(accessToken)}`;

    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.close();
    }

    setConnectionStatus('CONNECTING');
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('CONNECTED');
      ws.send(JSON.stringify({
        event: 'join_session',
        payload: { joinCode: code, token: accessToken }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const { event: evt, payload, error } = msg;

        if (error) {
          setErrorMessage(error.message || 'An error occurred');
          return;
        }

        switch (evt) {
          case 'joined_session_success':
            setJoined(true);
            setSessionMeta(payload);
            setStatus(payload.status || 'LOBBY');
            break;

          case 'session_starting':
            setStatus('STARTING');
            setCountdownNum(payload.countdownSeconds || 3);
            break;

          case 'question_active':
            setStatus('QUESTION_ACTIVE');
            setQuestion(payload.question);
            setRemainingSeconds(payload.remainingSeconds);
            setIsAnswerSubmitted(payload.alreadyAnswered || false);
            setSelectedAnswer(payload.userAnswer || '');
            setMultiSelected([]);
            setAnswerResult(null);
            break;

          case 'answer_acknowledged':
            setIsAnswerSubmitted(true);
            break;

          case 'answer_rejected':
            setErrorMessage(payload.message || 'Answer could not be submitted');
            setIsAnswerSubmitted(false);
            break;

          case 'question_ended':
            setStatus('QUESTION_ENDED');
            setAnswerResult(payload);
            if (payload.currentTotalScore !== undefined) {
              setCurrentScore(payload.currentTotalScore);
            }
            break;

          case 'leaderboard_update':
            setStatus('LEADERBOARD');
            setLeaderboard(payload.leaderboard || []);
            setMyRank(payload.userRank || 0);
            if (payload.userScore !== undefined) {
              setCurrentScore(payload.userScore);
            }
            break;

          case 'podium_celebration':
            setStatus('COMPLETED');
            setPodiumData(payload);
            break;

          default:
            break;
        }
      } catch (err) {
        console.error('[LiveStudent] WS message error:', err);
      }
    };

    ws.onclose = () => {
      setConnectionStatus('DISCONNECTED');
    };

    ws.onerror = () => {
      setConnectionStatus('DISCONNECTED');
      setErrorMessage('Failed to connect to the live session gateway');
    };
  };

  useEffect(() => {
    if (initialPin && accessToken) {
      handleConnectAndJoin(initialPin);
    }
    return () => {
      if (wsRef.current && wsRef.current.readyState === 1) {
        wsRef.current.close();
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [initialPin, accessToken]);

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

  // Starting 3s visual countdown
  useEffect(() => {
    if (status === 'STARTING') {
      const interval = setInterval(() => {
        setCountdownNum(prev => (prev > 1 ? prev - 1 : 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status]);

  // Submit Answer handler
  const handleSubmitAnswer = (answerValue) => {
    if (isAnswerSubmitted || !question) return;
    const finalAnswer = answerValue !== undefined ? answerValue : selectedAnswer;

    if (finalAnswer === undefined || finalAnswer === null || String(finalAnswer).trim() === '') {
      return;
    }

    if (wsRef.current && wsRef.current.readyState === 1) {
      wsRef.current.send(JSON.stringify({
        event: 'submit_answer',
        sessionId: sessionMeta?.sessionId,
        payload: {
          sessionId: sessionMeta?.sessionId,
          questionId: question.id,
          answer: typeof finalAnswer === 'object' ? JSON.stringify(finalAnswer) : String(finalAnswer),
          clientTimestamp: Date.now()
        }
      }));
      setIsAnswerSubmitted(true);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      
      {/* Top Header Bar */}
      <div className="dashboard-card p-4 flex items-center justify-between border-b border-[#1B2A44]">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-xl bg-[#132238] border border-[#1F304E] flex items-center justify-center text-[#94A3B8] hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h2 className="text-sm font-extrabold text-white">
              {sessionMeta?.quizTitle || 'Live Multiplayer Quiz'}
            </h2>
            <p className="text-[11px] text-[#94A3B8]">
              {sessionMeta?.hostName ? `Host: ${sessionMeta.hostName}` : 'Self-Paced or Live Assessment'}
            </p>
          </div>
        </div>

        {joined && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#34D399] font-mono bg-[#10B981]/15 px-3 py-1 rounded-xl border border-[#10B981]/30">
              {currentScore} pts
            </span>
          </div>
        )}
      </div>

      {/* Error Message Toast */}
      {errorMessage && (
        <div className="dashboard-card p-3.5 border-l-4 border-l-[#F43F5E] text-xs text-[#FB7185] font-semibold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-[#94A3B8] hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. ENTER PIN VIEW (If not yet joined) */}
      {/* ------------------------------------------------------------- */}
      {!joined && (
        <div className="dashboard-card p-8 md:p-12 text-center space-y-6 border-2 border-[#10B981]/30 bg-gradient-to-b from-[#10B981]/10 to-[#0E1626] animate-fadeIn">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-[#10B981]/20 border border-[#10B981]/40 flex items-center justify-center text-[#34D399] shadow-xl shadow-[#10B981]/15">
            <Radio size={32} className="animate-pulse" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white">Join Live Quiz</h2>
            <p className="text-xs text-[#94A3B8]">
              Enter the Game Code displayed on your teacher's screen:
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleConnectAndJoin(pin); }} className="max-w-xs mx-auto space-y-4">
            <input
              type="text"
              maxLength={12}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9a-zA-Z]/g, '').toUpperCase())}
              placeholder="e.g. AJM63B17"
              className="w-full text-center tracking-widest text-2xl font-black font-mono py-3.5 px-4 rounded-2xl bg-[#0B111D] border-2 border-[#2D436B] focus:border-[#34D399] text-white outline-none placeholder:text-[#64748B]/50 transition-all"
              autoFocus
            />

            <button
              type="submit"
              disabled={pin.length < 4 || connectionStatus === 'CONNECTING'}
              className="w-full btn-emerald-primary text-base font-extrabold py-3.5 rounded-2xl shadow-xl shadow-[#10B981]/25 transition-all"
            >
              {connectionStatus === 'CONNECTING' ? 'Connecting...' : 'Join Game'}
            </button>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. LOBBY WAITING ROOM */}
      {/* ------------------------------------------------------------- */}
      {joined && status === 'LOBBY' && (
        <div className="dashboard-card p-10 text-center space-y-6 border border-[#10B981]/30 bg-[#0E1626] animate-fadeIn">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#10B981]/20 text-[#34D399] flex items-center justify-center border border-[#10B981]/40">
            <CheckCircle2 size={32} />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#34D399]">
              Connected to Game #{sessionMeta?.joinCode}
            </span>
            <h3 className="text-xl font-black text-white">You're in the Game!</h3>
            <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
              Please wait for your host <strong className="text-white">{sessionMeta?.hostName}</strong> to start the quiz.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#38BDF8] pt-2">
            <Hourglass size={14} className="animate-spin" />
            <span>Waiting for game launch...</span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. STARTING COUNTDOWN OVERLAY */}
      {/* ------------------------------------------------------------- */}
      {joined && status === 'STARTING' && (
        <div className="dashboard-card p-14 text-center space-y-4 border border-[#34D399]/40 bg-[#080D14] animate-fadeIn">
          <span className="text-xs font-bold text-[#34D399] uppercase tracking-widest">
            First Question Starting In
          </span>
          <div className="text-7xl font-black text-white font-mono animate-bounce text-[#34D399]">
            {countdownNum}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. QUESTION ACTIVE RUNNER */}
      {/* ------------------------------------------------------------- */}
      {joined && status === 'QUESTION_ACTIVE' && question && (
        <div className="dashboard-card p-6 md:p-8 space-y-6 animate-fadeIn">
          
          {/* Header & Synchronized Countdown Timer */}
          <div className="flex items-center justify-between pb-4 border-b border-[#1B2A44]">
            <span className="text-xs font-bold text-[#34D399] bg-[#10B981]/15 px-3 py-1 rounded-xl border border-[#10B981]/30">
              Q{question.questionIndex + 1} of {question.totalQuestions}
            </span>

            <div className={`flex items-center gap-2 px-3 py-1 rounded-xl font-mono text-sm font-black border ${
              remainingSeconds <= 5
                ? 'bg-[#F43F5E]/20 text-[#FB7185] border-[#F43F5E]/40 animate-pulse'
                : 'bg-[#121D32] text-[#38BDF8] border-[#1F304E]'
            }`}>
              <Clock size={15} />
              <span>{remainingSeconds}s</span>
            </div>
          </div>

          {/* Question Text */}
          <h3 className="text-lg md:text-xl font-bold text-white leading-relaxed">
            {question.question_text}
          </h3>

          {/* Interactive Answer Input based on Question Type */}
          {question.question_type === 'MCQ_SINGLE' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {(question.options || []).map((opt, i) => {
                const colors = [
                  'hover:border-[#F43F5E] hover:bg-[#F43F5E]/10',
                  'hover:border-[#38BDF8] hover:bg-[#38BDF8]/10',
                  'hover:border-[#F59E0B] hover:bg-[#F59E0B]/10',
                  'hover:border-[#10B981] hover:bg-[#10B981]/10'
                ];
                const isSelected = selectedAnswer === opt.id || selectedAnswer === opt.option_key;

                return (
                  <button
                    key={opt.id || i}
                    disabled={isAnswerSubmitted}
                    onClick={() => {
                      setSelectedAnswer(opt.id);
                      handleSubmitAnswer(opt.id);
                    }}
                    className={`p-4 rounded-2xl border text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-[#10B981]/25 border-[#10B981] text-white shadow-lg shadow-[#10B981]/10'
                        : `bg-[#121D32] border-[#1F304E] text-[#CBD5E1] ${colors[i % 4]}`
                    } ${isAnswerSubmitted ? 'cursor-not-allowed opacity-80' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-[#0B111D] flex items-center justify-center font-bold text-xs text-white">
                        {opt.option_key || String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-sm font-semibold">{opt.option_text}</span>
                    </div>
                    {isSelected && <Check size={18} className="text-[#34D399]" />}
                  </button>
                );
              })}
            </div>
          )}

          {question.question_type === 'MCQ_MULTI' && (
            <div className="space-y-3 pt-2">
              {(question.options || []).map((opt, i) => {
                const isChecked = multiSelected.includes(opt.id);
                return (
                  <button
                    key={opt.id || i}
                    disabled={isAnswerSubmitted}
                    onClick={() => {
                      const updated = isChecked
                        ? multiSelected.filter(id => id !== opt.id)
                        : [...multiSelected, opt.id];
                      setMultiSelected(updated);
                    }}
                    className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isChecked
                        ? 'bg-[#10B981]/20 border-[#10B981] text-white'
                        : 'bg-[#121D32] border-[#1F304E] text-[#CBD5E1] hover:border-[#38BDF8]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded bg-[#0B111D] flex items-center justify-center text-xs font-bold">
                        {opt.option_key || String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-xs font-semibold">{opt.option_text}</span>
                    </div>
                    {isChecked && <Check size={16} className="text-[#34D399]" />}
                  </button>
                );
              })}

              {!isAnswerSubmitted && (
                <button
                  onClick={() => handleSubmitAnswer(multiSelected)}
                  disabled={multiSelected.length === 0}
                  className="w-full btn-emerald-primary text-xs py-3 font-bold mt-2"
                >
                  Lock In Choices ({multiSelected.length} Selected)
                </button>
              )}
            </div>
          )}

          {question.question_type === 'TRUE_FALSE' && (
            <div className="grid grid-cols-2 gap-4 pt-2">
              {['True', 'False'].map(choice => {
                const isSelected = selectedAnswer.toLowerCase() === choice.toLowerCase();
                return (
                  <button
                    key={choice}
                    disabled={isAnswerSubmitted}
                    onClick={() => {
                      setSelectedAnswer(choice);
                      handleSubmitAnswer(choice);
                    }}
                    className={`py-6 rounded-2xl border text-center font-black text-lg transition-all ${
                      isSelected
                        ? 'bg-[#10B981]/25 border-[#10B981] text-white'
                        : 'bg-[#121D32] border-[#1F304E] text-[#CBD5E1] hover:border-[#38BDF8]'
                    }`}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          )}

          {['FILL_BLANK', 'SHORT_ANSWER', 'NUMERICAL'].includes(question.question_type) && (
            <div className="space-y-3 pt-2">
              <input
                type={question.question_type === 'NUMERICAL' ? 'number' : 'text'}
                step="any"
                disabled={isAnswerSubmitted}
                value={selectedAnswer}
                onChange={(e) => setSelectedAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="input-field text-sm py-3 font-mono"
              />
              {!isAnswerSubmitted && (
                <button
                  onClick={() => handleSubmitAnswer(selectedAnswer)}
                  disabled={!selectedAnswer.trim()}
                  className="w-full btn-emerald-primary text-xs py-3 font-bold"
                >
                  Submit Answer
                </button>
              )}
            </div>
          )}

          {/* Submission Confirmation Indicator */}
          {isAnswerSubmitted && (
            <div className="p-4 rounded-xl bg-[#0A1E1E] border border-[#10B981]/40 text-center space-y-1 animate-fadeIn">
              <span className="text-xs font-bold text-[#34D399] flex items-center justify-center gap-1.5">
                <CheckCircle2 size={16} /> Answer Locked In!
              </span>
              <p className="text-[11px] text-[#94A3B8]">
                Waiting for the timer to expire or for all classmates to finish answering...
              </p>
            </div>
          )}

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. QUESTION ENDED (Solution & Points Feedback) */}
      {/* ------------------------------------------------------------- */}
      {joined && status === 'QUESTION_ENDED' && answerResult && (
        <div className="dashboard-card p-6 md:p-8 space-y-6 text-center animate-fadeIn">
          
          <div className="w-16 h-16 mx-auto rounded-3xl flex items-center justify-center text-white shadow-xl">
            {answerResult.isCorrect ? (
              <div className="w-16 h-16 rounded-3xl bg-[#10B981] text-white flex items-center justify-center shadow-lg shadow-[#10B981]/30">
                <Check size={36} />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-3xl bg-[#F43F5E] text-white flex items-center justify-center shadow-lg shadow-[#F43F5E]/30">
                <X size={36} />
              </div>
            )}
          </div>

          <div>
            <h3 className="text-2xl font-black text-white">
              {answerResult.isCorrect ? 'Correct!' : 'Incorrect'}
            </h3>
            <p className="text-xs text-[#94A3B8] mt-1">
              +{answerResult.earnedScore} points earned this round
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#0E1626] border border-[#1B2A44] text-left text-xs space-y-2">
            <div>
              <span className="text-[#94A3B8] font-bold block">Correct Solution:</span>
              <span className="text-white font-mono font-bold text-sm">{answerResult.correctAnswer}</span>
            </div>
            {answerResult.explanation && (
              <p className="text-[#CBD5E1] pt-1 border-t border-[#1F304E]">
                {answerResult.explanation}
              </p>
            )}
          </div>

          <div className="text-xs text-[#64748B]">
            Waiting for teacher to reveal the round leaderboard...
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. LEADERBOARD VIEW */}
      {/* ------------------------------------------------------------- */}
      {joined && status === 'LEADERBOARD' && (
        <div className="dashboard-card p-6 md:p-8 space-y-6 animate-fadeIn">
          
          <div className="text-center space-y-1">
            <span className="text-[11px] font-bold text-[#F59E0B] uppercase tracking-wider flex items-center justify-center gap-1">
              <Trophy size={14} /> Leaderboard
            </span>
            <h3 className="text-xl font-black text-white">Round Standings</h3>
          </div>

          {/* Personal Rank Highlight Banner */}
          <div className="p-4 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#10B981] text-black font-black font-mono flex items-center justify-center text-base">
                #{myRank || '-'}
              </div>
              <div>
                <p className="text-xs font-bold text-white">Your Rank</p>
                <p className="text-[11px] text-[#34D399] font-medium">{user?.name}</p>
              </div>
            </div>
            <span className="text-base font-black text-white font-mono">
              {currentScore} pts
            </span>
          </div>

          {/* Top Leaderboard */}
          <div className="space-y-2 pt-2">
            {leaderboard.map((item, idx) => (
              <div
                key={item.id || idx}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                  item.userId === user?.id
                    ? 'bg-[#10B981]/10 border-[#10B981]/40 text-white'
                    : 'bg-[#121D32] border-[#1F304E] text-[#94A3B8]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-white w-5">#{item.rank}</span>
                  <span className="text-white truncate max-w-[150px]">{item.displayName}</span>
                </div>
                <span className="font-mono font-bold text-[#34D399]">{item.score} pts</span>
              </div>
            ))}
          </div>

          <div className="text-center text-xs text-[#64748B]">
            Waiting for next question...
          </div>

        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. FINAL PODIUM CELEBRATION */}
      {/* ------------------------------------------------------------- */}
      {joined && status === 'COMPLETED' && podiumData && (
        <div className="dashboard-card p-8 text-center space-y-6 border-2 border-[#10B981]/40 bg-gradient-to-b from-[#10B981]/15 to-[#080D14] animate-fadeIn">
          <Sparkles size={36} className="text-[#34D399] mx-auto animate-bounce" />
          <h2 className="text-2xl font-black text-white">Quiz Completed!</h2>

          <div className="p-4 rounded-2xl bg-[#0B111D] border border-[#1F304E] max-w-sm mx-auto space-y-1">
            <span className="text-xs text-[#94A3B8]">Your Final Score</span>
            <p className="text-3xl font-black text-[#34D399] font-mono">{currentScore} pts</p>
          </div>

          <button
            onClick={onBack}
            className="btn-emerald-primary text-xs py-3 px-6 font-bold"
          >
            Back to Learner Dashboard
          </button>
        </div>
      )}

    </div>
  );
}
