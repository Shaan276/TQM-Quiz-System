const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { getDatabase, setDatabaseInstance, closeDatabase } = require('./database');
const { runMigrations } = require('./database/migrations');
const { seedDemoAccounts } = require('./database/seeds');
const { initWebSocketServer } = require('./websocket');
const { securityHeaders } = require('./middleware/securityHeaders');
const { requestIdMiddleware } = require('./middleware/requestId');
const { logger } = require('./utils/logger');

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
const notificationRoutes = require('./routes/notifications');
const healthRoutes = require('./routes/health');

function createApp(customDb = null) {
  if (customDb) {
    setDatabaseInstance(customDb);
  }

  const app = express();

  // 1. Security Headers & Request Tracking
  app.use(securityHeaders);
  app.use(requestIdMiddleware);

  // 2. CORS configuration
  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      const allowedOrigins = Array.isArray(config.cors.origin) ? config.cors.origin : [config.cors.origin];
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked request from origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
  }));

  app.use(express.json({ limit: '5mb' }));

  // 3. Request Latency & Structured Access Logging
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
      if (!req.path.startsWith('/assets') && !req.path.startsWith('/health')) {
        logger.info(`${req.method} ${req.path}`, {
          requestId: req.id,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          latencyMs: parseFloat(elapsedMs.toFixed(2))
        });
      }
    });
    next();
  });

  // 4. Health and Readiness Probes
  app.use('/health', healthRoutes);
  app.use('/api/v1/health', healthRoutes);

  // 5. Mount API Endpoints
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
  app.use('/api/v1/notifications', notificationRoutes);

  // 6. Serve production client build if exists
  const clientDist = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // 7. Centralized Error Handling Middleware
  app.use((err, req, res, next) => {
    const statusCode = err.status || (err.message && err.message.startsWith('CORS blocked') ? 403 : 500);

    logger.error(`Error on ${req.method} ${req.path}`, {
      requestId: req.id,
      error: err.message,
      code: err.code || 'ERR_INTERNAL_SERVER'
    });

    const response = {
      success: false,
      error: {
        code: err.code || (statusCode === 403 ? 'ERR_FORBIDDEN' : 'ERR_INTERNAL_SERVER'),
        message: config.isProd && statusCode === 500
          ? 'An internal server error occurred. Please try again later.'
          : err.message || 'An unexpected error occurred',
        requestId: req.id
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
      // Validate production configuration
      const { valid, errors } = config.validateConfig();
      if (!valid) {
        console.error('[Startup] Critical Configuration Errors:');
        errors.forEach(err => console.error(`  - ${err}`));
        if (config.isProd) {
          console.error('[Startup] Aborting startup due to invalid production configuration.');
          process.exit(1);
        }
      }

      console.log('[Startup] Initializing Quiz System Database...');
      await runMigrations();
      await seedDemoAccounts();
      console.log('[Startup] Database migrations and demo accounts ready.');

      const app = createApp();
      const server = http.createServer(app);
      const wss = initWebSocketServer(server);

      server.listen(config.port, () => {
        logger.info(`Quiz System API & WebSocket Server listening at http://localhost:${config.port}`, {
          port: config.port,
          nodeEnv: config.nodeEnv
        });
      });

      // Graceful Shutdown
      const handleShutdown = async (signal) => {
        logger.info(`Received ${signal}. Initiating graceful shutdown...`);

        // Close WebSocket server
        if (wss) {
          try {
            wss.clients.forEach(client => {
              if (client.readyState === 1) { // OPEN
                client.close(1001, 'Server is shutting down');
              }
            });
            wss.close();
          } catch (e) {}
        }

        // Close HTTP server
        server.close(async () => {
          logger.info('HTTP server closed.');
          try {
            await closeDatabase();
            logger.info('Database connection closed cleanly.');
          } catch (e) {}
          process.exit(0);
        });

        // Force shutdown after 10s if hanging
        setTimeout(() => {
          logger.error('Graceful shutdown timed out. Forcing termination.');
          process.exit(1);
        }, 10000).unref();
      };

      process.on('SIGTERM', () => handleShutdown('SIGTERM'));
      process.on('SIGINT', () => handleShutdown('SIGINT'));

    } catch (err) {
      console.error('[Startup] Failed to start server:', err);
      process.exit(1);
    }
  })();
}

module.exports = { createApp, initWebSocketServer };
