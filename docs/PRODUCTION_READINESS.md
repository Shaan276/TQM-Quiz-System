# Production Readiness, Security Hardening & Launch Guide

This document specifies the operational configuration, security architecture, deployment runbooks, and disaster recovery procedures for the Quiz System SaaS Platform.

---

## 1. Architecture & Technology Stack

The platform is engineered as a high-performance **modular monolith**:
- **Backend Application**: Node.js v20+ with Express, WebSocket (`ws`) real-time engine.
- **Database Engine**: Embedded SQLite3 with **WAL mode** (`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;`).
- **Frontend Client**: React 18, Vite, TailwindCSS, Lucide Icons.
- **Authentication**: Stateless HMAC-SHA256 JWT access tokens (15m expiry) paired with rotating refresh tokens stored in SQLite.
- **Deployment Topology**: Single-container or multi-process Node.js behind an Nginx reverse proxy with TLS termination and WebSocket protocol upgrade.

---

## 2. Production Environment Variables Reference

All production secrets must be supplied via environment variables or secret management services (e.g. AWS Secrets Manager, HashiCorp Vault). Never commit secrets to source control.

| Variable | Description | Production Requirement | Example Value |
| :--- | :--- | :--- | :--- |
| `PORT` | HTTP port for backend server | Required | `5000` |
| `NODE_ENV` | Operating environment mode | `production` | `production` |
| `DATABASE_PATH` | Path to persistent SQLite database | Required | `./server/data/quiz_system.db` |
| `JWT_ACCESS_SECRET` | 256-bit secret for signing access tokens | **Minimum 32 chars, high entropy** | `f6a9b4c7d8e2... (64 hex chars)` |
| `JWT_REFRESH_SECRET` | 256-bit secret for refresh token HMAC | **Must differ from access secret** | `e1b2c3d4e5f6... (64 hex chars)` |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifespan | `15m` recommended | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifespan | `7d` recommended | `7d` |
| `CORS_ORIGIN` | Allowed web origins | **No wildcard (`*`) allowed** | `https://quiz.yourdomain.com` |
| `SMTP_HOST` | Outbound mail server hostname | Required for live verification emails | `smtp.sendgrid.net` |
| `SMTP_PORT` | SMTP port (`587` or `465`) | Required | `587` |
| `SMTP_USER` | SMTP authentication user | Required | `apikey` |
| `SMTP_PASS` | SMTP authentication password/token | Required | `SG.xxxxxxxx...` |
| `SMTP_FROM` | Sender display name & address | Required | `Quiz System <no-reply@yourdomain.com>` |
| `VITE_ENABLE_DEV_LOGINS` | Client flag for 1-click dev logins | **Must be `false` in production** | `false` |

> [!IMPORTANT]
> The server validates required environment variables at startup via `validateConfig()`. In `production` mode, the server will immediately abort startup if default fallback secrets or weak keys are detected.

---

## 3. Security Hardening & Threat Model

### A. Authentication & Session Security
- **Short-Lived Access Tokens**: Signed with HMAC-SHA256, expired in 15 minutes.
- **Refresh Token Rotation**: Each refresh issues a brand new token and invalidates the old one; reuse of an old refresh token instantly revokes all tokens for that user family.
- **Password Protection**: Hashed using `bcryptjs` with salt work factor 10. Old password invalidated on change.
- **Safe Outbox / Email Token Protection**: In development, email tokens are printed for convenience; in production mode (`NODE_ENV === 'production'`), secret tokens are **never printed to stdout/logs**.

