# System Architecture & Component Design
## Modular Monolith Topology, Event Pipelines, and Domain Boundaries

---

### 1. System Context Diagram (C4 Level 1)

```mermaid
C4Context
    title System Context Diagram - Quiz & Assessment Platform

    Person(student, "Participant / Student", "Plays live multiplayer games or takes self-paced assignments.")
    Person(teacher, "Host / Creator", "Authors quizzes in Studio, launches live sessions, grades, and inspects reports.")
    Person(admin, "Platform Administrator", "Oversees system health, audit trails, and user management.")

    System(quizSystem, "Quiz System SaaS Platform", "Enables creation, real-time hosting, auto-grading, and analytics for interactive quizzes.")

    System_Ext(emailService, "Transactional Email Engine", "Delivers verification links, reports, and password reset tokens.")
    System_Ext(objectStore, "S3-Compatible Storage", "Stores question audio/images and report exports.")

    Rel(student, quizSystem, "Joins live games (WSS), submits attempts (HTTPS)")
    Rel(teacher, quizSystem, "Authors quizzes, manages sessions, inspects analytics (HTTPS/WSS)")
    Rel(admin, quizSystem, "Audits system transactions, configures settings (HTTPS)")
    Rel(quizSystem, emailService, "Dispatches emails via SMTP/REST")
    Rel(quizSystem, objectStore, "Uploads and serves media assets")
```

---

### 2. High-Level Component Architecture (C4 Level 2)

```mermaid
flowchart TB
    subgraph ClientTier ["Client Layer"]
        HostUI["Host / Creator Studio (React)"]
        PlayerUI["Participant Live Arena & Self-Paced UI (React)"]
        AdminUI["Admin & Analytics Cockpit (React)"]
    end

    subgraph GatewayTier ["Gateway & Security Boundary"]
        ReverseProxy["Nginx / Caddy Reverse Proxy"]
        RateLimiter["Rate Limiting & DDoS Shield (Redis Token Bucket)"]
        AuthMiddleware["JWT Authentication & RBAC Guard"]
    end

    subgraph AppTier ["Modular Monolith Application Core"]
        AuthModule["1. Auth & Identity Module"]
        QuizModule["2. Quiz & Question Studio"]
        SessionModule["3. Session Lifecycle Manager"]
        LiveEngine["4. Real-Time Game Orchestrator (Socket.io)"]
        ScoringEngine["5. Atomic Auto-Grading & Scoring Engine"]
        AssignmentModule["6. Assignment & Deadline Scheduler"]
        MistakeModule["7. Mistake Notebook & Smart Revision"]
        AnalyticsModule["8. Analytics & Report Generator"]
        AuditModule["9. Audit Logging & Poka-Yoke Telemetry"]
    end

    subgraph DataTier ["Persistence & Distributed State"]
        PG[(PostgreSQL 16 Primary Relational DB)]
        RedisCache[(Redis In-Memory Session Cache & Pub/Sub)]
    end

    ClientTier -->|HTTPS / WSS| ReverseProxy
    ReverseProxy --> RateLimiter
    RateLimiter --> AuthMiddleware
    AuthMiddleware --> AppTier

    SessionModule <--> LiveEngine
    LiveEngine --> ScoringEngine
    ScoringEngine --> MistakeModule
    AppTier --> PG
    AppTier --> RedisCache
    LiveEngine <..> RedisCache
```

---

### 3. Backend Domain Boundaries & Responsibility Matrix

