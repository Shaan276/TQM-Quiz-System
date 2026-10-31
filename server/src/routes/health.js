const express = require('express');
const { dbGet } = require('../database');
const config = require('../config');

const router = express.Router();

/**
 * GET /api/v1/health (Liveness Probe)
 * Confirms process is running and accepting HTTP requests
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'UP',
    version: '1.0.0',
    environment: config.nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/v1/health/ready (Readiness Probe)
 * Verifies underlying database connectivity, memory constraints, and readiness for production traffic
 */
router.get('/ready', async (req, res) => {
  const startTime = Date.now();
  let dbStatus = 'DOWN';
  let dbLatencyMs = null;

  try {
    const dbStart = Date.now();
    const result = await dbGet('SELECT 1 AS live');
    if (result && result.live === 1) {
      dbStatus = 'UP';
      dbLatencyMs = Date.now() - dbStart;
    }
  } catch (err) {
    dbStatus = 'ERROR';
  }

  const memoryUsage = process.memoryUsage();
  const isHealthy = dbStatus === 'UP';

  const responsePayload = {
    status: isHealthy ? 'READY' : 'NOT_READY',
    checks: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs
      },
      memory: {
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024)
      }
    },
    totalLatencyMs: Date.now() - startTime,
    timestamp: new Date().toISOString()
  };

  if (!isHealthy) {
    return res.status(503).json(responsePayload);
  }

  res.status(200).json(responsePayload);
});

module.exports = router;
