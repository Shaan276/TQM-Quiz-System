# Architecture Decision Records (ADRs)
## Canonical Records of Strategic Technical Decisions

---

### ADR-001: Adoption of Modular Monolith Architecture over Microservices
- **Status:** **APPROVED**
- **Date:** 2026-10-30
- **Context:** The platform requires low latency, rapid feature iteration, and real-time coordination across live multiplayer games, self-paced attempts, and analytics.
- **Decision:** Build the platform as a high-performance **Modular Monolith** in TypeScript (Node.js + PostgreSQL + Redis) rather than distributed microservices.
- **Consequences:**
  - *Positive:* Simplified deployment, zero network serialization overhead between modules, guaranteed ACID transaction boundaries for attempt submissions, single repository.
  - *Negative:* All modules share the same runtime deployment unit, requiring disciplined boundary enforcement in code.

---

### ADR-002: Strict Decoupling of Quiz, Session, and Attempt Entities
- **Status:** **APPROVED**
- **Date:** 2026-10-30
- **Context:** An educational platform requires reusing a single question bank across both live classroom competitions and asynchronous homework assignments.
- **Decision:** Mandate three distinct core domain entities:
  1. `Quiz`: Canonical content and default settings.
  2. `QuizSession`: Ephemeral or scheduled execution instance (Live Game PIN or Assignment deadline).
  3. `QuizAttempt`: Individual participant interaction and scores.
- **Consequences:**
  - *Positive:* A single quiz can be played live on Friday and assigned for homework over the weekend with zero content duplication. Historical attempts remain untainted by future quiz updates.

---

### ADR-003: Server-Authoritative Anti-Cheat Game Engine
- **Status:** **APPROVED**
- **Date:** 2026-10-30
- **Context:** Live competitive quizzes on web browsers are vulnerable to DevTools inspection (looking up answer keys in JSON payloads) and client-side clock tampering.
- **Decision:** The server is the exclusive source of truth:
  1. WebSocket payloads for active questions **never** include `is_correct` or explanations.
  2. All timers are calculated from server timestamps.
  3. Submissions are graded and stored server-side.
- **Consequences:**
  - *Positive:* Completely eliminates browser inspection cheating and clock manipulation.
  - *Negative:* Slightly higher server compute load during mass submit bursts, mitigated through in-memory Redis scoring caches.

---

### ADR-004: Redis Pub/Sub Backplane for Horizontal Socket Scaling
- **Status:** **APPROVED**
- **Date:** 2026-10-30
- **Context:** A single Node.js process has finite memory and CPU for maintaining persistent WebSocket connections during peak campus or corporate live sessions.
- **Decision:** Integrate `@socket.io/redis-adapter` backed by Redis 7 from day one.
- **Consequences:**
  - *Positive:* Multiple backend server pods can run behind an HAProxy/Nginx load balancer; room broadcasts automatically fan out across all pods transparently.
  - *Negative:* Introduces an operational dependency on a healthy Redis instance.

---

### ADR-005: Adoption of Nutri-Track Modern Dark Tech Aesthetic
- **Status:** **APPROVED**
- **Date:** 2026-10-30
- **Context:** The application requires a distinctive, professional brand identity that distinguishes it from overly cartoonish competitor interfaces while maintaining high contrast and game playability.
- **Decision:** Implement a sleek Dark Tech design system inspired by modern dashboard ergonomics (`#080D14` navy base, `#0E1626` floating card containers, glowing emerald `#10B981` action pills, and 4-color Kahoot game cards).
- **Consequences:**
  - *Positive:* Immediate visual sophistication, high readability, excellent contrast in darkened lecture halls.