| Module | Core Responsibilities | Dependencies | Data Access Pattern |
| :--- | :--- | :--- | :--- |
| **Auth & Identity** | Registration, login, password hashing (Argon2id), JWT issuance, refresh token rotation, role evaluation. | None | Synchronous ACID writes to `users`, `user_tokens`. |
| **Quiz Studio** | Authoring quizzes, question formulation, distractor management, validation, version incrementing. | Auth | Read/Write to `quizzes`, `questions`, `question_options`. |
| **Session Manager** | Creation of live session PINs, lifecycle state machines (`LOBBY` $\rightarrow$ `ACTIVE` $\rightarrow$ `FINISHED`), assignment scheduling. | Quiz Studio | Read/Write to `quiz_sessions`, Redis TTL storage. |
| **Live Game Engine** | WebSocket room management, pin-based joining, client connection heartbeats, synchronized question distribution. | Session Manager | Redis Pub/Sub, in-memory roster lookup. |
| **Scoring Engine** | Zero-latency answer evaluation, speed multiplier computation, streak adjustments, atomic attempt persistence. | Quiz, Session | High-frequency atomic inserts into `attempts`, `attempt_answers`. |
| **Mistake Notebook** | Automated recording of learner failure modes, spaced-repetition filtering, smart practice quiz synthesis. | Scoring Engine | Asynchronous event-driven write to `mistake_notebook`. |
| **Analytics Engine** | Item difficulty indexing, cohort pass rates, student gradebooks, audit transaction streaming. | Scoring, Session | Read-heavy queries with Redis caching layer. |

---

### 4. Live Multiplayer Quiz Lifecycle Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Host as Teacher / Host
    participant Server as Session & Live Engine
    participant Redis as Redis Cache / PubSub
    actor Student as Participant / Student
    participant DB as PostgreSQL DB

    Host->>Server: POST /api/v1/sessions (Create Live Session)
    Server->>DB: INSERT INTO quiz_sessions (status='LOBBY', pin='482910')
    Server->>Redis: SET session:482910 {quiz_id, host_id, state:'LOBBY'}
    Server-->>Host: {session_id, join_code: "482910"}

    Student->>Server: WS: join_session {join_code: "482910", alias: "Piyush"}
    Server->>Redis: SADD session:482910:roster "Piyush"
    Server-->>Host: WS: participant_joined {alias: "Piyush"}
    Server-->>Student: WS: joined_successfully {state: "LOBBY"}

    Host->>Server: WS: start_game {session_id}
    Server->>Redis: HSET session:482910 state 'ACTIVE', current_q: 1
    Server->>Student: WS: question_active {q_idx: 1, text, options: [A,B,C,D], time_limit: 20} (NO ANSWERS)
    Server->>Host: WS: question_active {q_idx: 1}

    Note over Student,Server: Participant selects Option B in 3.4 seconds
    Student->>Server: WS: submit_answer {q_id, selected_option: 'B', elapsed_sec: 3.4}
    Server->>Server: Validate submission within timer window & score atomically
    Server->>DB: INSERT INTO attempt_answers (is_correct, score, latency)
    Server-->>Student: WS: answer_acknowledged {status: "RECEIVED"}

    Note over Server: Question timer expires
    Server->>Host: WS: question_result {correct_option: 'B', distribution: {A:2, B:18, C:1, D:0}}
    Server->>Student: WS: question_result {correct_option: 'B', you_scored: 850, streak: 2}
    Server->>All: WS: leaderboard_update {top_5: [...]}
```

---

### 5. Self-Paced Quiz Lifecycle Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Self-Paced Student
    participant API as Assessment Engine
    participant Cache as Redis Cache
    participant DB as PostgreSQL DB

    Learner->>API: GET /api/v1/assignments/hw-math-101
    API->>DB: Check assignment deadline & existing user attempts
    API-->>Learner: {quiz_metadata, questions (without answers), duration_min: 30}

    Learner->>API: POST /api/v1/attempts/start {assignment_id}
    API->>DB: INSERT INTO quiz_attempts (status='IN_PROGRESS', started_at: NOW)
    API-->>Learner: {attempt_id, expires_at: NOW + 30m}

    Note over Learner,API: Student answers questions sequentially or revisits
    Learner->>API: POST /api/v1/attempts/:id/submit {answers: {q1:'A', q2:'C', ...}}
    API->>DB: Begin Atomic Transaction
    API->>DB: Grade all questions server-side against answer keys
    API->>DB: Calculate total score, percentage, pass/fail status
    API->>DB: UPDATE quiz_attempts SET status='COMPLETED', score=85
    API->>DB: INSERT INTO attempt_answers (attempt_id, q_id, selected, is_correct)
    API->>DB: Record wrong answers into mistake_notebook
    API->>DB: Commit Transaction
    API->>Cache: Invalidate student report cache
    API-->>Learner: {summary: {score: 85, status: 'PASSED'}, item_explanations: [...]}
```
