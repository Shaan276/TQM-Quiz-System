# Security Architecture & Data Protection Blueprint
## Threat Modeling, Authentication Guards, Anti-Cheat, and Compliance

---

### 1. Cryptographic Authentication & Session Security

1. **Password Storage:**
   - Hashed using **Argon2id** (OWASP recommended algorithm for password storage):
     - Memory cost: 64 MB ($m=65536$)
     - Iterations: $t=3$
     - Parallelism: $p=4$
     - Salt: 16 cryptographically random bytes.
   - Absolutely zero plain-text or single-iteration MD5/SHA256 password persistence.

2. **Token Lifecycle Architecture:**
   - **Access Token:** Short-lived JSON Web Token (JWT), 15-minute expiration, signed with asymmetric RSA/ECDSA or HMAC-SHA256 with 256-bit entropy keys. Transmitted in memory or secure request headers.
   - **Refresh Token:** Cryptographically random 256-bit token stored in an **`HttpOnly`**, **`Secure`**, **`SameSite=Strict`** cookie. Stored in database table `user_tokens` with automatic rotation upon every refresh.
   - When a user logs out, all associated refresh tokens are purged immediately from Redis and PostgreSQL.

---

### 2. Threat Model & Mitigation Matrix (Quiz-Specific Attack Vectors)

| Attack Scenario | Vulnerability / Threat Vector | Engineering Mitigation & Defense in Depth |
| :--- | :--- | :--- |
| **Inspect Element / DevTools Cheat** | Participant inspects Network tab or DOM to find the `correct_option` or answer key before submitting. | **Zero-Knowledge Payloads:** The server scrubs all answer keys, correct flags, and explanations before broadcasting `question_active`. The correct option is physically not present on the client device until the question closes. |
| **Timer / Latency Tampering** | Malicious participant modifies local system clock or injects manipulated `elapsed_seconds: 0.1` to game the speed bonus. | **Server-Authoritative Clock:** The server records `server_received_at - server_broadcast_at` using high-precision monotonous clock (`process.hrtime.bigint()`). Client-reported times are disregarded. |
| **Duplicate / Race-Condition Submissions** | Participant sends concurrent POST requests or socket events to be graded multiple times. | **Database Constraint & Redis Lock:** Table `attempt_answers` enforces `UNIQUE(attempt_id, question_id)`. First write commits; duplicate requests trigger SQL unique violation or are discarded by Redis idempotency locks. |
| **Cross-Tenant Data Leakage** | Student fetches attempt scores or grades belonging to other students. | **Row-Level Authorization Guard:** The API middleware verifies `WHERE attempt.user_id = req.user.id` unless the user holds the verified `TEACHER` or `ADMIN` role for that specific class session. |
| **Denial of Service / Socket Flooding** | Attacker floods session room with thousands of fake joining bots. | **Token-Bucket Rate Limiting:** Redis-backed rate limiter restricts joins to max 10 requests per IP per minute. Profanity filtering & regex sanitizer runs on all nicknames. |
| **SQL Injection (SQLi)** | Malicious SQL syntax injected via search query or question input. | **Strict Parameterization:** Zero string concatenation in database queries. Queries execute through Prisma / Drizzle ORM or parameterized prepared statements. |
| **Cross-Site Scripting (XSS)** | Malicious JavaScript injected via quiz question titles or option strings. | **Input Sanitization & React Auto-Escaping:** DOMPurify sanitizes rich text. React automatically escapes JSX string interpolation by default. Content-Security-Policy (CSP) headers block inline scripts. |

---

### 3. Role-Based Access Control (RBAC) Matrix

| Resource / Action | Anonymous Guest | Registered Student | Teacher / Host | Superadmin |
| :--- | :---: | :---: | :---: | :---: |
| **Join Live Game via PIN** | ✅ | ✅ | ✅ | ✅ |
| **View Own Quiz Score & History** | ❌ (Session Only) | ✅ (Personal Only) | ✅ | ✅ |
| **View Full Cohort Reports & Grades**| ❌ | ❌ | ✅ (Owned Quizzes) | ✅ (All) |
| **Create / Edit / Delete Quizzes** | ❌ | ❌ | ✅ | ✅ |
| **Add / Delete Question Bank Items**| ❌ | ❌ | ✅ | ✅ |
| **Access Personal Mistake Notebook** | ❌ | ✅ | ✅ | ✅ |
| **Inspect Audit Logs & Index Metrics**| ❌ | ❌ | ❌ | ✅ |

---

### 4. Privacy & Regulatory Compliance Readiness

1. **Right to Be Forgotten (Account Deletion):**
   - User account deletion scrubs personal identifiers (email, name, password hash).
   - Past attempt answers are anonymized (`user_id = NULL`, alias replaced with `Deleted User`) to preserve institutional statistical aggregates without retaining personally identifiable information (PII).
2. **Data Export:**
   - One-click GDPR / DPDP-ready JSON export endpoint providing user profile details, personal attempt history, and mistake notebook entries.
3. **No Third-Party Ad Trackers:**
   - Zero invasive marketing analytics or third-party pixels injected into participant live quiz interfaces, ensuring strict privacy protection for young learners and corporate trainees.
