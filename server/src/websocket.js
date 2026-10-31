const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { liveSessionManager } = require('./services/liveSessionManager');

/**
 * Initialize WebSocket Gateway attached to the HTTP server
 */
function initWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws/live' 
  });

  console.log('[WebSocket] Live Multiplayer Gateway mounted at /ws/live');

  wss.on('connection', (ws, req) => {
    // Parse query params for token if provided in connection URL: ws://host/ws/live?token=...
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const tokenFromQuery = url.searchParams.get('token');
    let authenticatedUser = null;

    if (tokenFromQuery) {
      try {
        authenticatedUser = jwt.verify(tokenFromQuery, config.jwt.accessSecret);
      } catch (e) {}
    }

    ws.on('message', async (messageData) => {
      try {
        const raw = messageData.toString();
        const msg = JSON.parse(raw);
        const { event, sessionId, payload = {} } = msg;

        // If client sends token in payload, authenticate or override
        if (payload.token) {
          try {
            authenticatedUser = jwt.verify(payload.token, config.jwt.accessSecret);
          } catch (e) {
            ws.send(JSON.stringify({
              event: 'error',
              error: { code: 'ERR_INVALID_TOKEN', message: 'Authentication token is invalid or expired' }
            }));
            return;
          }
        }

        // 1. Host Connect
        if (event === 'host_join') {
          if (!authenticatedUser) {
            ws.send(JSON.stringify({ event: 'error', error: { code: 'ERR_UNAUTHORIZED', message: 'Authentication required' } }));
            return;
          }
          try {
            liveSessionManager.registerHostSocket(sessionId || payload.sessionId, authenticatedUser, ws);
          } catch (err) {
            ws.send(JSON.stringify({ event: 'error', error: { code: 'ERR_HOST_FAILED', message: err.message } }));
          }
          return;
        }

        // 2. Participant Join
        if (event === 'join_session') {
          if (!authenticatedUser) {
            ws.send(JSON.stringify({ event: 'error', error: { code: 'ERR_UNAUTHORIZED', message: 'Authentication required to participate in live quiz' } }));
            return;
          }
          const joinCode = String(payload.joinCode || '').trim();
          if (!joinCode) {
            ws.send(JSON.stringify({ event: 'error', error: { code: 'ERR_INVALID_CODE', message: 'Join code is required' } }));
            return;
          }
          try {
            await liveSessionManager.joinParticipantSocket(joinCode, authenticatedUser, ws);
          } catch (err) {
            ws.send(JSON.stringify({ event: 'error', error: { code: 'ERR_JOIN_FAILED', message: err.message } }));
          }
          return;
        }

        // 3. Start Session (Host only)
        if (event === 'start_session') {
          if (!authenticatedUser) return;
          try {
            await liveSessionManager.startSession(sessionId || payload.sessionId, authenticatedUser.id);
          } catch (err) {
            ws.send(JSON.stringify({ event: 'error', error: { code: 'ERR_START_FAILED', message: err.message } }));
          }
          return;
        }

        // 4. Submit Answer (Participant only)
        if (event === 'submit_answer') {
          if (!authenticatedUser) return;
          const { questionId, answer, clientTimestamp } = payload;
          try {
            await liveSessionManager.submitAnswer(
              sessionId || payload.sessionId,
              authenticatedUser.id,
              questionId,
              answer,
              clientTimestamp || Date.now()
            );
          } catch (err) {
            ws.send(JSON.stringify({
              event: 'answer_rejected',
              sessionId,
              payload: { questionId, code: 'ERR_SUBMISSION_REJECTED', message: err.message }
            }));
          }
          return;
        }

        // 5. Show Leaderboard (Host only)
        if (event === 'show_leaderboard') {
          if (!authenticatedUser) return;
          try {
            await liveSessionManager.showLeaderboard(sessionId || payload.sessionId, authenticatedUser.id);
          } catch (err) {
            ws.send(JSON.stringify({ event: 'error', error: { code: 'ERR_LEADERBOARD_FAILED', message: err.message } }));
          }
          return;
        }

        // 6. Next Question (Host only)
        if (event === 'next_question') {
          if (!authenticatedUser) return;
          try {
            await liveSessionManager.nextQuestion(sessionId || payload.sessionId, authenticatedUser.id);
          } catch (err) {
            ws.send(JSON.stringify({ event: 'error', error: { code: 'ERR_NEXT_QUESTION_FAILED', message: err.message } }));
          }
          return;
        }

        // 7. Pause Session (Host only)
        if (event === 'pause_session') {
          if (!authenticatedUser) return;
          try {
            liveSessionManager.pauseSession(sessionId || payload.sessionId, authenticatedUser.id);
          } catch (err) {
            ws.send(JSON.stringify({ event: 'error', error: { code: 'ERR_PAUSE_FAILED', message: err.message } }));
          }
          return;
        }

        // 8. Resume Session (Host only)
        if (event === 'resume_session') {
          if (!authenticatedUser) return;
          try {
            liveSessionManager.resumeSession(sessionId || payload.sessionId, authenticatedUser.id);
          } catch (err) {
            ws.send(JSON.stringify({ event: 'error', error: { code: 'ERR_RESUME_FAILED', message: err.message } }));
          }
          return;
        }

        // 9. End Session (Host only)
        if (event === 'end_session') {
          if (!authenticatedUser) return;
          try {
            await liveSessionManager.endSession(sessionId || payload.sessionId, authenticatedUser.id);
          } catch (err) {
            ws.send(JSON.stringify({ event: 'error', error: { code: 'ERR_END_FAILED', message: err.message } }));
          }
          return;
        }

      } catch (err) {
        console.error('[WebSocket] Message handling error:', err);
      }
    });

    ws.on('close', () => {
      liveSessionManager.handleDisconnect(ws);
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Socket error:', err.message);
    });
  });

  return wss;
}

module.exports = { initWebSocketServer };
