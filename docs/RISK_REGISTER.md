# Risk Register & Failure Modes and Effects Analysis (FMEA)
## Identified Architectural Threats, RPN Scoring, and Prevention Countermeasures

---

### 1. Risk Evaluation & FMEA Scoring Methodology
Risks are ranked according to standard TQM Risk Priority Number (RPN) methodology:
$$\text{RPN} = \text{Severity (1-10)} \times \text{Occurrence (1-10)} \times \text{Detection (1-10)}$$
- **Severity (S):** Impact on user trust, exam validity, or system downtime.
- **Occurrence (O):** Probability of the failure mode manifesting under real-world usage.
- **Detection (D):** Difficulty of discovering the defect before it affects users (10 = undetectable until user reports).

---

### 2. Risk Register & FMEA Matrix

| ID | Failure Mode / Architectural Risk | Root Cause | S | O | D | RPN | Pre-Emptive Architectural Countermeasure |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **R-01** | **Participant inspects answer keys in browser DevTools** | Server broadcasts complete question object containing `correct_option` to client sockets. | **10** | **8** | **3** | **240** | **Anti-Cheat Payload Sanitization:** Server models strictly separate `QuestionPresentationDto` (text, options) from `QuestionGradingKey` (is_correct). Keys are never transmitted until question closes. |
| **R-02** | **Duplicate attempt scoring via rapid double-clicking** | Network latency jitter causes client to fire two submit requests before UI disables submit button. | **8** | **7** | **3** | **168** | **Database Unique Constraint + Idempotency:** Enforce `UNIQUE(attempt_id, question_id)` in database; wrap writes in atomic transaction; client disables button on first click. |
| **R-03** | **WebSocket server crash causes all live games to terminate** | Single Node.js thread unhandled exception or memory leak aborts process. | **9** | **3** | **4** | **108** | **Redis Session Persistence + Process Supervisor:** In-flight room state resides in Redis (not local process heap). PM2/Docker restarts node in $< 2\text{s}$; clients auto-reconnect using reconnect tokens. |
| **R-04** | **Full table scans freeze UI as database scales** | Unindexed `created_at` or `user_id` columns in attempts table. | **7** | **6** | **2** | **84** | **Mandatory B-Tree Indexes:** Pragma enforcement of `idx_attempts_created_at_desc` and `idx_questions_quiz_id`. Query plan CI checks fail if sequential scans detected. |
| **R-05** | **Author deletes or modifies quiz during an active session** | Host edits answer keys or drops questions while students are actively answering. | **8** | **3** | **3** | **72** | **Version Snapshotting & Restrict Constraints:** Active sessions link to immutable question snapshots. Foreign keys enforce `ON DELETE RESTRICT` preventing active quiz deletion. |
| **R-06** | **Host system clock skew misaligns question timers** | Host machine has incorrect system time or clock drift. | **6** | **4** | **2** | **48** | **Server-Authoritative Clock:** Client system clocks are completely ignored. All duration timers are computed relative to server monotonic clock (`hrtime`). |
| **R-07** | **Student accesses unauthorized peer scores** | Inadequate row-level authorization filter on attempts API. | **8** | **2** | **2** | **32** | **Tenant & User Authorization Guards:** Middleware verifies `attempt.user_id === authenticated_user.id` on all individual score endpoints. |
