const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { getDatabase, setDatabaseInstance } = require('./database');
const { runMigrations } = require('./database/migrations');
const { seedDemoAccounts } = require('./database/seeds');
const { initWebSocketServer } = require('./websocket');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const quizRoutes = require('./routes/quizzes');
const questionBankRoutes = require('./routes/questionBank');
const attemptRoutes = require('./routes/attempts');
const mistakeRoutes = require('./routes/mistakes');
const analyticsRoutes = require('./routes/analytics');
const liveSessionRoutes = require('./routes/liveSessions');
const institutionRoutes = require('./routes/institutions');
const assignmentRoutes = require('./routes/assignments');

function createApp(customDb = null) {
  if (customDb) {
    setDatabaseInstance(customDb);
  }

  const app = express();

  // Middleware
  app.use(cors({
    origin: config.cors.origin,
    credentials: true
  }));
  app.use(express.json());

  // Request Latency Tracker
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
      if (config.isDev && !req.path.startsWith('/assets')) {
        console.log(`[HTTP] ${req.method} ${req.path} - ${res.statusCode} (${elapsedMs.toFixed(2)} ms)`);
      }
    });
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // Mount API Endpoints
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', userRoutes);
  app.use('/api/v1/quizzes', quizRoutes);
  app.use('/api/v1/question-bank', questionBankRoutes);
  app.use('/api/v1/attempts', attemptRoutes);
  app.use('/api/v1/mistakes', mistakeRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/live-sessions', liveSessionRoutes);
  app.use('/api/v1/institutions', institutionRoutes);
  app.use('/api/v1/assignments', assignmentRoutes);

  // Serve production client build if exists
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Centralized Error Handling Middleware
  app.use((err, req, res, next) => {
    console.error(`[Error] Unhandled error on ${req.method} ${req.path}:`, err);

    const statusCode = err.status || 500;
    const response = {
      success: false,
      error: {
        code: err.code || 'ERR_INTERNAL_SERVER',
        message: err.message || 'An unexpected internal error occurred'
      }
    };

    if (config.isDev) {
      response.error.stack = err.stack;
    }

    res.status(statusCode).json(response);
  });

  return app;
}

// Server startup if run directly
if (require.main === module) {
  (async () => {
    try {
      console.log('[Startup] Initializing Quiz System Database...');
      await runMigrations();
      await seedDemoAccounts();
      console.log('[Startup] Database migrations and demo accounts ready.');

      const app = createApp();
      const server = http.createServer(app);
      initWebSocketServer(server);

      server.listen(config.port, () => {
        console.log(`[Startup] Quiz System API & WebSocket Server listening at http://localhost:${config.port}`);
      });
    } catch (err) {
      console.error('[Startup] Failed to start server:', err);
      process.exit(1);
    }
  })();
}

module.exports = { createApp, initWebSocketServer };

module.exports = { createApp };
