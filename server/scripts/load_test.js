const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const { createApp } = require('../src/server');
const { runMigrations } = require('../src/database/migrations');
const { setDatabaseInstance } = require('../src/database');

async function runLoadBenchmark({ concurrentUsers = 20, iterationsPerUser = 5 } = {}) {
  console.log(`\n⚡ Starting Quiz System Production Load Benchmark`);
  console.log(`   Concurrent Virtual Users: ${concurrentUsers}`);
  console.log(`   Actions per User: ${iterationsPerUser}`);
  console.log(`   Total Operations: ${concurrentUsers * iterationsPerUser * 3}`);

  // In-memory test instance
  const db = new sqlite3.Database(':memory:');
  setDatabaseInstance(db);
  await runMigrations(db);

  const app = createApp(db);
  const server = http.createServer(app);

  const PORT = 5099;
  await new Promise(resolve => server.listen(PORT, resolve));
  const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;

  const latencies = [];
  let successfulRequests = 0;
  let failedRequests = 0;

  async function timedRequest(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const start = process.hrtime.bigint();
    try {
      const res = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
      });
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
      latencies.push(elapsedMs);

      if (res.ok) {
        successfulRequests++;
      } else {
        failedRequests++;
      }
      return { status: res.status, data: await res.json().catch(() => ({})) };
    } catch (e) {
      failedRequests++;
      return { status: 500, data: {} };
    }
  }

  const startTime = Date.now();

  // 1. Seed Teacher and Published Quiz
  const teacherReg = await timedRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Load Benchmark Teacher',
      email: 'teacher_load@benchmark.com',
      password: 'Password123!',
      passwordConfirmation: 'Password123!'
    })
  });

  // Promote to TEACHER
  await new Promise((resolve, reject) => {
    db.run("UPDATE users SET role = 'TEACHER' WHERE email = 'teacher_load@benchmark.com'", (err) => {
      if (err) reject(err); else resolve();
    });
  });

  const teacherToken = (await timedRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'teacher_load@benchmark.com', password: 'Password123!' })
  })).data?.data?.accessToken;

  // Create & publish benchmark quiz
  const quizRes = await timedRequest('/quizzes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}` },
    body: JSON.stringify({
      title: 'Performance Benchmark Quiz',
      category: 'TQM',
      difficulty: 'MEDIUM',
      pass_percentage: 60,
      questions: [
        {
          question_text: 'What is Six Sigma defect rate per million opportunities?',
          question_type: 'MCQ_SINGLE',
          marks: 10,
          options: [
            { option_key: 'A', option_text: '3.4 DPMO', is_correct: 1 },
            { option_key: 'B', option_text: '34 DPMO', is_correct: 0 }
          ]
        }
      ]
    })
  });

  const quizId = quizRes.data?.data?.quiz?.id;
  await timedRequest(`/quizzes/${quizId}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${teacherToken}` }
  });

  // 2. Simulate Concurrent User Traffic
  const userWorkers = Array.from({ length: concurrentUsers }, async (_, userIdx) => {
    const studentEmail = `student_${userIdx}_${Date.now()}@benchmark.com`;
    
    // Register
    await timedRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: `Student Load ${userIdx}`,
        email: studentEmail,
        password: 'Password123!',
        passwordConfirmation: 'Password123!'
      })
    });

    // Login
    const loginRes = await timedRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: studentEmail, password: 'Password123!' })
    });
    const studentToken = loginRes.data?.data?.accessToken;

    if (!studentToken) return;

    for (let i = 0; i < iterationsPerUser; i++) {
      // Start Attempt
      const startAttempt = await timedRequest('/attempts/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
        body: JSON.stringify({ quizId })
      });

      const attemptId = startAttempt.data?.data?.attemptId || startAttempt.data?.data?.attempt?.id;
      const q = startAttempt.data?.data?.questions?.[0];
      const optA = q?.options?.[0]?.id;

      if (attemptId && q && optA) {
        // Submit Answer
        await timedRequest(`/attempts/${attemptId}/submit`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${studentToken}` },
          body: JSON.stringify({
            answers: [{ questionId: q.id, answer: optA }]
          })
        });
      }

      // Check Dashboard
      await timedRequest('/quizzes/discover', {
        headers: { Authorization: `Bearer ${studentToken}` }
      });
    }
  });

  await Promise.all(userWorkers);

  const totalTimeSec = (Date.now() - startTime) / 1000;
  server.close();

  // Metrics computation
  latencies.sort((a, b) => a - b);
  const min = latencies[0] || 0;
  const max = latencies[latencies.length - 1] || 0;
  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const avg = (latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)) || 0;
  const totalRequests = successfulRequests + failedRequests;
  const throughputRps = totalTimeSec > 0 ? (totalRequests / totalTimeSec).toFixed(1) : 0;

  console.log(`\n======================================================`);
  console.log(`📊 PERFORMANCE LOAD TEST RESULTS`);
  console.log(`======================================================`);
  console.log(`Total Requests Handled:  ${totalRequests}`);
  console.log(`Successful Requests:     ${successfulRequests}`);
  console.log(`Failed Requests:         ${failedRequests} (${((failedRequests / totalRequests) * 100).toFixed(2)}%)`);
  console.log(`Total Elapsed Time:      ${totalTimeSec.toFixed(2)}s`);
  console.log(`Throughput:              ${throughputRps} requests/sec`);
  console.log(`Latency p50 (Median):    ${p50.toFixed(2)} ms`);
  console.log(`Latency p95:             ${p95.toFixed(2)} ms`);
  console.log(`Latency p99:             ${p99.toFixed(2)} ms`);
  console.log(`Latency Min / Max:       ${min.toFixed(2)} ms / ${max.toFixed(2)} ms`);
  console.log(`Average Latency:         ${avg.toFixed(2)} ms`);
  console.log(`======================================================\n`);

  return {
    totalRequests,
    successfulRequests,
    failedRequests,
    throughputRps,
    p50,
    p95,
    p99,
    avg
  };
}

if (require.main === module) {
  process.env.NODE_ENV = 'test';
  runLoadBenchmark()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Benchmark error:', err);
      process.exit(1);
    });
}

module.exports = { runLoadBenchmark };