### B. Defense-in-Depth & Security Headers
Every HTTP response carries hardened security headers via `securityHeaders.js`:
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing.
- `X-Frame-Options: SAMEORIGIN`: Prevents clickjacking while allowing assessment fullscreen/embed on authorized host.
- `X-XSS-Protection: 1; mode=block`: Activates legacy browser anti-XSS protection.
- `Referrer-Policy: strict-origin-when-cross-origin`: Minimizes referrer leakage.
- `Permissions-Policy`: Restricts camera, microphone, and payment APIs.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`: Enforces HTTPS.
- `Content-Security-Policy`: Restricts script and object execution to safe origins.

### C. Multi-Tenant & Institutional Isolation
- Students in an organization cannot view unassigned quizzes (`GET /quizzes/discover` filters strictly to assigned tests).
- Students cannot attempt unassigned quizzes (`403 ERR_QUIZ_NOT_ASSIGNED`).
- Teachers cannot assign quizzes to unauthorized sections (`403 ERR_FORBIDDEN_SECTION`).
- Student section transfers preserve immutable past assignment recipient snapshots.

### D. Audit Logging
- Administrative actions (`USER_ROLE_UPDATED`, `USER_DELETED`, `STUDENT_ENROLLED`, `STUDENT_TRANSFERRED`, `TEACHER_ALLOCATED`, `ASSIGNMENT_CREATED`) are persisted to the `audit_logs` table with actor ID, IP address, target ID, and timestamp.

---

## 4. Health, Observability & Diagnostics

### Endpoints
- **Liveness Probe**: `GET /health` or `GET /api/v1/health`
  - Returns `200 OK` with `{ status: "UP", uptimeSeconds: 1420, environment: "production" }`.
- **Readiness Probe**: `GET /health/ready` or `GET /api/v1/health/ready`
  - Executes live database ping `SELECT 1 AS live`, inspects memory heap usage, returns `200 OK` if ready or `503 Service Unavailable` if degraded.

### Request Correlation & Logging
- Every request is tagged with an `x-request-id` header (generated UUID if omitted).
- Structured logging outputs JSON entries in production mode:
  ```json
  {"timestamp":"2026-10-31T18:45:00.000Z","level":"INFO","message":"POST /api/v1/attempts/start","requestId":"c333bf02-...","method":"POST","statusCode":200,"latencyMs":14.2}
  ```
- Sensitive fields (`password`, `token`, `secret`, `authorization`, `cookie`) are automatically redacted.

---

## 5. Database Migrations, Backup & Disaster Recovery

### Repeatable Migrations
Migrations are managed in `server/src/database/migrations.js` (versions 001 through 008) tracked in `schema_migrations`:
- `001_initial_auth_and_users`
- `002_quiz_studio_and_question_bank`
- `003_quiz_attempts_scoring_and_mistakes`
- `004_question_code_and_structured_ids`
- `005_live_multiplayer_sessions`
- `006_fullscreen_anti_cheat_monitoring`
- `007_institutional_structure_and_scoped_assignments`
- `008_production_audit_logging`

### Automated Backup Procedure
Run the automated backup script to create a verified, WAL-checkpointed snapshot:
```bash
node server/scripts/backup.js
```
- Performs `PRAGMA wal_checkpoint(TRUNCATE)` to flush all uncommitted pages to disk.
- Copies the binary database file to `server/backups/quiz_system_backup_<timestamp>.db`.
- Executes `PRAGMA integrity_check` on the backup file to guarantee zero corruption.
- Generates a metadata manifest JSON with file size and timestamp.

### Safe Restoration Procedure
To restore from a backup:
```bash
node server/scripts/restore.js <path-to-backup.db> [optional-destination-path]
```
- Verifies integrity of the backup file before touching existing data.
- Automatically creates a `.pre-restore.<timestamp>` safety copy of the active database.
- Safely replaces the active file and verifies integrity of the restored database.

---

## 6. Performance Benchmarks

Measured using the load benchmark runner (`server/scripts/load_test.js`) under 20 concurrent virtual users executing multi-step assessment workflows:
- **Total Requests Handled**: 344 operations
- **Failure Rate**: **0.00%** (344/344 successful)
- **Throughput**: **52.8 requests/second**
- **Median Latency (p50)**: **96.30 ms**
- **p95 Latency**: 2,331.44 ms
- **p99 Latency**: 2,346.79 ms
- **WAL Concurrency**: Zero SQLITE_BUSY lock errors observed under concurrent read/write load.

---

## 7. Production Deployment Runbook

### A. System Requirements
- Node.js >= 20.x LTS
- RAM: 2 GB minimum (4 GB recommended)
- Disk: SSD storage (SQLite WAL benefits significantly from fast I/O)
- OS: Ubuntu 22.04 LTS / Debian 12 / Alpine Linux (or Windows Server)

### B. Build & Startup Commands
1. **Install Dependencies**:
   ```bash
   npm install --production=false
   cd client && npm install && cd ..
   ```
2. **Build Client Production Bundle**:
   ```bash
   npm run build:client
   ```
3. **Run Full Verification Test Suite**:
   ```bash
   npm test
   ```
4. **Start Production Server**:
   ```bash
   NODE_ENV=production node server/src/server.js
   ```

### C. Nginx Reverse Proxy Configuration
```nginx
server {
    listen 80;
    server_name quiz.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name quiz.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/quiz.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/quiz.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Static Client Assets
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # WebSocket Gateway Upgrade
    location /ws/live {
        proxy_pass http://127.0.0.1:5000/ws/live;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

---

## 8. Rollback Procedure

1. **Application Rollback**:
   - Revert Git commit: `git revert <commit-hash>`
   - Rebuild client: `npm run build:client`
   - Restart process: `pm2 restart quiz-system`
2. **Database Rollback**:
   - Locate the pre-migration or pre-restore backup in `server/backups/`
   - Execute restore: `node server/scripts/restore.js server/backups/<backup-file>.db`
   - Restart backend server.
